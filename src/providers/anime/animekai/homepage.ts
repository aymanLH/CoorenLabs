/**
 * Server-side anime homepage builder.
 *
 * Replicates the exact logic of `getAnimeHomepage()` from the Odeon
 * frontend `anime-api.js`, so the client only needs ONE fetch.
 *
 * Data flow:
 *   1. Fetch AnimeKai /home  (trending cards + latest episodes)
 *   2. Fetch AnimeKai /tv    (airing now)
 *   3. Batch-fetch 5 AniList sections in a single GraphQL call
 *   4. Enrich AnimeKai items with AniList metadata
 *   5. Return unified homepage JSON — identical shape to what the frontend built before
 *
 * Caching: stale-while-revalidate — stale data is served instantly while a
 * background refresh runs. No user ever waits for a cold fetch after the first load.
 */

import { Logger } from "../../../core/logger";
import { AnimeKai } from "./animekai";

// ─── Constants ──────────────────────────────────────────────────────────────

const ANILIST_URL = "https://graphql.anilist.co";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches frontend HOME_TTL_MS
const STALE_TTL_MS = 30 * 60 * 1000; // 30 minutes — serve stale up to this age
const ANILIST_MIN_INTERVAL_MS = 1200;
const MAX_TITLE_LOOKUPS = 6;

let anilistNextRequestAt = 0;
let anilistBackoffUntil = 0;
const anilistInFlight = new Map<string, Promise<any>>();

// ─── Stale-while-revalidate cache ────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

let homepageCache: CacheEntry<any> | null = null;
let refreshInFlight: Promise<any> | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberOr(value: any, fallback: any = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTitle(title: string) {
  return String(title || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(
      /\b(season\s*\d+|\d+(st|nd|rd|th)\s*season|part\s*\d+|cour\s*\d+|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g,
      " ",
    )
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameBaseTitle(a: string, b: string) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  return !!na && !!nb && na === nb;
}

// ─── AniList direct fetch (server-side, no proxy needed) ─────────────────────

async function anilistFetch(query: string, variables: Record<string, any> = {}): Promise<any> {
  if (Date.now() < anilistBackoffUntil) return {};
  const requestKey = JSON.stringify([query, variables || {}]);
  if (anilistInFlight.has(requestKey)) return anilistInFlight.get(requestKey);

  const task = (async () => {
    const waitMs = Math.max(0, anilistNextRequestAt - Date.now());
    if (waitMs > 0) await sleep(waitMs);
    anilistNextRequestAt = Date.now() + ANILIST_MIN_INTERVAL_MS;

    try {
      const response = await fetch(ANILIST_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables: variables || {} }),
      });

      if (response.status === 429) {
        anilistBackoffUntil = Date.now() + 2 * 60 * 1000;
        return {};
      }

      if (!response.ok) return {};

      const body = await response.json();

      if (Array.isArray(body?.errors) && body.errors.length) {
        const status = Number(body.errors[0]?.status || 0);
        if (status === 429 || /too many requests/i.test(String(body.errors[0]?.message || ""))) {
          anilistBackoffUntil = Date.now() + 2 * 60 * 1000;
          return {};
        }
        return {};
      }

      return body?.data || {};
    } catch (err) {
      Logger.error(`[homepage] AniList fetch error: ${String(err)}`);
      return {};
    }
  })();

  anilistInFlight.set(requestKey, task);
  try {
    return await task;
  } finally {
    anilistInFlight.delete(requestKey);
  }
}

// ─── AniList field fragment ──────────────────────────────────────────────────

function getAnilistFields() {
  return `
    id
    idMal
    title { romaji english native }
    coverImage { extraLarge large }
    bannerImage
    description
    averageScore
    episodes
    duration
    genres
    status
    format
    startDate { year month day }
    studios(isMain: true) { nodes { name } }
  `;
}

// ─── Mappers (exact replicas of anime-api.js) ────────────────────────────────

function mapAnimeKaiBase(item: any) {
  if (!item) return null;
  const rawYear =
    item.releaseDate || item.release_date || item.premiered || item.season || "";
  const yearStr = String(rawYear).match(/\d{4}/)?.[0] || "";
  const releaseDate = yearStr ? `${yearStr}-01-01` : "";
  return {
    id: item.id || "",
    animekaiId: item.id || "",
    anilistId: numberOr(item.anilistId, null),
    malId: numberOr(item.malId, null),
    title: item.title || "Unknown",
    poster_path: item.image || item.banner || "",
    backdrop_path: item.banner || item.image || "",
    overview: (item.description || "").replace(/<[^>]*>/g, ""),
    vote_average: Number(item.score || 0),
    release_date: releaseDate,
    media_type: "anime",
    animekai: true,
    anilist: true,
    anilist_data: null,
    logo_url: null,
    anime_type: item.type || "TV",
    status: item.status || "",
    episodes: numberOr(item.totalEpisodes, null),
    duration: item.duration || "",
    rating: "",
    genres: Array.isArray(item.genres) ? item.genres : [],
    studios: Array.isArray(item.studios) ? item.studios : [],
  };
}

function mapAniListMetadata(media: any) {
  if (!media) return null;
  const year = media.startDate?.year;
  const month = media.startDate?.month || 1;
  const day = media.startDate?.day || 1;
  return {
    anilistId: media.id,
    malId: numberOr(media.idMal, null),
    title: media.title?.english || media.title?.romaji || media.title?.native || "",
    poster_path: media.coverImage?.extraLarge || media.coverImage?.large || "",
    backdrop_path: media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || "",
    overview: (media.description || "").replace(/<[^>]*>/g, ""),
    vote_average: media.averageScore ? media.averageScore / 10 : 0,
    release_date: year
      ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : "",
    episodes: numberOr(media.episodes, null),
    duration: media.duration ? `${media.duration} min` : "",
    genres: Array.isArray(media.genres) ? media.genres : [],
    studios: Array.isArray(media.studios?.nodes)
      ? media.studios.nodes.map((s: any) => s?.name).filter(Boolean)
      : [],
    status: media.status || "",
    anime_type: media.format || "",
    metadata: media,
  };
}

function scoreAniListMatch(media: any, title: string) {
  const query = normalizeTitle(title);
  const names = [media?.title?.english, media?.title?.romaji, media?.title?.native]
    .filter(Boolean)
    .map(normalizeTitle);

  let score = 0;
  for (const name of names) {
    if (!name) continue;
    if (name === query) score = Math.max(score, 220);
    else if (name.startsWith(query)) score = Math.max(score, 150);
    else if (name.includes(query) || query.includes(name)) score = Math.max(score, 110);
    else {
      const parts = query.split(/\s+/).filter(Boolean);
      const matched = parts.filter((part) => name.includes(part)).length;
      score = Math.max(score, matched * 12);
    }
  }
  return score;
}

// ─── AniList batch metadata fetch ────────────────────────────────────────────

// In-memory metadata cache (server-side, replaces the localStorage metaCache)
const META_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const metaStore = new Map<string, { value: any; ts: number }>();

function getMetaCached(id: string) {
  const entry = metaStore.get(id);
  if (!entry) return null;
  if (Date.now() - entry.ts > META_TTL_MS) return null;
  return entry.value;
}

function setMetaCached(id: string, value: any) {
  metaStore.set(id, { value, ts: Date.now() });
  // Limit size
  if (metaStore.size > 1000) {
    const now = Date.now();
    for (const [key, entry] of metaStore.entries()) {
      if (now - entry.ts > META_TTL_MS * 2) metaStore.delete(key);
    }
  }
}

async function fetchAniListBatch(ids: number[]) {
  const uniq = [...new Set(ids.map((id) => numberOr(id, null)).filter(Boolean))];
  const out: Record<number, any> = {};
  const missing: number[] = [];

  for (const id of uniq) {
    const cached = getMetaCached(String(id));
    if (cached) out[id] = cached;
    else missing.push(id);
  }

  for (let i = 0; i < missing.length; i += 40) {
    const chunk = missing.slice(i, i + 40);
    const data = await anilistFetch(
      `query ($ids:[Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${getAnilistFields()} } } }`,
      { ids: chunk },
    );

    const mediaList = data?.Page?.media || [];
    for (const media of mediaList) {
      const mapped = mapAniListMetadata(media);
      if (!mapped?.anilistId) continue;
      out[mapped.anilistId] = mapped;
      setMetaCached(String(mapped.anilistId), mapped);
    }
  }

  return out;
}

// ─── Search AniList by title ─────────────────────────────────────────────────

async function searchAniListByTitle(title: string): Promise<number | null> {
  const query = String(title || "").trim();
  if (!query) return null;

  const data = await anilistFetch(
    `query ($search:String) {
      Page(page: 1, perPage: 8) {
        media(type: ANIME, search: $search, sort: [SEARCH_MATCH]) {
          ${getAnilistFields()}
        }
      }
    }`,
    { search: query },
  );

  const list = data?.Page?.media || [];
  const best = list
    .map((media: any) => ({ media, score: scoreAniListMatch(media, query) }))
    .sort((a: any, b: any) => b.score - a.score)[0];
  return best?.media?.id || null;
}

// ─── Resolve AniList IDs for AnimeKai items ──────────────────────────────────

// Server-side map cache (replaces localStorage MAP_CACHE / TITLE_CACHE)
const MAP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TITLE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const mapStore = new Map<string, { value: number; ts: number }>();
const titleStore = new Map<string, { value: number; ts: number }>();

function getMapCached(key: string) {
  const e = mapStore.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > MAP_TTL_MS) return null;
  return e.value;
}
function setMapCached(key: string, value: number) {
  mapStore.set(key, { value, ts: Date.now() });
}
function getTitleCached(key: string) {
  const e = titleStore.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TITLE_TTL_MS) return null;
  return e.value;
}
function setTitleCached(key: string, value: number) {
  titleStore.set(key, { value, ts: Date.now() });
}

async function resolveAniListIds(animeList: any[]) {
  const mapped = animeList.map(mapAnimeKaiBase).filter(Boolean) as any[];

  for (const item of mapped) {
    if (item.anilistId) {
      setMapCached(item.animekaiId, item.anilistId);
      continue;
    }
    const fromCache = getMapCached(item.animekaiId);
    if (fromCache) item.anilistId = fromCache;
    if (item.anilistId) continue;
    const titleKey = normalizeTitle(item.title);
    const fromTitleCache = getTitleCached(titleKey);
    if (fromTitleCache) {
      item.anilistId = fromTitleCache;
      setMapCached(item.animekaiId, item.anilistId);
    }
  }

  for (const item of mapped) {
    if (item.anilistId) continue;
    const sibling = mapped.find(
      (r: any) => r.anilistId && r.animekaiId !== item.animekaiId && sameBaseTitle(r.title, item.title),
    );
    if (sibling?.anilistId) {
      item.anilistId = sibling.anilistId;
      setMapCached(item.animekaiId, item.anilistId);
    }
  }

  const unresolved = mapped
    .filter((item: any) => !item.anilistId)
    .slice(0, MAX_TITLE_LOOKUPS);

  for (const item of unresolved) {
    try {
      const id = await searchAniListByTitle(item.title);
      if (!id) continue;
      item.anilistId = id;
      setMapCached(item.animekaiId, id);
      const titleKey = normalizeTitle(item.title);
      if (titleKey) setTitleCached(titleKey, id);
    } catch {
      // keep AnimeKai-only fallback
    }
  }

  return mapped;
}

// ─── Merge anime base + AniList meta ─────────────────────────────────────────

function mergeAnime(base: any, meta: any) {
  if (!meta) return { ...base, metadata: null };
  const mergedScore =
    meta.vote_average > 0 ? meta.vote_average : base.vote_average > 0 ? base.vote_average : 0;
  const mergedDate = meta.release_date || base.release_date || "";
  return {
    ...base,
    anilistId: base.anilistId || meta.anilistId || null,
    malId: base.malId || meta.malId || null,
    poster_path: meta.poster_path || base.poster_path,
    backdrop_path: meta.backdrop_path || base.backdrop_path,
    overview: (base.overview && base.overview.length > 50 ? base.overview : meta.overview) || base.overview,
    vote_average: mergedScore,
    release_date: mergedDate,
    episodes: base.episodes || meta.episodes || null,
    duration: base.duration || meta.duration || "",
    genres: base.genres?.length ? base.genres : meta.genres || [],
    studios: base.studios?.length ? base.studios : meta.studios || [],
    status: base.status || meta.status || "",
    anime_type: base.anime_type || meta.anime_type || "TV",
    metadata: meta.metadata || null,
  };
}

// ─── Enrich anime list (resolve IDs + merge) ────────────────────────────────

async function enrichAnimeList(animeList: any[]) {
  const resolved = await resolveAniListIds(animeList || []);
  const ids = resolved.map((item: any) => item.anilistId).filter(Boolean);
  const metaById = await fetchAniListBatch(ids);

  return resolved.map((item: any) => {
    const meta = item.anilistId ? metaById[item.anilistId] : null;
    return mergeAnime(item, meta);
  });
}

// ─── Section helpers ─────────────────────────────────────────────────────────

function toSection(res: any, items: any[]) {
  return {
    items,
    page: res?.currentPage ?? 1,
    totalPages: res?.totalPages ?? 1,
  };
}

function mapAniListSection(pageData: any, opts: { animeType?: string; status?: string } = {}) {
  const mediaList = pageData?.media || [];
  const items = mediaList
    .map((media: any) => {
      const mapped = mapAniListMetadata(media);
      if (!mapped) return null;
      return {
        id: String(mapped.anilistId),
        animekaiId: String(mapped.anilistId),
        anilistId: mapped.anilistId,
        malId: mapped.malId,
        title: mapped.title,
        poster_path: mapped.poster_path,
        backdrop_path: mapped.backdrop_path,
        overview: mapped.overview,
        vote_average: mapped.vote_average,
        release_date: mapped.release_date,
        media_type: "anime",
        animekai: true,
        anilist: true,
        anime_type: opts.animeType || mapped.anime_type,
        status: opts.status || mapped.status,
        episodes: mapped.episodes,
        duration: mapped.duration,
        genres: mapped.genres,
        studios: mapped.studios,
        logo_url: null,
        anilist_data: null,
        metadata: mapped.metadata || null,
      };
    })
    .filter((item: any) => item && item.poster_path);
  const pageInfo = pageData?.pageInfo || {};
  return {
    items,
    page: pageInfo.currentPage ?? 1,
    totalPages: pageInfo.lastPage ?? 1,
  };
}

// ─── Batched AniList sections ────────────────────────────────────────────────

async function fetchAllAniListSections() {
  const currentYear = new Date().getFullYear();
  const fields = getAnilistFields();
  const data = await anilistFetch(
    `query ($year: Int) {
      trending: Page(page: 1, perPage: 50) {
        pageInfo { currentPage lastPage }
        media(type: ANIME, sort: TRENDING_DESC, status_not: NOT_YET_RELEASED, format_not_in: [MUSIC, MANGA]) {
          ${fields}
        }
      }
      topRated: Page(page: 1, perPage: 50) {
        pageInfo { currentPage lastPage }
        media(type: ANIME, sort: SCORE_DESC, status_not: NOT_YET_RELEASED, format_not_in: [MUSIC, MANGA]) {
          ${fields}
        }
      }
      movies: Page(page: 1, perPage: 50) {
        pageInfo { currentPage lastPage }
        media(type: ANIME, format: MOVIE, sort: SCORE_DESC, seasonYear: $year, status: FINISHED) {
          ${fields}
        }
      }
      moviesAllTime: Page(page: 1, perPage: 50) {
        pageInfo { currentPage lastPage }
        media(type: ANIME, format: MOVIE, sort: SCORE_DESC, status: FINISHED) {
          ${fields}
        }
      }
      upcoming: Page(page: 1, perPage: 50) {
        pageInfo { currentPage lastPage }
        media(type: ANIME, status: NOT_YET_RELEASED, sort: START_DATE, format_not_in: [MUSIC, MANGA]) {
          ${fields}
        }
      }
    }`,
    { year: currentYear },
  );
  return data || {};
}

// ─── Build the homepage (core orchestrator) ──────────────────────────────────

async function buildHomepageFresh(): Promise<any> {
  Logger.info("[homepage] Building fresh homepage data...");
  const start = Date.now();

  // ── Fetch AnimeKai data + all AniList sections in parallel ─────────────
  const [homeData, tv, anilistData] = await Promise.all([
    AnimeKai.home().catch(() => ({ trending: [], latestEpisodes: [] })),
    AnimeKai.tv(1).catch(() => ({ currentPage: 1, hasNextPage: false, totalPages: 1, results: [] })),
    fetchAllAniListSections(),
  ]);

  // ── Latest Episodes ─────────────────────────────────────────────────────
  let latestEpisodesRaw = (homeData as any)?.latestEpisodes || [];
  let latestEpTotalPages = 1;

  if (!latestEpisodesRaw.length) {
    try {
      const recentRes = await AnimeKai.recentlyUpdated(1);
      latestEpisodesRaw = recentRes?.results || [];
      latestEpTotalPages = recentRes?.totalPages ?? 1;
    } catch (err: any) {
      Logger.error(`[homepage] recent-episodes fallback failed: ${err?.message}`);
    }
  }

  const enrichedLatest = await enrichAnimeList(latestEpisodesRaw);
  const enrichedLatestMap = new Map(enrichedLatest.map((item: any) => [item.id, item]));
  const latestEpisodesItems = latestEpisodesRaw.map((x: any) => {
    const enriched = enrichedLatestMap.get(x.id) || mapAnimeKaiBase(x);
    return {
      ...enriched,
      episode: x?.episodeNo ?? x?.episode ?? x?.sub ?? "?",
      airingAgo: "",
      vote_average: enriched.vote_average || Number(x.score || 0),
      release_date: enriched.release_date || "",
    };
  });

  // ── Map batched AniList data to sections ─────────────────────────────────
  const trendingSection = mapAniListSection(anilistData.trending);
  const topRatedSection = mapAniListSection(anilistData.topRated);
  let movieSection = mapAniListSection(anilistData.movies, { animeType: "MOVIE" });
  // Fallback: if current year has too few finished movies, use all-time
  if (movieSection.items.length < 6) {
    movieSection = mapAniListSection(anilistData.moviesAllTime, { animeType: "MOVIE" });
  }
  const upcomingSection = mapAniListSection(anilistData.upcoming, { status: "NOT_YET_RELEASED" });

  // ── Airing Now — from AnimeKai TV endpoint ──────────────────────────────
  const tvEnriched = await enrichAnimeList((tv as any)?.results || []);

  const hero = trendingSection.items[0] || latestEpisodesItems[0] || null;

  const result = {
    hero,
    trending: trendingSection,
    topRated: topRatedSection,
    latestMovies: movieSection,
    latestShows: toSection(tv, tvEnriched),
    upcoming: upcomingSection,
    latestEpisodes: {
      items: latestEpisodesItems,
      page: 1,
      totalPages: latestEpTotalPages,
    },
  };

  Logger.info(`[homepage] Built in ${Date.now() - start}ms — ${trendingSection.items.length} trending, ${latestEpisodesItems.length} latest eps`);
  return result;
}

// ─── Public API — stale-while-revalidate ─────────────────────────────────────

/**
 * Returns the homepage data, using stale-while-revalidate caching:
 *
 *  - FRESH (< 10 min old): serve from cache instantly
 *  - STALE (10-30 min old): serve stale immediately, trigger background refresh
 *  - EXPIRED (> 30 min): wait for a fresh build
 *
 * Concurrent callers during a refresh are coalesced (only one fetch runs).
 */
export async function buildHomepage(): Promise<any> {
  const now = Date.now();

  // ── 1. Fresh cache → instant ──────────────────────────────────────────
  if (homepageCache && now - homepageCache.cachedAt <= CACHE_TTL_MS) {
    return homepageCache.data;
  }

  // ── 2. Stale cache → serve now, refresh in background ─────────────────
  if (homepageCache && now - homepageCache.cachedAt <= STALE_TTL_MS) {
    // Trigger background refresh if not already running
    if (!refreshInFlight) {
      refreshInFlight = buildHomepageFresh()
        .then((data) => {
          homepageCache = { data, cachedAt: Date.now() };
          Logger.info("[homepage] Background refresh complete");
        })
        .catch((err) => {
          Logger.error(`[homepage] Background refresh failed: ${String(err)}`);
        })
        .finally(() => {
          refreshInFlight = null;
        });
    }
    // Serve stale data immediately
    return homepageCache.data;
  }

  // ── 3. Expired / first load → wait for fresh data ─────────────────────
  // Coalesce concurrent requests
  if (refreshInFlight) {
    await refreshInFlight;
    if (homepageCache) return homepageCache.data;
  }

  // Build fresh
  const task = buildHomepageFresh()
    .then((data) => {
      homepageCache = { data, cachedAt: Date.now() };
      return data;
    })
    .catch((err) => {
      Logger.error(`[homepage] Build failed: ${String(err)}`);
      // Serve stale if available
      if (homepageCache) return homepageCache.data;
      throw err;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  refreshInFlight = task;
  return task;
}
