const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const PROVIDER = "animepahe";

interface TestResult {
  name: string;
  endpoint: string;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function requestJson(endpoint: string): Promise<{ status: number; data: unknown; responseTime: number }> {
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}${endpoint}`);
  const responseTime = Date.now() - startedAt;
  const data = await response.json();
  return { status: response.status, data, responseTime };
}

async function runTest(
  name: string,
  endpoint: string,
  validate: (data: unknown) => boolean,
  expectedStatus = 200,
): Promise<TestResult> {
  try {
    const { status, data, responseTime } = await requestJson(endpoint);
    const statusOk = status === expectedStatus;
    const shapeOk = statusOk ? validate(data) : false;

    return {
      name,
      endpoint,
      status,
      responseTime,
      success: statusOk && shapeOk,
      error: statusOk && shapeOk ? undefined : `Unexpected response for ${endpoint}`,
    };
  } catch (error) {
    return {
      name,
      endpoint,
      status: 0,
      responseTime: 0,
      success: false,
      error: String(error),
    };
  }
}

export async function runAnimePaheTests(): Promise<void> {
  console.log("🧪 Running unified anime API tests (AnimePahe provider)");
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log("═".repeat(80));

  const results: TestResult[] = [];

  const root = await runTest("Root", "/", (data) => isObject(data) && data.status === "operational");
  results.push(root);

  const animeIndex = await runTest("Anime index", "/anime", (data) => {
    if (!isObject(data)) return false;
    return Array.isArray(data.providers) && data.providers.includes(PROVIDER);
  });
  results.push(animeIndex);

  const tmdbResolve = await runTest("TMDB resolve", "/anime/tmdb:37854", (data) => {
    if (!isObject(data)) return false;
    return data.idType === "tmdb" && data.bestTitle !== undefined;
  });
  results.push(tmdbResolve);

  const providerInfo = await runTest("Provider info", `/anime/21/${PROVIDER}`, (data) => {
    if (!isObject(data)) return false;
    return typeof data.id === "string" && Array.isArray(data.episodes);
  });
  results.push(providerInfo);

  const episodes = await runTest("Episodes list", `/anime/21/${PROVIDER}/episodes`, (data) => {
    if (!isObject(data)) return false;
    return Array.isArray(data.episodes) && typeof data.episodeCount === "number";
  });
  results.push(episodes);

  const episodesPayload = await requestJson(`/anime/21/${PROVIDER}/episodes`);
  let firstEpisode = 1;
  if (isObject(episodesPayload.data) && Array.isArray(episodesPayload.data.episodes) && episodesPayload.data.episodes.length > 0) {
    const first = episodesPayload.data.episodes[0];
    if (isObject(first) && typeof first.episode === "number") {
      firstEpisode = first.episode;
    }
  }

  const stream = await runTest(
    "Episode stream",
    `/anime/21/${PROVIDER}/episode/${firstEpisode}`,
    (data) => isObject(data) && Array.isArray(data.streams),
  );
  results.push(stream);

  const mappings = await runTest("Mappings", "/mappings?anilist_id=21", (data) => {
    if (!isObject(data)) return false;
    return data.anilist_id === 21;
  });
  results.push(mappings);

  const proxyIndex = await runTest("Proxy index", "/proxy", (data) => {
    if (!isObject(data)) return false;
    return Array.isArray(data.endpoints);
  });
  results.push(proxyIndex);

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.name} → ${result.status} (${result.responseTime}ms) ${result.endpoint}`);
    if (!result.success && result.error) {
      console.log(`   ${result.error}`);
    }
  }

  console.log("═".repeat(80));
  const passed = results.filter((r) => r.success).length;
  const total = results.length;
  console.log(`📊 Results: ${passed}/${total} checks passed`);

  if (passed !== total) {
    throw new Error(`${total - passed} test(s) failed`);
  }

  console.log("✅ Unified anime API tests passed.");
}
