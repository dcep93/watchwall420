/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BoxScoreType } from "./types";

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

export function buildTeamSummaries(summaryObj: any) {
  return ((((summaryObj as any).boxscore?.teams as any[]) ?? []).slice().reverse()).map(
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
}

export function buildDefaultBoxScore(players: any[], keys: readonly string[]): BoxScoreType[] {
  return keys.map((key) => ({
    key,
    labels: players?.[0]?.statistics?.find((stat: any) => stat.name === key)?.labels || [],
    players: []
      .concat(
        ...(players || [])
          .map((team: any) => team.statistics?.find((stat: any) => stat.name === key))
          .filter(Boolean)
          .map((statBlock: any) => statBlock.athletes || []),
      )
      .map((athlete: any) => ({
        name: athlete.athlete?.displayName ?? "",
        stats: athlete.stats ?? [],
        rank:
          athlete.stats
            ?.map((stat: string) => parseFloat(String(stat).split("/")[0]))
            .find((stat: number) => !Number.isNaN(stat)) || 0,
      }))
      .sort((left, right) => right.rank - left.rank),
  }));
}

export function findStatIndex(keys: string[], aliases: readonly string[]) {
  return keys.findIndex((key) => aliases.includes(key));
}
