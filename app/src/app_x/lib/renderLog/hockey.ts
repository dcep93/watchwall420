/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Stream } from "../../config/types";
import { buildTeamSummaries, fetchJson, findStatIndex } from "./shared";
import type { BoxScoreType, DriveType, HockeyLeagueConfig, LogType } from "./types";

type HockeyRenderedPlay = {
  team: string;
  type: string;
  down: string;
  text: string;
  clock: string;
  score: string;
  result?: string;
  meta?: string;
};

export async function getHockeyLog(
  stream: Stream,
  config: HockeyLeagueConfig,
): Promise<LogType | null> {
  const summaryObj = await fetchJson(
    `https://site.web.api.espn.com/apis/site/v2/sports/${config.sport}/${config.espnLeague}/summary?region=us&lang=en&contentorigin=espn&event=${stream.espn_id}`,
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
    teams: buildTeamSummaries(summaryObj, stream.title),
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
  const normalizedPlays = plays
    .map((play) => normalizeHockeyPlay(play, teamsById))
    .filter((play) => play.text && !isAdministrativeHockeyPlay(play.type));

  const groups: HockeyRenderedPlay[][] = [];
  let currentGroup: HockeyRenderedPlay[] = [];

  const pushCurrentGroup = () => {
    if (currentGroup.length === 0) return;
    groups.push(currentGroup);
    currentGroup = [];
  };

  for (const play of normalizedPlays) {
    if (currentGroup.length === 0) {
      currentGroup.push(play);
      if (shouldCloseHockeyGroup(play)) {
        pushCurrentGroup();
      }
      continue;
    }

    const previousPlay = currentGroup[currentGroup.length - 1];
    if (shouldStartNewHockeyGroup(previousPlay, play)) {
      pushCurrentGroup();
    }

    currentGroup.push(play);

    if (shouldCloseHockeyGroup(play)) {
      pushCurrentGroup();
    }
  }

  pushCurrentGroup();

  return groups
    .map(buildHockeyGroup)
    .filter((group): group is DriveType => group !== null);
}

function buildHockeyGroup(plays: HockeyRenderedPlay[]): DriveType | null {
  const visiblePlays = filterHockeyGroupPlays(plays);
  if (visiblePlays.length === 0) {
    return null;
  }

  const renderedOrderPlays = visiblePlays.slice().reverse();
  const summaryPlay =
    renderedOrderPlays.find((play) => isPrimaryHockeySummaryPlay(play.type)) ||
    renderedOrderPlays[0] ||
    visiblePlays[visiblePlays.length - 1];
  const latestPlay = renderedOrderPlays[0] || visiblePlays[0];
  const team =
    summaryPlay.team ||
    latestPlay.team ||
    plays.find((play) => play.team)?.team ||
    "";
  const meta = Array.from(
    new Set(
      [latestPlay.meta, summaryPlay.meta, plays[0]?.meta]
        .filter((value): value is string => Boolean(value)),
    ),
  ).join(" | ");

  return {
    team,
    result: plays.find((play) => play.result === "SCORE") ? "SCORE" : undefined,
    meta: meta || undefined,
    plays: visiblePlays.map((play) => ({
      down: play.down,
      text: play.text,
      clock: play.clock,
    })),
    description: summaryPlay.text,
    score: latestPlay.score,
  } satisfies DriveType;
}

function shouldStartNewHockeyGroup(previousPlay: HockeyRenderedPlay, nextPlay: HockeyRenderedPlay) {
  if (!previousPlay || !nextPlay) {
    return false;
  }

  if (extractPeriodFromClock(previousPlay.clock) !== extractPeriodFromClock(nextPlay.clock)) {
    return true;
  }

  if (isStrongBoundaryHockeyPlay(nextPlay.type)) {
    return true;
  }

  if (isStrongBoundaryHockeyPlay(previousPlay.type)) {
    return true;
  }

  if (previousPlay.team && nextPlay.team && previousPlay.team !== nextPlay.team) {
    return true;
  }

  if (previousPlay.clock !== nextPlay.clock && isAttackSequenceHockeyPlay(previousPlay.type)) {
    return true;
  }

  return false;
}

function shouldCloseHockeyGroup(play: HockeyRenderedPlay) {
  return isTerminalHockeyPlay(play.type) || play.result === "SCORE";
}

function filterHockeyGroupPlays(plays: HockeyRenderedPlay[]) {
  const meaningfulPlays = plays.filter(
    (play) => play.text && !isMinorAdministrativeHockeyPlay(play.type),
  );
  return meaningfulPlays.length > 0 ? meaningfulPlays : plays.filter((play) => play.text);
}

function isPrimaryHockeySummaryPlay(playType: string) {
  const normalized = playType.toLowerCase();
  return [
    "goal",
    "penalty",
    "shot",
    "missed shot",
    "blocked shot",
    "saved shot",
    "shot on goal",
    "takeaway",
    "giveaway",
    "hit",
  ].includes(normalized);
}

function isAdministrativeHockeyPlay(playType: string) {
  const normalized = playType.toLowerCase();
  return [
    "game start",
    "period start",
    "period end",
    "overtime start",
    "shootout start",
    "game end",
    "star of the game",
  ].includes(normalized);
}

function isMinorAdministrativeHockeyPlay(playType: string) {
  const normalized = playType.toLowerCase();
  return ["stoppage", "tv timeout", "timeout"].includes(normalized);
}

function isStrongBoundaryHockeyPlay(playType: string) {
  const normalized = playType.toLowerCase();
  return ["faceoff", "penalty", "goal", "period start", "period end"].includes(normalized);
}

function isTerminalHockeyPlay(playType: string) {
  const normalized = playType.toLowerCase();
  return ["goal", "penalty", "saved shot", "shot", "shot on goal", "missed shot", "blocked shot"].includes(
    normalized,
  );
}

function isAttackSequenceHockeyPlay(playType: string) {
  const normalized = playType.toLowerCase();
  return [
    "goal",
    "saved shot",
    "shot",
    "shot on goal",
    "missed shot",
    "blocked shot",
    "takeaway",
    "giveaway",
    "hit",
  ].includes(normalized);
}

function extractPeriodFromClock(clock: string) {
  return clock.split(" ")[0] || "";
}

function normalizeHockeyPlay(play: any, teamsById: Record<string, string>): HockeyRenderedPlay {
  const period = parseInt(String(play.period?.number || "0"), 10) || 0;
  const awayScore = play.awayScore ?? play.scoreValue?.away;
  const homeScore = play.homeScore ?? play.scoreValue?.home;
  const type = String(play.type?.text || play.type?.name || play.type?.abbreviation || "").trim();

  return {
    team:
      teamsById[play.team?.id] ||
      play.team?.shortDisplayName ||
      play.team?.displayName ||
      play.team?.abbreviation ||
      play.team?.name ||
      "",
    type,
    result: play.scoringPlay ? "SCORE" : undefined,
    down: formatHockeyPlayLabel(play),
    text: play.text || play.shortText || "",
    clock: `P${period || ""} ${play.clock?.displayValue || ""}`.trim(),
    score:
      awayScore !== undefined || homeScore !== undefined ? `${awayScore ?? ""} - ${homeScore ?? ""}` : "",
    meta: formatHockeyPlayMeta(play),
  };
}

function formatHockeyPlayLabel(play: any) {
  const parts = [
    play.type?.text || "",
    play.shotType?.displayName || play.shotType?.name || "",
  ].filter(Boolean);

  return Array.from(new Set(parts)).join(" | ");
}

function formatHockeyPlayMeta(play: any) {
  const strength =
    play.strength?.displayName ||
    play.strength?.name ||
    play.situation?.strength ||
    "";
  const manpower =
    play.situation?.manPowerSituation ||
    play.situation?.manpowerSituation ||
    play.situation?.situation ||
    "";
  const zone = play.zone?.displayName || play.zone?.name || "";
  const shootout =
    play.shootout ? "Shootout" : "";

  return [strength, manpower, zone, shootout].filter(Boolean).join(" | ") || undefined;
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
