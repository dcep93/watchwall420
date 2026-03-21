import { fetchTextThroughProxy } from "../../lib/proxy420";
import {
  ISTREAMEAST_URL,
  LOCAL_PROXY_CACHE_MAX_AGE_MS,
  REMOTE_PROXY_CACHE_MAX_AGE_MS,
  WATCHWALL_USER_AGENT,
} from "./constants";

export async function fetchIstreameastHtml(
  localMaxAgeMs = LOCAL_PROXY_CACHE_MAX_AGE_MS,
  remoteMaxAgeMs = REMOTE_PROXY_CACHE_MAX_AGE_MS,
) {
  return fetchTextThroughProxy({
    url: ISTREAMEAST_URL,
    localMaxAgeMs,
    remoteMaxAgeMs,
    options: {
      headers: {
        "user-agent": WATCHWALL_USER_AGENT,
      },
    },
  });
}

export async function fetchIstreameastPageText(targetUrl: string) {
  return fetchTextThroughProxy({
    url: targetUrl,
    localMaxAgeMs: LOCAL_PROXY_CACHE_MAX_AGE_MS,
    remoteMaxAgeMs: REMOTE_PROXY_CACHE_MAX_AGE_MS,
    options: {
      headers: {
        "user-agent": WATCHWALL_USER_AGENT,
      },
      referrer: ISTREAMEAST_URL,
    },
  });
}
