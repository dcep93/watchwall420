import { fetchProxyText } from "./proxy";
import { resolveUrl } from "./utils";

export async function resolveStreamFid(
  embedPageUrl: string,
): Promise<string> {
  if (!embedPageUrl) {
    return "";
  }

  const normalizedEmbedPageUrl = embedPageUrl.trim();
  const embedPageHtml = await fetchProxyText(normalizedEmbedPageUrl).catch(() => "");
  if (!embedPageHtml) {
    return "";
  }

  const iframeSourcePageUrl = extractIframeSourcePageUrl(
    embedPageHtml,
    normalizedEmbedPageUrl,
  );
  if (!iframeSourcePageUrl) {
    return "";
  }

  const iframeSourceHtml = await fetchProxyText(iframeSourcePageUrl).catch(() => "");
  return extractStreamFid(iframeSourceHtml);
}

function extractIframeSourcePageUrl(html: string, baseUrl: string) {
  if (!html || !baseUrl) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  const iframeSrc = document.querySelector("body > iframe")?.getAttribute("src")?.trim() ?? "";

  return resolveUrl(iframeSrc, baseUrl);
}

function extractStreamFid(html: string) {
  if (!html) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  for (const script of document.querySelectorAll("script")) {
    const fid = script.textContent?.match(/\bfid\s*=\s*["']([^"']+)["']/)?.[1]?.trim();
    if (fid) {
      return fid;
    }
  }

  return "";
}
