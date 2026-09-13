import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFeed } from "../api/news.js";
import scrapeHandler, { validWebUrl } from "../api/scrape.js";
import jobsHandler, { rankJobs, validateUrls } from "../api/jobs/scan.js";

test("normalizes RSS and validates scrape URLs", () => {
  const [article] = normalizeFeed(`
    <rss><channel><item>
      <guid>story-1</guid><title>AI &amp; students</title>
      <link>https://example.com/story</link><pubDate>Fri, 11 Sep 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[<p>A useful <strong>summary</strong>.</p>]]></description>
    </item></channel></rss>
  `, "Example");

  assert.deepEqual(article, {
    id: "story-1",
    source: "Example",
    title: "AI & students",
    url: "https://example.com/story",
    publishedAt: "2026-09-11T10:00:00.000Z",
    summary: "A useful summary .",
  });
  assert.equal(validWebUrl("https://example.com/story"), true);
  assert.equal(validWebUrl("file:///secret"), false);
  assert.equal(validWebUrl("not a URL"), false);
});

test("scrape route rejects invalid URLs and reports a missing key", async () => {
  const call = async (url) => {
    const response = {
      statusCode: 0,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await scrapeHandler({ method: "POST", body: { url } }, response);
    return response;
  };

  assert.equal((await call("file:///secret")).statusCode, 400);
  assert.equal((await call("https://example.com")).statusCode, 503);
});

test("scrape route returns only normalized, limited content", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.firecrawl.dev/v2/scrape");
    assert.deepEqual(JSON.parse(options.body), {
      url: "https://example.com/story",
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    });
    return new Response(JSON.stringify({
      success: true,
      data: {
        markdown: "x".repeat(5000),
        metadata: { title: "Story", sourceURL: "https://example.com/story" },
      },
    }));
  };

  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await scrapeHandler({ method: "POST", body: { url: "https://example.com/story" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.domain, "example.com");
    assert.equal(response.body.content.length, 4000);
    assert.deepEqual(Object.keys(response.body), ["title", "domain", "url", "description", "content"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalKey;
  }
});

test("job URLs reject private/login-only sources and remove duplicates", async () => {
  await assert.rejects(validateUrls(["http://127.0.0.1/jobs"]), /private-network/);
  await assert.rejects(validateUrls(["https://jobs.linkedin.com/search"]), /LinkedIn/);
  await assert.rejects(validateUrls(Array(6).fill("https://1.1.1.1/jobs")), /1 to 5/);
  assert.deepEqual(await validateUrls(["https://1.1.1.1/jobs", "https://1.1.1.1/jobs"]), ["https://1.1.1.1/jobs"]);
});

test("job ranking favors junior evidence and returns exactly three reasons", () => {
  const job = (title, overrides = {}) => ({
    title,
    employer: "Example Agency",
    location: "Remote",
    jobUrl: `https://example.com/${encodeURIComponent(title)}`,
    sourceDomain: "example.com",
    postedDate: "",
    employmentType: "Full time",
    description: "",
    juniorEvidence: [],
    transferableSkills: ["Communication"],
    futureRelevantSignals: ["Digital services"],
    learningSignals: ["Training"],
    seniorityWarnings: [],
    ...overrides,
  });
  const ranked = rankJobs([
    job("Senior Director", { transferableSkills: ["A", "B", "C"], futureRelevantSignals: ["AI", "Data"] }),
    job("Graduate Analyst"), job("Junior Coordinator"), job("Trainee Assistant"),
    job("Associate Analyst"), job("Entry-level Intern"),
  ]);

  assert.equal(ranked.length, 5);
  assert.equal(ranked.some(({ title }) => title === "Senior Director"), false);
  assert.equal(ranked.every(({ reasons }) => reasons.length === 3 && reasons.every(Boolean)), true);
});

test("job scan keeps results when one of five sources fails", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;
  const urls = ["1.1.1.1", "8.8.8.8", "9.9.9.9", "208.67.222.222", "94.140.14.14"].map((host) => `https://${host}/jobs`);
  process.env.FIRECRAWL_API_KEY = "test-key";
  globalThis.fetch = async (_endpoint, options) => {
    const { url, formats } = JSON.parse(options.body);
    assert.equal(formats[0].type, "json");
    if (url.includes("9.9.9.9")) return new Response(JSON.stringify({ success: false, error: "blocked" }), { status: 500 });
    if (url.includes("94.140.14.14")) return new Response(JSON.stringify({ success: true, data: { json: { jobs: [] } } }));
    return new Response(JSON.stringify({
      success: true,
      data: { json: { jobs: [{
        title: url.includes("8.8.8.8") ? "Senior Director" : "Graduate Analyst",
        employer: "Public Agency", location: "Remote", jobUrl: url, postedDate: "", employmentType: "Full time",
        description: "Visible listing", juniorEvidence: ["Open to graduates"], transferableSkills: ["Analysis"],
        futureRelevantSignals: ["Digital services"], learningSignals: ["Training"], seniorityWarnings: [],
      }] } },
    }));
  };
  const response = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await jobsHandler({ method: "POST", body: { urls: [urls[0]] } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.sources.length, 1);

    await jobsHandler({ method: "POST", body: { urls } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.sources.length, 5);
    assert.equal(response.body.sources.filter(({ status }) => status === "failed").length, 1);
    assert.equal(response.body.sources.filter(({ status }) => status === "no_jobs").length, 1);
    assert.equal(response.body.jobs.length, 3);
    assert.equal("description" in response.body.jobs[0], false);

    await jobsHandler({ method: "POST", body: { urls: [urls[2]] } }, response);
    assert.equal(response.statusCode, 502);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FIRECRAWL_API_KEY;
    else process.env.FIRECRAWL_API_KEY = originalKey;
  }
});
