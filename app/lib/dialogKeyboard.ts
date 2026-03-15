function isSkippableSubmitTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[data-dialog-enter-submit='false']")) {
    return true;
  }

  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement ||
    target.isContentEditable
  );
}

export function shouldTriggerDialogSubmit(event: KeyboardEvent): boolean {
  if (event.key !== "Enter" || event.defaultPrevented || event.isComposing) {
    return false;
  }

  return !isSkippableSubmitTarget(event.target);
}