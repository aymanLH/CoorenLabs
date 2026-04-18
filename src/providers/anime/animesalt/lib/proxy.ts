import { STREAM_PROXY_BASE } from "../route";
import { DirectSource } from "../types";

export function proxifySource(source: DirectSource): DirectSource {
  const { type, url, headers } = source;
  const headerQuery = headers ? "&headers=" + encodeURIComponent(JSON.stringify(headers)) : "";

  const encodedUrl = encodeURIComponent(url);

  const finalUrl =
    type == "hls"
      ? `${STREAM_PROXY_BASE}/m3u8-proxy?url=${encodedUrl}${headerQuery}`
      : `${STREAM_PROXY_BASE}/mp4-proxy?url=${encodedUrl}${headerQuery}`;

  return {
    proxiedUrl: finalUrl,
    ...source,
  };
}

export function proxifyUrl(
  url: string,
  type: "mp4" | "hls",
  headers: Record<string, string> = null,
) {
  const headerParam = headers ? `&headers=${encodeURIComponent(JSON.stringify(headers))}` : "";
  const proxiedUrl =
    type == "hls"
      ? `${STREAM_PROXY_BASE}/m3u8-proxy?url=${encodeURIComponent(url)}${headerParam}`
      : "";
  return proxiedUrl;
}
