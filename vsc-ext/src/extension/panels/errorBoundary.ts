import type { Logger } from "../types";

/**
 * Wrap an async message handler so unhandled errors are caught and logged
 * instead of silently swallowed by the webview message event loop.
 */
export function withErrorHandler<T>(
  handler: (message: T) => Promise<void> | void,
  logger: Logger,
): (message: T) => void {
  return (message: T) => {
    try {
      const result = handler(message);
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          logger.error(`MolVis: Unhandled error in message handler: ${error}`);
        });
      }
    } catch (error) {
      logger.error(`MolVis: Unhandled error in message handler: ${error}`);
    }
  };
}
