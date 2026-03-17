# Scripts Directory

This folder contains test scripts and utilities for various providers. A central `tests` subfolder holds individual provider suites, with `index.ts` as the main entrypoint.

All current tests target the unified anime API (`/anime/...`) rather than legacy provider-prefixed routes.

---

## Structure

```
scripts/
├── README.md              # This file
└── tests/
    ├── index.ts           # Aggregates all provider tests
    └── animepahe.ts       # Unified anime API tests using provider=animepahe
```

(legacy `scripts/animepahe/` may be removed or kept for reference.)

---

## Creating Tests for Your Provider

### Step 1: Create Provider Folder

```bash
mkdir scripts/yourprovider
```

### Step 2: Create Test Script Template

Create `scripts/yourprovider/test-yourprovider.ts`:

```typescript
/**
 * Test script for YourProvider endpoints
 * Tests all endpoints with performance monitoring
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
  dataCount?: number;
}

async function testEndpoint(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  expectedStatus: number = 200
): Promise<TestResult> {
  const fullUrl = \`${BASE_URL}${endpoint}\`;
  const startTime = Date.now();
  
  try {
    const response = await fetch(fullUrl, { method });
    const responseTime = Date.now() - startTime;
    
    let dataCount: number | undefined;
    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json();
      if (Array.isArray(data)) {
        dataCount = data.length;
      } else if (data && typeof data === "object") {
        dataCount = Object.keys(data).length;
      }
    }

    return {
      endpoint,
      method,
      status: response.status,
      responseTime,
      success: response.status === expectedStatus,
      dataCount,
    };
  } catch (error) {
    return {
      endpoint,
      method,
      status: 0,
      responseTime: Date.now() - startTime,
      success: false,
      error: String(error),
    };
  }
}

async function runTests(): Promise<void> {
  console.log("🧪 Starting YourProvider Tests");
  console.log(\`📍 Base URL: ${BASE_URL}\`);
  console.log("═".repeat(80));

  const tests: Array<[string, string, number?]> = [
    ["/yourprovider", "Index - List Endpoints"],
    ["/yourprovider/search/naruto", "Search - Naruto"],
    ["/yourprovider/info/some-id", "Anime Info"],
    // Add more test cases
  ];

  const results: TestResult[] = [];
  
  for (const [endpoint, description, expectedStatus = 200] of tests) {
    console.log(\`⏳ Testing: ${description}\`);
    const result = await testEndpoint(endpoint, "GET", expectedStatus);
    results.push(result);
    
    const status = result.success ? "✅" : "❌";
    const time = \`${result.responseTime}ms\`;
    const data = result.dataCount !== undefined ? \` (${result.dataCount} items)\` : "";
    const error = result.error ? \` - ${result.error}\` : "";
    
    console.log(\`${status} ${result.status} ${time}${data}${error}\`);
    
    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log("═".repeat(80));
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  console.log(\`📊 Results: ${passed}/${total} tests passed\`);
  
  const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / total;
  console.log(\`⚡ Average Response Time: ${avgTime.toFixed(0)}ms\`);
  
  if (passed === total) {
    console.log("✅ All tests passed!");
  } else {
    console.log(\`❌ ${total - passed} tests failed\`);
    process.exit(1);
  }
}

runTests();
```

---

## Running Tests

### Local Development

1. Start the development server:
```bash
bun run dev
```

2. In another terminal, run all test suites:
```bash
bun run test
```

To run only the AnimePahe-focused suite directly:

```bash
bun run scripts/tests/animepahe.ts
```

### Production Testing

Set the `API_BASE_URL` environment variable:

```bash
API_BASE_URL=https://your-production-domain.com bun run scripts/yourprovider/test-yourprovider.ts
```

---

## Adding to package.json

Update `package.json` to point the `test` script at the new runner:

```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "test": "bun run scripts/tests/index.ts",
    "test:animepahe": "bun run scripts/tests/animepahe.ts",
    "test:prod": "API_BASE_URL=https://your-domain.com bun run scripts/tests/index.ts"
  }
}
```

Then run with:
```bash
bun test:yourprovider
```

---

## Test Script Best Practices

### 1. Always Include Index Route Test

Test the provider's root endpoint first:
```typescript
["/yourprovider", "Index - List Endpoints"],
```

### 2. Test Real-World Scenarios

Use realistic queries and IDs:
```typescript
["/yourprovider/search/naruto", "Search - Popular Anime"],
["/yourprovider/search/obscure-title", "Search - Edge Case"],
```

### 3. Test Error Cases

Include tests that expect failures:
```typescript
["/yourprovider/info/invalid-id", "Invalid ID Error", 404],
["/snapshots/nonexistent.jpg", "Missing File", 502],
```

### 4. Add Timing and Metrics

Track performance to catch regressions:
```typescript
const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / total;
console.log(\`⚡ Average Response Time: ${avgTime.toFixed(0)}ms\`);
```

### 5. Prevent Rate Limiting

Add delays between requests:
```typescript
await new Promise(resolve => setTimeout(resolve, 100));
```

---

## Utility Scripts

You can also create utility scripts for manual testing or data exploration:

### Example: `scripts/yourprovider/yourprovider.ts`

```typescript
/**
 * Utility functions for YourProvider
 * Use for manual testing and debugging
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

export async function quickSearch(query: string) {
  const res = await fetch(\`${BASE_URL}/yourprovider/search/${query}\`);
  return await res.json();
}

export async function getInfo(id: string) {
  const res = await fetch(\`${BASE_URL}/yourprovider/info/${id}\`);
  return await res.json();
}

// Run if called directly
if (import.meta.main) {
  const query = process.argv[2] || "naruto";
  console.log(\`Searching for: ${query}\`);
  const results = await quickSearch(query);
  console.log(JSON.stringify(results, null, 2));
}
```

Run directly:
```bash
bun run scripts/yourprovider/yourprovider.ts "one piece"
```

Or import in other scripts:
```typescript
import { quickSearch } from "./yourprovider";
const results = await quickSearch("naruto");
```

---

## Continuous Integration

### GitHub Actions Example

Create `.github/workflows/test.yml`:

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        
      - name: Install dependencies
        run: bun install
        
      - name: Start server
        run: bun run dev &
        
      - name: Wait for server
        run: sleep 5
        
      - name: Run tests
        run: bun run test
```

---

## Tips

### Environment Variables

Use `.env` for local testing:
```bash
# .env
API_BASE_URL=http://localhost:3000
ANIMEPAHE_BASE_URL=https://animepahe.si
```

### Debugging

Add verbose logging:
```typescript
const DEBUG = process.env.DEBUG === "true";

if (DEBUG) {
  console.log("Request:", fullUrl);
  console.log("Response:", await response.text());
}
```

Run with:
```bash
DEBUG=true bun run scripts/yourprovider/test-yourprovider.ts
```

---

## Example Output

```
🧪 Starting YourProvider Tests
📍 Base URL: http://localhost:3000
════════════════════════════════════════════════════════════════════════════════
⏳ Testing: Index - List Endpoints
✅ 200 45ms (5 items)
⏳ Testing: Search - Naruto
✅ 200 234ms (8 items)
⏳ Testing: Anime Info
✅ 200 189ms (15 items)
════════════════════════════════════════════════════════════════════════════════
📊 Results: 3/3 tests passed
⚡ Average Response Time: 156ms
✅ All tests passed!
```

---

## Next Steps

1. Copy the test template for your provider
2. Customize endpoints and test cases
3. Add to `package.json` scripts
4. Run and iterate until all tests pass
5. Consider adding CI/CD integration

Happy testing! 🧪
