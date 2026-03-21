import type { Host } from "../../config/types";
import { fetchEspnScheduleEventsForCategories } from "../../lib/espn";
import { ISTREAMEAST_URL } from "./constants";
import { renderIstreameastPlayerDocument } from "./iframe";
import { resolveEmbedPlayback } from "./playback";
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
  async getIframeParams(stream) {
    if (!stream.raw_url) {
      throw new Error(`Missing raw stream URL for "${stream.title}".`);
    }

    const watchPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const watchPageHtml = await fetchIstreameastPageText(watchPageUrl);
    const watchPage = parseStreamWatchPage(watchPageHtml);

    const iframeParams = {
      _1_rawUrl: stream.raw_url,
      _2_embedPageUrl: watchPage.embedPageUrl,
      _3_iframeSourcePageUrl: "",
      _4_fid: "",
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

    const resolvedPlayback = await resolveEmbedPlayback(iframeParams._2_embedPageUrl);

    iframeParams._3_iframeSourcePageUrl = resolvedPlayback.iframeSourcePageUrl;
    iframeParams._4_fid = resolvedPlayback.fid;

    return iframeParams;
  },
  getIframeDocStrElement(iframeParams) {
    return renderIstreameastPlayerDocument(iframeParams);
  },
};
