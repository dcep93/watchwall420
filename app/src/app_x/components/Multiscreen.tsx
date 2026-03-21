import type { Stream, StreamSlug } from "../config/types";

export default function Multiscreen(props: {
  streams: Stream[];
  displayLogs: boolean;
  focusedSlug?: StreamSlug;
  onRemove: (streamSlug: StreamSlug) => void;
  onFocus: (streamSlug: StreamSlug) => void;
}) {
  const focusedStream =
    props.streams.find((stream) => stream.slug === props.focusedSlug) ?? props.streams[0];
  const secondaryStreams = props.streams.filter((stream) => stream.slug !== focusedStream?.slug);
  const spotlightBodyClassName = [
    "screen-spotlight-body",
    props.displayLogs ? "" : "screen-spotlight-body-no-log",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="multiscreen-column">
      {focusedStream ? (
        <article
          className={[
            "screen-card",
            "screen-card-spotlight",
            "is-focused",
            secondaryStreams.length === 0 ? "screen-card-spotlight-solo" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ScreenTitleBar
            className="spotlight-title-bar"
            label={focusedStream.label}
            onClick={() => props.onRemove(focusedStream.slug)}
          />
          <div className={spotlightBodyClassName}>
            {props.displayLogs ? (
              <div className="log-panel log-panel-spotlight">
                <div className="log-entry">{focusedStream.log}</div>
              </div>
            ) : null}
            <ScreenContent
              className="screen-focus screen-focus-spotlight"
              label={focusedStream.label}
              content={focusedStream.content}
              onClick={() => props.onFocus(focusedStream.slug)}
            />
          </div>
        </article>
      ) : null}

      {secondaryStreams.length > 0 ? (
        <div className="screen-strip">
          {secondaryStreams.map((stream) => (
            <SecondaryScreenCard
              key={stream.slug}
              content={stream.content}
              label={stream.label}
              onClick={() => props.onFocus(stream.slug)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SecondaryScreenCard(props: {
  label: string;
  content: string;
  onClick: () => void;
}) {
  return (
    <article className="screen-card screen-card-secondary">
      <button
        type="button"
        className="screen-card-secondary-button"
        aria-label={`Focus screen ${props.label}`}
        onClick={props.onClick}
      >
        <ScreenTitleBar
          className="spotlight-title-bar spotlight-title-bar-secondary"
          label={props.label}
        />
        <span className="screen-focus screen-focus-secondary">
          <span className="screen-focus-label">{props.content}</span>
        </span>
      </button>
    </article>
  );
}

function ScreenTitleBar(props: {
  label: string;
  className: string;
  onClick?: () => void;
}) {
  const content = <span className="screen-letter">{props.label}</span>;

  if (!props.onClick) {
    return <span className={props.className}>{content}</span>;
  }

  return (
    <button
      type="button"
      className={props.className}
      aria-label={`Remove screen ${props.label}`}
      onClick={props.onClick}
    >
      {content}
    </button>
  );
}

function ScreenContent(props: {
  label: string;
  content: string;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={props.className}
      aria-label={`Focus screen ${props.label}`}
      onClick={props.onClick}
    >
      <span className="screen-focus-label">{props.content}</span>
    </button>
  );
}
