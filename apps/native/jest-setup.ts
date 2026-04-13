import "@testing-library/jest-native/extend-expect";

// Expo 55 "winter" installs lazy getters on many globals (structuredClone, etc.) that try to
// load runtime.native.ts (ESM file). Jest runs in CJS mode so the import fails.
// We preemptively define these globals as plain values to prevent the getters from firing.
const nativeGlobals = [
  "structuredClone",
  "fetch",
  "Request",
  "Response",
  "Headers",
  "FormData",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
  "Blob",
  "File",
  "URL",
  "URLSearchParams",
  "crypto",
  "performance",
  "MessageChannel",
  "MessageEvent",
] as const;

for (const name of nativeGlobals) {
  const existing = (global as Record<string, unknown>)[name];
  if (existing !== undefined) {
    Object.defineProperty(global, name, {
      value: existing,
      writable: true,
      configurable: true,
    });
  }
}
