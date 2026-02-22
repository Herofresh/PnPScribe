import "server-only";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpError) {
    return error.message;
  }

  return fallback;
}

export function getErrorStatus(error: unknown, fallback = 500) {
  if (error instanceof HttpError) {
    return error.status;
  }

  return fallback;
}
