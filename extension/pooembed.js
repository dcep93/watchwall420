(() => {
  const HOST_HOSTNAMES = new Set(["localhost", "watchwall420.web.app"]);
  const MESSAGE_SOURCE = "watchwall420-extension";
  const APP_MESSAGE_SOURCE = "watchwall420-app";
  const POOEMBED_LOADED = "watchwall420:pooembed-loaded";
  const POOEMBED_SCROLL_DEBUG = "watchwall420:pooembed-scroll-debug";
  const SET_MUTED = "watchwall420:set-muted";
  const TOGGLE_MUTE = "watchwall420:toggle-mute";
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const isDescendantOfWatchwallHost = ancestorOrigins.some((origin) =>
    HOST_HOSTNAMES.has(new URL(origin).hostname),
  );
  let hasUserInteracted = false;
  let currentVideo = null;
  let requestedMutedState = true;

  if (!isDescendantOfWatchwallHost) {
    return;
  }

  const markUserInteraction = () => {
    hasUserInteracted = true;
    applyRequestedMutedState();
  };

  window.addEventListener("pointerdown", markUserInteraction, { capture: true });
  window.addEventListener("keydown", markUserInteraction, { capture: true });
  window.addEventListener("touchstart", markUserInteraction, { capture: true });
  window.addEventListener("click", markUserInteraction, { capture: true });

  window.addEventListener("message", (event) => {
    if (event.data?.source !== APP_MESSAGE_SOURCE) {
      return;
    }

    if (event.data?.type === SET_MUTED) {
      requestedMutedState = event.data.muted !== false;
      applyRequestedMutedState();
      return;
    }

    if (event.data?.type !== TOGGLE_MUTE) {
      return;
    }

    if (!hasUserInteracted || !(currentVideo instanceof HTMLVideoElement)) {
      return;
    }

    currentVideo.muted = !currentVideo.muted;
    requestedMutedState = currentVideo.muted;
  });

  enableScrollDebugging();
  waitForVideoElement();
  notifyParents(POOEMBED_LOADED);

  function waitForVideoElement() {
    let stopped = false;

    const checkForVideo = () => {
      if (stopped) {
        return;
      }

      const video = document.querySelector("video");

      if (video instanceof HTMLVideoElement) {
        stopped = true;
        init(video);
        return;
      }

      window.requestAnimationFrame(checkForVideo);
    };

    checkForVideo();
  }

  function init(video) {
    currentVideo = video;
    video.autoplay = true;
    video.playsInline = true;
    applyRequestedMutedState();
    const playResult = video.play();

    if (!playResult || typeof playResult.then !== "function") {
      return;
    }

    void playResult.catch((error) => {
      console.log("watchwall:pooembed:play-error", error);
    });
  }

  function applyRequestedMutedState() {
    if (!(currentVideo instanceof HTMLVideoElement)) {
      return;
    }

    if (requestedMutedState) {
      currentVideo.muted = true;
      return;
    }

    if (hasUserInteracted) {
      currentVideo.muted = false;
    }
  }

  function enableScrollDebugging() {
    const report = (label, extra = {}) => {
      notifyParents(POOEMBED_SCROLL_DEBUG, {
        label,
        href: window.location.href,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        activeTagName: document.activeElement instanceof Element ? document.activeElement.tagName : null,
        stack: new Error().stack,
        ...extra,
      });
    };

    const wrapMethod = (target, methodName, label) => {
      const original = target?.[methodName];

      if (typeof original !== "function") {
        return;
      }

      target[methodName] = function wrappedMethod(...args) {
        report(label, { args });
        return original.apply(this, args);
      };
    };

    wrapMethod(window, "scroll", "pooembed.window.scroll");
    wrapMethod(window, "scrollTo", "pooembed.window.scrollTo");
    wrapMethod(window, "scrollBy", "pooembed.window.scrollBy");
    wrapMethod(Element.prototype, "scrollIntoView", "pooembed.Element.scrollIntoView");
    wrapMethod(Element.prototype, "scroll", "pooembed.Element.scroll");
    wrapMethod(Element.prototype, "scrollTo", "pooembed.Element.scrollTo");
    wrapMethod(Element.prototype, "scrollBy", "pooembed.Element.scrollBy");

    const originalFocus = HTMLElement.prototype.focus;
    if (typeof originalFocus === "function") {
      HTMLElement.prototype.focus = function wrappedFocus(...args) {
        report("pooembed.HTMLElement.focus", { args });
        return originalFocus.apply(this, args);
      };
    }
  }

  function notifyParents(type, extra = {}) {
    let currentWindow = window;

    while (currentWindow.parent && currentWindow.parent !== currentWindow) {
      currentWindow = currentWindow.parent;
      currentWindow.postMessage({ source: MESSAGE_SOURCE, type, ...extra }, "*");
    }
  }
})();
