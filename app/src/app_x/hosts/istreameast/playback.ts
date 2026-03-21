import { fetchProxyText } from "./proxy";
import { matchStrings, isPlayableSourceUrl, resolveUrl } from "./utils";

export async function resolvePlayableSourceUrl(
  initialUrl: string,
  visited = new Set<string>(),
  depth = 0,
): Promise<string> {
  const normalizedUrl = initialUrl.trim();
  if (!normalizedUrl || visited.has(normalizedUrl) || depth > 5) {
    return "";
  }

  visited.add(normalizedUrl);

  if (isPlayableSourceUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  const html = await fetchProxyText(normalizedUrl).catch(() => "");
  if (!html) {
    return "";
  }

  const directSource = extractPlayableSource(html, normalizedUrl);
  if (directSource) {
    return directSource;
  }

  for (const candidateUrl of extractNestedDocumentUrls(html, normalizedUrl)) {
    const resolved = await resolvePlayableSourceUrl(candidateUrl, visited, depth + 1);
    if (resolved) {
      return resolved;
    }
  }

  return "";
}

function extractPlayableSource(html: string, baseUrl: string) {
  if (!html || !baseUrl) return "";

  const normalizedHtml = html.replaceAll("\\/", "/");
  const candidates = [
    ...matchStrings(
      normalizedHtml,
      /(https?:\/\/[^"'\\\s]+?\.(?:m3u8|mp4)(?:[^"'\\\s]*)?)/gi,
    ),
    ...matchStrings(
      normalizedHtml,
      /["'](?:file|source|src)["']\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    ),
    ...matchStrings(
      normalizedHtml,
      /\b(?:file|source|src)\b\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/gi,
    ),
  ];

  for (const candidate of candidates) {
    const resolved = resolveUrl(candidate, baseUrl);
    if (resolved && isPlayableSourceUrl(resolved)) {
      return resolved;
    }
  }

  return "";
}

function extractNestedDocumentUrls(html: string, baseUrl: string) {
  if (!html || !baseUrl) return [];

  const document = new DOMParser().parseFromString(html, "text/html");
  const candidates = [
    ...Array.from(document.querySelectorAll("iframe"))
      .map((iframe) => iframe.getAttribute("src")?.trim() ?? "")
      .filter(Boolean),
    ...Array.from(document.querySelectorAll("[data-src]"))
      .map((element) => element.getAttribute("data-src")?.trim() ?? "")
      .filter(Boolean),
    ...matchStrings(html, /<iframe[^>]*src=["']([^"']+)["']/gi),
    ...matchStrings(html, /\bdata-src=["']([^"']+)["']/gi),
    ...matchStrings(html, /\b(?:src|href)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi),
  ];

  const uniqueCandidates = new Set<string>();
  for (const candidate of candidates) {
    const resolved = resolveUrl(candidate, baseUrl);
    if (!resolved || uniqueCandidates.has(resolved) || isPlayableSourceUrl(resolved)) {
      continue;
    }
    uniqueCandidates.add(resolved);
  }

  return Array.from(uniqueCandidates);
}
