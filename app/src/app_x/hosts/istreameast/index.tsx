import type { Host } from "../../config/types";
import { fetchEspnScheduleEventsForCategories } from "../../lib/espn";
import { ISTREAMEAST_URL } from "./constants";
import { renderIstreameastDocElement } from "./iframe";
import { resolveStreamFid } from "./playback";
import { fetchIstreameastHtml, fetchProxyText } from "./proxy";
import { parseStreamPageDetails, parseStreamsFromHtml } from "./streams";
import type { IframeParams } from "./types";

function getIstreameastLeagueCategories() {
  return ["NFL", "NBA", "MLB", "NHL", "CFL", "CFB", "NCAAB", "UFC", "BOXING", "SOCCER", "F1"] as const;
}

export const istreameastHost: Host<IframeParams> = {
  getLeagueCategories: getIstreameastLeagueCategories,
  async getStreams(category) {
    const streamListHtml = await fetchIstreameastHtml();
    const leagueCategories = getIstreameastLeagueCategories();
    const espnEvents = await fetchEspnScheduleEventsForCategories(category, leagueCategories).catch(
      (error: unknown) => {
        console.error("istreameast:fetchEspnScheduleEvents", error);
        return [];
      },
    );
    return parseStreamsFromHtml(streamListHtml, category, espnEvents, leagueCategories);
  },
  async getIframeParams(stream) {
    if (!stream.raw_url) {
      throw new Error(`Missing raw stream URL for "${stream.title}".`);
    }

    const streamPageUrl = new URL(stream.raw_url, ISTREAMEAST_URL).toString();
    const streamPageHtml = await fetchProxyText(streamPageUrl);
    const streamPageDetails = parseStreamPageDetails(streamPageHtml);

    const fid = streamPageDetails.embedPageUrl
      ? await resolveStreamFid(streamPageDetails.embedPageUrl)
      : "";

    if (!fid) {
      throw new Error(
        `Unable to resolve a fid for "${stream.title}".`,
      );
    }

    return {
      fid,
    };
  },
  getIframeDocStrElement(params) {
    return renderIstreameastDocElement(params);
  },
};
