export async function clientFetch<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    // se sei loggato male o cookie scaduto
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message ?? "Errore";
    throw new Error(msg);
  }

  return data as T;
}
