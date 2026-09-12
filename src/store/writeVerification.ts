export type VerificationRead<T> = {
  reachable: boolean;
  value: T | null;
};

export type VerificationResult<T> = VerificationRead<T> & {
  matched: boolean;
  attempts: number;
};

export type VerificationOptions = {
  attempts?: number;
  delayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

const defaultSleep = (delayMs: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, delayMs));

/**
 * Re-read server state after an ambiguous mutation failure (timeout, dropped
 * response, connection reset). A mutation may have committed even when the
 * client never received its response, so rollback is only safe after bounded
 * verification attempts.
 */
export async function verifyAmbiguousWrite<T>(
  read: () => Promise<VerificationRead<T>>,
  matchesExpected: (value: T | null) => boolean,
  options: VerificationOptions = {},
): Promise<VerificationResult<T>> {
  const attempts = Math.max(1, Math.min(8, options.attempts ?? 5));
  const delayMs = Math.max(0, options.delayMs ?? 180);
  const sleep = options.sleep ?? defaultSleep;
  let last: VerificationRead<T> = { reachable: false, value: null };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      last = await read();
    } catch {
      last = { reachable: false, value: null };
    }
    if (last.reachable && matchesExpected(last.value)) {
      return { ...last, matched: true, attempts: attempt };
    }
    if (attempt < attempts && delayMs > 0) {
      await sleep(delayMs * attempt);
    }
  }

  return { ...last, matched: false, attempts };
}
