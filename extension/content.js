(() => {
  const HOST_HOSTNAMES = new Set(["localhost", "watchwall420.web.app"]);
  const MESSAGE_SOURCE = "watchwall420-extension";
  const POOEMBED_LOADED = "watchwall420:pooembed-loaded";
  const ancestorOrigins = Array.from(window.location.ancestorOrigins ?? []);
  const isDescendantOfWatchwallHost = ancestorOrigins.some((origin) =>
    HOST_HOSTNAMES.has(new URL(origin).hostname),
  );

  if (!isDescendantOfWatchwallHost) {
    return;
  }

  notifyParents(POOEMBED_LOADED);

  function notifyParents(type) {
    let currentWindow = window;

    while (currentWindow.parent && currentWindow.parent !== currentWindow) {
      currentWindow = currentWindow.parent;
      currentWindow.postMessage({ source: MESSAGE_SOURCE, type }, "*");
    }
  }
})();
