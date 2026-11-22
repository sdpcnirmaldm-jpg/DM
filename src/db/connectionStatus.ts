export class SqlUnavailableError extends Error {
  constructor(message = 'SQL database proxy is unavailable', options?: ErrorOptions) {
    super(message, options);
    this.name = 'SqlUnavailableError';
  }
}

export function warnSqlProxyOnce(_context: string, _detail?: string): void {
  // Handled silently via local fallback responses to keep server logs and UI isolated.
}

export function isSqlUnavailableError(error: unknown, depth = 0): boolean {
  if (!error || depth > 5) return false;
  if (error instanceof SqlUnavailableError) return true;

  const errObj = error as { code?: unknown; message?: unknown; cause?: unknown };
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  const msg = typeof errObj.message === 'string' ? errObj.message : String(error);

  if (
    code === 'ENOENT' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EPIPE' ||
    code === 'ENETUNREACH' ||
    code === '57P01' ||
    code === '57P02' ||
    code === '57P03'
  ) {
    return true;
  }

  if (
    msg.includes('.s.PGSQL.') ||
    msg.includes('connect ENOENT') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('Connection closed') ||
    msg.includes('the database system is starting up')
  ) {
    return true;
  }

  if (errObj.cause) {
    return isSqlUnavailableError(errObj.cause, depth + 1);
  }
  return false;
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const causeMsg =
      error.cause instanceof Error ? ` (${error.cause.message})` : '';
    return `${error.message}${causeMsg}`;
  }
  return String(error);
}
