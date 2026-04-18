import { STREAM_PROXY_BASE } from "./config";

export const proxifySource = (url: string, headers?: Record<string, string> | undefined) => {
  const urlParam = `?url=` + encodeURIComponent(url);
  const headerParam = headers ? `&headers=` + encodeURIComponent(JSON.stringify(headers)) : "";
  if (url.includes(".m3u")) {
    // count as hls source
    return STREAM_PROXY_BASE + "/m3u8-proxy" + urlParam + headerParam;
  } else {
    // count as mp4
    return STREAM_PROXY_BASE + "/mp4-proxy" + urlParam + headerParam;
  }
};
