export function parseExternalHttpUrl(value: unknown) {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function safeExternalHref(value: unknown) {
  return parseExternalHttpUrl(value)?.toString() ?? null;
}
