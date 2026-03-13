import { useEffect } from "react";
import {
  ERROR_TOAST_IDS,
  isAbortError,
  notifyErrorToast,
} from "../lib/asyncErrors";

export function useGlobalAsyncErrorToasts(): void {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isAbortError(event.reason)) {
        return;
      }

      notifyErrorToast({
        id: ERROR_TOAST_IDS.unhandledAsync,
        title: "Unexpected async error",
        error: event.reason,
        fallback: "A background task failed.",
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);
}