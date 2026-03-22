import type { Host } from "../../config/types";
import { fetchEspnScheduleEventsForCategories } from "../../lib/espn";
import { ISTREAMEAST_URL } from "./constants";
import { renderIstreameastPlayerDocument } from "./iframe";
import { fetchIstreameastHtml, fetchIstreameastPageText } from "./proxy";
import { parseStreamWatchPage, parseStreamsFromHtml } from "./streams";
import type { IframeParams } from "./types";

function getSupportedIstreameastCategories() {
  return ["NFL", "NBA", "MLB", "NHL", "CFL", "CFB", "NCAAB", "UFC", "SOCCER", "F1"] as const;
}

export const istreameastHost: Host<IframeParams> = {
  getLeagueCategories: getSupportedIstreameastCategories,
  async getStreams() {
    const streamListHtml = await fetchIstreameastHtml();
    const supportedCategories = getSupportedIstreameastCategories();
    const espnEvents = await fetchEspnScheduleEventsForCategories("ALL", supportedCategories).catch(
      (error: unknown) => {
        console.error("istreameast:fetchEspnScheduleEvents", error);
        return [];
      },
    );
    return parseStreamsFromHtml(streamListHtml, espnEvents, supportedCategories);
  },
  async getIframeParams(stream, options) {
    if (!stream.raw_url) {
      throw new Error(`Missing raw stream URL for "${stream.title}".`);
    }

    const watchPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const watchPageHtml = await fetchIstreameastPageText(
      watchPageUrl,
      options?.maxAgeMs,
      options?.maxAgeMs,
    );
    const watchPage = parseStreamWatchPage(watchPageHtml);

    const iframeParams = {
      _1_rawUrl: stream.raw_url,
      _2_embedPageUrl: watchPage.embedPageUrl,
      _3_fetchedAtMs: Date.now(),
    };

    if (!iframeParams._2_embedPageUrl) {
      throw new Error(
        `Unable to resolve an embed page URL for "${stream.title}".\n${JSON.stringify(
          {
            iframeParams,
          },
          null,
          2,
        )}`,
      );
    }

    return iframeParams;
  },
  getIframeDocStrElement(iframeParams) {
    return renderIstreameastPlayerDocument(iframeParams);
  },
};
