//#region lib/types/invariant.js
/** Package-owned invariant companion. @module dsh-wsl-workspace/invariant */
const PACKAGE_NAME = "dsh-wsl-workspace";
/** Cordis companion plugin name. */
const name = "wsl-workspace-invariant";
/** Service required before the companion can reserve package ownership. */
const inject = ["invariants"];
/** No runtime invariant: each response is derived from WSL and the Host filesystem at call time. */
const install = () => {};
/** Register this package's invariant companion. */
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };
