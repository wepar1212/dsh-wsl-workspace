/** Windows-side WSL discovery and UNC directory listing helpers. */
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { posix } from 'node:path';
const WSL_COMMAND_TIMEOUT_MS = 10_000;
const WSL_COMMAND_OUTPUT_LIMIT = 1024 * 1024;
const DIRECTORY_LIMIT = 1_000;
/** Decode wsl.exe output, which is UTF-16LE on some Windows builds and UTF-8 on others. */
export function decodeWslOutput(value) {
    const sample = value.subarray(0, Math.min(value.length, 128));
    let zeroOddBytes = 0;
    for (let index = 1; index < sample.length; index += 2) {
        if (sample[index] === 0)
            zeroOddBytes += 1;
    }
    const utf16 = value.length >= 2
        && (value[0] === 0xff && value[1] === 0xfe
            || zeroOddBytes >= Math.max(2, Math.floor(sample.length / 8)));
    return (utf16 ? value.toString('utf16le') : value.toString('utf8'))
        .replace(/^\uFEFF/, '')
        .replaceAll('\0', '');
}
/** Parse the quiet distribution list without inventing a default distribution. */
export function parseDistributionList(value) {
    const seen = new Set();
    const distributions = [];
    for (const line of decodeWslOutput(value).split(/\r?\n/u)) {
        const name = line.trim();
        if (name === '' || seen.has(name))
            continue;
        seen.add(name);
        distributions.push(name);
    }
    return distributions;
}
/** Normalize an absolute Linux directory path; relative paths are rejected. */
export function normalizeLinuxPath(value) {
    if (!value.startsWith('/') || value.includes('\\') || value.includes('\0')) {
        throw new Error('WSL directory path must be an absolute Linux path');
    }
    return posix.normalize(value);
}
/** Reject characters that can escape or change one UNC distribution segment. */
export function validateDistributionName(value) {
    const name = value.trim();
    if (name === '' || name === '.' || name === '..' || /[<>:"/\\|?*\u0000-\u001f]/u.test(name)) {
        throw new Error('invalid WSL distribution name');
    }
    return name;
}
/** Convert one distribution and Linux path into a Windows WSL UNC path. */
export function wslUncPath(server, distribution, linuxPath) {
    const name = validateDistributionName(distribution);
    const normalized = normalizeLinuxPath(linuxPath);
    const suffix = normalized === '/' ? '' : `\\${normalized.slice(1).split('/').join('\\')}`;
    return `\\\\${server}\\${name}${suffix}`;
}
/** Parse a Windows WSL UNC workspace path back into its Linux target. */
export function parseWslUncPath(value) {
    const match = /^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(?:\\(.*))?$/iu.exec(value.trim());
    if (match === null || match[1] === undefined)
        return undefined;
    const linuxPath = match[2] === undefined || match[2] === ''
        ? '/'
        : `/${match[2].split('\\').join('/')}`;
    return {
        distribution: validateDistributionName(match[1]),
        linuxPath: normalizeLinuxPath(linuxPath),
    };
}
function runWsl(args) {
    return new Promise((resolve, reject) => {
        const child = spawn('wsl.exe', [...args], {
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        const stdout = [];
        const stderr = [];
        let outputBytes = 0;
        let settled = false;
        const settle = (action) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timeout);
            action();
        };
        const append = (target, chunk) => {
            outputBytes += chunk.length;
            if (outputBytes > WSL_COMMAND_OUTPUT_LIMIT) {
                child.kill();
                settle(() => { reject(new Error('wsl.exe output exceeded 1 MiB')); });
                return;
            }
            target.push(chunk);
        };
        const timeout = setTimeout(() => {
            child.kill();
            settle(() => { reject(new Error('wsl.exe did not respond within 10 seconds')); });
        }, WSL_COMMAND_TIMEOUT_MS);
        child.stdout.on('data', (chunk) => { append(stdout, chunk); });
        child.stderr.on('data', (chunk) => { append(stderr, chunk); });
        child.once('error', error => { settle(() => { reject(error); }); });
        child.once('close', exitCode => {
            settle(() => { resolve({ exitCode, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }); });
        });
    });
}
/** Read installed WSL distributions from the Windows Host. */
export async function listWslDistributions() {
    if (process.platform !== 'win32') {
        return { available: false, distributions: [], message: 'WSL workspaces require a Windows Host.' };
    }
    try {
        const result = await runWsl(['--list', '--quiet']);
        if (result.exitCode !== 0) {
            const diagnostic = decodeWslOutput(result.stderr).trim();
            return {
                available: false,
                distributions: [],
                message: diagnostic === '' ? 'WSL is unavailable on this Windows Host.' : diagnostic,
            };
        }
        const distributions = parseDistributionList(result.stdout);
        return distributions.length === 0
            ? { available: false, distributions: [], message: 'No WSL distribution is installed.' }
            : { available: true, distributions, message: null };
    }
    catch (error) {
        return {
            available: false,
            distributions: [],
            message: error instanceof Error ? error.message : String(error),
        };
    }
}
async function directoryNames(windowsPath) {
    const entries = await readdir(windowsPath, { withFileTypes: true });
    const names = [];
    for (const entry of entries) {
        if (entry.name.includes('\\'))
            continue;
        if (entry.isDirectory()) {
            names.push(entry.name);
            continue;
        }
        if (!entry.isSymbolicLink())
            continue;
        try {
            if ((await stat(`${windowsPath}\\${entry.name}`)).isDirectory())
                names.push(entry.name);
        }
        catch {
            // Broken or inaccessible WSL symlinks are not selectable directories.
        }
    }
    return names.sort((left, right) => left.localeCompare(right)).slice(0, DIRECTORY_LIMIT + 1);
}
/** List one WSL directory through the preferred UNC server with the legacy alias as fallback. */
export async function listWslDirectory(distribution, linuxPath) {
    if (process.platform !== 'win32')
        throw new Error('WSL workspaces require a Windows Host');
    const name = validateDistributionName(distribution);
    const normalized = normalizeLinuxPath(linuxPath);
    const preferred = wslUncPath('wsl.localhost', name, normalized);
    const fallback = wslUncPath('wsl$', name, normalized);
    let windowsPath = preferred;
    let names;
    try {
        names = await directoryNames(preferred);
    }
    catch (preferredError) {
        try {
            names = await directoryNames(fallback);
            windowsPath = fallback;
        }
        catch {
            throw new Error(`Cannot read WSL directory ${name}:${normalized}`, { cause: preferredError });
        }
    }
    const truncated = names.length > DIRECTORY_LIMIT;
    const visible = truncated ? names.slice(0, DIRECTORY_LIMIT) : names;
    const directories = visible.map(child => ({
        name: child,
        linuxPath: posix.join(normalized, child),
    }));
    return {
        distribution: name,
        linuxPath: normalized,
        parentLinuxPath: normalized === '/' ? null : posix.dirname(normalized),
        windowsPath,
        directories,
        truncated,
    };
}
