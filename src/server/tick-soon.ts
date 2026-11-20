/*
 * "Process the new events soon." emit() calls requestTick(); the host decides what that means.
 * With an always-on worker (server, local mode) nothing needs to happen: the worker polls.
 * On Vercel, instrumentation.ts registers a scheduler that runs one tick after the current request.
 * Kept free of Next.js imports so business code, tests and the worker stay host-independent.
 */
let scheduler: (() => void) | null = null;
let requested = false;

export function setTickScheduler(fn: (() => void) | null) {
  scheduler = fn;
}

export function requestTick() {
  if (!scheduler || requested) return;
  requested = true;
  try {
    scheduler();
  } catch {
    // outside a request (scripts, worker): the cron tick picks the events up
  } finally {
    // one tick per request is enough: it drains everything that is waiting
    queueMicrotask(() => (requested = false));
  }
}
