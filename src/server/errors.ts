export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, "not_found", `${what} not found`);
export const conflict = (message: string) => new AppError(409, "conflict", message);
export const forbidden = (message = "forbidden") => new AppError(403, "forbidden", message);
export const invalid = (message: string) => new AppError(400, "invalid", message);
