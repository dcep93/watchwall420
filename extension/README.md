# Watchwall420 Chrome Extension

Minimal Manifest V3 extension that rewrites the `Referer` header for requests to `https://pooembed.eu/*` when the request initiator is:

- `localhost`
- `watchwall420.web.app`

The spoofed header value is:

`https://embedsports.top/`

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `watchwall420/extension` folder
