/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Stream } from "../config/types";
import Autoscroller from "./Autoscroller";
import { fetchLeagueLog, leagueConfigs } from "./renderLog/leagues";
import type { LogType } from "./renderLog/types";

const POLL_INTERVAL_MS = 10 * 1000;

export default function renderLog(stream: Stream, logDelayMs: number): ReactNode {
  return <StreamLog stream={stream} logDelayMs={logDelayMs} />;
}

function StreamLog(props: { stream: Stream; logDelayMs: number }) {
  const config = leagueConfigs[props.stream.category];
  const [displayedLog, setDisplayedLog] = useState<LogType | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const espnGameUrl = getEspnGameUrl(props.stream, config);
  const pendingTimeoutIdsRef = useRef<number[]>([]);
  const isMountedRef = useRef(false);

  const clearPendingLogTimeouts = useCallback(() => {
    for (const timeoutId of pendingTimeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }

    pendingTimeoutIdsRef.current = [];
  }, []);

  const queueDelayedLogUpdate = useCallback((nextLog: LogType) => {
    const timeoutId = window.setTimeout(() => {
      pendingTimeoutIdsRef.current = pendingTimeoutIdsRef.current.filter(
        (pendingTimeoutId) => pendingTimeoutId !== timeoutId,
      );

      if (!isMountedRef.current) {
        return;
      }

      setDisplayedLog(nextLog);
    }, Math.max(0, props.logDelayMs));

    pendingTimeoutIdsRef.current.push(timeoutId);
  }, [props.logDelayMs]);

  const fetchAndHandleLog = useCallback((shouldRenderImmediately = false) => {
    if (!config || !hasEspnGame(props.stream)) {
      return Promise.resolve();
    }

    return fetchLeagueLog(props.stream.espn_id, config)
      .then((nextLog) => {
        if (!isMountedRef.current || !nextLog) {
          return;
        }

        if (shouldRenderImmediately) {
          clearPendingLogTimeouts();
          setDisplayedLog(nextLog);
        } else {
          queueDelayedLogUpdate(nextLog);
        }

        setErrorMessage("");
      })
      .catch((error: unknown) => {
        console.error("watchwall:fetchLog", error);

        if (!isMountedRef.current) {
          return;
        }

        setErrorMessage("Unable to load play-by-play.");
      });
  }, [clearPendingLogTimeouts, config, props.stream, queueDelayedLogUpdate]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearPendingLogTimeouts();
    };
  }, [clearPendingLogTimeouts]);

  useEffect(() => {
    if (!config || !hasEspnGame(props.stream)) {
      return;
    }

    void fetchAndHandleLog();
    const interval = window.setInterval(() => {
      void fetchAndHandleLog();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [config, fetchAndHandleLog, props.logDelayMs, props.stream]);

  if (!props.stream.espn_id || props.stream.espn_id < 0) {
    return <div className="watchwall-log-empty">No ESPN game linked.</div>;
  }

  if (!config) {
    return <div className="watchwall-log-empty">Play-by-play is not supported for this league yet.</div>;
  }

  if (!displayedLog) {
    return (
      <div
        className="watchwall-log-empty"
        role="button"
        tabIndex={0}
        onClick={() => {
          void fetchAndHandleLog(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
      >
        <LogActions espnGameUrl={espnGameUrl} />
        <div>{errorMessage || "Loading log..."}</div>
      </div>
    );
  }

  return (
    <LogView
      log={displayedLog}
      espnGameUrl={espnGameUrl}
      onClick={() => {
        void fetchAndHandleLog(true);
      }}
    />
  );
}

function hasEspnGame(stream: Stream) {
  return Boolean(stream.espn_id && stream.espn_id > 0);
}

function LogView(props: { log: LogType; espnGameUrl: string | null; onClick: () => void }) {
  const playByPlay = useMemo(() => {
    const drives = [...(props.log.playByPlay || [])];
    if (drives.length > 1 && drives[0].description === drives[1].description) {
      drives.shift();
    }
    return drives;
  }, [props.log.playByPlay]);

  return (
    <div
      className="watchwall-log"
      role="button"
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onClick();
        }
      }}
    >
      <div className="watchwall-log-content watchwall-log-top">
        <div className="watchwall-log-topbar">
          <span>{new Date(props.log.timestamp).toLocaleTimeString()}</span>
          <LogActions espnGameUrl={props.espnGameUrl} />
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
                {drive.score ? (
                  <span className="watchwall-log-topbar-muted">{drive.score}</span>
                ) : null}
              </div>
              <div className="watchwall-log-event-description">{drive.description}</div>
              {drive.meta ? <div className="watchwall-log-topbar-muted">{drive.meta}</div> : null}
            </div>
            <div>
              {(drive.plays || []).slice().reverse().map((play, playIndex) => {
                const hideText = play.text === drive.description;
                const hasPlayMeta = Boolean(play.clock || play.down);
                return (
                  <div key={`${play.clock}-${playIndex}`} className="watchwall-log-play-content">
                    {!hideText ? <div>{play.text}</div> : null}
                    {hasPlayMeta ? (
                      <div className="watchwall-log-play-meta">
                        {play.down ? <span>{play.down}</span> : null}
                        {play.clock ? <span>{play.clock}</span> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="watchwall-log-content watchwall-log-bottom">
        <Autoscroller className="watchwall-log-autoscroller" speed={0.1}>
          <>
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
          </>
        </Autoscroller>
      </div>
    </div>
  );
}

function LogActions(props: { espnGameUrl: string | null }) {
  if (!props.espnGameUrl) {
    return null;
  }

  return (
    <a
      className="watchwall-log-link"
      href={props.espnGameUrl}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      open in espn
    </a>
  );
}

function renderTeamStatistics(statistics: Record<string, string>) {
  const fieldGoals = statistics["fieldGoalsMade-fieldGoalsAttempted"];
  const threePointers = statistics["threePointFieldGoalsMade-threePointFieldGoalsAttempted"];
  const freeThrows = statistics["freeThrowsMade-freeThrowsAttempted"];
  const runs = statistics.runs;
  const hits = statistics.hits;
  const errors = statistics.errors;
  const shots = statistics.shots || statistics.shotsOnGoal;
  const powerPlays = statistics.powerPlayGoals || statistics.powerPlays;

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

  if (runs && hits && errors) {
    return renderStatRows([
      ["R", runs],
      ["H", hits],
      ["E", errors],
      ["LOB", statistics.leftOnBase || ""],
    ]);
  }

  if (shots && statistics.hits && statistics.penaltyMinutes) {
    return renderStatRows([
      ["SOG", shots],
      ["HIT", statistics.hits],
      ["PIM", statistics.penaltyMinutes],
      ["PP", powerPlays || ""],
    ]);
  }

  return renderStatRows(
    Object.entries(statistics)
      .slice(0, 4)
      .map(([key, value]) => [key, value]),
  );
}

function getEspnGameUrl(
  stream: Stream,
  config: { sport: string; espnLeague: string } | null | undefined,
) {
  if (!hasEspnGame(stream) || !config) {
    return null;
  }

  return `https://www.espn.com/${config.espnLeague}/game?gameId=${stream.espn_id}`;
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
