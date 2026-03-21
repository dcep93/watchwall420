const PAGE_SOURCE = "watchwall420-page-hook";
const EXTENSION_SOURCE = "watchwall420-extension";

function injectPageHook() {
  if (document.documentElement.dataset.watchwall420HookInjected === "true") {
    return;
  }

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("page-hook.js");
  script.dataset.watchwall420Injected = "true";
  (document.head || document.documentElement).appendChild(script);
  script.remove();

  document.documentElement.dataset.watchwall420HookInjected = "true";
}

injectPageHook();

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data;
  if (!data || data.source !== PAGE_SOURCE || data.type !== "fetch-pooembed-wasm") {
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "fetch-pooembed-wasm",
      url: data.url
    },
    (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        window.postMessage(
          {
            source: EXTENSION_SOURCE,
            type: "fetch-pooembed-wasm-response",
            requestId: data.requestId,
            ok: false,
            error: runtimeError.message
          },
          "*"
        );
        return;
      }

      window.postMessage(
        {
          source: EXTENSION_SOURCE,
          type: "fetch-pooembed-wasm-response",
          requestId: data.requestId,
          ...response
        },
        "*"
      );
    }
  );
});
