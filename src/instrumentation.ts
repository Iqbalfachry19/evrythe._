export async function register() {
  if (typeof window !== "undefined") {
    return;
  }

  const maybeLocalStorage = (globalThis as { localStorage?: unknown })
    .localStorage;

  if (
    maybeLocalStorage &&
    typeof maybeLocalStorage === "object" &&
    typeof (maybeLocalStorage as { getItem?: unknown }).getItem !== "function"
  ) {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: undefined,
    });
  }
}
