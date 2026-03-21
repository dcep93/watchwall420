import { fetchProxyText } from "./proxy";
import { matchStrings, resolveUrl } from "./utils";

export async function resolvePlayableSourceUrl(
  initialUrl: string,
): Promise<string> {
  const normalizedUrl = initialUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  const embedHtml = await fetchProxyText(normalizedUrl).catch(() => "");
  if (!embedHtml) {
    return "";
  }

  const iframe_src = extractIframeSrc(embedHtml, normalizedUrl);
  if (!iframe_src) {
    return "";
  }

  const fetch_resp = await fetchProxyText(iframe_src).catch(() => "");
  const fid = extractFid(fetch_resp);
  return fid;
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

function extractFid(html: string) {
  if (!html) return "";

  return matchStrings(html, /\bfid\s*=\s*["']([^"']+)["']/gi)[0] ?? "";
}
