import type { Host } from "../../config/types";
import { fetchEspnScheduleEventsForCategories } from "../../lib/espn";
import { ISTREAMEAST_URL } from "./constants";
import { renderIstreameastPlayerDocument } from "./iframe";
import { fetchIstreameastHtml, fetchIstreameastPageText } from "./proxy";
import { parseStreamWatchPage, parseStreamsFromHtml } from "./streams";
import type { IframeParams } from "./types";

const LICHESS_CATEGORY = "LICHESS";
const LICHESS_GAME_URL = "https://lichess.org/MoegD6AstAjq";
const LICHESS_STREAM = {
  category: LICHESS_CATEGORY,
  espn_id: -1,
  raw_url: LICHESS_GAME_URL,
  slug: "lichess-moegd6as",
  title: "Lichess",
} as const;

function getSupportedIstreameastCategories() {
  return ["NFL", "NBA", "MLB", "NHL", "CFL", "CFB", "NCAAB", "UFC", "SOCCER", "F1", "LICHESS"] as const;
}

function appendFetchTimeMs(rawUrl: string, fetchTimeMs: number) {
  const url = new URL(rawUrl);
  url.searchParams.set("fetchTimeMs", String(fetchTimeMs));
  return url.toString();
}

function isLichessStreamUrl(rawUrl: string) {
  return new URL(rawUrl).hostname === "lichess.org";
}

function getLichessEmbedPageUrl(rawUrl: string) {
  const pathPart = new URL(rawUrl).pathname.split("/").filter(Boolean)[0] ?? "";
  const gameId = pathPart.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);

  if (!gameId) {
    throw new Error(`Unable to resolve a Lichess game ID from "${rawUrl}".`);
  }

  const embedUrl = new URL(`/embed/game/${gameId}`, "https://lichess.org");
  embedUrl.searchParams.set("theme", "brown");
  embedUrl.searchParams.set("bg", "dark");
  return embedUrl.toString();
}

export const istreameastHost: Host<IframeParams> = {
  getLeagueCategories: getSupportedIstreameastCategories,
  async getStreams() {
    const fetchTimeMs = Date.now();
    const streamListHtml = await fetchIstreameastHtml();
    const supportedCategories = getSupportedIstreameastCategories();
    const espnEvents = await fetchEspnScheduleEventsForCategories("ALL", supportedCategories).catch(
      (error: unknown) => {
        console.error("istreameast:fetchEspnScheduleEvents", error);
        return [];
      },
    );
    return [...parseStreamsFromHtml(streamListHtml, espnEvents, supportedCategories), LICHESS_STREAM].map(
      (stream) => ({
        ...stream,
        raw_url: appendFetchTimeMs(stream.raw_url, fetchTimeMs),
      }),
    );
  },
  async getIframeParams(stream, options) {
    if (!stream.raw_url) {
      throw new Error(`Missing raw stream URL for "${stream.title}".`);
    }

    if (isLichessStreamUrl(stream.raw_url)) {
      return {
        _0_fetchedAtMs: Date.now(),
        _1_rawUrl: stream.raw_url,
        _2_embedPageUrl: getLichessEmbedPageUrl(stream.raw_url),
      };
    }

    const watchPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const watchPageHtml = await fetchIstreameastPageText(
      watchPageUrl,
      options?.maxAgeMs,
      options?.maxAgeMs,
    );
    const watchPage = parseStreamWatchPage(watchPageHtml);

    const iframeParams = {
      _0_fetchedAtMs: Date.now(),
      _1_rawUrl: stream.raw_url,
      _2_embedPageUrl: watchPage.embedPageUrl,
    };

    if (!iframeParams._2_embedPageUrl) {
      throw new Error(
        `Unable to resolve an embed page URL for "${stream.title}".\n${JSON.stringify(
          iframeParams,
          null,
          2,
        )
        } `,
      );
    }

    return iframeParams;
  },
  getIframeDocStrElement(iframeParams) {
    return renderIstreameastPlayerDocument(iframeParams);
  },
};
