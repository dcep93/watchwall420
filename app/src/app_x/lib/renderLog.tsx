/* eslint-disable @typescript-eslint/no-explicit-any, react-refresh/only-export-components */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Category, Stream } from "../config/types";

type PlayType = {
  down: string;
  text: string;
  clock: string;
  distance: number;
};

type DriveType = {
  team: string;
  description: string;
  score: string;
  result?: string;
  plays?: PlayType[];
  yardsToEndzone: number;
};

type BoxScoreType = {
  key: string;
  labels: string[];
  players?: { name: string; stats: string[] }[];
};

type LogType = {
  gameId: number;
  timestamp: number;
  teams: { name: string; statistics: Record<string, string> }[];
  playByPlay: DriveType[];
  boxScore: BoxScoreType[];
};

const POLL_INTERVAL_MS = 3 * 1000;

type LeagueConfig = {
  sport: string;
  espnLeague: string;
  playType: "football" | "basketball";
  boxScoreKeys: readonly string[];
};

type FootballLeagueConfig = LeagueConfig & {
  playType: "football";
};

type BasketballLeagueConfig = LeagueConfig & {
  playType: "basketball";
};

const leagueConfigs: Partial<Record<Category, LeagueConfig>> = {
  NFL: {
    sport: "football",
    espnLeague: "nfl",
    playType: "football",
    boxScoreKeys: ["passing", "receiving", "rushing"],
  },
  CFB: {
    sport: "football",
    espnLeague: "college-football",
    playType: "football",
    boxScoreKeys: ["passing", "receiving", "rushing"],
  },
  CFL: {
    sport: "football",
    espnLeague: "cfl",
    playType: "football",
    boxScoreKeys: ["passing", "receiving", "rushing"],
  },
  NBA: {
    sport: "basketball",
    espnLeague: "nba",
    playType: "basketball",
    boxScoreKeys: ["points", "rebounds", "assists"],
  },
  NCAAB: {
    sport: "basketball",
    espnLeague: "mens-college-basketball",
    playType: "basketball",
    boxScoreKeys: ["points", "rebounds", "assists"],
  },
};

export default function renderLog(stream: Stream): ReactNode {
  return <StreamLog stream={stream} />;
}

function StreamLog(props: { stream: Stream }) {
  const config = leagueConfigs[props.stream.category];
  const [log, setLog] = useState<LogType | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isActive = true;

    if (!config || !hasEspnGame(props.stream)) {
      return;
    }

    const updateLog = () =>
      fetchLog(props.stream, config)
        .then((nextLog) => {
          if (!isActive || !nextLog) return;
          setLog((currentLog) =>
            !currentLog || nextLog.timestamp >= currentLog.timestamp ? nextLog : currentLog,
          );
          setErrorMessage("");
        })
        .catch((error: unknown) => {
          console.error("watchwall:fetchLog", error);
          if (!isActive) return;
          setErrorMessage("Unable to load play-by-play.");
        });

    void updateLog();
    const interval = window.setInterval(() => {
      void updateLog();
    }, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [config, props.stream]);

  if (!props.stream.espn_id || props.stream.espn_id < 0) {
    return <div className="watchwall-log-empty">No ESPN game linked.</div>;
  }

  if (!config) {
    return <div className="watchwall-log-empty">Play-by-play is not supported for this league yet.</div>;
  }

  if (!log) {
    return <div className="watchwall-log-empty">{errorMessage || "Loading log..."}</div>;
  }

  return <LogView log={log} />;
}

async function fetchLog(
  stream: Stream,
  config: LeagueConfig,
): Promise<LogType | null> {
  if (isFootballLeagueConfig(config)) {
    return getFootballLog(stream.espn_id, config);
  }

  if (!isBasketballLeagueConfig(config)) {
    return null;
  }

  return getBasketballLog(stream.espn_id, config);
}

function hasEspnGame(stream: Stream) {
  return Boolean(stream.espn_id && stream.espn_id > 0);
}

function isFootballLeagueConfig(config: LeagueConfig): config is FootballLeagueConfig {
  return config.playType === "football";
}

function isBasketballLeagueConfig(config: LeagueConfig): config is BasketballLeagueConfig {
  return config.playType === "basketball";
}

async function getFootballLog(
  espnId: number,
  config: FootballLeagueConfig,
) {
  const [summaryObj, coreObj] = await Promise.all([
    fetchJson(
      `https://site.web.api.espn.com/apis/site/v2/sports/${config.sport}/${config.espnLeague}/summary?region=us&lang=en&contentorigin=espn&event=${espnId}`,
    ),
    fetchJson(
      `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.espnLeague}/events/${espnId}/competitions/${espnId}/drives?limit=1000`,
    ),
  ]);

  const driveItems = ((coreObj as { items?: { $ref: string; id: string }[] }).items ?? [])
    .slice()
    .reverse();

  const driveObjs = await Promise.all(
    driveItems.map(async (coreItem) => {
      const driveObj = await fetchJson(coreItem.$ref);
      const teamRef = (driveObj as { team?: { $ref?: string } }).team?.$ref;
      const teamObj = teamRef ? await fetchJson(teamRef) : null;
      return {
        ...(driveObj as Record<string, unknown>),
        id: coreItem.id,
        team: teamObj,
      };
    }),
  );

  const filteredDriveObjs = driveObjs.filter(
    (driveObj) =>
      Array.isArray((driveObj as { plays?: unknown[] }).plays) &&
      ((driveObj as { plays?: unknown[] }).plays?.length ?? 0) > 0,
  );

  const summaryWithDrives = summaryObj as {
    drives?: {
      current?: Record<string, unknown>;
      previous?: Record<string, unknown>[];
    };
    boxscore?: {
      teams?: any[];
      players?: any[];
    };
  };

  if (filteredDriveObjs.length > 0) {
    summaryWithDrives.drives = {
      current: filteredDriveObjs[0] as Record<string, unknown>,
      previous: filteredDriveObjs.slice(1).reverse() as Record<string, unknown>[],
    };
  }

  if (!summaryWithDrives.drives?.current) {
    return null;
  }

  const drives = [summaryWithDrives.drives.current]
    .concat(
      (summaryWithDrives.drives.previous ?? [])
        .slice()
        .reverse()
        .filter((drive) => drive?.id !== summaryWithDrives.drives?.current?.id),
    )
    .filter((drive) => drive?.team);

  const playByPlay = drives.map((drive) => {
    const plays = ((drive as any).plays ?? []).slice().reverse();
    return {
      team: (drive as any).team?.shortDisplayName ?? "",
      result: (drive as any).displayResult,
      plays: plays
        .filter((play: any) => play.participants)
        .map((play: any) => ({
          down: play.start?.downDistanceText ?? "",
          text: play.text ?? "",
          clock: `Q${play.period?.number ?? ""} ${play.clock?.displayValue ?? ""}`.trim(),
          distance: play.statYardage ?? 0,
        })),
      description: (drive as any).description ?? "",
      score: `${(drive as any).plays?.[0]?.awayScore ?? ""} - ${(drive as any).plays?.[0]?.homeScore ?? ""}`,
      yardsToEndzone: (drive as any).plays?.[0]?.end?.yardsToEndzone ?? 100,
    } satisfies DriveType;
  });

  const timestamp =
    ((summaryWithDrives.drives.current as any)?.plays ?? [])
      .map((play: any) => play.wallclock)
      .find(Boolean) ?? Date.now();

  return {
    gameId: espnId,
    timestamp,
    teams: ((summaryWithDrives.boxscore?.teams as any[]) ?? []).map((teamObj) => ({
      name: teamObj.team?.name ?? "",
      statistics: Object.fromEntries(
        ((teamObj.statistics as any[]) ?? []).map((stat) => [stat.name, stat.displayValue]),
      ),
    })),
    playByPlay,
    boxScore: buildBoxScore(summaryWithDrives.boxscore?.players ?? [], config.boxScoreKeys),
  };
}

async function getBasketballLog(
  espnId: number,
  config: BasketballLeagueConfig,
) {
  const summaryObj = await fetchJson(
    `https://site.web.api.espn.com/apis/site/v2/sports/${config.sport}/${config.espnLeague}/summary?region=us&lang=en&contentorigin=espn&event=${espnId}`,
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
    gameId: espnId,
    timestamp,
    teams: ((((summaryObj as any).boxscore?.teams as any[]) ?? []).map((teamObj: any) => ({
      name: teamObj.team?.name ?? "",
      statistics: Object.fromEntries(
        ((teamObj.statistics as any[]) ?? []).map((stat) => [stat.name, stat.displayValue]),
      ),
    }))),
    playByPlay: buildBasketballPlayByPlay(plays, teamsById),
    boxScore: buildBasketballBoxScore((summaryObj as any).boxscore?.players ?? [], config.boxScoreKeys),
  };
}

async function fetchJson(url: string) {
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
        (isFreeThrowPlay(normalizedPlays[index]) ||
          normalizedPlays[index].clock === freeThrowClock)
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
    distance: number;
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
      down: play.down,
      text: play.text,
      clock: play.clock,
      distance: play.distance,
    })),
    description: summaryPlay.text,
    score: latestPlay.score,
    yardsToEndzone: 100,
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
    distance: parseInt(play.scoreValue || "0", 10),
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
    distance: number;
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

function buildBoxScore(players: any[], keys: readonly string[]) {
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
    } satisfies BoxScoreType;
  });
}

function LogView(props: { log: LogType }) {
  const playByPlay = useMemo(() => {
    const drives = [...(props.log.playByPlay || [])];
    if (drives.length > 1 && drives[0].description === drives[1].description) {
      drives.shift();
    }
    return drives;
  }, [props.log.playByPlay]);

  return (
    <div className="watchwall-log">
      <div className="watchwall-log-content watchwall-log-top">
        <div className="watchwall-log-topbar">
          <span>{new Date(props.log.timestamp).toLocaleTimeString()}</span>
        </div>
        <div className="watchwall-log-team-summary-row">
          {props.log.teams.map((team) => (
            <div
              key={team.name}
              className="watchwall-log-team-summary-card"
              title={JSON.stringify(team.statistics, null, 2)}
            >
              <div className="watchwall-log-team-summary-name">{team.name}</div>
              <div className="watchwall-log-team-summary-stats">
                {renderTeamStatistics(team.statistics)}
              </div>
            </div>
          ))}
        </div>
        <div className="watchwall-log-spacer" />
        {playByPlay.slice().reverse().map((drive, index) => (
          <div key={`${drive.team}-${drive.description}-${index}`} className="watchwall-log-event-row">
            <div className="watchwall-log-header">
              <div className="watchwall-log-event-meta">
                <span>{drive.team || "Update"}</span>
                {drive.result ? (
                  <span className="watchwall-log-event-result">{drive.result}</span>
                ) : null}
                {drive.score ? (
                  <span className="watchwall-log-topbar-muted">{drive.score}</span>
                ) : null}
              </div>
              <div className="watchwall-log-event-description">{drive.description}</div>
            </div>
            <div>
              {(drive.plays || []).slice().reverse().map((play, playIndex) => {
                const hideText = play.text === drive.description;
                return (
                  <div key={`${play.clock}-${playIndex}`} className="watchwall-log-play-content">
                    {!hideText ? <div>{play.text}</div> : null}
                    <div className="watchwall-log-play-meta">
                      <span>{play.clock}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="watchwall-log-content watchwall-log-bottom">
        {(props.log.boxScore || []).map((boxScore) => (
          <div key={boxScore.key} className="watchwall-log-box-score">
            <div className="watchwall-log-header">{boxScore.key}</div>
            <table>
              <thead>
                <tr>
                  <th></th>
                  {boxScore.labels.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(boxScore.players || []).map((player) => (
                  <tr key={player.name}>
                    <td className="watchwall-log-player-name">{player.name}</td>
                    {player.stats.map((stat, index) => (
                      <td key={`${player.name}-${index}`}>{stat}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderTeamStatistics(statistics: Record<string, string>) {
  const fieldGoals = statistics["fieldGoalsMade-fieldGoalsAttempted"];
  const threePointers = statistics["threePointFieldGoalsMade-threePointFieldGoalsAttempted"];
  const freeThrows = statistics["freeThrowsMade-freeThrowsAttempted"];

  if (statistics.possessionTime && statistics.totalYards && statistics.totalOffensivePlays) {
    return renderStatRows([
      ["TOP", statistics.possessionTime],
      ["YDS", statistics.totalYards],
      ["PLAYS", statistics.totalOffensivePlays],
    ]);
  }

  if (fieldGoals && threePointers && statistics.totalRebounds) {
    return renderStatRows([
      ["FG", fieldGoals],
      ["REB", statistics.totalRebounds],
      ["3PT", threePointers],
      ["TO", statistics.totalTurnovers || statistics.turnovers || ""],
      ["FT", freeThrows || ""],
      ["LP", statistics.leadPercentage ? `${statistics.leadPercentage}%` : ""],
    ]);
  }

  return renderStatRows(
    Object.entries(statistics)
      .slice(0, 4)
      .map(([key, value]) => [key, value]),
  );
}

function renderStatRows(lines: string[][]) {
  const rows = [];
  for (let index = 0; index < lines.length; index += 2) {
    rows.push(lines.slice(index, index + 2));
  }

  return (
    <>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="watchwall-log-team-summary-stat-row">
          {row.map(([label, value]) => (
            <div key={label} className="watchwall-log-team-summary-stat-line">
              <span className="watchwall-log-team-summary-stat-label">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
