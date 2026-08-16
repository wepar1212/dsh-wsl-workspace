/** Remote Host gateway for WSL distribution discovery and directory listing. */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { listWslDirectory, listWslDistributions } from "./wsl.js";
import { registerWslCommandBridge } from "./wsl-command.js";
import { registerWslTerminal } from "./wsl-terminal.js";
/** Remote-only gateway used by the WSL workspace browser. */
let WslWorkspaceGateway = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _listDistributions_decorators;
    let _listDirectory_decorators;
    return class WslWorkspaceGateway extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _listDistributions_decorators = [Remote('listDistributions')];
            _listDirectory_decorators = [Remote('listDirectory')];
            __esDecorate(this, null, _listDistributions_decorators, { kind: "method", name: "listDistributions", static: false, private: false, access: { has: obj => "listDistributions" in obj, get: obj => obj.listDistributions }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _listDirectory_decorators, { kind: "method", name: "listDirectory", static: false, private: false, access: { has: obj => "listDirectory" in obj, get: obj => obj.listDirectory }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['tools', 'systemPrompt', 'subprocess', 'agents'];
        constructor(ctx) {
            super(ctx, 'wslWorkspace');
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
export { WslWorkspaceGateway };
export default WslWorkspaceGateway;
