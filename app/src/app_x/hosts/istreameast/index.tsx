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
      fid: "",
      _rawUrl: stream.raw_url,
      _embedPageUrl: watchPage.embedPageUrl,
      _iframeSourcePageUrl: "",
    };

    const resolvedPlayback = watchPage.embedPageUrl
      ? await resolveEmbedPlayback(watchPage.embedPageUrl)
      : { fid: "", iframeSourcePageUrl: "" };

    iframeParams.fid = resolvedPlayback.fid;
    iframeParams._iframeSourcePageUrl = resolvedPlayback.iframeSourcePageUrl;

    if (!resolvedPlayback.fid) {
      throw new Error(
        `Unable to resolve a fid for "${stream.title}".${JSON.stringify(
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
