/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BoxScoreType } from "./types";

type TeamSummary = {
  name: string;
  statistics: Record<string, string>;
};

export async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  return response.json();
}

export function buildTeamSummaries(summaryObj: any, streamTitle = "") {
  const teamSummaries = ((((summaryObj as any).boxscore?.teams as any[]) ?? []).slice()).map(
    (teamObj: any) => ({
      name: teamObj.team?.name ?? "",
      statistics: Object.fromEntries(
        ((teamObj.statistics as any[]) ?? []).flatMap((stat) => {
          if (Array.isArray(stat?.stats)) {
            return stat.stats.map((nestedStat: any) => [nestedStat.name, nestedStat.displayValue]);
          }

          return stat?.name ? [[stat.name, stat.displayValue]] : [];
        }),
      ),
    }),
  );

  return orderTeamSummariesByTitle(teamSummaries, streamTitle);
}

export function buildDefaultBoxScore(players: any[], keys: readonly string[]): BoxScoreType[] {
  return keys.map((key) => ({
    key,
    labels: players?.[0]?.statistics?.find((stat: any) => stat.name === key)?.labels || [],
    players: (players || [])
      .flatMap((team: any, teamIndex: number) => {
        const statBlock = team.statistics?.find((stat: any) => stat.name === key);
        if (!statBlock) {
          return [];
        }

        const isHomeTeam = isHomeTeamBoxScoreTeam(teamIndex);
        return (statBlock.athletes || []).map((athlete: any) => ({
          name: athlete.athlete?.displayName ?? "",
          stats: athlete.stats ?? [],
          isHomeTeam,
          rank:
            athlete.stats
              ?.map((stat: string) => parseFloat(String(stat).split("/")[0]))
              .find((stat: number) => !Number.isNaN(stat)) || 0,
        }));
      })
      .sort((left, right) => right.rank - left.rank),
  }));
}

export function findStatIndex(keys: string[], aliases: readonly string[]) {
  return keys.findIndex((key) => aliases.includes(key));
}

export function isHomeTeamBoxScoreTeam(teamIndex: number) {
  return teamIndex === 1;
}

function orderTeamSummariesByTitle(teamSummaries: TeamSummary[], streamTitle: string) {
  const titleTeams = parseTitleTeams(streamTitle).map(normalizeTeamName).filter(Boolean);
  if (titleTeams.length < 2 || teamSummaries.length < 2) {
    return teamSummaries;
  }

  return teamSummaries
    .map((teamSummary, index) => ({
      teamSummary,
      index,
      titleIndex: getTitleIndex(teamSummary.name, titleTeams),
    }))
    .sort((left, right) => {
      if (left.titleIndex !== right.titleIndex) {
        return left.titleIndex - right.titleIndex;
      }

      return left.index - right.index;
    })
    .map(({ teamSummary }) => teamSummary);
}

function getTitleIndex(teamName: string, titleTeams: string[]) {
  const normalizedTeamName = normalizeTeamName(teamName);
  const matchedIndex = titleTeams.findIndex((titleTeam) =>
    teamNamesMatch(normalizedTeamName, titleTeam),
  );

  return matchedIndex === -1 ? Number.MAX_SAFE_INTEGER : matchedIndex;
}

function parseTitleTeams(title: string) {
  for (const separator of [/\s+vs\s+/i, /\s+@\s+/i, /\s+at\s+/i]) {
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(0, 2);
    }
  }

  return [title];
}

function normalizeTeamName(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bstate\b/g, "st")
    .replace(/\buniversity\b/g, "")
    .replace(/\bfc\b/g, "")
    .replace(/\bcf\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamNamesMatch(left: string, right: string) {
  if (left === right) {
    return true;
  }

  const leftCompact = left.replaceAll(" ", "");
  const rightCompact = right.replaceAll(" ", "");

  if (leftCompact === rightCompact) {
    return true;
  }

  return leftCompact.includes(rightCompact) || rightCompact.includes(leftCompact);
}
