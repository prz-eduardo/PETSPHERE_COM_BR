export function ensureHTMLElement(el: unknown, name: string): asserts el is HTMLElement {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`${name} must be an HTMLElement`);
  }
}

export function cleanupElement(el: HTMLElement | null | undefined): void {
  if (!el) return;
  try {
    el.remove();
  } catch {
    // ignore
  }
}
