export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: AppError };

export const ErrorCodes = {
  UNAUTHORIZED: 'AUTH_001',
  FORBIDDEN: 'AUTH_003',
  VALIDATION_FAILED: 'VAL_001',
  DATABASE_ERROR: 'DB_001',
  NOT_FOUND: 'DB_002',
  BUSINESS_CONFLICT: 'BIZ_001',
} as const;
