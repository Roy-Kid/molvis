import { type ILogObj, Logger } from "tslog";

function resolveNodeEnv(): string | undefined {
  const maybeGlobal = globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  };
  return maybeGlobal.process?.env?.NODE_ENV;
}

function resolveDefaultMinLevel(): number {
  const env = resolveNodeEnv();
  return env === "development" ? 2 : 3;
}

export function createLogger(name: string): Logger<ILogObj> {
  return new Logger({
    name,
    minLevel: resolveDefaultMinLevel(), // 0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal
    type: "pretty",
    hideLogPositionForProduction: true,
  });
}

export const logger = createLogger("molvis-core");
