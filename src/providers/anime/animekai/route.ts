import { Elysia } from "elysia";
import { AnimeKai } from "./animekai";
import { buildHomepage } from "./homepage";
import { STREAM_PROXY_BASE } from "../../../core/config";

// Short-lived in-memory store for pre-fetched & rewritten m3u8 playlists.
// Keys are random tokens; entries expire after 5 minutes.
const m3u8Cache = new Map<string, { content: string; expiresAt: number }>();
const M3U8_TTL_MS = 5 * 60 * 1000;

function storeM3u8(content: string): string {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  m3u8Cache.set(token, { content, expiresAt: Date.now() + M3U8_TTL_MS });
  // Purge expired entries opportunistically
  for (const [k, v] of m3u8Cache.entries()) {
    if (v.expiresAt < Date.now()) m3u8Cache.delete(k);
  }
  return token;
}

export const animekaiRoutes = new Elysia({ prefix: "/animekai" })

  // ─── Full Homepage (AniList + AnimeKai, server-side cached) ─────────────────
  .get("/homepage", async () => {
    return await buildHomepage();
  })

  // ─── Homepage (trending + latest episodes) ─────────────────────────────────
  .get("/home", async () => {
    return await AnimeKai.home();
  })

  // ─── Search ────────────────────────────────────────────────────────────────
  .get("/search/:query", async ({ params: { query }, query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.search(query, page);
  })

  // ─── Spotlight ─────────────────────────────────────────────────────────────
  .get("/spotlight", async () => {
    return { results: await AnimeKai.spotlight() };
  })

  // ─── Schedule ──────────────────────────────────────────────────────────────
  .get("/schedule/:date", async ({ params: { date } }) => {
    return { results: await AnimeKai.schedule(date) };
  })

  // ─── Search Suggestions ────────────────────────────────────────────────────
  .get("/suggestions/:query", async ({ params: { query } }) => {
    return { results: await AnimeKai.suggestions(query) };
  })

  // ─── Recent Episodes (recently updated) ────────────────────────────────────
  .get("/recent-episodes", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.recentlyUpdated(page);
  })

  // ─── Recently Added ────────────────────────────────────────────────────────
  .get("/recent-added", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.recentlyAdded(page);
  })

  // ─── Latest Completed ──────────────────────────────────────────────────────
  .get("/completed", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.latestCompleted(page);
  })

  // ─── New Releases ──────────────────────────────────────────────────────────
  .get("/new-releases", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.newReleases(page);
  })

  // ─── Movies ────────────────────────────────────────────────────────────────
  .get("/movies", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.movies(page);
  })

  // ─── TV ────────────────────────────────────────────────────────────────────
  .get("/tv", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.tv(page);
  })

  // ─── OVA ───────────────────────────────────────────────────────────────────
  .get("/ova", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.ova(page);
  })

  // ─── ONA ───────────────────────────────────────────────────────────────────
  .get("/ona", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.ona(page);
  })

  // ─── Specials ──────────────────────────────────────────────────────────────
  .get("/specials", async ({ query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.specials(page);
  })

  // ─── Genre List ────────────────────────────────────────────────────────────
  .get("/genres", async () => {
    return { results: await AnimeKai.genres() };
  })

  // ─── By Genre ──────────────────────────────────────────────────────────────
  .get("/genre/:genre", async ({ params: { genre }, query: qs }) => {
    const page = parseInt(qs?.page as string) || 1;
    return await AnimeKai.genreSearch(genre, page);
  })

  // ─── Anime Info ────────────────────────────────────────────────────────────
  .get("/info/:id?", async ({ params: { id }, set }) => {
    if (!id) {
      set.status = 400;
      return { message: "id is required" };
    }
    const res = await AnimeKai.info(id);
    if (!res) {
      set.status = 404;
      return { message: "Anime not found" };
    }
    return res;
  })

// ─── Cached pre-fetched M3U8 playlist (served to client after server-side rewrite) ──
  .get("/cached-m3u8", ({ query: qs, set }) => {
    const token = qs?.token as string | undefined;
    if (!token) { set.status = 400; return "Missing token"; }
    const entry = m3u8Cache.get(token);
    if (!entry || entry.expiresAt < Date.now()) { set.status = 404; return "Expired or not found"; }
    return new Response(entry.content, {
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*" },
    });
  })

// ─── Watch / Stream Sources ────────────────────────────────────────────────
  .get("/watch/:episodeId", async ({ params: { episodeId }, query: qs, set }) => {
    if (!episodeId) {
      set.status = 400;
      return { message: "episodeId is required" };
    }
    
    const type = qs?.type as "softsub" | "dub" | "hardsub" | undefined;
    const animeSlug = episodeId.split("$")[0] ?? episodeId;
    
    const streamsData = await AnimeKai.streams(animeSlug, episodeId, type);

    // Pre-fetch each signed HLS playlist server-side immediately after extraction.
    // MegaUp CDN signs URLs to the VPS IP — if we let the client proxy them later,
    // the signature may have expired or be rejected. Fetching here, rewriting segment
    // URLs through our proxy, and returning a stable token URL avoids all 403s.
    if (Array.isArray(streamsData?.results)) {
      await Promise.all(
        streamsData.results.map(async (result: any) => {
          if (!Array.isArray(result.sources)) return;
          await Promise.all(
            result.sources.map(async (source: any) => {
              const url: string = source?.url ?? source?.file ?? "";
              if (!url.includes(".m3u8")) return;
              try {
                const origin = new URL(url).origin;
                const cdnHeaders: Record<string, string> = {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                  "Referer": origin + "/",
                  "Origin": origin,
                  "Accept": "*/*",
                };
                const res = await fetch(url, { headers: cdnHeaders });
                if (!res.ok) return; // leave source as-is, client will fall through to next server
                const m3u8Text = await res.text();
                const encodedHeaders = encodeURIComponent(JSON.stringify(cdnHeaders));
                const rewritten = m3u8Text
                  .split("\n")
                  .map((line: string) => {
                    const tl = line.trim();
                    if (!tl || tl.startsWith("#")) return line;
                    const absUrl = new URL(tl, url).href;
                    const enc = encodeURIComponent(absUrl);
                    const isPlaylist = /\.m3u|\.txt|playlist/i.test(absUrl);
                    return isPlaylist
                      ? `${STREAM_PROXY_BASE}/m3u8-proxy?url=${enc}&headers=${encodedHeaders}`
                      : `${STREAM_PROXY_BASE}/ts-segment?url=${enc}&headers=${encodedHeaders}`;
                  })
                  .join("\n");
                const token = storeM3u8(rewritten);
                const cachedUrl = `${STREAM_PROXY_BASE.replace("/proxy", "")}/anime/animekai/cached-m3u8?token=${token}`;
                source.url = cachedUrl;
                source.file = cachedUrl;
              } catch {
                // leave source unchanged if anything fails
              }
            }),
          );
        }),
      );
    }

    return streamsData;
  })

  // ─── Episode Servers ───────────────────────────────────────────────────────
.get("/servers/:episodeId", async ({ params: { episodeId }, query: qs, set }) => {
  if (!episodeId) {
    set.status = 400;
    return { message: "episodeId is required" };
  }

  const type = qs?.type as "softsub" | "dub" | "hardsub" | undefined;
  return { 
    servers: await AnimeKai.fetchEpisodeServers(episodeId, type ?? "hardsub") 
  };
});
