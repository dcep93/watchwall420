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
  muteToggleSlug?: StreamSlug;
  muteToggleRequestId: number;
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
        {streams.map((stream, index) => (
          <ScreenCard
            key={stream.slug}
            host={host}
            stream={stream}
            streamIndex={index}
            displayLogs={displayLogs}
            isFocused={stream.slug === focusedStream?.slug}
            shouldToggleMute={stream.slug === props.muteToggleSlug}
            muteToggleRequestId={props.muteToggleRequestId}
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
  streamIndex: number;
  displayLogs: boolean;
  isFocused: boolean;
  shouldToggleMute: boolean;
  muteToggleRequestId: number;
  isSolo: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const [titleTooltip, setTitleTooltip] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshScreen, setRefreshScreen] = useState<(() => void) | null>(null);
  const indexedTitle = formatIndexedStreamTitle(props.stream.title, props.streamIndex);
  const screenBodyClassName = [
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
        label={indexedTitle}
        onRefresh={refreshScreen ?? undefined}
        onClose={props.onRemove}
        refreshDisabled={!refreshScreen || isRefreshing}
        title={titleTooltip}
      />
      <div className={screenBodyClassName}>
        {props.isFocused && props.displayLogs ? (
          <div className="log-panel log-panel-spotlight">
            <div className="log-entry">{renderLog(props.stream)}</div>
          </div>
        ) : null}
        <ScreenContent
          key={props.stream.raw_url}
          host={props.host}
          indexedTitle={indexedTitle}
          className={[
            "screen-focus",
            props.isFocused ? "screen-focus-spotlight" : "screen-focus-secondary",
          ].join(" ")}
          isFocused={props.isFocused}
          shouldToggleMute={props.shouldToggleMute}
          muteToggleRequestId={props.muteToggleRequestId}
          stream={props.stream}
          onRefreshButtonStateChange={setIsRefreshing}
          onRefreshReady={(refresh) => {
            setRefreshScreen(() => refresh);
          }}
          onClick={props.isFocused ? undefined : props.onFocus}
          onDebugTitleChange={setTitleTooltip}
        />
      </div>
    </article>
  );
}

function ScreenTitleBar(props: {
  label: string;
  className: string;
  onRefresh?: () => void;
  onClose?: () => void;
  refreshDisabled?: boolean;
  title?: string;
}) {
  return (
    <div
      className={`screen-title-bar-shell ${props.className}`}
      title={props.title}
      role="button"
      tabIndex={0}
      aria-label={`Close screen ${props.label}`}
      onClick={props.onClose}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onClose?.();
        }
      }}
    >
      <div className="screen-title-inner">
        <span className="screen-letter">{props.label}</span>
        {props.onRefresh ? (
          <button
            type="button"
            className="screen-title-action"
            aria-label={`Refresh screen ${props.label}`}
            onClick={(event) => {
              event.stopPropagation();
              props.onRefresh?.();
            }}
            disabled={props.refreshDisabled}
            title="Refresh stream"
          >
            🔄
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ScreenContent<T>(props: {
  host: Host<T>;
  stream: Stream;
  indexedTitle: string;
  className: string;
  isFocused: boolean;
  shouldToggleMute: boolean;
  muteToggleRequestId: number;
  onRefreshReady?: (refresh: () => void) => void;
  onRefreshButtonStateChange?: (isRefreshing: boolean) => void;
  onClick?: () => void;
  onDebugTitleChange?: (value: string) => void;
}) {
  const {
    className,
    host,
    indexedTitle,
    isFocused,
    muteToggleRequestId,
    onClick,
    onDebugTitleChange,
    onRefreshButtonStateChange,
    onRefreshReady,
    shouldToggleMute,
    stream,
  } = props;
  const [srcDoc, setSrcDoc] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [iframeElement, setIframeElement] = useState<HTMLIFrameElement | null>(null);
  const [refreshRequestId, setRefreshRequestId] = useState(0);

  useEffect(() => {
    onRefreshReady?.(() => {
      setRefreshRequestId((currentValue) => currentValue + 1);
    });
  }, [onRefreshReady]);

  useEffect(() => {
    let isActive = true;

    onDebugTitleChange?.("");
    onRefreshButtonStateChange?.(true);

    host
      .getIframeParams(stream, refreshRequestId > 0 ? { maxAgeMs: 0 } : undefined)
      .then((iframeParams) => {
        onDebugTitleChange?.(JSON.stringify(iframeParams, null, 2));

        return ReactDomServer.renderToStaticMarkup(host.getIframeDocStrElement(iframeParams));
      })
      .then((renderedSrcDoc) => {
        if (!isActive) return;
        setSrcDoc(renderedSrcDoc);
        setErrorMessage("");
        onRefreshButtonStateChange?.(false);
      })
      .catch((error) => {
        console.error(error);
        if (!isActive) return;
        setSrcDoc("");
        const nextErrorMessage = getStreamContentErrorMessage(error);
        setErrorMessage(nextErrorMessage);
        onDebugTitleChange?.(nextErrorMessage);
        onRefreshButtonStateChange?.(false);
      });

    return () => {
      isActive = false;
      onRefreshButtonStateChange?.(false);
    };
  }, [host, onDebugTitleChange, onRefreshButtonStateChange, refreshRequestId, stream]);

  useEffect(() => {
    if (!iframeElement || !shouldToggleMute || muteToggleRequestId === 0) {
      return;
    }

    iframeElement.contentWindow?.postMessage(
      {
        source: "watchwall420-app",
        type: "watchwall420:toggle-mute",
      },
      "*",
    );
  }, [iframeElement, muteToggleRequestId, shouldToggleMute]);

  useEffect(() => {
    if (!iframeElement) {
      return;
    }

    iframeElement.contentWindow?.postMessage(
      {
        source: "watchwall420-app",
        type: "watchwall420:set-muted",
        muted: !isFocused,
      },
      "*",
    );
  }, [iframeElement, isFocused]);

  return (
    <div className={className}>
      {onClick ? (
        <button
          type="button"
          className="screen-focus-overlay"
          aria-label={`Focus screen ${indexedTitle}`}
          onClick={onClick}
        />
      ) : null}
      {errorMessage ? (
        <pre className="screen-content-error" role="alert">
          {errorMessage}
        </pre>
      ) : (
        <iframe
          className="screen-iframe"
          title={indexedTitle}
          srcDoc={srcDoc}
          loading="eager"
          referrerPolicy="no-referrer"
          ref={setIframeElement}
        />
      )}
    </div>
  );
}

function getStreamContentErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return "Unable to load stream.";
}

function formatIndexedStreamTitle(title: string, index: number) {
  return `(${index + 1}) ${title}`;
}
