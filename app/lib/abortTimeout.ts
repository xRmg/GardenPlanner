export interface TimeoutAbortHandle {
  signal: AbortSignal;
  didTimeout: () => boolean;
  cleanup: () => void;
}

export function createTimeoutAbortHandle(
  timeoutMs: number,
  parentSignal?: AbortSignal,
): TimeoutAbortHandle {
  const controller = new AbortController();
  let timedOut = false;

  const handleParentAbort = () => {
    controller.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted) {
    controller.abort(parentSignal.reason);
  } else if (parentSignal) {
    parentSignal.addEventListener("abort", handleParentAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener("abort", handleParentAbort);
      }
    },
  };
}