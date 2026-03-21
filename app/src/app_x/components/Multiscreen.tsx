import type { Ref } from "react";
import type { Host, Stream, StreamSlug } from "../config/types";
import { renderLog } from "../lib/renderStream";

export default function Multiscreen(props: {
  containerRef?: Ref<HTMLElement>;
  host: Host;
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
    <section ref={props.containerRef} className="multiscreen-column">
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
            label={focusedStream.title}
            onClick={() => props.onRemove(focusedStream.slug)}
          />
          <div className={spotlightBodyClassName}>
            {props.displayLogs ? (
              <div className="log-panel log-panel-spotlight">
                <div className="log-entry">{renderLog(focusedStream)}</div>
              </div>
            ) : null}
            <ScreenContent
              host={props.host}
              className="screen-focus screen-focus-spotlight"
              stream={focusedStream}
            />
          </div>
        </article>
      ) : null}

      {secondaryStreams.length > 0 ? (
        <div className="screen-strip">
          {secondaryStreams.map((stream) => (
            <SecondaryScreenCard
              host={props.host}
              key={stream.slug}
              stream={stream}
              onFocus={() => props.onFocus(stream.slug)}
              onRemove={() => props.onRemove(stream.slug)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SecondaryScreenCard(props: {
  host: Host;
  stream: Stream;
  onFocus: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="screen-card screen-card-secondary">
      <ScreenTitleBar
        className="spotlight-title-bar spotlight-title-bar-secondary"
        label={props.stream.title}
        onClick={props.onRemove}
      />
      <ScreenContent
        host={props.host}
        className="screen-focus screen-focus-secondary"
        stream={props.stream}
        onClick={props.onFocus}
      />
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
    return <div className={props.className}>{content}</div>;
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
  host: Host;
  stream: Stream;
  className: string;
  onClick?: () => void;
}) {
  const iframe = (
    <iframe
      className="screen-iframe"
      title={props.stream.title}
      srcDoc={props.host.getIframeDocStr(props.stream)}
    />
  );

  if (!props.onClick) {
    return <div className={props.className}>{iframe}</div>;
  }

  return (
    <button
      type="button"
      className={props.className}
      aria-label={`Focus screen ${props.stream.title}`}
      onClick={props.onClick}
    >
      {iframe}
    </button>
  );
}
