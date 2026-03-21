import { fetchProxyText } from "./proxy";
import { resolveUrl } from "./utils";

export async function resolvePlayableSourceUrl(
  initialUrl: string,
): Promise<string> {
  if (!initialUrl) {
    return "";
  }

  const embedPageUrl = initialUrl.trim();
  const embedHtml = await fetchProxyText(embedPageUrl).catch(() => "");
  if (!embedHtml) {
    return "";
  }

  const iframeSourcePageUrl = extractIframeSourcePageUrl(embedHtml, embedPageUrl);
  if (!iframeSourcePageUrl) {
    return "";
  }

  const iframeSourceHtml = await fetchProxyText(iframeSourcePageUrl).catch(() => "");
  return extractFid(iframeSourceHtml);
}

function extractIframeSourcePageUrl(html: string, baseUrl: string) {
  if (!html || !baseUrl) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  const iframeSrc = document.querySelector("body > iframe")?.getAttribute("src")?.trim() ?? "";

  return resolveUrl(iframeSrc, baseUrl);
}

function extractFid(html: string) {
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
