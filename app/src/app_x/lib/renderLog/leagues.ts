import type { Stream } from "../../config/types";
import { getBaseballLog } from "./baseball";
import { getBasketballLog } from "./basketball";
import { getFootballLog } from "./football";
import { getHockeyLog } from "./hockey";
import type {
  BaseballLeagueConfig,
  BasketballLeagueConfig,
  FootballLeagueConfig,
  HockeyLeagueConfig,
  LeagueConfig,
  LogType,
} from "./types";

export const leagueConfigs: Record<string, LeagueConfig> = {
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
  MLB: {
    sport: "baseball",
    espnLeague: "mlb",
    playType: "baseball",
    boxScoreKeys: ["batting", "pitching"],
  },
  NHL: {
    sport: "hockey",
    espnLeague: "nhl",
    playType: "hockey",
    boxScoreKeys: ["skaters", "goalies"],
  },
  NCAAB: {
    sport: "basketball",
    espnLeague: "mens-college-basketball",
    playType: "basketball",
    boxScoreKeys: ["points", "rebounds", "assists"],
  },
};

export async function fetchLeagueLog(
  stream: Stream,
  config: LeagueConfig,
): Promise<LogType | null> {
  if (isFootballLeagueConfig(config)) {
    return getFootballLog(stream, config);
  }

  if (isBasketballLeagueConfig(config)) {
    return getBasketballLog(stream, config);
  }

  if (isBaseballLeagueConfig(config)) {
    return getBaseballLog(stream, config);
  }

  if (isHockeyLeagueConfig(config)) {
    return getHockeyLog(stream, config);
  }

  return null;
}

function isFootballLeagueConfig(config: LeagueConfig): config is FootballLeagueConfig {
  return config.playType === "football";
}

function isBasketballLeagueConfig(config: LeagueConfig): config is BasketballLeagueConfig {
  return config.playType === "basketball";
}

function isBaseballLeagueConfig(config: LeagueConfig): config is BaseballLeagueConfig {
  return config.playType === "baseball";
}

function isHockeyLeagueConfig(config: LeagueConfig): config is HockeyLeagueConfig {
  return config.playType === "hockey";
}
