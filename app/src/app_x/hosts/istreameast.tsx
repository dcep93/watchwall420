import type { Category, Host, Stream } from "../config/types";
import { fetchTextThroughProxy } from "../lib/proxy420";
import type { ReactElement } from "react";

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

    const source_url =
      extractPlayableSource(nestedIframeHtml, nestedIframeUrl) ||
      extractPlayableSource(embedHtml, streamPage.embed_page_url) ||
      streamPage.embed_page_url;

    console.log("istreameast:getIframeParams", {
      title: stream.title,
      streamPageUrl,
      embed_page_url: streamPage.embed_page_url,
      nestedIframeUrl,
      source_url,
    });

    return {
      source_url,
      title: streamPage.title,
    };
  },
  getIframeDocStrElement(params) {
    return renderIstreameastDocElement(params);
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
  const startTs = parseInt(eventCard.getAttribute("data-start-ts") ?? "", 10);
  if (!Number.isFinite(startTs)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilStart = startTs - nowSeconds;
  const liveElapsedSeconds = nowSeconds - startTs;

  if (secondsUntilStart > 0 && secondsUntilStart <= UPCOMING_WINDOW_SECONDS) {
    return true;
  }

  if (liveElapsedSeconds >= 0 && liveElapsedSeconds < LIVE_WINDOW_SECONDS) {
    return true;
  }

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

type IframeParams = {
  source_url: string;
  title: string;
};

function renderIstreameastDocElement(params: IframeParams): ReactElement {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <title>{params.title}</title>
        <style>{`
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            background: #000;
            overflow: hidden;
          }

          body {
            position: relative;
          }

          #player {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
          }

          #status {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            color: #fff;
            font: 16px sans-serif;
            background: #000;
          }
        `}</style>
      </head>
      <body>
        <video id="player" controls playsInline autoPlay />
        <div id="status">Loading stream...</div>
        <noscript>
          <a href={params.source_url}>Open stream</a>
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(${bootIstreameastPlayer.toString()})(${JSON.stringify(params)});`,
          }}
        />
      </body>
    </html>
  );
}

function bootIstreameastPlayer(params: IframeParams) {
  const sourceUrl = params.source_url;
  const video = document.getElementById("player") as HTMLVideoElement | null;
  const status = document.getElementById("status") as HTMLDivElement | null;

  function log(event: string, details: Record<string, unknown> = {}) {
    const payload = {
      sourceUrl,
      title: params.title,
      ...details,
    };

    console.log(`renderStream:${event}`, payload);

    try {
      const parentWindow = window.parent as Window & {
        console?: Pick<Console, "log">;
      };
      parentWindow.console?.log(`renderStream:${event}`, payload);
    } catch {
      // Ignore parent-console access failures.
    }
  }

  function showStatus(message: string) {
    log("status", { message });
    if (!status) return;
    status.textContent = message;
    status.style.display = "grid";
  }

  function hideStatus() {
    if (!status) return;
    status.style.display = "none";
  }

  function attachSource() {
    if (!sourceUrl || !video) {
      showStatus("Missing stream source.");
      return;
    }

    if (sourceUrl.includes(".m3u8")) {
      log("attach:hls");

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        log("hls:native");
        video.src = sourceUrl;
        hideStatus();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
      script.onload = function () {
        const HlsConstructor = (window as Window & {
          Hls?: {
            new (): {
              loadSource: (source: string) => void;
              attachMedia: (media: HTMLMediaElement) => void;
              on: (event: string, cb: (...args: unknown[]) => void) => void;
            };
            isSupported: () => boolean;
            Events: {
              MANIFEST_PARSED: string;
              ERROR: string;
            };
          };
        }).Hls;

        log("hls:script-loaded", { hasHls: Boolean(HlsConstructor) });

        if (!HlsConstructor || !HlsConstructor.isSupported()) {
          showStatus("HLS is not supported here.");
          return;
        }

        const hls = new HlsConstructor();
        log("hls:created");
        hls.loadSource(sourceUrl);
        hls.attachMedia(video);
        hls.on(HlsConstructor.Events.MANIFEST_PARSED, function () {
          log("hls:manifest-parsed");
          hideStatus();
        });
        hls.on(HlsConstructor.Events.ERROR, function (_event, data) {
          log("hls:error", { data });
          showStatus("Unable to load stream.");
        });
      };
      script.onerror = function () {
        log("hls:script-error");
        showStatus("Unable to load player library.");
      };
      document.head.appendChild(script);
      return;
    }

    log("attach:direct");
    video.src = sourceUrl;
    hideStatus();
  }

  if (!video) {
    showStatus("Missing player element.");
    return;
  }

  video.addEventListener("loadstart", function () {
    log("video:loadstart", {
      currentSrc: video.currentSrc,
      networkState: video.networkState,
      readyState: video.readyState,
    });
  });

  video.addEventListener("loadedmetadata", function () {
    log("video:loadedmetadata", {
      currentSrc: video.currentSrc,
      duration: video.duration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    });
  });

  video.addEventListener("canplay", function () {
    log("video:canplay", {
      currentSrc: video.currentSrc,
      readyState: video.readyState,
    });
  });

  video.addEventListener("error", function () {
    const error = video.error;
    log("video:error", {
      currentSrc: video.currentSrc,
      networkState: video.networkState,
      readyState: video.readyState,
      code: error ? error.code : null,
      message: error ? error.message : null,
    });
    showStatus("Unable to play stream.");
  });

  log("init");
  attachSource();
}
