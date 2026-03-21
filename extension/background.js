const TARGET_WASM_URL = "https://pooembed.eu/js/wasm/gasm.wasm";
const SPOOFED_REFERER = "https://embedsports.top/";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "fetch-pooembed-wasm") {
    return false;
  }

  void (async () => {
    try {
      const requestedUrl = new URL(message.url ?? TARGET_WASM_URL).toString();

      if (requestedUrl !== TARGET_WASM_URL) {
        throw new Error(`Unexpected wasm URL: ${requestedUrl}`);
      }

      const response = await fetch(TARGET_WASM_URL, {
        method: "GET",
        referrer: SPOOFED_REFERER
      });

      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const body = await response.arrayBuffer();
      sendResponse({
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        bodyBase64: arrayBufferToBase64(body)
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();

  return true;
});
