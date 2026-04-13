export class BizVerifyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly tool: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "BizVerifyError";
  }
}

export class RateLimitError extends BizVerifyError {
  constructor(tool: string, source: string) {
    super(`Rate limit hit on ${source}. Retry in a few seconds.`, "RATE_LIMIT", tool, true);
  }
}

export class DataSourceError extends BizVerifyError {
  constructor(tool: string, source: string, detail: string) {
    super(`${source} unavailable: ${detail}`, "DATA_SOURCE_ERROR", tool, true);
  }
}

export class InvalidInputError extends BizVerifyError {
  constructor(tool: string, field: string, reason: string) {
    super(`Invalid ${field}: ${reason}`, "INVALID_INPUT", tool, false);
  }
}

export function formatErrorResponse(error: unknown, tool: string) {
  if (error instanceof BizVerifyError) {
    return { success: false, error: error.message, code: error.code, retryable: error.retryable };
  }
  return { success: false, error: "Unexpected error", code: "INTERNAL_ERROR", retryable: false };
}
