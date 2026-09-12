export type WriteSuccess<T> = { ok: true; data: T };
export type WriteFailure<T = never> = {
  ok: false;
  error: string;
  readonly __writeType?: T;
};
export type WriteResult<T> = WriteSuccess<T> | WriteFailure<T>;

export const writeOk = <T>(data: T): WriteSuccess<T> => ({ ok: true, data });

export const writeErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const candidate = String((error as { message?: unknown }).message || "").trim();
    if (candidate) return candidate;
  }
  return fallback;
};

export const writeFail = <T = never>(
  error: unknown,
  fallback: string,
): WriteFailure<T> => ({
  ok: false,
  error: writeErrorMessage(error, fallback),
});
