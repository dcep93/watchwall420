import { LeagueCategories, type Category, type StreamCategory } from "../config/types";

const ESPN_MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;
const ESPN_DATE_OFFSETS = [-1, 0, 1] as const;
const TITLE_TEAM_SEPARATORS = [/\s+vs\s+/i, /\s+@\s+/i, /\s+at\s+/i] as const;
const INVALID_EVENT_ID = -1;

type EspnScoreboardEndpoint = {
  sport: string;
  league: string;
};

type EspnTeam = {
  displayName?: string;
  shortDisplayName?: string;
  shortName?: string;
  abbreviation?: string;
  location?: string;
  name?: string;
};

type EspnScoreboardEvent = {
  id?: string | number;
  date?: string;
  competitions?: Array<{
    date?: string;
    competitors?: Array<{
      team?: EspnTeam;
    }>;
  }>;
};

type EspnScoredEvent = {
  espnEvent: EspnScheduleEvent;
  teamScore: number;
  timeDeltaMs: number;
};

export type EspnScheduleEvent = {
  id: number;
  startTimeMs: number;
  normalizedCompetitors: string[];
};

export const ESPN_SCOREBOARD_ENDPOINTS: Record<StreamCategory, EspnScoreboardEndpoint> = {
  NFL: { sport: "football", league: "nfl" },
  NBA: { sport: "basketball", league: "nba" },
  MLB: { sport: "baseball", league: "mlb" },
  NHL: { sport: "hockey", league: "nhl" },
  CFL: { sport: "football", league: "cfl" },
  CFB: { sport: "football", league: "college-football" },
  NCAAB: { sport: "basketball", league: "mens-college-basketball" },
  UFC: { sport: "mma", league: "ufc" },
  BOXING: { sport: "boxing", league: "boxing" },
  SOCCER: { sport: "soccer", league: "eng.1" },
  F1: { sport: "racing", league: "f1" },
};

export async function fetchEspnScheduleEvents(category: Category): Promise<EspnScheduleEvent[]> {
  if (category === "ALL") {
    const events = await Promise.all(
      LeagueCategories.map((leagueCategory) => fetchEspnScheduleEvents(leagueCategory)),
    );
    return dedupeEventsById(events.flat());
  }

  const endpoint = ESPN_SCOREBOARD_ENDPOINTS[category];
  const payloads = await Promise.all(
    getEspnDateCandidates().map((date) =>
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/${endpoint.sport}/${endpoint.league}/scoreboard?dates=${date}`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`ESPN scoreboard request failed with status ${response.status}.`);
          }

          return response.json();
        })
        .catch((error) => {
          console.error("espn:fetchScoreboard", { category, date, error });
          return null;
        }),
    ),
  );

  return parseEspnScoreboardEvents(payloads);
}

export function resolveEspnEventId(
  title: string,
  startTimeMs: number | null,
  espnEvents: EspnScheduleEvent[],
) {
  const eventTeams = parseTitleTeams(title);
  if (eventTeams.length === 0) {
    return INVALID_EVENT_ID;
  }

  const normalizedEventTeams = eventTeams.map(normalizeTeamName).filter(Boolean);
  if (normalizedEventTeams.length === 0) {
    return INVALID_EVENT_ID;
  }

  const matchedEvent = espnEvents
    .map((espnEvent) => scoreEspnEvent(normalizedEventTeams, startTimeMs, espnEvent))
    .filter(isMatchingEspnEvent)
    .sort((left, right) => {
      if (right.teamScore !== left.teamScore) {
        return right.teamScore - left.teamScore;
      }
      return left.timeDeltaMs - right.timeDeltaMs;
    })[0];

  return matchedEvent?.espnEvent.id ?? INVALID_EVENT_ID;
}

function parseEspnScoreboardEvents(payloads: unknown[]): EspnScheduleEvent[] {
  return payloads
    .flatMap((payload) => {
      const events = (payload as { events?: EspnScoreboardEvent[] } | null)?.events;
      return Array.isArray(events) ? events : [];
    })
    .map((event) => {
      const eventId = parseInt(String(event.id ?? ""), 10);
      const competitors =
        event.competitions?.[0]?.competitors
          ?.map((competitor) => getEspnTeamNames(competitor.team))
          .flat() ?? [];
      const startTimeMs = Date.parse(event.competitions?.[0]?.date ?? event.date ?? "");

      if (!Number.isFinite(eventId) || !Number.isFinite(startTimeMs) || competitors.length === 0) {
        return null;
      }

      const normalizedCompetitors = Array.from(
        new Set(competitors.map(normalizeTeamName).filter(Boolean)),
      );

      if (normalizedCompetitors.length === 0) {
        return null;
      }

      return {
        id: eventId,
        startTimeMs,
        normalizedCompetitors,
      } satisfies EspnScheduleEvent;
    })
    .filter((event): event is EspnScheduleEvent => event !== null);
}

function dedupeEventsById(events: EspnScheduleEvent[]) {
  const eventsById = new Map<number, EspnScheduleEvent>();

  for (const event of events) {
    eventsById.set(event.id, event);
  }

  return Array.from(eventsById.values());
}

function getEspnDateCandidates() {
  const today = new Date();

  return ESPN_DATE_OFFSETS.map((offsetDays) => {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + offsetDays);
    return formatEspnDate(nextDate);
  });
}

function formatEspnDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function getEspnTeamNames(team: EspnTeam | null | undefined) {
  if (!team) {
    return [];
  }

  return Array.from(
    new Set(
      [
        team.displayName,
        team.shortDisplayName,
        team.shortName,
        team.abbreviation,
        [team.location, team.name].filter(Boolean).join(" "),
        team.location,
        team.name,
      ]
        .map((value) => value?.trim() ?? "")
        .filter(Boolean),
    ),
  );
}

function parseTitleTeams(title: string) {
  for (const separator of TITLE_TEAM_SEPARATORS) {
    const parts = title.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(0, 2);
    }
  }

  return [title];
}

function scoreEspnEvent(
  normalizedEventTeams: string[],
  startTimeMs: number | null,
  espnEvent: EspnScheduleEvent,
): EspnScoredEvent {
  return {
    espnEvent,
    teamScore: scoreEspnEventMatch(normalizedEventTeams, espnEvent.normalizedCompetitors),
    timeDeltaMs:
      startTimeMs === null ? Number.POSITIVE_INFINITY : Math.abs(espnEvent.startTimeMs - startTimeMs),
  };
}

function isMatchingEspnEvent({ teamScore, timeDeltaMs }: EspnScoredEvent) {
  return teamScore > 0 && timeDeltaMs <= ESPN_MATCH_WINDOW_MS;
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

function scoreEspnEventMatch(streamTeams: string[], espnTeams: string[]) {
  let score = 0;

  for (const streamTeam of streamTeams) {
    if (espnTeams.some((espnTeam) => teamNamesMatch(streamTeam, espnTeam))) {
      score += 1;
    }
  }

  return score;
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
