import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { posix } from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
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
/** Parse a Windows WSL UNC workspace path back into its Linux target. */
function parseWslUncPath(value) {
	const match = /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(?:\\(.*))?$/iu.exec(value.trim());
	if (match === null || match[1] === void 0) return void 0;
	const linuxPath = match[2] === void 0 || match[2] === "" ? "/" : `/${match[2].split("\\").join("/")}`;
	return {
		distribution: validateDistributionName(match[1]),
		linuxPath: normalizeLinuxPath(linuxPath)
	};
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
//#region lib/types/wsl-command.js
/** Model-facing WSL command bridge for WSL-backed workspaces. */
const DEFAULT_TIMEOUT_MS = 12e4;
const MAX_TIMEOUT_MS = 9e5;
const OUTPUT_MAX_BYTES = 262144;
const OUTPUT_SPILL_MAX_BYTES = 2097152;
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function targetFromPath(value) {
	if (value === void 0 || value.trim() === "") return void 0;
	return parseWslUncPath(value);
}
function resolveTarget(args, exec) {
	const sessionCwd = exec.agent?.session.header.cwd;
	const sessionTarget = targetFromPath(sessionCwd);
	const requestedWorkdir = args.workdir?.trim();
	const requestedTarget = targetFromPath(requestedWorkdir);
	const explicitDistribution = args.distribution === void 0 ? void 0 : validateDistributionName(args.distribution);
	if (requestedWorkdir !== void 0 && requestedTarget === void 0 && !requestedWorkdir.startsWith("/")) throw new Error("WSL workdir must be an absolute Linux path or a WSL UNC workspace path");
	const distribution = explicitDistribution ?? requestedTarget?.distribution ?? sessionTarget?.distribution;
	if (distribution === void 0) throw new Error("No WSL distribution is selected; enable a WSL workspace or provide distribution");
	if (explicitDistribution !== void 0 && requestedTarget !== void 0 && explicitDistribution !== requestedTarget.distribution) throw new Error("distribution does not match the requested WSL workspace path");
	return {
		distribution,
		linuxPath: requestedTarget?.linuxPath ?? (requestedWorkdir === void 0 ? sessionTarget?.linuxPath : normalizeLinuxPath(requestedWorkdir)) ?? "/"
	};
}
function resolveTimeout(value) {
	const timeoutMs = value ?? DEFAULT_TIMEOUT_MS;
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) throw new Error(`timeoutMs must be an integer between 1 and ${MAX_TIMEOUT_MS}`);
	return timeoutMs;
}
function formatResult(stdout, stderr, exitCode, signal, timedOut, timeoutMs) {
	const body = [stdout.trimEnd(), stderr.trimEnd() === "" ? "" : `[stderr]\n${stderr.trimEnd()}`].filter(Boolean).join("\n");
	const status = timedOut ? `[timed out after ${timeoutMs} ms]` : signal === null ? `[exit code: ${exitCode ?? 1}]` : `[killed by signal: ${signal}]`;
	return body === "" ? status : `${body}\n${status}`;
}
function createWslCommandTool(ctx, toolName = "wsl_bash") {
	return defineTool({
		name: toolName,
		description: "Execute a bash command inside the Ubuntu/WSL distribution of the current WSL workspace. Use this instead of bash or pwsh for project commands in a WSL workspace.",
		parameters: {
			command: {
				type: "string",
				required: true,
				description: "The bash command to execute inside WSL."
			},
			description: {
				type: "string",
				description: "Clear, concise description of what this command does in active voice, 5-10 words."
			},
			distribution: {
				type: "string",
				description: "Optional WSL distribution name; defaults to the current WSL workspace."
			},
			workdir: {
				type: "string",
				description: "Optional absolute Linux path or WSL UNC workspace path."
			},
			timeoutMs: {
				type: "number",
				description: `Timeout in milliseconds, from 1 to ${MAX_TIMEOUT_MS}.`
			}
		},
		output: {
			schema: { type: "string" },
			render: (_args, value) => [{
				type: "text",
				text: value
			}]
		},
		async execute(args, exec) {
			if (process.platform !== "win32") throw new Error("WSL commands require a Windows Host");
			if (args.command.trim() === "") throw new Error("command must be a non-empty string");
			if (toolName === "wsl_bash" && (args.description === void 0 || args.description.trim() === "")) throw new Error("description must be a non-empty string");
			const target = resolveTarget(args, exec);
			const timeoutMs = resolveTimeout(args.timeoutMs);
			const timeoutController = new AbortController();
			const timeout = setTimeout(() => timeoutController.abort(/* @__PURE__ */ new Error("WSL command timed out")), timeoutMs);
			const signal = AbortSignal.any([exec.signal, timeoutController.signal]);
			let handle;
			try {
				handle = ctx.subprocess.spawn({
					argv: [
						"wsl.exe",
						"--distribution",
						target.distribution,
						"--cd",
						target.linuxPath,
						"--",
						"bash",
						"-lc",
						args.command
					],
					cwd: process.cwd(),
					stdio: {
						stdin: "ignore",
						stdout: {
							maxBytes: OUTPUT_MAX_BYTES,
							spill: { maxBytes: OUTPUT_SPILL_MAX_BYTES }
						},
						stderr: {
							maxBytes: OUTPUT_MAX_BYTES,
							spill: { maxBytes: OUTPUT_SPILL_MAX_BYTES }
						}
					},
					graceMs: 1e3,
					signal
				});
				const outcome = await handle.done;
				return formatResult(handle.collected.stdout?.readFrom(0).text ?? "", handle.collected.stderr?.readFrom(0).text ?? "", outcome.exitCode, outcome.signal, timeoutController.signal.aborted && !exec.signal.aborted, timeoutMs);
			} catch (error) {
				if (exec.signal.aborted) throw error;
				if (timeoutController.signal.aborted) throw new Error(`WSL command timed out after ${timeoutMs} ms`);
				throw new Error(`WSL command failed: ${errorMessage(error)}`);
			} finally {
				clearTimeout(timeout);
			}
		},
		presentCall: (args) => ({
			card: "terminal",
			title: args.command,
			...args.description === void 0 ? {} : { description: args.description },
			...args.workdir === void 0 ? {} : { cwd: args.workdir }
		})
	});
}
/** Register the WSL command tool and workspace-aware model guidance. */
function registerWslCommandBridge(ctx) {
	ctx.effect(() => ctx.tools.register(createWslCommandTool(ctx)), "wsl-workspace: wsl_bash tool");
	ctx.effect(() => ctx.systemPrompt.section({
		name: "tool:wsl-bash",
		order: 106,
		text: (context) => {
			const cwd = context.agent?.session?.header?.cwd;
			const target = targetFromPath(cwd);
			if (target === void 0) return "";
			return `The current workspace is inside WSL distribution "${target.distribution}" at "${target.linuxPath}". Use the bash tool (routed to WSL in this workspace) or wsl_bash for project commands; do not use the Windows bash or pwsh tool for this workspace.`;
		}
	}), "wsl-workspace: WSL command guidance");
}
//#endregion
//#region lib/types/wsl-terminal.js
/** Workspace-scoped bash routing for WSL workspaces. */
/**
* Install a WSL-backed `bash` shadow for one Agent.
*
* DSH's current Windows subprocess provider cannot inspect PTY foreground
* process groups, so its persistent terminal backend is unavailable on Win32.
* The shadow deliberately uses the reliable bounded subprocess path instead:
* the model still calls `bash`, but every command runs through `wsl.exe` in
* the selected distribution and Linux cwd.
*/
function installAgentBash(agent) {
	const cwd = agent.session.header.cwd;
	if (cwd === void 0 || parseWslUncPath(cwd) === void 0) return;
	agent.ctx.inject(["tools", "subprocess"], (ctx) => {
		ctx.tools.register(createWslCommandTool(ctx, "bash"));
	});
}
/** Install WSL bash shadows for current and future WSL workspace Agents. */
function registerWslTerminal(ctx) {
	const installed = /* @__PURE__ */ new WeakSet();
	const installOnce = (agent) => {
		if (installed.has(agent)) return;
		const cwd = agent.session.header.cwd;
		if (cwd === void 0 || parseWslUncPath(cwd) === void 0) return;
		installed.add(agent);
		installAgentBash(agent);
	};
	for (const agent of ctx.agents.list()) installOnce(agent);
	ctx.on("agent/created", ({ agent }) => {
		installOnce(agent);
	});
	ctx.on("agent/session-start", ({ agent }) => {
		installOnce(agent);
	});
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
		static inject = [
			"tools",
			"systemPrompt",
			"subprocess",
			"agents"
		];
		constructor(ctx) {
			super(ctx, "wslWorkspace");
			__runInitializers(this, _instanceExtraInitializers);
			registerWslCommandBridge(ctx);
			registerWslTerminal(ctx);
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
