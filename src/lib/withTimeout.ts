/** Limits waiting for a request, including Supabase's PromiseLike builders. */
export async function withTimeout<T>(
  request: PromiseLike<T>,
  timeoutMs = 10_000,
  message = "A solicitação demorou demais. Verifique sua conexão e tente novamente.",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
