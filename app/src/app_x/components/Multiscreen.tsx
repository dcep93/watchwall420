import { useEffect, useState, type CSSProperties, type Ref } from "react";
import ReactDomServer from "react-dom/server";
import type { Host, Stream, StreamSlug } from "../config/types";
import renderLog from "../lib/renderLog";

export default function Multiscreen<T>(props: {
  containerRef?: Ref<HTMLElement>;
  host: Host<T>;
  streams: Stream[];
  displayLogs: boolean;
  focusedSlug?: StreamSlug;
  onRemove: (streamSlug: StreamSlug) => void;
  onFocus: (streamSlug: StreamSlug) => void;
}) {
  const { containerRef, displayLogs, focusedSlug, host, onFocus, onRemove, streams } = props;
  const focusedStream =
    streams.find((stream) => stream.slug === focusedSlug) ?? streams[0];
  const secondaryCount = Math.max(1, streams.length - 1);

  return (
    <section ref={containerRef} className="multiscreen-column">
      <div
        className={streams.length === 1 ? "screen-layout screen-layout-solo" : "screen-layout"}
        style={
          {
            "--screen-columns": secondaryCount,
          } as CSSProperties
        }
      >
        {streams.map((stream) => (
          <ScreenCard
            key={stream.slug}
            host={host}
            stream={stream}
            displayLogs={displayLogs}
            isFocused={stream.slug === focusedStream?.slug}
            isSolo={streams.length === 1}
            onFocus={() => onFocus(stream.slug)}
            onRemove={() => onRemove(stream.slug)}
          />
        ))}
      </div>
    </section>
  );
}

function ScreenCard<T>(props: {
  host: Host<T>;
  stream: Stream;
  displayLogs: boolean;
  isFocused: boolean;
  isSolo: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const spotlightBodyClassName = [
    "screen-spotlight-body",
    props.isFocused && props.displayLogs ? "" : "screen-spotlight-body-no-log",
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
          key={props.stream.raw_url}
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

function ScreenContent<T>(props: {
  host: Host<T>;
  stream: Stream;
  className: string;
  onClick?: () => void;
}) {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    let isActive = true;

    props.host
      .getIframeParams(props.stream)
      .then((params) =>
        ReactDomServer.renderToStaticMarkup(props.host.getIframeDocStrElement(params)),
      )
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
        loading="eager"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
      />
    </div>
  );
}
