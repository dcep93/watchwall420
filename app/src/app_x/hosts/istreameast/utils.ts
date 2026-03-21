export function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchStrings(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern), (match) => match[1]?.trim() ?? "").filter(Boolean);
}

export function resolveUrl(candidate: string, baseUrl: string) {
  if (!candidate) return "";

  try {
    const url = new URL(candidate, baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function buildStreamSlug(title: string, rawUrl: string) {
  const normalizedTitle = title
    .split(/ vs /i)
    .at(-1)
    ?.trim()
    .replaceAll(" ", "");

  if (normalizedTitle) {
    return normalizedTitle;
  }

  return rawUrl.replace(/[^a-z0-9]+/gi, "");
}
