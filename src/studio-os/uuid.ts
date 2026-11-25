const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value?: string | null): boolean {
  return Boolean(value && UUID_RE.test(value));
}

function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Generates a stable, deterministic RFC-4122 v4-compatible UUID for seed rows.
 */
export function deterministicUuid(seedKey: string): string {
  const p1 = fnv1a32(`a:${seedKey}`, 0x811c9dc5);
  const p2 = fnv1a32(`b:${seedKey}`, 0x9e3779b9);
  const p3 = fnv1a32(`c:${seedKey}`, 0x85ebca6b);
  const p4 = fnv1a32(`d:${seedKey}`, 0xc2b2ae35);

  const b1 = p1.toString(16).padStart(8, "0");
  const b2 = ((p2 >>> 16) & 0xffff).toString(16).padStart(4, "0");
  const b3 = (((p2 & 0x0fff) | 0x4000) >>> 0).toString(16).padStart(4, "0");
  const b4 = (((p3 >>> 16) & 0x3fff) | 0x8000).toString(16).padStart(4, "0");
  const b5a = (p3 & 0xffff).toString(16).padStart(4, "0");
  const b5b = p4.toString(16).padStart(8, "0");

  return `${b1}-${b2}-${b3}-${b4}-${b5a}${b5b}`;
}

/**
 * Generates a fresh UUID for user-created entities.
 */
export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
