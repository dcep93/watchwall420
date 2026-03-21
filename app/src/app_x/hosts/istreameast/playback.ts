import { fetchProxyText } from "./proxy";
import { isPlayableSourceUrl, matchStrings, resolveUrl } from "./utils";

const MAX_DOCUMENT_HOPS = 5;

export async function resolvePlayableSourceUrl(
  initialUrl: string,
): Promise<string> {
  const normalizedUrl = initialUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  const seenUrls = new Set<string>();
  const pendingUrls: Array<{ url: string; hops: number }> = [
    { url: normalizedUrl, hops: 0 },
  ];

  while (pendingUrls.length > 0) {
    const nextCandidate = pendingUrls.shift();
    if (!nextCandidate) {
      break;
    }

    const { url, hops } = nextCandidate;
    if (!url || seenUrls.has(url) || hops > MAX_DOCUMENT_HOPS) {
      continue;
    }

    seenUrls.add(url);

    if (isPlayableSourceUrl(url)) {
      return url;
    }

    const html = await fetchProxyText(url).catch(() => "");
    console.log({ hops, url, html });
    if (!html) {
      continue;
    }

    const directSource = extractPlayableSource(html, url);
    if (directSource) {
      return directSource;
    }

    for (const nestedUrl of extractNestedDocumentUrls(html, url)) {
      if (seenUrls.has(nestedUrl)) {
        continue;
      }

      pendingUrls.push({ url: nestedUrl, hops: hops + 1 });
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
    ...matchStrings(
      html,
      /\b(?:src|href)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/gi,
    ),
  ];

  const uniqueCandidates = new Set<string>();
  for (const candidate of candidates) {
    const resolved = resolveUrl(candidate, baseUrl);
    if (
      !resolved ||
      uniqueCandidates.has(resolved) ||
      isPlayableSourceUrl(resolved)
    ) {
      continue;
    }
    uniqueCandidates.add(resolved);
  }

  return Array.from(uniqueCandidates);
}
