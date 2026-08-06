/**
 * Keeps a promise alive after an HTTP response is sent.
 *
 * On Vercel, this uses the global `waitUntil` function so serverless functions
 * don't freeze before async work finishes. In long-lived processes (local dev,
 * Docker, Railway/Render/Fly.io) it falls back to fire-and-forget with error
 * logging.
 */
export function keepAlive(promise: Promise<unknown>, context = "async work") {
  const vercelWaitUntil = (globalThis as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil;
  if (vercelWaitUntil) {
    vercelWaitUntil(promise);
    return;
  }
  promise.catch((err) => {
    console.error(`Background ${context} failed:`, err);
  });
}
