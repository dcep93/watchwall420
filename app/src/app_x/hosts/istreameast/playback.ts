import { fetchProxyText } from "./proxy";
import { isPlayableSourceUrl, matchStrings, resolveUrl } from "./utils";

export async function resolvePlayableSourceUrl(
  initialUrl: string,
): Promise<string> {
  const normalizedUrl = initialUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  if (isPlayableSourceUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  const embedHtml = await fetchProxyText(normalizedUrl).catch(() => "");
  if (!embedHtml) {
    return "";
  }

  const iframe_src = extractIframeSrc(embedHtml, normalizedUrl);
  if (!iframe_src) {
    return extractPlayableSource(embedHtml, normalizedUrl);
  }

  const fetch_resp = await fetchProxyText(iframe_src).catch(() => "");
  console.log("istreameast:resolvePlayableSourceUrl", { iframe_src, fetch_resp });

  const directSource = extractPlayableSource(fetch_resp, iframe_src);
  if (directSource) {
    return directSource;
  }

  return extractPlayableSource(embedHtml, normalizedUrl);
}

function extractIframeSrc(html: string, baseUrl: string) {
  if (!html || !baseUrl) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  const iframeSrc = [
    ...Array.from(document.querySelectorAll("iframe"))
      .map((iframe) => iframe.getAttribute("src")?.trim() ?? "")
      .filter(Boolean),
    ...matchStrings(html, /<iframe[^>]*src=["']([^"']+)["']/gi),
  ].find(Boolean);

  return resolveUrl(iframeSrc ?? "", baseUrl);
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
