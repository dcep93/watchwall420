import type { Category, Host, Stream } from "../config/types";
import { fetchTextThroughProxy } from "../lib/proxy420";
import { renderStreamJsonHtml } from "../lib/renderStream";

const ISTREAMEAST_URL = "https://istreameast.is/";
const UPCOMING_WINDOW_SECONDS = 60 * 60;
const DEFAULT_LIVE_WINDOW_SECONDS = 10_600;
const WATCHWALL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

export async function fetchIstreameastHtml(
  maxAgeMs = Number.POSITIVE_INFINITY,
) {
  return fetchTextThroughProxy({
    url: ISTREAMEAST_URL,
    maxAgeMs,
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
  async getIframeDocStr(stream) {
    return renderStreamJsonHtml(stream);
  },
} satisfies Host;

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

  const liveWindowSeconds = parseInt(
    eventCard.getAttribute("data-live-window") ?? "",
    10,
  );
  const resolvedLiveWindowSeconds = Number.isFinite(liveWindowSeconds)
    ? liveWindowSeconds
    : DEFAULT_LIVE_WINDOW_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const secondsUntilStart = startTs - nowSeconds;

  if (secondsUntilStart > 0 && secondsUntilStart <= UPCOMING_WINDOW_SECONDS) {
    return true;
  }

  const liveElapsedSeconds = nowSeconds - startTs;
  return liveElapsedSeconds >= 0 && liveElapsedSeconds < resolvedLiveWindowSeconds;
}
