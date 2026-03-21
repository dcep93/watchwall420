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

  return {
    timestamp,
    teams: buildTeamSummaries(summaryObj),
    playByPlay: buildBaseballPlayByPlay(plays),
    boxScore: buildBaseballBoxScore((summaryObj as any).boxscore?.players ?? [], config.boxScoreKeys),
  };
}

function buildBaseballPlayByPlay(plays: any[]) {
  return plays
    .map(normalizeBaseballPlay)
    .filter((play) => play.text)
    .map((play) => ({
      team: play.team,
      result: play.result,
      plays: [
        {
          down: play.down,
          text: play.text,
          clock: play.clock,
        },
      ],
      description: play.text,
      score: play.score,
    }) satisfies DriveType);
}

function normalizeBaseballPlay(play: any) {
  const awayScore = play.awayScore ?? play.scoreValue?.away;
  const homeScore = play.homeScore ?? play.scoreValue?.home;
  const situation = [
    formatBaseballCount(play),
    formatBaseballBases(play),
    formatBaseballOuts(play),
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    team:
      play.team?.shortDisplayName ||
      play.team?.displayName ||
      play.team?.abbreviation ||
      play.team?.name ||
      "",
    result: play.scoringPlay ? "SCORE" : undefined,
    down: situation,
    text: play.text || play.shortText || "",
    clock: formatBaseballClock(play),
    score:
      awayScore !== undefined || homeScore !== undefined ? `${awayScore ?? ""} - ${homeScore ?? ""}` : "",
  };
}

function formatBaseballClock(play: any) {
  const inning = play.period?.number ?? play.period ?? play.inning;
  const halfInning =
    play.homeAway ||
    play.period?.type ||
    play.period?.displayValue ||
    play.clock?.displayValue ||
    play.inningHalf;
  const normalizedHalfInning = String(halfInning || "").trim().toLowerCase();
  const inningLabel =
    normalizedHalfInning === "top" || normalizedHalfInning === "top of the inning"
      ? "Top"
      : normalizedHalfInning === "bottom" || normalizedHalfInning === "bottom of the inning"
        ? "Bot"
        : normalizedHalfInning;

  return [inningLabel, inning ? String(inning) : ""].filter(Boolean).join(" ").trim();
}

function formatBaseballCount(play: any) {
  const balls = play.count?.balls ?? play.balls;
  const strikes = play.count?.strikes ?? play.strikes;
  if (!Number.isFinite(balls) && !Number.isFinite(strikes)) {
    return "";
  }
  return `${balls ?? 0}-${strikes ?? 0}`;
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
      rankKeys: ["hits", "RBI", "rbis", "runs", "totalBases"],
      columns: [
        ["atBats", "AB"],
        ["runs", "R"],
        ["hits", "H"],
        ["RBI", "rbis", "RBI"],
        ["walks", "BB"],
        ["strikeouts", "SO"],
      ],
    },
    pitching: {
      rankKeys: ["strikeouts", "innings", "outs"],
      columns: [
        ["innings", "IP"],
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
      const statBlock = (team.statistics || []).find((stat: any) => stat.name === key);
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
