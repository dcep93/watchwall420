export type PlayType = {
  down: string;
  text: string;
  clock: string;
};

export type DriveType = {
  team: string;
  description: string;
  score: string;
  result?: string;
  meta?: string;
  plays?: PlayType[];
};

export type BoxScoreType = {
  key: string;
  labels: string[];
  players?: { name: string; stats: string[]; isHomeTeam?: boolean }[];
};

export type LogType = {
  timestamp: number;
  teams: { name: string; statistics: Record<string, string> }[];
  playByPlay: DriveType[];
  boxScore: BoxScoreType[];
};

export type LeagueConfig = {
  sport: string;
  espnLeague: string;
  playType: "football" | "basketball" | "baseball" | "hockey";
  boxScoreKeys: readonly string[];
};

export type FootballLeagueConfig = LeagueConfig & {
  playType: "football";
};

export type BasketballLeagueConfig = LeagueConfig & {
  playType: "basketball";
};

export type BaseballLeagueConfig = LeagueConfig & {
  playType: "baseball";
};

export type HockeyLeagueConfig = LeagueConfig & {
  playType: "hockey";
};
