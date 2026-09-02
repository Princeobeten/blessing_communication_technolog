import { NextResponse } from "next/server";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { HttpError } from "./auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Converts thrown errors into consistent JSON responses. */
export function handleError(err: unknown) {
  if (err instanceof HttpError) return fail(err.message, err.status);

  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join(".");
    return NextResponse.json(
      { error: path ? `${path}: ${first.message}` : first?.message ?? "Invalid request.", issues: err.issues },
      { status: 422 }
    );
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const first = Object.values(err.errors)[0];
    return fail(first?.message ?? "Validation failed.", 422);
  }

  if (err instanceof mongoose.Error.CastError) {
    return fail("Invalid identifier.", 400);
  }

  if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
    const key = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0];
    return fail(key ? `That ${key} is already in use.` : "Duplicate record.", 409);
  }

  console.error("[api]", err);
  return fail("Something went wrong on the server.", 500);
}
