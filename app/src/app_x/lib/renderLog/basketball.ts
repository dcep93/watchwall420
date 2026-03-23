/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Stream } from "../../config/types";
import { buildTeamSummaries, fetchJson } from "./shared";
import type { BasketballLeagueConfig, DriveType, LogType } from "./types";

export async function getBasketballLog(
  stream: Stream,
  config: BasketballLeagueConfig,
): Promise<LogType | null> {
  const summaryObj = await fetchJson(
    `https://site.web.api.espn.com/apis/site/v2/sports/${config.sport}/${config.espnLeague}/summary?region=us&lang=en&contentorigin=espn&event=${stream.espn_id}`,
  );

  const teamsById = Object.fromEntries(
    [
      ...(((summaryObj as any).header?.competitions?.[0]?.competitors ?? []).map((competitor: any) => [
        competitor.team?.id,
        competitor.team?.shortDisplayName ||
          competitor.team?.displayName ||
          competitor.team?.name ||
          "",
      ])),
      ...((((summaryObj as any).boxscore?.teams as any[]) ?? []).map((teamObj: any) => [
        teamObj.team?.id,
        teamObj.team?.shortDisplayName || teamObj.team?.displayName || teamObj.team?.name || "",
      ])),
    ].filter(([teamId]) => Boolean(teamId)),
  );

  const plays = (((summaryObj as any).plays as any[]) ?? []).slice();
  if (plays.length === 0) {
    return null;
  }

  const timestamp =
    Date.parse(
      (summaryObj as any).meta?.lastPlayWallClock ||
        plays[plays.length - 1]?.wallclock ||
        (summaryObj as any).header?.competitions?.[0]?.date ||
        "",
    ) || Date.now();

  return {
    timestamp,
    teams: buildTeamSummaries(summaryObj, stream.title),
    playByPlay: buildBasketballPlayByPlay(plays, teamsById),
    boxScore: buildBasketballBoxScore((summaryObj as any).boxscore?.players ?? [], config.boxScoreKeys),
  };
}

function buildBasketballPlayByPlay(plays: any[], teamsById: Record<string, string>) {
  const normalizedPlays = plays.map((play) => normalizeBasketballPlay(play, teamsById));
  const groups: DriveType[] = [];
  let currentGroup: (typeof normalizedPlays) | null = null;
  let index = 0;

  const pushCurrentGroup = () => {
    if (!currentGroup || currentGroup.length === 0) return;
    groups.push(buildBasketballGroup(currentGroup));
    currentGroup = null;
  };

  while (index < normalizedPlays.length) {
    const play = normalizedPlays[index];

    if (isFreeThrowPlay(play)) {
      pushCurrentGroup();
      const freeThrowPlays = [play];
      const freeThrowClock = play.clock;
      index += 1;
      while (
        index < normalizedPlays.length &&
        (isFreeThrowPlay(normalizedPlays[index]) || normalizedPlays[index].clock === freeThrowClock)
      ) {
        freeThrowPlays.push(normalizedPlays[index]);
        index += 1;
      }
      groups.push(buildBasketballGroup(freeThrowPlays));
      continue;
    }

    if (!currentGroup) {
      currentGroup = [];
    }
    currentGroup.push(play);
    if (play.result === "SCORE") {
      pushCurrentGroup();
    }
    index += 1;
  }

  pushCurrentGroup();
  return groups;
}

function buildBasketballGroup(
  plays: {
    team: string;
    result?: string;
    down: string;
    text: string;
    clock: string;
    score: string;
  }[],
) {
  const visiblePlays = filterBasketballGroupPlays(plays);
  const renderedOrderPlays = visiblePlays.slice().reverse();
  const summaryPlay =
    renderedOrderPlays.find((play) => isPrimaryBasketballSummaryPlay(play.down)) ||
    renderedOrderPlays[0] ||
    visiblePlays[visiblePlays.length - 1];
  const latestPlay = renderedOrderPlays[0] || visiblePlays[0] || plays[plays.length - 1];

  return {
    team: summaryPlay.team || latestPlay.team,
    result: plays.find((play) => play.result === "SCORE") ? "SCORE" : undefined,
    plays: visiblePlays.map((play) => ({
      down: getBasketballPlayMetaLabel(play),
      text: play.text,
      clock: play.clock,
    })),
    description: summaryPlay.text,
    score: latestPlay.score,
  } satisfies DriveType;
}

function normalizeBasketballPlay(play: any, teamsById: Record<string, string>) {
  const period = parseInt(String(play.period?.number || "0"), 10) || 0;
  return {
    team:
      teamsById[play.team?.id] ||
      play.team?.shortDisplayName ||
      play.team?.displayName ||
      play.team?.abbreviation ||
      "",
    result: play.scoringPlay ? "SCORE" : undefined,
    down: play.type?.text || "",
    text: play.text || play.shortText || "",
    clock: `P${period || ""} ${play.clock?.displayValue || ""}`.trim(),
    score: `${play.awayScore ?? ""} - ${play.homeScore ?? ""}`,
  };
}

function isFreeThrowPlay(play: { down: string; text: string }) {
  const down = play.down.toLowerCase();
  const text = play.text.toLowerCase();
  return down.includes("freethrow") || text.includes("free throw");
}

function filterBasketballGroupPlays(
  plays: {
    down: string;
    text: string;
    clock: string;
    score: string;
    team: string;
    result?: string;
  }[],
) {
  const meaningfulPlays = plays.filter((play) => !isAdministrativeBasketballPlay(play.down));
  return meaningfulPlays.length > 0 ? meaningfulPlays : plays;
}

function isPrimaryBasketballSummaryPlay(down: string) {
  return !isAdministrativeBasketballPlay(down);
}

function isAdministrativeBasketballPlay(down: string) {
  const normalized = down.toLowerCase();
  return [
    "substitution",
    "officialtvtimeout",
    "shorttimeout",
    "timeout",
    "dead ball rebound",
    "deadballteamrebound",
  ].includes(normalized);
}

function getBasketballPlayMetaLabel(play: { down: string }) {
  const normalized = play.down.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  // ESPN's basketball play types are usually just machine-ish duplicates
  // of the human-readable play text, so we only keep the clock in the UI.
  return "";
}

function buildBasketballBoxScore(players: any[], keys: readonly string[]) {
  const statConfig: Record<string, { rankKey: string; columns: readonly string[] }> = {
    points: {
      rankKey: "points",
      columns: [
        "minutes",
        "points",
        "fieldGoalsMade-fieldGoalsAttempted",
        "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
        "freeThrowsMade-freeThrowsAttempted",
      ],
    },
    rebounds: {
      rankKey: "rebounds",
      columns: ["minutes", "rebounds", "offensiveRebounds", "defensiveRebounds"],
    },
    assists: {
      rankKey: "assists",
      columns: ["minutes", "assists", "turnovers"],
    },
  };

  return keys.map((key) => {
    const config = statConfig[key];
    const athletes = (players || []).flatMap((team: any) => {
      const statBlock = team.statistics?.[0];
      if (!statBlock || !config) return [];
      const blockKeys = statBlock.keys || [];
      const labels = config.columns.map((columnKey) => {
        const index = blockKeys.findIndex((blockKey: string) => blockKey === columnKey);
        return statBlock.labels?.[index] || columnKey;
      });
      const rankIndex = blockKeys.findIndex((blockKey: string) => blockKey === config.rankKey);
      const columnIndexes = config.columns.map((columnKey) =>
        blockKeys.findIndex((blockKey: string) => blockKey === columnKey),
      );

      return (statBlock.athletes || [])
        .filter((athlete: any) => (athlete.stats || []).length > 0 && rankIndex >= 0)
        .map((athlete: any) => ({
          name: athlete.athlete?.displayName ?? "",
          stats: columnIndexes.map((columnIndex) =>
            columnIndex >= 0 ? athlete.stats[columnIndex] || "" : "",
          ),
          rank: parseFloat(athlete.stats[rankIndex] || "0") || 0,
          labels,
        }));
    });

    return {
      key,
      labels: athletes[0]?.labels || [],
      players: athletes
        .sort((left, right) => right.rank - left.rank)
        .map(({ name, stats }) => ({ name, stats })),
    };
  });
}
