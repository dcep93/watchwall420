/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildTeamSummaries, fetchJson, findStatIndex } from "./shared";
import type { BaseballLeagueConfig, DriveType, LogType } from "./types";

export async function getBaseballLog(
  espnId: number,
  config: BaseballLeagueConfig,
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
      ...((((summaryObj as any).boxscore?.players as any[]) ?? []).map((teamObj: any) => [
        teamObj.team?.id,
        teamObj.team?.shortDisplayName || teamObj.team?.displayName || teamObj.team?.name || "",
      ])),
    ].filter(([teamId]) => Boolean(teamId)),
  );

  return {
    timestamp,
    teams: buildTeamSummaries(summaryObj).slice().reverse(),
    playByPlay: buildBaseballPlayByPlay(plays, teamsById),
    boxScore: buildBaseballBoxScore((summaryObj as any).boxscore?.players ?? [], config.boxScoreKeys),
  };
}

function buildBaseballPlayByPlay(plays: any[], teamsById: Record<string, string>) {
  const normalizedPlays = plays
    .map((play) => normalizeBaseballPlay(play, teamsById))
    .filter((play) => play.text);

  const groups: typeof normalizedPlays[] = [];
  let currentGroup: typeof normalizedPlays = [];

  normalizedPlays.forEach((play, index) => {
    if (currentGroup.length === 0) {
      currentGroup.push(play);
    } else {
      currentGroup.push(play);
    }

    const nextPlay = normalizedPlays[index + 1];
    if (!nextPlay || play.stateKey !== nextPlay.stateKey) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  });

  return groups
    .map(buildBaseballGroup)
    .filter((group): group is DriveType => Boolean(group));
}

function buildBaseballGroup(
  plays: {
    playType: string;
    stateKey: string;
    team: string;
    result?: string;
    meta: string;
    down: string;
    text: string;
    clock: string;
    score: string;
  }[],
) {
  const visiblePlays = filterBaseballGroupPlays(plays);
  if (visiblePlays.length === 0) {
    return null;
  }

  const renderedOrderPlays = visiblePlays.slice().reverse();
  const summaryPlay =
    renderedOrderPlays.find((play) => isPrimaryBaseballSummaryPlay(play.playType)) || renderedOrderPlays[0];
  const latestPlay = renderedOrderPlays[0];

  return {
    team: plays[0]?.team || summaryPlay.team || latestPlay.team,
    result: renderedOrderPlays.find((play) => play.result === "SCORE") ? "SCORE" : undefined,
    meta: plays[0]?.meta || "",
    plays: visiblePlays.map((play) => ({
      down: "",
      text: play.text,
      clock: play.clock,
    })),
    description: summaryPlay.text,
    score: latestPlay.score,
  } satisfies DriveType;
}

function normalizeBaseballPlay(play: any, teamsById: Record<string, string>) {
  const awayScore = play.awayScore ?? play.scoreValue?.away;
  const homeScore = play.homeScore ?? play.scoreValue?.home;

  return {
    playType: play.type?.type || "",
    stateKey: buildBaseballStateKey(play, awayScore, homeScore),
    team:
      teamsById[play.team?.id] ||
      play.team?.shortDisplayName ||
      play.team?.displayName ||
      play.team?.abbreviation ||
      play.team?.name ||
      "",
    result: play.scoringPlay ? "SCORE" : undefined,
    meta: formatBaseballStateMeta(play),
    down: "",
    text: play.text || play.shortText || "",
    clock: "",
    score:
      awayScore !== undefined || homeScore !== undefined ? `${awayScore ?? ""} - ${homeScore ?? ""}` : "",
  };
}

function filterBaseballGroupPlays(
  plays: {
    playType: string;
    text: string;
    down: string;
    clock: string;
    score: string;
    team: string;
    result?: string;
  }[],
) {
  const meaningfulPlays = plays.filter((play) => !isAdministrativeBaseballPlay(play.playType) && play.text);
  return meaningfulPlays.length > 0 ? meaningfulPlays : plays.filter((play) => play.text);
}

function isPrimaryBaseballSummaryPlay(playType: string) {
  return !["start-batterpitcher", "start-inning"].includes(playType.toLowerCase());
}

function isAdministrativeBaseballPlay(playType: string) {
  return ["end-batterpitcher", "start-inning"].includes(playType.toLowerCase());
}

function formatBaseballStateMeta(play: any) {
  const bases = formatBaseballBases(play);
  const outs = formatBaseballOuts(play);
  return [bases, outs].filter(Boolean).join(" | ");
}

function buildBaseballStateKey(play: any, awayScore: unknown, homeScore: unknown) {
  const bases = formatBaseballBases(play);
  const outs = formatBaseballOuts(play);
  const score =
    awayScore !== undefined || homeScore !== undefined ? `${awayScore ?? ""} - ${homeScore ?? ""}` : "";
  return [bases, outs, score].join(" :: ");
}

function formatBaseballBases(play: any) {
  const onFirst =
    play.onFirst || play.runnersOn?.first || play.baseRunners?.first || play.situation?.onFirst;
  const onSecond =
    play.onSecond || play.runnersOn?.second || play.baseRunners?.second || play.situation?.onSecond;
  const onThird =
    play.onThird || play.runnersOn?.third || play.baseRunners?.third || play.situation?.onThird;
  const occupiedBases = [
    onFirst ? "1B" : "",
    onSecond ? "2B" : "",
    onThird ? "3B" : "",
  ].filter(Boolean);
  return occupiedBases.length > 0 ? occupiedBases.join(", ") : "Bases empty";
}

function formatBaseballOuts(play: any) {
  const outs = play.outs ?? play.count?.outs ?? play.situation?.outs;
  return Number.isFinite(outs) ? `${outs} out${outs === 1 ? "" : "s"}` : "";
}

function buildBaseballBoxScore(players: any[], keys: readonly string[]) {
  const statConfig: Record<
    string,
    {
      rankKeys: readonly string[];
      columns: readonly string[][];
    }
  > = {
    batting: {
      rankKeys: ["hits", "RBIs", "RBI", "rbis", "runs", "totalBases"],
      columns: [
        ["atBats", "AB"],
        ["runs", "R"],
        ["hits", "H"],
        ["RBIs", "RBI", "rbis"],
        ["walks", "BB"],
        ["strikeouts", "SO"],
      ],
    },
    pitching: {
      rankKeys: ["strikeouts", "fullInnings.partInnings", "innings", "outs"],
      columns: [
        ["fullInnings.partInnings", "innings", "IP"],
        ["hits", "H"],
        ["runs", "R"],
        ["earnedRuns", "ER"],
        ["walks", "BB"],
        ["strikeouts", "SO"],
      ],
    },
  };

  return keys.map((key) => {
    const config = statConfig[key];
    const athletes = (players || []).flatMap((team: any) => {
      const statBlock = (team.statistics || []).find(
        (stat: any) => stat.name === key || stat.type === key,
      );
      if (!statBlock || !config) return [];

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
