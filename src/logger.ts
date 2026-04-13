type Level = "debug" | "info" | "warn" | "error";
const levels: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const configured = (process.env.LOG_LEVEL ?? "info") as Level;

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  if (levels[level] < levels[configured]) return;
  console[level === "debug" ? "log" : level](
    JSON.stringify({ level, message, ...meta, ts: new Date().toISOString() })
  );
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
