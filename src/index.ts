import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import { Elysia } from "elysia";
import {
  CORS_CREDENTIALS,
  CORS_ORIGIN,
  OPENAPI_ENABLED,
  OPENAPI_VERSION,
  PORT,
  REPO_URL,
  validateConfig
} from "./core/config";
import { Logger } from "./core/logger";
import { mappingRoutes } from "./core/mappingRoutes";
import { proxyRoutes } from "./core/proxyRoutes";
import { animeRoutes } from "./providers/anime/route";
import { mangaRoutes } from "./providers/manga/route";

validateConfig();

const app = new Elysia({ aot: true })
  .use(cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","),
    credentials: CORS_CREDENTIALS,
  }));

app.use(openapi({
  path: '/swagger', //Todo : Snozxyx (Fix : Make this /docs and add a redirect from /docs to /swagger)
  documentation: {
    info: { 
      title:  'Mangaball API Documentation',
      version: '1.0.0',
    }
  }
}));

app
  .get("/", () => {
    return {
      name: "Cooren API",
      version: OPENAPI_VERSION,
      repo: REPO_URL,
      environment: process.env.NODE_ENV || "development",
      about: "Cooren is a high-performance, scalable scraping engine designed to collect, organize, and deliver structured data from across the world of anime, movies, manga, and music, all in one unified ecosystem",
      status: "operational"
    };
  })
  .use(animeRoutes)
  .use(mangaRoutes)
  .use(proxyRoutes)
  .use(mappingRoutes);

app.listen(PORT);

Logger.info(
  `Successfully Started at ${app.server?.protocol}://${app.server?.hostname}:${PORT}`,
);
