import { Elysia } from "elysia";
import { mangaball } from "./mangaball";

// ─── helpers ────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { status: 200, success: true, data };
}

function err(set: any, status: number, message: string) {
  set.status = status;
  return { status, success: false, message, data: null };
}

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  // Add /mangaball so the parser generates the correct prefixed image links
  return `${url.protocol}//${url.host}/manga/mangaball`;
}

// ─── Routes ────────────────────────────────────────────────────────────────

export const mangaballRoutes = new Elysia({ prefix: "/mangaball" })
  
  // ─── Root Endpoint ───────────────────────────────────────────────────────────
  .get("/", () => {
    return {
      provider: "Mangaball",
      status: "operational",
      message: "Mangaball provider is running. Visit /swagger for available endpoints."
    };
  })
  
  // ─── browse endpoints ────────────────────────────────────────────────────────
  .get("/recommendation", async ({ query, request, set }) => {
    const limit = parseInt(query.limit as string) || 12;
    const data = await mangaball.parseRecommendation(getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/home", async ({ request, set }) => {
    const data = await mangaball.parseHome(getBaseUrl(request));
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/latest", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseLatest(getBaseUrl(request), page, limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/foryou", async ({ query, request, set }) => {
    const time = (query.time as string) || "day";
    const limit = parseInt(query.limit as string) || 12;
    const data = await mangaball.parseForYou(time, getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/recent", async ({ query, request, set }) => {
    const time = (query.time as string) || "day";
    const limit = parseInt(query.limit as string) || 12;
    const data = await mangaball.parseRecent(time, getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/popular", async ({ query, request, set }) => {
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parsePopular(getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/origin", async ({ query, request, set }) => {
    const origin = (query.origin as string) || "all";
    const data = await mangaball.parseOrigin(origin, getBaseUrl(request));
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/added", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdded(page, getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/new-chap", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseNewChap(page, getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/manga", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, originalLang: "jp" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/manhwa", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, originalLang: "kr" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/manhua", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, originalLang: "zh" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/comics", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, originalLang: "en" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/ongoing", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, publicationStatus: "ongoing" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/completed", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, publicationStatus: "completed" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/on-hold", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, publicationStatus: "on_hold" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/cancelled", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, publicationStatus: "cancelled" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/hiatus", async ({ query, request, set }) => {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseAdvanced({ baseApiUrl: getBaseUrl(request), page, limit, publicationStatus: "hiatus" });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })

  // ─── search endpoints ────────────────────────────────────────────────────────
  .get("/search", async ({ query, request, set }) => {
    const q = (query.q as string) || "";
    if (!q) return err(set, 400, "Query parameter 'q' is required");
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 24;
    const data = await mangaball.parseSearch(q, page, getBaseUrl(request), limit);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/filters", async ({ query, request, set }) => {
    const q = (query.q as string) || "";
    const sort = (query.sort as string) || "updated_chapters_desc";
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 10;
    const tagIncluded = query.tag_included ? [query.tag_included].flat() as string[] : [];
    const tagIncludedMode = (query.tag_included_mode as string) || "and";
    const tagExcluded = query.tag_excluded ? [query.tag_excluded].flat() as string[] : [];
    const tagExcludedMode = (query.tag_excluded_mode as string) || "and";
    const demographic = (query.demographic as string) || "any";
    const person = (query.person as string) || "any";
    const originalLang = (query.original_lang as string) || "any";
    const publicationStatus = (query.status as string) || "any";
    const translatedLang = query.translated_lang ? [query.translated_lang].flat() as string[] : [];

    const data = await mangaball.parseFilters({
      baseApiUrl: getBaseUrl(request),
      q, sort, page, limit,
      tagIncluded, tagIncludedMode,
      tagExcluded, tagExcludedMode,
      demographic, person,
      originalLang, publicationStatus,
      translatedLang,
    });
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/person-search", async ({ query, set }) => {
    const q = (query.q as string) || "";
    if (!q) return err(set, 400, "Query parameter 'q' is required");
    const data = await mangaball.parsePersonSearch(q);
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/person/:id_person", async ({ params, query, request, set }) => {
    const { id_person } = params;
    const page = parseInt(query.page as string) || 1;
    const data = await mangaball.parsePerson(id_person, page, getBaseUrl(request));
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })

  // ─── tag endpoints ───────────────────────────────────────────────────────────
  .get("/tags", async ({ set }) => {
    const data = await mangaball.parseTags();
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/tags-detail", async ({ set }) => {
    const data = await mangaball.parseTagsDetail();
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/tags/:id_tags", async ({ params, query, request, set }) => {
    const { id_tags } = params;
    const page = parseInt(query.page as string) || 1;
    const data = await mangaball.parseTagsById(id_tags, page, getBaseUrl(request));
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })
  .get("/keyword/:id_keyword", async ({ params, query, request, set }) => {
    const { id_keyword } = params;
    const page = parseInt(query.page as string) || 1;
    const data = await mangaball.parseKeyword(id_keyword, page, getBaseUrl(request));
    if ("error" in data) return err(set, 500, data.error as string);
    return ok(data);
  })

  // ─── detail & reading ────────────────────────────────────────────────────────
  .get("/detail/:slug", async ({ params, request, set }) => {
    const { slug } = params;
    const data = await mangaball.parseDetail(slug, getBaseUrl(request));
    if ("error" in data) return err(set, 404, data.error as string);
    return ok(data);
  })
  .get("/read/:id_chapter", async ({ params, request, set }) => {
    const { id_chapter } = params;
    const data = await mangaball.parseRead(id_chapter, getBaseUrl(request));
    if ("error" in data) return err(set, 404, data.error as string);
    return ok(data);
  })

  // ─── image proxy ─────────────────────────────────────────────────────────────
  .get("/image/*", async ({ params, set }) => {
    const path = params["*"] as string;
    const result = await mangaball.proxyImage(path);
    if (!result) {
      set.status = 404;
      return;
    }
    set.headers["Content-Type"] = result.contentType;
    set.headers["Cache-Control"] = "public, max-age=86400";
    return result.content;
  });

  //------Metahat-----//
