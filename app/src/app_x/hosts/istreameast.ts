import type { Category, Host, Stream } from "../config/types";
import { fetchTextThroughProxy } from "../lib/proxy420";
import { renderStreamJsonHtml } from "../lib/renderStream";

const ISTREAMEAST_URL = "https://istreameast.is/";
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
  getIframeDocStr(stream) {
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
      const detailsElement = eventCard.querySelector(".event-details");

      if (!leagueElement || !titleElement || !detailsElement) {
        return null;
      }

      const strippedLeague = leagueElement.textContent?.trim() ?? "";
      if (!leaguePattern.test(strippedLeague)) {
        return null;
      }

      const title = titleElement.textContent?.trim() ?? "";
      if (!title) {
        return null;
      }

      return {
        title,
        slug: title.split(" vs ").at(-1)?.trim() ?? title,
      } satisfies Stream;
    })
    .filter((stream): stream is Stream => stream !== null);
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
