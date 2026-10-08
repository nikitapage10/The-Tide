/** Stable, documented error codes (see docs/API.md). */
export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CSRF_REJECTED: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INVALID_JSON: 400,
  INVALID_INPUT: 400,
  FIELD_NOT_ALLOWED: 400,
  VALIDATION_FAILED: 422,
  UNSUPPORTED_SCHEMA_VERSION: 422,
  CROSS_PROJECT: 422,
  STALE_BASE: 409,
  RELEASE_ID_CONFLICT: 409,
  REVISION_CONFLICT: 409,
  RATE_LIMITED: 429,
  SETUP_REQUIRED: 503,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError;
