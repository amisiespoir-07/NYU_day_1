import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFeed } from "../api/news.js";
import scrapeHandler, { validWebUrl } from "../api/scrape.js";

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
