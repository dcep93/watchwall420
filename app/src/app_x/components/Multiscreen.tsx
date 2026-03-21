import { useEffect, useState, type Ref } from "react";
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

  return (
    <section ref={props.containerRef} className="multiscreen-column">
      <div className="screen-layout">
        {props.streams.map((stream) => (
          <ScreenCard
            key={stream.slug}
            host={props.host}
            stream={stream}
            displayLogs={props.displayLogs}
            isFocused={stream.slug === focusedStream?.slug}
            isSolo={props.streams.length === 1}
            onFocus={() => props.onFocus(stream.slug)}
            onRemove={() => props.onRemove(stream.slug)}
          />
        ))}
      </div>
    </section>
  );
}

function ScreenCard(props: {
  host: Host;
  stream: Stream;
  displayLogs: boolean;
  isFocused: boolean;
  isSolo: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const spotlightBodyClassName = [
    "screen-spotlight-body",
    props.displayLogs ? "" : "screen-spotlight-body-no-log",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={[
        "screen-card",
        props.isFocused ? "screen-card-spotlight is-focused" : "screen-card-secondary",
        props.isFocused && props.isSolo ? "screen-card-spotlight-solo" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ScreenTitleBar
        className={[
          "spotlight-title-bar",
          props.isFocused ? "" : "spotlight-title-bar-secondary",
        ]
          .filter(Boolean)
          .join(" ")}
        label={props.stream.title}
        onClick={props.onRemove}
      />
      <div className={spotlightBodyClassName}>
        {props.isFocused && props.displayLogs ? (
          <div className="log-panel log-panel-spotlight">
            <div className="log-entry">{renderLog(props.stream)}</div>
          </div>
        ) : null}
        <ScreenContent
          host={props.host}
          className={[
            "screen-focus",
            props.isFocused ? "screen-focus-spotlight" : "screen-focus-secondary",
          ].join(" ")}
          stream={props.stream}
          onClick={props.isFocused ? undefined : props.onFocus}
        />
      </div>
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
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    let isActive = true;

    props.host
      .getIframeDocStr(props.stream)
      .then((nextSrcDoc) => {
        if (!isActive) return;
        setSrcDoc(nextSrcDoc);
      })
      .catch((error) => {
        console.error(error);
        if (!isActive) return;
        setSrcDoc("");
      });

    return () => {
      isActive = false;
    };
  }, [props.host, props.stream]);

  return (
    <div className={props.className}>
      {props.onClick ? (
        <button
          type="button"
          className="screen-focus-overlay"
          aria-label={`Focus screen ${props.stream.title}`}
          onClick={props.onClick}
        />
      ) : null}
      <iframe
        className="screen-iframe"
        title={props.stream.title}
        srcDoc={srcDoc}
      />
    </div>
  );
}
