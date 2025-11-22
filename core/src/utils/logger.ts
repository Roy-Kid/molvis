import { Logger, type ILogObj } from "tslog";

export function createLogger(name: string): Logger<ILogObj> {
    return new Logger({
        name,
        minLevel: 3, // 0: silly, 1: trace, 2: debug, 3: info, 4: warn, 5: error, 6: fatal
        type: "pretty",
        hideLogPositionForProduction: true,
    });
}

export const logger = createLogger("molvis-core");