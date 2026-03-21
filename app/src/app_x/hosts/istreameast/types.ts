export type EspnScheduleEvent = {
  id: number;
  startTimeMs: number;
  competitors: string[];
  normalizedCompetitors: string[];
};

export type IframeParams = {
  playback_url: string;
  title: string;
};
