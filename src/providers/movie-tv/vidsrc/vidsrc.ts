import * as cheerio from "cheerio";
import { createProxiedAxios } from "../../../core/lib/upstreamProxy";
import { VideoStream } from "../himovies/extractor";
import { Logger } from "../../../core/logger";

const http = createProxiedAxios();
const extractor = new VideoStream();

const BASE = "https://vidsrc.rip";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── VRF encoding (vidsrc.rip uses a simple char-shift cipher) ────────────────

function generateVRF(input: string): string {
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let encoded = "";
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    encoded += table[charCode % table.length];
  }
  return encodeURIComponent(btoa(encoded));
}

// ─── Step 1: get server list ──────────────────────────────────────────────────

async function getServers(
  type: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number,
): Promise<{ hash: string; name: string }[]> {
  // vidsrc.rip API endpoint
  let url: string;
  if (type === "movie") {
    url = `${BASE}/api/9/movie?id=${tmdbId}`;
  } else {
    url = `${BASE}/api/9/tv?id=${tmdbId}&season=${season}&episode=${episode}`;
  }

  const res = await http.get(url, {
    headers: { Referer: `${BASE}/`, "User-Agent": UA },
  });

  const data = res.data;

  // Response shape: { status, result: [{ hash, title, ... }] }
  const results = Array.isArray(data?.result)
    ? data.result
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];

  if (!results.length) {
    Logger.warn("[vidsrc] No servers from API for tmdbId:", tmdbId);
  }

  return results.map((r: any) => ({
    hash: r.hash ?? r.id ?? "",
    name: r.title ?? r.name ?? "server",
  }));
}

// ─── Step 2: resolve hash → embed URL via /rcp/ ───────────────────────────────

async function resolveHash(hash: string): Promise<string | null> {
  try {
    const vrf = generateVRF(hash);
    const res = await http.get(`${BASE}/rcp/${hash}`, {
      headers: { Referer: `${BASE}/`, "User-Agent": UA },
      params: { vrf },
      maxRedirects: 5,
      validateStatus: (s) => s < 500,
    });

    // Can be a redirect, JSON with url/link, or HTML with iframe
    if (res.headers?.location) return res.headers.location;
    if (typeof res.data === "object") {
      if (res.data?.url) return res.data.url;
      if (res.data?.link) return res.data.link;
      if (res.data?.src) return res.data.src;
    }
    if (typeof res.data === "string") {
      const $ = cheerio.load(res.data);
      const src = $("iframe").attr("src") || $("video source").attr("src");
      if (src) return src;
      // Look for a JS variable with the URL
      const match = res.data.match(/(?:url|src|link)\s*[:=]\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i);
      if (match) return match[1];
    }
  } catch (err: any) {
    Logger.warn("[vidsrc] resolveHash error for", hash, ":", err.message);
  }
  return null;
}

// ─── Step 3: extract M3U8 from embed URL (MegaCloud/VidStr) ──────────────────

async function extractFromEmbedUrl(embedUrl: string): Promise<any | null> {
  try {
    const videoUrl = new URL(embedUrl);
    const result = await extractor.extract(videoUrl, `${BASE}/`);
    if (result?.sources?.length > 0) return result;
  } catch (err: any) {
    Logger.warn("[vidsrc] MegaCloud extract failed for", embedUrl, ":", err.message);
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchSources(
  type: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number,
) {
  let servers: { hash: string; name: string }[];
  try {
    servers = await getServers(type, tmdbId, season, episode);
  } catch (err: any) {
    Logger.error("[vidsrc] Failed to get server list:", err.message);
    return null;
  }

  if (!servers.length) {
    Logger.error("[vidsrc] No servers available for tmdbId:", tmdbId);
    return null;
  }

  Logger.info(`[vidsrc] ${servers.length} server(s) for tmdb:${tmdbId}`);

  for (const server of servers) {
    if (!server.hash) continue;
    Logger.info(`[vidsrc] Trying: ${server.name} (${server.hash})`);

    const embedUrl = await resolveHash(server.hash);
    if (!embedUrl) {
      Logger.warn("[vidsrc] Could not resolve hash:", server.hash);
      continue;
    }

    Logger.info("[vidsrc] Embed URL:", embedUrl);

    // If it's already an m3u8, return it directly
    if (embedUrl.includes(".m3u8")) {
      return {
        sources: [{ url: embedUrl, isM3u8: true, type: "hls" }],
        subtitles: [],
      };
    }

    // Otherwise try MegaCloud extraction
    const result = await extractFromEmbedUrl(embedUrl);
    if (result) {
      Logger.info(`[vidsrc] Got ${result.sources.length} source(s) from ${server.name}`);
      return result;
    }
  }

  Logger.error("[vidsrc] All servers failed for tmdbId:", tmdbId);
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export class Vidsrc {
  static async getMovieSources(tmdbId: number) {
    const data = await fetchSources("movie", tmdbId);
    if (!data) return { success: false, status: 404, error: "No sources found" };
    return { success: true, status: 200, data };
  }

  static async getTvSources(tmdbId: number, season: number, episode: number) {
    const data = await fetchSources("tv", tmdbId, season, episode);
    if (!data) return { success: false, status: 404, error: "No sources found" };
    return { success: true, status: 200, data };
  }
}
