import type { Host } from "../../config/types";
import { fetchEspnScheduleEventsForCategories } from "../../lib/espn";
import { ISTREAMEAST_URL } from "./constants";
import { renderIstreameastPlayerDocument } from "./iframe";
import { resolveEmbedPlayback } from "./playback";
import { fetchIstreameastHtml, fetchIstreameastPageText } from "./proxy";
import { parseStreamWatchPage, parseStreamsFromHtml } from "./streams";
import type { IframeParams } from "./types";

function getSupportedIstreameastCategories() {
  return ["NFL", "NBA", "MLB", "NHL", "CFL", "CFB", "NCAAB", "UFC", "BOXING", "SOCCER", "F1"] as const;
}

export const istreameastHost: Host<IframeParams> = {
    getLeagueCategories: getSupportedIstreameastCategories,
  async getStreams(category) {
    const streamListHtml = await fetchIstreameastHtml();
    const supportedCategories = getSupportedIstreameastCategories();
    const espnEvents = await fetchEspnScheduleEventsForCategories(category, supportedCategories).catch(
      (error: unknown) => {
        console.error("istreameast:fetchEspnScheduleEvents", error);
        return [];
      },
    );
    return parseStreamsFromHtml(streamListHtml, category, espnEvents, supportedCategories);
  },
  async getIframeParams(stream) {
    if (!stream.raw_url) {
      throw new Error(`Missing raw stream URL for "${stream.title}".`);
    }

    const watchPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const watchPageHtml = await fetchIstreameastPageText(watchPageUrl);
    const watchPage = parseStreamWatchPage(watchPageHtml);

    const resolvedPlayback = watchPage.embedPageUrl
      ? await resolveEmbedPlayback(watchPage.embedPageUrl)
      : { fid: "", iframeSourcePageUrl: "" };

    if (!resolvedPlayback.fid) {
      throw new Error(
        `Unable to resolve a fid for "${stream.title}".`,
      );
    }

    const iframeParams = {
      fid: resolvedPlayback.fid,
      _rawUrl: stream.raw_url,
      _embedPageUrl: watchPage.embedPageUrl,
      _iframeSourcePageUrl: resolvedPlayback.iframeSourcePageUrl,
    };

    return iframeParams;
  },
  getIframeDocStrElement(iframeParams) {
    return renderIstreameastPlayerDocument(iframeParams);
  },
};
