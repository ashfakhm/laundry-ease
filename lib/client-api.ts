type ApiEnvelope<T> = {
  data?: T;
};

/**
 * Accept both legacy raw payloads and standardized API envelopes.
 */
export function unwrapApiData<T>(payload: unknown): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    (payload as ApiEnvelope<T>).data !== undefined
  ) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

export function unwrapApiArray<T>(payload: unknown): T[] {
  const data = unwrapApiData<unknown>(payload);
  return Array.isArray(data) ? (data as T[]) : [];
}
