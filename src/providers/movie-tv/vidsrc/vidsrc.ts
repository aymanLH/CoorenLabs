import * as cheerio from "cheerio";
import { createProxiedAxios } from "../../../core/lib/upstreamProxy";
import { VideoStream, getClientKey } from "../himovies/extractor";
import { vidsrc as baseUrl } from "../../origins";
import { Logger } from "../../../core/logger";
import type { VidsrcServer, VidsrcResult } from "./types";

// vidsrc.rip uses the same MegaCloud/VidStr embed infrastructure as himovies.
// Flow: embed page → find server hash → getSources?id=HASH&_k=CLIENT_KEY → decrypt → M3U8
const extractor = new VideoStream();
const http = createProxiedAxios();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmbedUrl(type: "movie" | "tv", tmdbId: number, season?: number, episode?: number) {
  if (type === "movie") return `${baseUrl}/embed/movie/${tmdbId}`;
  return `${baseUrl}/embed/tv/${tmdbId}/${season}/${episode}`;
}

// Parse server list from the embed page HTML
function parseServers(html: string): VidsrcServer[] {
  const $ = cheerio.load(html);
  const servers: VidsrcServer[] = [];

  // vidsrc renders server list as <div class="server"> or <li data-hash="...">
  $("[data-hash]").each((_, el) => {
    const hash = $(el).attr("data-hash") || $(el).attr("data-id") || "";
    const name = $(el).text().trim() || $(el).attr("data-name") || "server";
    const id = $(el).attr("data-id") || hash;
    if (hash) servers.push({ id, name: name.toLowerCase(), hash });
  });

  // Fallback: look for source links embedded in script tags
  if (servers.length === 0) {
    const scriptContent = $("script")
      .map((_, el) => $(el).html() || "")
      .get()
      .join("\n");
    const hashMatches = scriptContent.matchAll(/"hash"\s*:\s*"([^"]+)"/g);
    for (const match of hashMatches) {
      servers.push({ id: match[1], name: "vidstr", hash: match[1] });
    }
  }

  return servers;
}

// Resolve a server hash → actual embed URL (megacloud/vidstr)
async function resolveServerUrl(hash: string, referer: string): Promise<string | null> {
  try {
    const res = await http.get(`${baseUrl}/rcp/${hash}`, {
      headers: { Referer: referer, "X-Requested-With": "XMLHttpRequest" },
      maxRedirects: 0,
      validateStatus: (s) => s < 400,
    });

    // May return a redirect Location or a JSON with url field
    if (res.headers?.location) return res.headers.location;
    if (res.data?.url) return res.data.url;
    if (res.data?.link) return res.data.link;

    // Some versions embed the URL in HTML
    const $ = cheerio.load(res.data || "");
    const iframeSrc = $("iframe").attr("src");
    if (iframeSrc) return iframeSrc;

    return null;
  } catch (err: any) {
    Logger.error("[vidsrc] resolveServerUrl error:", err.message);
    return null;
  }
}

// ─── Main scraper ─────────────────────────────────────────────────────────────

async function fetchSources(
  type: "movie" | "tv",
  tmdbId: number,
  season?: number,
  episode?: number,
): Promise<VidsrcResult | null> {
  const embedUrl = buildEmbedUrl(type, tmdbId, season, episode);

  // 1. Load embed page and find servers
  let html: string;
  try {
    const res = await http.get(embedUrl, {
      headers: {
        Referer: `${baseUrl}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    html = res.data;
  } catch (err: any) {
    Logger.error("[vidsrc] Failed to load embed page:", err.message);
    return null;
  }

  const servers = parseServers(html);
  if (servers.length === 0) {
    Logger.error("[vidsrc] No servers found on embed page for:", embedUrl);
    return null;
  }

  Logger.info(`[vidsrc] Found ${servers.length} server(s):`, servers.map((s) => s.name).join(", "));

  // 2. Try each server until one works
  for (const server of servers) {
    try {
      Logger.info(`[vidsrc] Trying server: ${server.name} (${server.hash})`);

      // Resolve hash → embed URL (megacloud/vidstr URL)
      const serverEmbedUrl = await resolveServerUrl(server.hash, embedUrl);
      if (!serverEmbedUrl) {
        Logger.warn(`[vidsrc] Could not resolve URL for server: ${server.name}`);
        continue;
      }

      Logger.info(`[vidsrc] Resolved embed URL: ${serverEmbedUrl}`);

      // 3. Use the existing MegaCloud extractor (same as himovies)
      const videoUrl = new URL(serverEmbedUrl);
      const result = await extractor.extract(videoUrl, `${baseUrl}/`);

      if (result?.sources?.length > 0) {
        Logger.info(`[vidsrc] Got ${result.sources.length} source(s) from ${server.name}`);
        return result as VidsrcResult;
      }
    } catch (err: any) {
      Logger.warn(`[vidsrc] Server ${server.name} failed: ${err.message}`);
    }
  }

  Logger.error("[vidsrc] All servers failed for:", embedUrl);
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
