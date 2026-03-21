import { fetchIstreameastPageText } from "./proxy";
import { resolveUrl } from "./utils";

export type ResolvedEmbedPlayback = {
  fid: string;
  iframeSourcePageUrl: string;
};

export async function resolveEmbedPlayback(
  embedPageUrl: string,
): Promise<ResolvedEmbedPlayback> {
  if (!embedPageUrl) {
    return {
      fid: "",
      iframeSourcePageUrl: "",
    };
  }

  const normalizedEmbedPageUrl = embedPageUrl.trim();
  const embedPageHtml = await fetchIstreameastPageText(normalizedEmbedPageUrl).catch(() => "");
  if (!embedPageHtml) {
    return {
      fid: "",
      iframeSourcePageUrl: "",
    };
  }

  const iframeSourcePageUrl = extractIframeDocumentUrl(
    embedPageHtml,
    normalizedEmbedPageUrl,
  );
  if (!iframeSourcePageUrl) {
    return {
      fid: "",
      iframeSourcePageUrl: "",
    };
  }

  const iframeSourceHtml = await fetchIstreameastPageText(iframeSourcePageUrl).catch(() => "");
  return {
    fid: extractEmbedFid(iframeSourceHtml),
    iframeSourcePageUrl,
  };
}

function extractIframeDocumentUrl(html: string, baseUrl: string) {
  if (!html || !baseUrl) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  const iframeSrc = document.querySelector("body > iframe")?.getAttribute("src")?.trim() ?? "";

  return resolveUrl(iframeSrc, baseUrl);
}

function extractEmbedFid(html: string) {
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
