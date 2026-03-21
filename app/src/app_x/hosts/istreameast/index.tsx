import type { Host } from "../../config/types";
import { fetchEspnScheduleEventsForCategories } from "../../lib/espn";
import { ISTREAMEAST_URL } from "./constants";
import { renderIstreameastDocElement } from "./iframe";
import { resolvePlayableSourceUrl } from "./playback";
import { fetchIstreameastHtml, fetchProxyText } from "./proxy";
import { parseStreamPage, parseStreamsFromHtml } from "./streams";
import type { IframeParams } from "./types";

function getLeagueCategories() {
  return ["NFL", "NBA", "MLB", "NHL", "CFL", "CFB", "NCAAB", "UFC", "BOXING", "SOCCER", "F1"] as const;
}

export const istreameastHost: Host<IframeParams> = {
  getLeagueCategories,
  async getStreams(category) {
    const html = await fetchIstreameastHtml();
    const leagueCategories = getLeagueCategories();
    const espnEvents = await fetchEspnScheduleEventsForCategories(category, leagueCategories).catch(
      (error: unknown) => {
        console.error("istreameast:fetchEspnScheduleEvents", error);
        return [];
      },
    );
    return parseStreamsFromHtml(html, category, espnEvents, leagueCategories);
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
      throw new Error(
        `Unable to resolve a playable source for "${stream.title}".`,
      );
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
};
