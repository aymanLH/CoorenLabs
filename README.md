To install dependencies (install bun before that):

```bash
bun install
```

To run:

```bash
bun run dev
```

## src/core/

This folder contains all kind of configuration and baisc util files.\
**src/core/config.ts** \
This file contains all api and server configs \
**src/core/logger.ts** \
Use `Logger` from this file everytime instead of `console.log`

## src/providers/

Contains each providers to be scraped/extracted data from
each provider has (and should be) their own folders containing everything needed for scraping and extracting data, only except the origin imported from **src/providers/config.ts** \
e.g. src/providers/animepahe/

## src/providers/{name}

- route.ts
- {provderName}.ts
- types.ts

create as many files as u want but to keep it a standard make sure to have these 3 files atleast.

Look at this example \
**src/providers/flixhq/route.ts** which contains the routes for the provider prefix endpoints.

```typescript
import Elysia from "elysia";
import { FlixHQ } from "./flixhq"; // provider class wrapper for organizing scraped data

const flixhqRoutes = new Elysia({ prefix: "/flixhq" }) // should have a prefix
  .get("/home", async () => {
    const response = await FlixHQ.home();
    return response;
  })
  .get(
    "/search/:query",
    async ({ params: { query } }) => {
      const response = await FlixHQ.search(query);
      return response;
    },
    // ... more routes
  );

export { flixhqRoutes }; // dont forget to export the handler
```

**src/providers/flixhq/flixhq.ts** flixhq class for wrapping scraped/extracted data, make sure to keep the methods static for easy access like `FlixHQ.home()` bypassing the creation of an instance.

```typescript
export class FlixHQ {
  static async home() {
    // keep the methods static
    return "GARBAGE";
  }
  static async search(query: string) {
    // keep the methods static
    return "GARBAGE";
  }
}
```

**src/providers/flixhq/types.ts** save all types e.g. response types or certain data types for easier usage and typesafety. (AI works good if u provide them types.ts btw)
