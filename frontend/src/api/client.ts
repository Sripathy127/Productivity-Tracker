/**
 * Thin typed fetch wrapper. Every call funnels through `request` so error
 * handling and the API's error envelope are dealt with in exactly one place.
 */

import type { ErrorResponse, FieldError } from "@/types/api";

const API_BASE = import.meta.env["VITE_API_BASE_URL"] ?? "/api";

/** An error carrying the backend's field-addressed validation detail. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];

  constructor(status: number, fieldErrors: FieldError[], message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Message for a specific form field, if the backend blamed one. */
  messageFor(field: string): string | undefined {
    return this.fieldErrors.find((error) => error.field === field)?.message;
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== "object" || value === null) return false;
  const detail = (value as { detail?: unknown }).detail;
  return (
    Array.isArray(detail) &&
    detail.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { field?: unknown }).field === "string" &&
        typeof (item as { message?: unknown }).message === "string"
    )
  );
}

async function readError(response: Response): Promise<ApiRequestError> {
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // A non-JSON body (proxy error page, empty 502) is expected here; fall
    // through to the generic message below rather than masking the status.
    parsed = null;
  }

  if (isErrorResponse(parsed) && parsed.detail.length > 0) {
    const summary = parsed.detail.map((item) => item.message).join(" ");
    return new ApiRequestError(response.status, parsed.detail, summary);
  }

  return new ApiRequestError(
    response.status,
    [],
    `Request failed with status ${response.status}`
  );
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function request<TResponse>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    signal,
    // The session lives in an httpOnly cookie, so it must be sent explicitly
    // whenever the API is on a different origin to the page.
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
