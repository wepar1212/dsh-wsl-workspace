import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { posix } from "node:path";
//#region lib/types/wsl.js
/** Windows-side WSL discovery and UNC directory listing helpers. */
const WSL_COMMAND_TIMEOUT_MS = 1e4;
const WSL_COMMAND_OUTPUT_LIMIT = 1048576;
const DIRECTORY_LIMIT = 1e3;
/** Decode wsl.exe output, which is UTF-16LE on some Windows builds and UTF-8 on others. */
function decodeWslOutput(value) {
	const sample = value.subarray(0, Math.min(value.length, 128));
	let zeroOddBytes = 0;
	for (let index = 1; index < sample.length; index += 2) if (sample[index] === 0) zeroOddBytes += 1;
	return (value.length >= 2 && (value[0] === 255 && value[1] === 254 || zeroOddBytes >= Math.max(2, Math.floor(sample.length / 8))) ? value.toString("utf16le") : value.toString("utf8")).replace(/^\uFEFF/, "").replaceAll("\0", "");
}
/** Parse the quiet distribution list without inventing a default distribution. */
function parseDistributionList(value) {
	const seen = /* @__PURE__ */ new Set();
	const distributions = [];
	for (const line of decodeWslOutput(value).split(/\r?\n/u)) {
		const name = line.trim();
		if (name === "" || seen.has(name)) continue;
		seen.add(name);
		distributions.push(name);
	}
	return distributions;
}
/** Normalize an absolute Linux directory path; relative paths are rejected. */
function normalizeLinuxPath(value) {
	if (!value.startsWith("/") || value.includes("\\") || value.includes("\0")) throw new Error("WSL directory path must be an absolute Linux path");
	return posix.normalize(value);
}
/** Reject characters that can escape or change one UNC distribution segment. */
function validateDistributionName(value) {
	const name = value.trim();
	if (name === "" || name === "." || name === ".." || /[<>:"/\\|?*\u0000-\u001f]/u.test(name)) throw new Error("invalid WSL distribution name");
	return name;
}
/** Convert one distribution and Linux path into a Windows WSL UNC path. */
function wslUncPath(server, distribution, linuxPath) {
	const name = validateDistributionName(distribution);
	const normalized = normalizeLinuxPath(linuxPath);
	return `\\\\${server}\\${name}${normalized === "/" ? "" : `\\${normalized.slice(1).split("/").join("\\")}`}`;
}
function runWsl(args) {
	return new Promise((resolve, reject) => {
		const child = spawn("wsl.exe", [...args], {
			windowsHide: true,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		const stdout = [];
		const stderr = [];
		let outputBytes = 0;
		let settled = false;
		const settle = (action) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			action();
		};
		const append = (target, chunk) => {
			outputBytes += chunk.length;
			if (outputBytes > WSL_COMMAND_OUTPUT_LIMIT) {
				child.kill();
				settle(() => {
					reject(/* @__PURE__ */ new Error("wsl.exe output exceeded 1 MiB"));
				});
				return;
			}
			target.push(chunk);
		};
		const timeout = setTimeout(() => {
			child.kill();
			settle(() => {
				reject(/* @__PURE__ */ new Error("wsl.exe did not respond within 10 seconds"));
			});
		}, WSL_COMMAND_TIMEOUT_MS);
		child.stdout.on("data", (chunk) => {
			append(stdout, chunk);
		});
		child.stderr.on("data", (chunk) => {
			append(stderr, chunk);
		});
		child.once("error", (error) => {
			settle(() => {
				reject(error);
			});
		});
		child.once("close", (exitCode) => {
			settle(() => {
				resolve({
					exitCode,
					stdout: Buffer.concat(stdout),
					stderr: Buffer.concat(stderr)
				});
			});
		});
	});
}
/** Read installed WSL distributions from the Windows Host. */
async function listWslDistributions() {
	if (process.platform !== "win32") return {
		available: false,
		distributions: [],
		message: "WSL workspaces require a Windows Host."
	};
	try {
		const result = await runWsl(["--list", "--quiet"]);
		if (result.exitCode !== 0) {
			const diagnostic = decodeWslOutput(result.stderr).trim();
			return {
				available: false,
				distributions: [],
				message: diagnostic === "" ? "WSL is unavailable on this Windows Host." : diagnostic
			};
		}
		const distributions = parseDistributionList(result.stdout);
		return distributions.length === 0 ? {
			available: false,
			distributions: [],
			message: "No WSL distribution is installed."
		} : {
			available: true,
			distributions,
			message: null
		};
	} catch (error) {
		return {
			available: false,
			distributions: [],
			message: error instanceof Error ? error.message : String(error)
		};
	}
}
async function directoryNames(windowsPath) {
	const entries = await readdir(windowsPath, { withFileTypes: true });
	const names = [];
	for (const entry of entries) {
		if (entry.name.includes("\\")) continue;
		if (entry.isDirectory()) {
			names.push(entry.name);
			continue;
		}
		if (!entry.isSymbolicLink()) continue;
		try {
			if ((await stat(`${windowsPath}\\${entry.name}`)).isDirectory()) names.push(entry.name);
		} catch {}
	}
	return names.sort((left, right) => left.localeCompare(right)).slice(0, 1001);
}
/** List one WSL directory through the preferred UNC server with the legacy alias as fallback. */
async function listWslDirectory(distribution, linuxPath) {
	if (process.platform !== "win32") throw new Error("WSL workspaces require a Windows Host");
	const name = validateDistributionName(distribution);
	const normalized = normalizeLinuxPath(linuxPath);
	const preferred = wslUncPath("wsl.localhost", name, normalized);
	const fallback = wslUncPath("wsl$", name, normalized);
	let windowsPath = preferred;
	let names;
	try {
		names = await directoryNames(preferred);
	} catch (preferredError) {
		try {
			names = await directoryNames(fallback);
			windowsPath = fallback;
		} catch {
			throw new Error(`Cannot read WSL directory ${name}:${normalized}`, { cause: preferredError });
		}
	}
	const truncated = names.length > DIRECTORY_LIMIT;
	const directories = (truncated ? names.slice(0, DIRECTORY_LIMIT) : names).map((child) => ({
		name: child,
		linuxPath: posix.join(normalized, child)
	}));
	return {
		distribution: name,
		linuxPath: normalized,
		parentLinuxPath: normalized === "/" ? null : posix.dirname(normalized),
		windowsPath,
		directories,
		truncated
	};
}
//#endregion
//#region lib/types/index.js
/** Remote Host gateway for WSL distribution discovery and directory listing. */
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Remote-only gateway used by the WSL workspace browser. */
let WslWorkspaceGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listDistributions_decorators;
	let _listDirectory_decorators;
	return class WslWorkspaceGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listDistributions_decorators = [Remote("listDistributions")];
			_listDirectory_decorators = [Remote("listDirectory")];
			__esDecorate(this, null, _listDistributions_decorators, {
				kind: "method",
				name: "listDistributions",
				static: false,
				private: false,
				access: {
					has: (obj) => "listDistributions" in obj,
					get: (obj) => obj.listDistributions
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listDirectory_decorators, {
				kind: "method",
				name: "listDirectory",
				static: false,
				private: false,
				access: {
					has: (obj) => "listDirectory" in obj,
					get: (obj) => obj.listDirectory
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		constructor(ctx) {
			super(ctx, "wslWorkspace");
			__runInitializers(this, _instanceExtraInitializers);
		}
		/**
		* Enumerate distributions installed for the Windows account running DSH.
		* @returns availability, distribution names, and an operator-facing failure when unavailable.
		*/
		listDistributions() {
			return listWslDistributions();
		}
		/**
		* List one absolute Linux directory in a WSL distribution.
		* @param distribution - installed distribution name.
		* @param linuxPath - absolute Linux directory path.
		* @returns the normalized path, Windows UNC workspace path, and direct children.
		*/
		listDirectory(distribution, linuxPath) {
			return listWslDirectory(distribution, linuxPath);
		}
	};
})();
//#endregion
export { WslWorkspaceGateway, WslWorkspaceGateway as default };
