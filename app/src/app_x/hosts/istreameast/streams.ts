import type { Category, Stream, StreamCategory } from "../../config/types";
import { resolveEspnEventId, type EspnScheduleEvent } from "../../lib/espn";
import { ISTREAMEAST_URL, LIVE_WINDOW_SECONDS, UPCOMING_WINDOW_SECONDS } from "./constants";
import { buildStreamSlug, escapeForRegex, resolveUrl } from "./utils";

export function parseStreamsFromHtml(
  streamListHtml: string,
  selectedCategory: Category,
  espnEvents: EspnScheduleEvent[],
  supportedLeagueCategories: readonly StreamCategory[],
): Stream[] {
  const document = new DOMParser().parseFromString(streamListHtml, "text/html");
  const seenRawUrls = new Set<string>();

  return Array.from(document.querySelectorAll(".events-list .event-card"))
    .map((eventCard) => {
      const leagueElement = eventCard.querySelector(".event-league");
      const titleElement = eventCard.querySelector(".event-title");

      if (!leagueElement || !titleElement) {
        return null;
      }

      const strippedLeague = leagueElement.textContent?.trim() ?? "";
      const resolvedCategory = resolveCategory(
        strippedLeague,
        selectedCategory,
        supportedLeagueCategories,
      );
      if (!resolvedCategory) {
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
        category: resolvedCategory,
        espn_id: resolveEspnEventId(title, startTimeMs, espnEvents),
        raw_url: rawUrl,
        title,
        slug: buildStreamSlug(title, rawUrl),
      } satisfies Stream;
    })
    .filter((stream): stream is Stream => stream !== null);
}

export function parseStreamWatchPage(streamWatchPageHtml: string) {
  const document = new DOMParser().parseFromString(streamWatchPageHtml, "text/html");
  const embedPageUrlCandidate = [
    document.querySelector("#main-player")?.getAttribute("src"),
    document.querySelector(".server-btn.active")?.getAttribute("data-src"),
    document.querySelector(".server-btn")?.getAttribute("data-src"),
  ]
    .map((candidateUrl) => candidateUrl?.trim() ?? "")
    .find(Boolean);

  return {
    embedPageUrl: resolveUrl(embedPageUrlCandidate ?? "", ISTREAMEAST_URL),
  };
}

function resolveCategory(
  leagueLabel: string,
  selectedCategory: Category,
  supportedLeagueCategories: readonly StreamCategory[],
): StreamCategory | null {
  if (selectedCategory !== "ALL") {
    return hasLeagueMatch(leagueLabel, selectedCategory) ? selectedCategory : null;
  }

  for (const supportedCategory of supportedLeagueCategories) {
    if (hasLeagueMatch(leagueLabel, supportedCategory)) {
      return supportedCategory;
    }
  }

  return null;
}

function hasLeagueMatch(leagueLabel: string, category: StreamCategory) {
  const leaguePattern = new RegExp(`\\b${escapeForRegex(category)}\\b`);
  return leaguePattern.test(leagueLabel);
}

function getRawUrl(eventCard: Element) {
  const onclick = eventCard.getAttribute("onclick") ?? "";
  const match = onclick.match(/window\.location\.href='([^']+)'/);
  return resolveUrl(match?.[1]?.trim() ?? "", ISTREAMEAST_URL);
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
