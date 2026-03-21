(() => {
  const TARGET_WASM_URL = "https://pooembed.eu/js/wasm/gasm.wasm";
  const PAGE_SOURCE = "watchwall420-page-hook";
  const EXTENSION_SOURCE = "watchwall420-extension";
  const pendingRequests = new Map();

  if (window.__watchwall420PooembedHookInstalled) {
    return;
  }

  window.__watchwall420PooembedHookInstalled = true;

  function normalizeUrl(input) {
    if (typeof input === "string") {
      return new URL(input, document.baseURI).toString();
    }

    if (input instanceof URL) {
      return input.toString();
    }

    if (typeof Request !== "undefined" && input instanceof Request) {
      return new URL(input.url, document.baseURI).toString();
    }

    return new URL(String(input), document.baseURI).toString();
  }

  function fetchThroughExtension(url) {
    return new Promise((resolve, reject) => {
      const requestId =
        typeof crypto?.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const timeoutId = window.setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error("Timed out fetching pooembed wasm through the extension."));
      }, 30000);

      pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId
      });

      window.postMessage(
        {
          source: PAGE_SOURCE,
          type: "fetch-pooembed-wasm",
          requestId,
          url
        },
        "*"
      );
    });
  }

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== EXTENSION_SOURCE || data.type !== "fetch-pooembed-wasm-response") {
      return;
    }

    const pendingRequest = pendingRequests.get(data.requestId);
    if (!pendingRequest) {
      return;
    }

    window.clearTimeout(pendingRequest.timeoutId);
    pendingRequests.delete(data.requestId);

    if (!data.ok) {
      pendingRequest.reject(new Error(data.error || "Extension fetch failed."));
      return;
    }

    pendingRequest.resolve(
      new Response(base64ToUint8Array(data.bodyBase64), {
        status: data.status || 200,
        statusText: data.statusText || "OK",
        headers: data.headers || []
      })
    );
  });

  const originalFetch = window.fetch.bind(window);

  window.fetch = function fetchWithWasmInterception(input, init) {
    try {
      const resolvedUrl = normalizeUrl(input);
      if (resolvedUrl === TARGET_WASM_URL) {
        return fetchThroughExtension(resolvedUrl);
      }
    } catch {
      return originalFetch(input, init);
    }

    return originalFetch(input, init);
  };
})();
