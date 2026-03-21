/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildTeamSummaries, fetchJson, findStatIndex } from "./shared";
import type { BoxScoreType, DriveType, HockeyLeagueConfig, LogType } from "./types";

type HockeyRenderedPlay = {
  team: string;
  down: string;
  text: string;
  clock: string;
  score: string;
  result?: string;
  meta?: string;
};

export async function getHockeyLog(
  espnId: number,
  config: HockeyLeagueConfig,
): Promise<LogType | null> {
  const summaryObj = await fetchJson(
    `https://site.web.api.espn.com/apis/site/v2/sports/${config.sport}/${config.espnLeague}/summary?region=us&lang=en&contentorigin=espn&event=${espnId}`,
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

  const teamsById = buildHockeyTeamsById(summaryObj);

  return {
    timestamp,
    teams: buildTeamSummaries(summaryObj),
    playByPlay: buildHockeyPlayByPlay(plays, teamsById),
    boxScore: buildHockeyBoxScore((summaryObj as any).boxscore?.players ?? [], config.boxScoreKeys),
  };
}

function buildHockeyTeamsById(summaryObj: any): Record<string, string> {
  return Object.fromEntries(
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
      ...((((summaryObj as any).boxscore?.players as any[]) ?? []).map((teamObj: any) => [
        teamObj.team?.id,
        teamObj.team?.shortDisplayName || teamObj.team?.displayName || teamObj.team?.name || "",
      ])),
    ].filter(([teamId]) => Boolean(teamId)),
  );
}

function buildHockeyPlayByPlay(plays: any[], teamsById: Record<string, string>) {
  return plays
    .map((play) => normalizeHockeyPlay(play, teamsById))
    .filter((play) => play.text)
    .map((play) => {
      const description = play.text;

      return {
        team: play.team,
        result: play.result,
        meta: play.meta,
        plays: [
          {
            down: play.down,
            text: play.text,
            clock: play.clock,
          },
        ],
        description,
        score: play.score,
      } satisfies DriveType;
    });
}

function normalizeHockeyPlay(play: any, teamsById: Record<string, string>): HockeyRenderedPlay {
  const period = parseInt(String(play.period?.number || "0"), 10) || 0;
  const awayScore = play.awayScore ?? play.scoreValue?.away;
  const homeScore = play.homeScore ?? play.scoreValue?.home;

  return {
    team:
      teamsById[play.team?.id] ||
      play.team?.shortDisplayName ||
      play.team?.displayName ||
      play.team?.abbreviation ||
      play.team?.name ||
      "",
    result: play.scoringPlay ? "SCORE" : undefined,
    down: play.type?.text || "",
    text: play.text || play.shortText || "",
    clock: `P${period || ""} ${play.clock?.displayValue || ""}`.trim(),
    score:
      awayScore !== undefined || homeScore !== undefined ? `${awayScore ?? ""} - ${homeScore ?? ""}` : "",
    meta: formatHockeyPlayMeta(play),
  };
}

function formatHockeyPlayMeta(play: any) {
  const strength =
    play.strength?.displayName ||
    play.strength?.name ||
    play.situation?.strength ||
    "";
  const shootout =
    play.shootout ? "Shootout" : "";

  return [strength, shootout].filter(Boolean).join(" | ") || undefined;
}

function buildHockeyBoxScore(players: any[], keys: readonly string[]): BoxScoreType[] {
  const statConfig: Record<
    string,
    {
      blockNames: readonly string[];
      rankKeys: readonly string[];
      columns: readonly string[][];
    }
  > = {
    skaters: {
      blockNames: ["skaters", "forwards", "players"],
      rankKeys: ["points", "goals", "assists", "shots", "shotsOnGoal"],
      columns: [
        ["goals", "G"],
        ["assists", "A"],
        ["points", "PTS"],
        ["shots", "shotsOnGoal", "SOG"],
        ["plusMinus", "+/-"],
      ],
    },
    goalies: {
      blockNames: ["goalies", "goaltending"],
      rankKeys: ["saves", "savePct", "savePercentage"],
      columns: [
        ["saves", "SV"],
        ["shotsAgainst", "SA"],
        ["goalsAgainst", "GA"],
        ["savePct", "savePercentage", "SV%"],
        ["timeOnIce", "TOI"],
      ],
    },
  };

  return keys.map((key) => {
    const config = statConfig[key];
    if (!config) {
      return { key, labels: [], players: [] };
    }

    const athletes = (players || []).flatMap((team: any) => {
      const statBlock = (team.statistics || []).find((stat: any) =>
        config.blockNames.includes(stat.name) || config.blockNames.includes(stat.type),
      );
      if (!statBlock) return [];

      const blockKeys = statBlock.keys || [];
      const labels = config.columns.map((aliases) => {
        const index = findStatIndex(blockKeys, aliases);
        return index >= 0 ? statBlock.labels?.[index] || aliases[aliases.length - 1] : aliases[aliases.length - 1];
      });
      const rankIndex = findStatIndex(blockKeys, config.rankKeys);
      const columnIndexes = config.columns.map((aliases) => findStatIndex(blockKeys, aliases));

      return (statBlock.athletes || [])
        .filter((athlete: any) => (athlete.stats || []).length > 0)
        .map((athlete: any) => ({
          name: athlete.athlete?.displayName ?? "",
          stats: columnIndexes.map((columnIndex) =>
            columnIndex >= 0 ? athlete.stats[columnIndex] || "" : "",
          ),
          rank: rankIndex >= 0 ? parseFloat(String(athlete.stats?.[rankIndex] || "0")) || 0 : 0,
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
