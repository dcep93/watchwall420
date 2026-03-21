import type { Ref } from "react";
import type { Stream, StreamSlug } from "../config/types";

export default function Multiscreen(props: {
  containerRef?: Ref<HTMLElement>;
  streams: Stream[];
  displayLogs: boolean;
  focusedSlug?: StreamSlug;
  onRemove: (streamSlug: StreamSlug) => void;
  onFocus: (streamSlug: StreamSlug) => void;
}) {
  const focusedStream =
    props.streams.find((stream) => stream.slug === props.focusedSlug) ?? props.streams[0];
  const secondaryStreams = props.streams.filter((stream) => stream.slug !== focusedStream?.slug);

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
          <div className="screen-spotlight-body screen-spotlight-body-no-log">
            <ScreenContent
              className="screen-focus screen-focus-spotlight"
              label={focusedStream.title}
              renderContent={focusedStream.renderContent}
            />
          </div>
        </article>
      ) : null}

      {secondaryStreams.length > 0 ? (
        <div className="screen-strip">
          {secondaryStreams.map((stream) => (
            <SecondaryScreenCard
              key={stream.slug}
              renderContent={stream.renderContent}
              label={stream.title}
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
  label: string;
  renderContent: string;
  onFocus: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="screen-card screen-card-secondary">
      <ScreenTitleBar
        className="spotlight-title-bar spotlight-title-bar-secondary"
        label={props.label}
        onClick={props.onRemove}
      />
      <ScreenContent
        className="screen-focus screen-focus-secondary"
        label={props.label}
        renderContent={props.renderContent}
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
  label: string;
  renderContent: string;
  className: string;
  onClick?: () => void;
}) {
  if (!props.onClick) {
    return (
      <div className={props.className}>
        <div
          className="screen-focus-label"
          dangerouslySetInnerHTML={{ __html: props.renderContent }}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={props.className}
      aria-label={`Focus screen ${props.label}`}
      onClick={props.onClick}
    >
      <div
        className="screen-focus-label"
        dangerouslySetInnerHTML={{ __html: props.renderContent }}
      />
    </button>
  );
}
