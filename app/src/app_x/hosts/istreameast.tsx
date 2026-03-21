import type { Category, Host, Stream } from "../config/types";
import { fetchTextThroughProxy } from "../lib/proxy420";
import type { ReactElement } from "react";

const ISTREAMEAST_URL = "https://istreameast.is/";
const LOCAL_PROXY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REMOTE_PROXY_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const UPCOMING_WINDOW_SECONDS = 60 * 60;
const LIVE_WINDOW_SECONDS = 10_600;
const ESPN_MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;
const STREAM_SOURCE_PATTERN = /\.(?:m3u8|mp4)(?:$|[?#])/i;
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
    const espnEvents = await fetchEspnScheduleEvents(category).catch((error) => {
      console.error("istreameast:fetchEspnScheduleEvents", error);
      return [];
    });
    return parseStreamsFromHtml(html, category, espnEvents);
  },
  async getIframeParams(stream) {
    if (!stream.raw_url) {
      throw new Error(`Missing raw stream URL for "${stream.title}".`);
    }

    const streamPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const rawHtml = await fetchProxyText(streamPageUrl);
    const streamPage = parseStreamPage(rawHtml);

    const playback_url = streamPage.embed_page_url
      ? await resolvePlayableSourceUrl(streamPage.embed_page_url)
      : "";

    if (!playback_url) {
      throw new Error(`Unable to resolve a playable source for "${stream.title}".`);
    }

    console.log("istreameast:getIframeParams", {
      title: stream.title,
      streamPageUrl,
      embed_page_url: streamPage.embed_page_url,
      playback_url,
    });

    return {
      playback_url,
      title: streamPage.title || stream.title,
    };
  },
  getIframeDocStrElement(params) {
    return renderIstreameastDocElement(params);
  },
} satisfies Host<{ playback_url: string; title: string }>;

type EspnScheduleEvent = {
  id: number;
  startTimeMs: number;
  competitors: string[];
  normalizedCompetitors: string[];
};

function parseStreamsFromHtml(
  html: string,
  category: Category,
  espnEvents: EspnScheduleEvent[],
): Stream[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const leaguePattern = new RegExp(`\\b${escapeForRegex(category)}\\b`);
  const seenRawUrls = new Set<string>();

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
      if (!title || !rawUrl || seenRawUrls.has(rawUrl)) {
        return null;
      }
      seenRawUrls.add(rawUrl);

      const startTimeMs = getEventStartTimeMs(eventCard);

      return {
        category,
        espn_id: resolveEspnEventId(title, startTimeMs, espnEvents),
        raw_url: rawUrl,
        title,
        slug: buildStreamSlug(title, rawUrl),
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
  return match?.[1]?.trim() ?? "";
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

function getEventStartTimeMs(eventCard: Element) {
  const startTs = parseInt(eventCard.getAttribute("data-start-ts") ?? "", 10);
  if (!Number.isFinite(startTs)) {
    return null;
  }

  return startTs * 1000;
}

function parseStreamPage(rawHtml: string) {
  const document = new DOMParser().parseFromString(rawHtml, "text/html");
  const embed_page_url = [
    document.querySelector("#main-player")?.getAttribute("src"),
    document.querySelector(".server-btn.active")?.getAttribute("data-src"),
    document.querySelector(".server-btn")?.getAttribute("data-src"),
  ]
    .map((value) => value?.trim() ?? "")
    .find(Boolean);
  const title =
    document.querySelector(".hero-title")?.textContent?.trim() ??
    document.title ??
    "Streameast Stream";

  return {
    embed_page_url: resolveUrl(embed_page_url ?? "", ISTREAMEAST_URL),
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

async function resolvePlayableSourceUrl(
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

function matchStrings(value: string, pattern: RegExp) {
  return Array.from(value.matchAll(pattern), (match) => match[1]?.trim() ?? "").filter(Boolean);
}

function resolveUrl(candidate: string, baseUrl: string) {
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

function isPlayableSourceUrl(value: string) {
  return STREAM_SOURCE_PATTERN.test(new URL(value).pathname + new URL(value).search);
}

function buildStreamSlug(title: string, rawUrl: string) {
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

async function fetchEspnScheduleEvents(category: Category) {
  const endpoint = ESPN_SCOREBOARD_ENDPOINTS[category];
  if (!endpoint) {
    return [];
  }

  const payloads = await Promise.all(
    getEspnDateCandidates().map((date) =>
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${endpoint.sport}/${endpoint.league}/scoreboard?dates=${date}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`ESPN scoreboard request failed with status ${response.status}.`);
          }

          return response.json();
        })
        .catch((error) => {
          console.error("istreameast:fetchEspnScoreboard", { category, date, error });
          return null;
        }),
    ),
  );

  return parseEspnScoreboardEvents(payloads);
}

const ESPN_SCOREBOARD_ENDPOINTS: Partial<
  Record<
    Category,
    {
      sport: string;
      league: string;
    }
  >
> = {
  NFL: { sport: "football", league: "nfl" },
  NBA: { sport: "basketball", league: "nba" },
  MLB: { sport: "baseball", league: "mlb" },
  NHL: { sport: "hockey", league: "nhl" },
  CFL: { sport: "football", league: "cfl" },
  CFB: { sport: "football", league: "college-football" },
  NCAAB: { sport: "basketball", league: "mens-college-basketball" },
  UFC: { sport: "mma", league: "ufc" },
  BOXING: { sport: "boxing", league: "boxing" },
  SOCCER: { sport: "soccer", league: "eng.1" },
  F1: { sport: "racing", league: "f1" },
};

function parseEspnScoreboardEvents(payloads: unknown[]): EspnScheduleEvent[] {
  type EspnScoreboardEvent = {
    id?: string | number;
    date?: string;
    competitions?: Array<{
      date?: string;
      competitors?: Array<{
        team?: {
          displayName?: string;
          shortDisplayName?: string;
          shortName?: string;
          abbreviation?: string;
          location?: string;
          name?: string;
        };
      }>;
    }>;
  };

  return payloads
    .flatMap((payload) => {
      const events = (payload as { events?: EspnScoreboardEvent[] } | null)?.events;
      return Array.isArray(events) ? events : [];
    })
    .map((event) => {
      const eventId = parseInt(String(event.id ?? ""), 10);
      const competitors =
        event.competitions?.[0]?.competitors
          ?.map((competitor) => getEspnTeamNames(competitor.team))
          .flat() ??
        [];
      const startTimeMs = Date.parse(event.competitions?.[0]?.date ?? event.date ?? "");

      if (!Number.isFinite(eventId) || !Number.isFinite(startTimeMs) || competitors.length === 0) {
        return null;
      }

      const normalizedCompetitors = Array.from(
        new Set(competitors.map(normalizeTeamName).filter(Boolean)),
      );

      if (normalizedCompetitors.length === 0) {
        return null;
      }

      return {
        id: eventId,
        startTimeMs,
        competitors: Array.from(new Set(competitors)),
        normalizedCompetitors,
      } satisfies EspnScheduleEvent;
    })
    .filter((event): event is EspnScheduleEvent => event !== null);
}

function getEspnDateCandidates() {
  const today = new Date();

  return [-1, 0, 1].map((offsetDays) => {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + offsetDays);
    return formatEspnDate(nextDate);
  });
}

function formatEspnDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getEspnTeamNames(team: {
  displayName?: string;
  shortDisplayName?: string;
  shortName?: string;
  abbreviation?: string;
  location?: string;
  name?: string;
} | null | undefined) {
  if (!team) {
    return [];
  }

  return Array.from(
    new Set(
      [
        team.displayName,
        team.shortDisplayName,
        team.shortName,
        team.abbreviation,
        [team.location, team.name].filter(Boolean).join(" "),
        team.location,
        team.name,
      ]
        .map((value) => value?.trim() ?? "")
        .filter(Boolean),
    ),
  );
}

function resolveEspnEventId(
  title: string,
  startTimeMs: number | null,
  espnEvents: EspnScheduleEvent[],
) {
  const eventTeams = parseTitleTeams(title);
  if (eventTeams.length === 0) {
    return -1;
  }

  const normalizedEventTeams = eventTeams.map(normalizeTeamName).filter(Boolean);
  if (normalizedEventTeams.length === 0) {
    return -1;
  }

  const matchedEvent = espnEvents
    .map((espnEvent) => ({
      espnEvent,
      teamScore: scoreEspnEventMatch(normalizedEventTeams, espnEvent.normalizedCompetitors),
      timeDeltaMs:
        startTimeMs === null ? Number.POSITIVE_INFINITY : Math.abs(espnEvent.startTimeMs - startTimeMs),
    }))
    .filter(({ teamScore, timeDeltaMs }) => teamScore > 0 && timeDeltaMs <= ESPN_MATCH_WINDOW_MS)
    .sort((left, right) => {
      if (right.teamScore !== left.teamScore) {
        return right.teamScore - left.teamScore;
      }
      return left.timeDeltaMs - right.timeDeltaMs;
    })[0];

  return matchedEvent?.espnEvent.id ?? -1;
}

function parseTitleTeams(title: string) {
  const separators = [" vs ", " @ ", " at "];

  for (const separator of separators) {
    if (!title.toLowerCase().includes(separator.trim())) {
      continue;
    }

    const parts = title.split(new RegExp(separator, "i")).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(0, 2);
    }
  }

  return [title];
}

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bstate\b/g, "st")
    .replace(/\buniversity\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bcf\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreEspnEventMatch(streamTeams: string[], espnTeams: string[]) {
  let score = 0;

  for (const streamTeam of streamTeams) {
    if (espnTeams.some((espnTeam) => teamNamesMatch(streamTeam, espnTeam))) {
      score += 1;
    }
  }

  return score;
}

function teamNamesMatch(left: string, right: string) {
  if (left === right) {
    return true;
  }

  const leftCompact = left.replaceAll(" ", "");
  const rightCompact = right.replaceAll(" ", "");

  if (leftCompact === rightCompact) {
    return true;
  }

  return leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact);
}

type IframeParams = {
  playback_url: string;
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
          <a href={params.playback_url}>Open stream</a>
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
  const playbackUrl = params.playback_url;
  const video = document.getElementById("player") as HTMLVideoElement | null;
  const status = document.getElementById("status") as HTMLDivElement | null;
  const HLS_JS_CDN_URL = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
  const sourceIsHls = /\.m3u8(?:$|[?#])/i.test(playbackUrl);
  let hasStartedPlayback = false;

  function log(event: string, details: Record<string, unknown> = {}) {
    const payload = {
      playbackUrl,
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

  function attemptPlayback() {
    if (!video) return;
    const playResult = video.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch((error: unknown) => {
        log("video:play-rejected", {
          error: error instanceof Error ? error.message : String(error),
        });
        showStatus("Press play to start the stream.");
      });
    }
  }

  function handlePlaybackReady(event: string) {
    hasStartedPlayback = true;
    log(event, {
      currentSrc: video?.currentSrc,
      readyState: video?.readyState,
    });
    hideStatus();
    attemptPlayback();
  }

  function attachSource() {
    if (!playbackUrl || !video) {
      showStatus("Missing stream source.");
      return;
    }

    video.crossOrigin = "anonymous";
    video.preload = "auto";

    if (sourceIsHls) {
      log("attach:hls");

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        log("hls:native");
        video.src = playbackUrl;
        showStatus("Loading stream...");
        attemptPlayback();
        return;
      }

      loadHlsScript()
        .then(() => {
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
        hls.loadSource(playbackUrl);
        hls.attachMedia(video);
        hls.on(HlsConstructor.Events.MANIFEST_PARSED, function () {
          handlePlaybackReady("hls:manifest-parsed");
        });
        hls.on(HlsConstructor.Events.ERROR, function (_event, data) {
          log("hls:error", { data });
          showStatus("Unable to load stream.");
        });
      })
        .catch(() => {
          log("hls:script-error");
          showStatus("Unable to load player library.");
        });
      return;
    }

    log("attach:direct");
    video.src = playbackUrl;
    showStatus("Loading stream...");
    attemptPlayback();
  }

  function loadHlsScript() {
    const windowWithHls = window as Window & {
      Hls?: unknown;
      __watchwallHlsScriptPromise__?: Promise<void>;
    };

    if (windowWithHls.Hls) {
      return Promise.resolve();
    }

    if (windowWithHls.__watchwallHlsScriptPromise__) {
      return windowWithHls.__watchwallHlsScriptPromise__;
    }

    windowWithHls.__watchwallHlsScriptPromise__ = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[data-watchwall-hls="true"]`,
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("HLS script failed.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = HLS_JS_CDN_URL;
      script.async = true;
      script.dataset.watchwallHls = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("HLS script failed."));
      document.head.appendChild(script);
    }).catch((error) => {
      delete windowWithHls.__watchwallHlsScriptPromise__;
      log("hls:script-load-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });

    return windowWithHls.__watchwallHlsScriptPromise__;
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
    handlePlaybackReady("video:canplay");
  });

  video.addEventListener("playing", function () {
    handlePlaybackReady("video:playing");
  });

  video.addEventListener("waiting", function () {
    if (!hasStartedPlayback) {
      showStatus("Loading stream...");
      return;
    }
    showStatus("Buffering stream...");
  });

  video.addEventListener("stalled", function () {
    showStatus("Stream stalled. Retrying...");
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
