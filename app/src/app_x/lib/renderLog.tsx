/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Stream } from "../config/types";
import Autoscroller from "./Autoscroller";
import { fetchLeagueLog, leagueConfigs } from "./renderLog/leagues";
import type { LogType } from "./renderLog/types";

const POLL_INTERVAL_MS = 3 * 1000;

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
      fetchLeagueLog(props.stream.espn_id, config)
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

function hasEspnGame(stream: Stream) {
  return Boolean(stream.espn_id && stream.espn_id > 0);
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

function renderTeamStatistics(statistics: Record<string, string>) {
  const fieldGoals = statistics["fieldGoalsMade-fieldGoalsAttempted"];
  const threePointers = statistics["threePointFieldGoalsMade-threePointFieldGoalsAttempted"];
  const freeThrows = statistics["freeThrowsMade-freeThrowsAttempted"];
  const runs = statistics.runs;
  const hits = statistics.hits;
  const errors = statistics.errors;

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
