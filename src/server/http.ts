import { ZodError } from "zod";
import { AppError } from "./errors";

// Uniform JSON errors for every API route (agents parse these).
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return Response.json({ error: { code: "invalid", message: "invalid input", issues: err.issues } }, { status: 400 });
  }
  console.error(err);
  return Response.json({ error: { code: "internal", message: "internal error" } }, { status: 500 });
}
