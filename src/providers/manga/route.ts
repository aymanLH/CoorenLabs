import { Elysia } from "elysia";
import { mangaballRoutes } from "./mangaball/route";

export const mangaRoutes = new Elysia({ prefix: "/manga" })
  .get("/", () => {
    return {
      service: "manga",
      description: "Unified manga API — provider-isolated route architecture",
      providers: ["mangaball"],
      endpoints: [
        "GET /manga/mangaball/home          → Featured titles and banners",
        "GET /manga/mangaball/latest        → Latest updated titles",
        "GET /manga/mangaball/recommendation → Recommended titles",
        "GET /manga/mangaball/popular       → Popular titles this season",
        "GET /manga/mangaball/added         → Recently added titles",
        "GET /manga/mangaball/new-chap      → Titles with new chapters",
        "GET /manga/mangaball/foryou        → Personalized suggestions (?time=day|week|month|year)",
        "GET /manga/mangaball/recent        → Recent chapter reads (?time=day|week|month|year)",
        "GET /manga/mangaball/search        → Search titles (?q=query&page=1)",
        "GET /manga/mangaball/filters       → Advanced filtering with tags and sorts",
        "GET /manga/mangaball/manga         → Browse Japanese Manga",
        "GET /manga/mangaball/manhwa        → Browse Korean Manhwa",
        "GET /manga/mangaball/manhua        → Browse Chinese Manhua",
        "GET /manga/mangaball/comics        → Browse English Comics",
        "GET /manga/mangaball/ongoing       → Browse ongoing series",
        "GET /manga/mangaball/completed     → Browse completed series",
        "GET /manga/mangaball/detail/:slug  → Full title details and chapter list",
        "GET /manga/mangaball/read/:id      → Chapter images and metadata",
        "GET /manga/mangaball/tags          → List all available tags/genres",
        "GET /manga/mangaball/tags-detail   → Detailed tag statistics",
        "GET /manga/mangaball/image/* → Image proxy for bypass"
      ]
    };
  })
  .use(mangaballRoutes);
