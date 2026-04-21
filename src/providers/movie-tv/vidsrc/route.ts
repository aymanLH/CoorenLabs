import Elysia, { t } from "elysia";
import { Vidsrc } from "./vidsrc";

const prefix = "vidsrc";

export const vidsrcRoutes = new Elysia({ prefix: `/${prefix}` })
  .get("/", () => ({
    name: "Vidsrc",
    description: "Ad-free M3U8 sources via vidsrc.rip + MegaCloud extraction",
    endpoints: [
      `/${prefix}/movie/:tmdbId`,
      `/${prefix}/tv/:tmdbId/:season/:episode`,
    ],
  }))

  // ── Movie ──────────────────────────────────────────────────────────────────
  .get(
    "/movie/:tmdbid",
    async ({ params: { tmdbid } }) => {
      return await Vidsrc.getMovieSources(+tmdbid);
    },
    {
      params: t.Object({ tmdbid: t.Numeric() }),
      detail: { tags: ["vidsrc"], summary: "Get ad-free movie sources" },
    },
  )

  // ── TV Episode ─────────────────────────────────────────────────────────────
  .get(
    "/tv/:tmdbid/:season/:episode",
    async ({ params: { tmdbid, season, episode } }) => {
      return await Vidsrc.getTvSources(+tmdbid, +season, +episode);
    },
    {
      params: t.Object({
        tmdbid: t.Numeric(),
        season: t.Numeric(),
        episode: t.Numeric(),
      }),
      detail: { tags: ["vidsrc"], summary: "Get ad-free TV episode sources" },
    },
  );
