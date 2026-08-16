/** Package-owned invariant companion. @module dsh-wsl-workspace/invariant */
const PACKAGE_NAME = 'dsh-wsl-workspace';
/** Cordis companion plugin name. */
export const name = 'wsl-workspace-invariant';
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants'];
/** No runtime invariant: each response is derived from WSL and the Host filesystem at call time. */
const install = () => { };
/** Register this package's invariant companion. */
export const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
/* jscpd:ignore-end */
