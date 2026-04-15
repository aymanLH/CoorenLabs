import { Elysia, t } from "elysia";
import { SERVER_ORIGIN } from "./config";
import { isTooLarge } from "./helper";
import { Logger } from "./logger";

// for proxy safety
const MAX_M3U8_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TS_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_FETCH_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_MP4_SIZE = 20 * 1024 * 1024 * 1024; // 20 GB

const PLAYLIST_REGEX = /\.m3u|playlist|\.txt/i;

import { env } from "./runtime";

if (!SERVER_ORIGIN && env.NODE_ENV !== "test") throw new Error("set SERVER_ORIGIN at .env!");

const ANILIST_HOST = "graphql.anilist.co";
const ANILIST_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const ANILIST_STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const ANILIST_MIN_INTERVAL_MS = 2200; // keep under 30 req/min
const ANILIST_FALLBACK_BACKOFF_MS = 2 * 60 * 1000;

type CachedProxyResponse = {
  status: number;
  contentType: string;
  body: string;
  cachedAt: number;
};

const anilistCache = new Map<string, CachedProxyResponse>();
const anilistInFlight = new Map<string, Promise<CachedProxyResponse | null>>();
let anilistNextAllowedAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupAniListCache() {
  if (anilistCache.size <= 500) return;
  const now = Date.now();
  for (const [key, value] of anilistCache.entries()) {
    if (now - value.cachedAt > ANILIST_STALE_TTL_MS) anilistCache.delete(key);
  }
}

function getFreshAniListCache(key: string) {
  const hit = anilistCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > ANILIST_CACHE_TTL_MS) return null;
  return hit;
}

function getStaleAniListCache(key: string) {
  const hit = anilistCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > ANILIST_STALE_TTL_MS) return null;
  return hit;
}

function toCachedResponse(payload: CachedProxyResponse, cacheStatus: "HIT" | "STALE" | "MISS") {
  return new Response(payload.body, {
    status: payload.status,
    headers: {
      "content-type": payload.contentType || "application/json",
      "x-proxy-cache": cacheStatus,
    },
  });
}

const fetchQuerySchema = t.Object({
  url: t.String(),
  headers: t.Optional(t.String()),
});

async function handleFetchProxy(request: Request, url: string, headers?: string) {
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  let customHeaders: Record<string, string> = {};
  if (headers) {
    try {
      customHeaders = JSON.parse(decodeURIComponent(headers));
    } catch (_e) {
      console.error("Fetch header parse failed");
    }
  }

  customHeaders["Connection"] = "keep-alive";

  const method = request.method.toUpperCase();
  const isAniList = parsedUrl.hostname === ANILIST_HOST;
  const requestBody = method === "GET" || method === "HEAD" ? "" : await request.text();

  if (!customHeaders["Content-Type"]) {
    const incomingType = request.headers.get("content-type");
    if (incomingType) customHeaders["Content-Type"] = incomingType;
  }

  const anilistKey = isAniList ? `${method}|${parsedUrl.toString()}|${headers || ""}|${requestBody}` : "";

  if (isAniList) {
    const fresh = getFreshAniListCache(anilistKey);
    if (fresh) return toCachedResponse(fresh, "HIT");

    const pending = anilistInFlight.get(anilistKey);
    if (pending) {
      const shared = await pending;
      if (shared) return toCachedResponse(shared, "HIT");
    }
  }

  const runAniListFetch = async (): Promise<CachedProxyResponse | null> => {
    const waitMs = Math.max(0, anilistNextAllowedAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    anilistNextAllowedAt = Date.now() + ANILIST_MIN_INTERVAL_MS;

    const res = await fetch(url, {
      method,
      headers: customHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : requestBody,
      signal: undefined, // shared AniList requests should not abort for all listeners
    });

    if (isTooLarge(res.headers.get("content-length"), MAX_FETCH_SIZE)) {
      throw new Error("Payload too large");
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const bodyText = await res.text();
    const cacheable = res.ok && contentType.toLowerCase().includes("application/json") && bodyText.length > 0;

    if (cacheable) {
      const payload: CachedProxyResponse = {
        status: res.status,
        contentType,
        body: bodyText,
        cachedAt: Date.now(),
      };
      anilistCache.set(anilistKey, payload);
      cleanupAniListCache();
      return payload;
    }

    if (res.status === 429) {
      const retryAfterRaw = Number(res.headers.get("retry-after") || 0);
      const retryMs =
        Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? retryAfterRaw * 1000 : ANILIST_FALLBACK_BACKOFF_MS;
      anilistNextAllowedAt = Math.max(anilistNextAllowedAt, Date.now() + retryMs);
    }

    return {
      status: res.status,
      contentType,
      body: bodyText,
      cachedAt: Date.now(),
    };
  };

  try {
    if (isAniList) {
      const task = runAniListFetch();
      anilistInFlight.set(anilistKey, task);
      const data = await task.finally(() => {
        anilistInFlight.delete(anilistKey);
      });

      if (!data) return new Response("Fetch Error", { status: 500 });

      // Serve stale cached data on upstream throttling/errors when available.
      if (data.status >= 400) {
        const stale = getStaleAniListCache(anilistKey);
        if (stale) return toCachedResponse(stale, "STALE");
      }

      return toCachedResponse(data, "MISS");
    }

    const res = await fetch(url, {
      method,
      headers: customHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : requestBody,
      signal: request.signal, // Abort if client disconnects
    });

    // Size limit check
    if (isTooLarge(res.headers.get("content-length"), MAX_FETCH_SIZE)) {
      return new Response("Payload too large", { status: 413 });
    }

    return new Response(res.body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/octet-stream",
      },
    });
  } catch (err: any) {
    if (err.name === "AbortError") return new Response("Client disconnected", { status: 499 });
    if (String(err?.message || "").includes("Payload too large")) {
      return new Response("Payload too large", { status: 413 });
    }
    if (isAniList) {
      const stale = getStaleAniListCache(anilistKey);
      if (stale) return toCachedResponse(stale, "STALE");
    }
    return new Response("Fetch Error", { status: 500 });
  }
}

export const proxyRoutes = new Elysia({ prefix: "/proxy" })

  .get(
    "/",
    () => {
      return {
        endpoints: [
          "-------------PROXY--------------",
          "/proxy/m3u8-proxy?url={url}&headers={encodedHeaders}",
          "/proxy/ts-segment?url={url}&headers={encodedHeaders}",
          "/proxy/fetch?url={url}&headers={encodedHeaders}",
          "/proxy/mp4-proxy?url={url}&headers=",
        ],
      };
    },
    {
      detail: {
        tags: ["proxy"],
        summary: "Proxy API Overview",
      },
    },
  )

  .get(
    "/m3u8-proxy",
    async ({ request, query: { url, headers } }) => {
      let corsHeaders: Record<string, string> = {};

      if (headers) {
        try {
          corsHeaders = JSON.parse(decodeURIComponent(headers));
        } catch {
          return new Response("Invalid headers format", { status: 400 });
        }
      }

      corsHeaders["Connection"] = "keep-alive";

      try {
        const res = await fetch(url, {
          headers: corsHeaders,
          signal: request.signal, // Abort if client disconnects
        });

        if (!res.ok) {
          console.log("Fetch failed with status:", res.status, "Url:", url);
          return new Response(res.body, { status: res.status });
        }

        // Size limit check
        if (isTooLarge(res.headers.get("content-length"), MAX_M3U8_SIZE)) {
          return new Response("File too large", { status: 413 });
        }

        const text = await res.text();
        const encodedHeaders = encodeURIComponent(headers || "");

        const proxifiedM3u8 = text
          .split("\n")
          .map((line) => {
            const tl = line.trim();
            if (!tl) return line;

            if (tl.startsWith("#EXT")) {
              return tl.replace(/URI="([^"]+)"/g, (_, uri) => {
                const absoluteUrl = new URL(uri, url).href;
                let proxiedUrl;
                const encodedUrl = encodeURIComponent(absoluteUrl);

                if (PLAYLIST_REGEX.test(absoluteUrl)) {
                  proxiedUrl = `${SERVER_ORIGIN}/proxy/m3u8-proxy?url=${encodedUrl}${headers ? `&headers=${encodedHeaders}` : ""}`;
                } else {
                  proxiedUrl = `${SERVER_ORIGIN}/proxy/fetch?url=${encodedUrl}${headers ? `&headers=${encodedHeaders}` : ""}`;
                }

                return `URI="${proxiedUrl}"`;
              });
            }

            const absoluteUrl = new URL(tl, url).href;
            const encodedUrl = encodeURIComponent(absoluteUrl);

            if (PLAYLIST_REGEX.test(absoluteUrl)) {
              return `${SERVER_ORIGIN}/proxy/m3u8-proxy?url=${encodedUrl}${headers ? `&headers=${encodedHeaders}` : ""}`;
            } else {
              return `${SERVER_ORIGIN}/proxy/ts-segment?url=${encodedUrl}${headers ? `&headers=${encodedHeaders}` : ""}`;
            }
          })
          .join("\n");

        return new Response(proxifiedM3u8, {
          headers: {
            "Content-Type": res.headers.get("Content-Type") || "application/vnd.apple.mpegurl",
          },
        });
      } catch (err: any) {
        if (err.name === "AbortError") return new Response("Client disconnected", { status: 499 });
        Logger.error(err);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    {
      query: t.Object({
        url: t.String(),
        headers: t.Optional(t.String()),
      }),
      detail: {
        tags: ["proxy"],
        summary: "M3U8 Playlist Proxy",
      },
    },
  )

  .get(
    "/ts-segment",
    async ({ request, query: { url, headers } }) => {
      let corsHeaders: Record<string, string> = {};

      if (headers) {
        try {
          corsHeaders = JSON.parse(decodeURIComponent(headers));
        } catch {
          return new Response("Invalid headers format", { status: 400 });
        }
      }

      // Force keep-alive for the upstream connection
      corsHeaders["Connection"] = "keep-alive";

      try {
        const res = await fetch(url, {
          headers: corsHeaders,
          signal: request.signal, // Abort if client disconnects
        });

        if (!res.ok) {
          console.error("TS segment Fetch failed:", res.status, url);
          return new Response(res.body, { status: res.status });
        }

        // Size limit check
        if (isTooLarge(res.headers.get("content-length"), MAX_TS_SIZE)) {
          return new Response("Segment too large", { status: 413 });
        }

        return new Response(res.body, {
          headers: {
            "Content-Type": res.headers.get("Content-Type") || "video/MP2T",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (err: any) {
        if (err.name === "AbortError") return new Response("Client disconnected", { status: 499 });
        Logger.error(err);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    {
      query: t.Object({
        url: t.String(),
        headers: t.Optional(t.String()),
      }),
      detail: {
        tags: ["proxy"],
        summary: "TS Segment Proxy",
      },
    },
  )

  .get(
    "/mp4-proxy",
    async ({ request, query: { url, headers } }) => {
      let corsHeaders: Record<string, string> = {};

      if (headers) {
        try {
          corsHeaders = JSON.parse(decodeURIComponent(headers));
        } catch {
          return new Response("Invalid headers format", { status: 400 });
        }
      }

      const clientRange = request.headers.get("range");

      if (clientRange) {
        corsHeaders["Range"] = clientRange;
      }

      corsHeaders["Connection"] = "keep-alive";

      try {
        const res = await fetch(url, {
          headers: corsHeaders,
          signal: request.signal, // Abort if client disconnects
        });

        if (!res.ok) {
          console.error("[MP4] Fetch failed:", res.status, url);
          return new Response(await res.text(), { status: res.status });
        }

        // Size limit check
        if (isTooLarge(res.headers.get("content-length"), MAX_MP4_SIZE)) {
          return new Response("Video too large", { status: 413 });
        }

        return new Response(res.body, {
          status: res.status,
          headers: {
            "content-type": res.headers.get("content-type") || "video/mp4",
            "content-range": res.headers.get("content-range") || "",
            "content-length": res.headers.get("content-length") || "",
            "accept-ranges": "bytes",
          },
        });
      } catch (err: any) {
        if (err.name === "AbortError") return new Response("Client disconnected", { status: 499 });
        console.error("[MP4] Proxy Error:", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    },
    {
      query: t.Object({
        url: t.String(),
        headers: t.Optional(t.String()),
      }),
      detail: {
        tags: ["proxy"],
        summary: "MP4 Video Proxy",
      },
    },
  )

  .get(
    "/fetch",
    async ({ request, query: { url, headers } }) => handleFetchProxy(request, url, headers),
    {
      query: fetchQuerySchema,
      detail: {
        tags: ["proxy"],
        summary: "General Media Fetch Proxy (GET)",
      },
    },
  )

  .post(
    "/fetch",
    async ({ request, query: { url, headers } }) => handleFetchProxy(request, url, headers),
    {
      query: fetchQuerySchema,
      detail: {
        tags: ["proxy"],
        summary: "General Media Fetch Proxy (POST passthrough)",
      },
    },
  );
