import type { Stream } from "./types";

export default function Multiscreen(props: {
  streams: Stream[];
  displayLogs: boolean;
  focusedSlug?: string;
  onRemove: (streamSlug: string) => void;
  onFocus: (streamSlug: string) => void;
}) {
  const focusedStream =
    props.streams.find((stream) => stream.slug === props.focusedSlug) ?? props.streams[0];
  const secondaryStreams = props.streams.filter((stream) => stream.slug !== focusedStream?.slug);

  return (
    <section className="multiscreen-column">
      {focusedStream ? (
        <article
          className={`screen-card screen-card-spotlight is-focused ${
            secondaryStreams.length === 0 ? "screen-card-spotlight-solo" : ""
          }`.trim()}
        >
          <button
            type="button"
            className="spotlight-title-bar"
            aria-label={`Remove screen ${focusedStream.label}`}
            onClick={() => props.onRemove(focusedStream.slug)}
          >
            <span className="screen-letter">{focusedStream.label}</span>
          </button>
          <div
            className={`screen-spotlight-body ${props.displayLogs ? "" : "screen-spotlight-body-no-log"}`.trim()}
          >
            {props.displayLogs ? (
              <div className="log-panel log-panel-spotlight">
                <div className="log-entry">{focusedStream.log}</div>
              </div>
            ) : null}
            <button
              type="button"
              className="screen-focus screen-focus-spotlight"
              aria-label={`Focus screen ${focusedStream.label}`}
              onClick={() => props.onFocus(focusedStream.slug)}
            >
              <span className="screen-focus-label">{focusedStream.content}</span>
            </button>
          </div>
        </article>
      ) : null}

      {secondaryStreams.length > 0 ? (
        <div className="screen-strip">
          {secondaryStreams.map((stream) => (
            <article key={stream.slug} className="screen-card screen-card-secondary">
              <button
                type="button"
                className="screen-card-secondary-button"
                aria-label={`Focus screen ${stream.label}`}
                onClick={() => props.onFocus(stream.slug)}
              >
                <span className="spotlight-title-bar spotlight-title-bar-secondary">
                  <span className="screen-letter">{stream.label}</span>
                </span>
                <span className="screen-focus screen-focus-secondary">
                  <span className="screen-focus-label">{stream.content}</span>
                </span>
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
