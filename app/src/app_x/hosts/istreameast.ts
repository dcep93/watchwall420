import type { Category, Host, Stream } from "../config/types";
import { fetchTextThroughProxy } from "../lib/proxy420";
import { renderStreamDocElement } from "../lib/renderStream";

const ISTREAMEAST_URL = "https://istreameast.is/";
const LOCAL_PROXY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REMOTE_PROXY_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const UPCOMING_WINDOW_SECONDS = 60 * 60;
const LIVE_WINDOW_SECONDS = 10_600;
const WATCHWALL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export async function fetchIstreameastHtml(
  localMaxAgeMs = LOCAL_PROXY_CACHE_MAX_AGE_MS,
  remoteMaxAgeMs = REMOTE_PROXY_CACHE_MAX_AGE_MS,
) {
  return fetchTextThroughProxy({
    url: ISTREAMEAST_URL,
    localMaxAgeMs,
    remoteMaxAgeMs,
    options: {
      headers: {
        "user-agent": WATCHWALL_USER_AGENT,
      },
    },
  });
}

export const istreameastHost = {
  async getStreams(category) {
    const html = await fetchIstreameastHtml();
    return parseStreamsFromHtml(html, category);
  },
  async getIframeParams(stream) {
    const streamPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const rawHtml = await fetchProxyText(streamPageUrl);
    const streamPage = parseStreamPage(rawHtml);

    let embedHtml = "";
    if (streamPage.embed_page_url) {
      embedHtml = await fetchProxyText(streamPage.embed_page_url);
    }

    const nestedIframeUrl = streamPage.embed_page_url
      ? extractNestedIframeUrl(embedHtml, streamPage.embed_page_url)
      : "";
    const nestedIframeHtml = nestedIframeUrl ? await fetchProxyText(nestedIframeUrl) : "";

    return {
      source_url:
        extractPlayableSource(nestedIframeHtml, nestedIframeUrl) ||
        extractPlayableSource(embedHtml, streamPage.embed_page_url) ||
        streamPage.embed_page_url,
      title: streamPage.title,
    };
  },
  getIframeDocStrElement(params) {
    return renderStreamDocElement(params);
  },
} satisfies Host<{ source_url: string; title: string }>;

function parseStreamsFromHtml(html: string, category: Category): Stream[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const leaguePattern = new RegExp(`\\b${escapeForRegex(category)}\\b`);

  return Array.from(document.querySelectorAll(".events-list .event-card"))
    .map((eventCard) => {
      const leagueElement = eventCard.querySelector(".event-league");
      const titleElement = eventCard.querySelector(".event-title");

      if (!leagueElement || !titleElement) {
        return null;
      }

      const strippedLeague = leagueElement.textContent?.trim() ?? "";
      if (!leaguePattern.test(strippedLeague)) {
        return null;
      }

      if (!hasRelevantStatus(eventCard)) {
        return null;
      }

      const title = titleElement.textContent?.trim() ?? "";
      const rawUrl = getRawUrl(eventCard);
      if (!title) {
        return null;
      }

      return {
        espn_id: -1,
        raw_url: rawUrl,
        title,
        slug: (title.split(" vs ").at(-1)?.trim() ?? title).replaceAll(" ", ""),
      } satisfies Stream;
    })
    .filter((stream): stream is Stream => stream !== null);
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRawUrl(eventCard: Element) {
  const onclick = eventCard.getAttribute("onclick") ?? "";
  const match = onclick.match(/window\.location\.href='([^']+)'/);
  return match?.[1] ?? "";
}

function hasRelevantStatus(eventCard: Element) {
  const title = eventCard.querySelector(".event-title")?.textContent?.trim() ?? "";
  const startTs = parseInt(eventCard.getAttribute("data-start-ts") ?? "", 10);
  if (!Number.isFinite(startTs)) {
    console.log("hasRelevantStatus:exclude:invalid-start", { title });
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilStart = startTs - nowSeconds;
  const liveElapsedSeconds = nowSeconds - startTs;

  if (secondsUntilStart > 0 && secondsUntilStart <= UPCOMING_WINDOW_SECONDS) {
    console.log("hasRelevantStatus:include:upcoming", {
      title,
      startTs,
      nowSeconds,
      secondsUntilStart,
      upcomingWindowSeconds: UPCOMING_WINDOW_SECONDS,
      liveWindowSeconds: LIVE_WINDOW_SECONDS,
    });
    return true;
  }

  if (liveElapsedSeconds >= 0 && liveElapsedSeconds < LIVE_WINDOW_SECONDS) {
    console.log("hasRelevantStatus:include:live", {
      title,
      startTs,
      nowSeconds,
      liveElapsedSeconds,
      liveWindowSeconds: LIVE_WINDOW_SECONDS,
    });
    return true;
  }

  console.log("hasRelevantStatus:exclude:outside-window", {
    title,
    startTs,
    nowSeconds,
    secondsUntilStart,
    liveElapsedSeconds,
    upcomingWindowSeconds: UPCOMING_WINDOW_SECONDS,
    liveWindowSeconds: LIVE_WINDOW_SECONDS,
  });
  return false;
}

function parseStreamPage(rawHtml: string) {
  const document = new DOMParser().parseFromString(rawHtml, "text/html");
  const embed_page_url =
    document.querySelector("#main-player")?.getAttribute("src") ??
    document.querySelector(".server-btn.active")?.getAttribute("data-src") ??
    document.querySelector(".server-btn")?.getAttribute("data-src") ??
    "";
  const title =
    document.querySelector(".hero-title")?.textContent?.trim() ??
    document.title ??
    "Streameast Stream";

  return {
    embed_page_url: embed_page_url ? new URL(embed_page_url, ISTREAMEAST_URL).toString() : "",
    title,
  };
}

async function fetchProxyText(url: string) {
  return fetchTextThroughProxy({
    url,
    localMaxAgeMs: LOCAL_PROXY_CACHE_MAX_AGE_MS,
    remoteMaxAgeMs: REMOTE_PROXY_CACHE_MAX_AGE_MS,
    options: {
      headers: {
        "user-agent": WATCHWALL_USER_AGENT,
      },
      referrer: ISTREAMEAST_URL,
    },
  });
}

function extractNestedIframeUrl(html: string, baseUrl: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  const src =
    document.querySelector("iframe")?.getAttribute("src") ??
    matchString(html, /<iframe[^>]*src=["']([^"']+)["']/i);
  return src ? new URL(src, baseUrl).toString() : "";
}

function extractPlayableSource(html: string, baseUrl: string) {
  if (!html) return "";

  const directMatch =
    matchString(html, /(https?:\/\/[^"'\\\s]+?\.(?:m3u8|mp4)(?:[^"'\\\s]*)?)/i) ||
    matchString(html, /["'](?:file|source|src)["']\s*[:=]\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i) ||
    matchString(html, /\b(?:file|source|src)\b\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);

  if (directMatch) {
    return new URL(directMatch, baseUrl).toString();
  }

  return "";
}

function matchString(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] ?? "";
}
