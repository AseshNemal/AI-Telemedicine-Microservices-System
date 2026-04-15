export function readId(rawId: string | null | undefined, prefix = "AP"): string {
  const value = String(rawId || "").trim();
  if (!value) return `${prefix}-0000`;

  // Deterministic 32-bit FNV-1a hash for stable readable IDs.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const num = 1000 + (Math.abs(hash >>> 0) % 9000);
  return `${prefix}-${String(num).padStart(4, "0")}`;
}
