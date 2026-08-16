/** Hand-owned Typert Host manifest for the two WSL workspace Remote methods. */
import { z } from 'zod';
/** Runtime Host face auto-registered by dsh-typert-loader. */
export declare const TYPERT: {
    package: string;
    face: string;
    schemas: never[];
    invocations: ({
        id: string;
        service: string;
        namespace: string;
        method: string;
        invocation: {
            kind: string;
        };
        parameters: {
            name: string;
            wire: string;
            source: string;
            codec: {
                mode: string;
                typeSymbol: string;
                schema: z.ZodString;
            };
        }[];
        result: {
            mode: string;
            typeSymbol: string;
            schema: z.ZodObject<{
                distribution: z.ZodReadonly<z.ZodString>;
                linuxPath: z.ZodReadonly<z.ZodString>;
                parentLinuxPath: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<null>, z.ZodString]>>;
                windowsPath: z.ZodReadonly<z.ZodString>;
                directories: z.ZodReadonly<z.ZodArray<z.ZodObject<{
                    name: z.ZodReadonly<z.ZodString>;
                    linuxPath: z.ZodReadonly<z.ZodString>;
                }, z.core.$strip>>>;
                truncated: z.ZodReadonly<z.ZodBoolean>;
            }, z.core.$strip>;
        };
        sourceLocation: {
            file: string;
            line: number;
            column: number;
        };
    } | {
        id: string;
        service: string;
        namespace: string;
        method: string;
        invocation: {
            kind: string;
        };
        parameters: never[];
        result: {
            mode: string;
            typeSymbol: string;
            schema: z.ZodObject<{
                available: z.ZodReadonly<z.ZodBoolean>;
                distributions: z.ZodReadonly<z.ZodArray<z.ZodString>>;
                message: z.ZodReadonly<z.ZodUnion<readonly [z.ZodLiteral<null>, z.ZodString]>>;
            }, z.core.$strip>;
        };
        sourceLocation: {
            file: string;
            line: number;
            column: number;
        };
    })[];
    model: {
        services: never[];
        events: never[];
        objects: never[];
    };
};
//# sourceMappingURL=typert.host.d.ts.map