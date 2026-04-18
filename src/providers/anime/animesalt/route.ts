import { Elysia, t } from "elysia";
import { AnimeSalt } from "./animesalt";
import { isTooLarge } from "../../../core/helper";
import { Logger } from "../../../core/logger";

import { env } from "../../../core/runtime";

export const SERVER_ORIGIN = env.SERVER_ORIGIN || "";
export const STREAM_PROXY_BASE = (env.STREAM_PROXY_BASE || (SERVER_ORIGIN ? `${SERVER_ORIGIN}/proxy` : "")).replace(
  /\/+$/,
  "",
);
export const PROXIFY = Boolean(env.PROXIFY) || false;

if (!SERVER_ORIGIN && env.NODE_ENV !== "test") throw new Error("set SERVER_ORIGIN at .env!");

Logger.info("auto source proxy is ", PROXIFY);

const PLAYLIST_REGEX =
  /\.m3u|playlist|\.txt|^(?!.*\.(?:js|css|gif|jpg|png|svg|woff|woff2|ttf|ts|mp4|m4s|aac|key|vtt)(?:[?#].*)?$).*$/i;

export const animesaltRoutes = new Elysia({ prefix: "/animesalt" })

  .get("/", () => ({
    name: "animesalt-api",
    version: "2.0",
    endpoints: [
      "/anime/animesalt/home",
      "/anime/animesalt/search/{query}/{page}",
      "/anime/animesalt/category/{type}/{page}",
      "/anime/animesalt/movies/{page}",
      "/anime/animesalt/movies/info/{slug}",
      "/anime/animesalt/series/info/{slug}",
      "/anime/animesalt/episode/stream/{slug}",
    ],
  }))

  .get("/home", async () => {
    return { results: await AnimeSalt.home() };
  })

  .get(
    "/search/:query/:page?",
    async ({ params }) => {
      return {
        results: await AnimeSalt.search(params.query, Number(params.page) || 1),
      };
    },
    {
      params: t.Object({
        query: t.String(),
        page: t.Optional(t.Number({ default: 1 })),
      }),
    },
  )

  .get("/category/*", async ({ params, query }) => {
    const path = params["*"] || "";
    const segments = path.split("/").filter(Boolean);

    let type: string;
    let page = 1;

    const last = segments[segments.length - 1];

    if (segments.length > 1 && /^\d+$/.test(last)) {
      page = parseInt(segments.pop()!);
      type = segments.join("/");
    } else {
      type = segments.join("/");
    }

    return {
      results: await AnimeSalt.category(type, page, query.type),
    };
  })

  .get(
    "/movies/:page?",
    async ({ params }) => {
      return {
        results: await AnimeSalt.movies(Number(params.page) || 1),
      };
    },
    {
      params: t.Object({
        page: t.Optional(t.Number({ default: 1 })),
      }),
    },
  )

  .get("/movies/info/:slug", async ({ params }) => {
    const data = await AnimeSalt.movieInfo(params.slug);
    if (!data) return { error: "Not found" };
    return data;
  })

  .get("/series/info/:slug", async ({ params }) => {
    const data = await AnimeSalt.seriesInfo(params.slug);
    if (!data) return { error: "Not found" };
    return data;
  })

  .get("/episode/stream/:slug", async ({ params }) => {
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of AnimeSalt.streams(params.slug)) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + "\n"));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  })

  .get(
    "/m3u8-proxy",
    async ({ request, query: { url, headers } }) => {
      let corsHeaders: Record<string, string> = {};

      if (headers) {
        try {
          corsHeaders = JSON.parse(decodeURIComponent(headers));
        } catch {
          return new Response("Invalid headers", { status: 400 });
        }
      }

      corsHeaders["Connection"] = "keep-alive";

      try {
        const res = await fetch(url, {
          headers: corsHeaders,
          signal: request.signal,
        });

        const text = await res.text();
        const encodedHeaders = encodeURIComponent(headers || "");

        const proxified = text
          .split("\n")
          .map((line) => {
            const tl = line.trim();
            if (!tl) return line;

            const absolute = new URL(tl, url).href;
            const encoded = encodeURIComponent(absolute);

            if (PLAYLIST_REGEX.test(absolute)) {
              return `${STREAM_PROXY_BASE}/m3u8-proxy?url=${encoded}&headers=${encodedHeaders}`;
            } else {
              return `${STREAM_PROXY_BASE}/ts-segment?url=${encoded}&headers=${encodedHeaders}`;
            }
          })
          .join("\n");

        return new Response(proxified);
      } catch (err) {
        Logger.error(err);
        return new Response("Proxy error", { status: 500 });
      }
    },
    {
      query: t.Object({
        url: t.String(),
        headers: t.Optional(t.String()),
      }),
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
          return new Response("Invalid headers", { status: 400 });
        }
      }

      corsHeaders["Connection"] = "keep-alive";

      try {
        const res = await fetch(url, {
          headers: corsHeaders,
          signal: request.signal,
        });

        return new Response(res.body, {
          headers: {
            "Content-Type": "video/MP2T",
          },
        });
      } catch (err) {
        Logger.error(err);
        return new Response("Proxy error", { status: 500 });
      }
    },
    {
      query: t.Object({
        url: t.String(),
        headers: t.Optional(t.String()),
      }),
    },
  );
