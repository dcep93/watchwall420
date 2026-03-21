export function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
