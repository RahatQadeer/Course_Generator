/** `server-only` throws outside a React Server Component; stub it for node scripts. */
import Module from "node:module";

type Loader = (this: unknown, request: string, ...rest: unknown[]) => unknown;

export function stubServerOnly(): void {
  const internal = Module as unknown as { _load: Loader };
  const original = internal._load;
  internal._load = function (this: unknown, request: string, ...rest: unknown[]) {
    if (request === "server-only") return {};
    return original.call(this, request, ...rest);
  };
}
