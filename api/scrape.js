const MAX_CONTENT_LENGTH = 4000;

export function validWebUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });

  const url = request.body?.url;
  if (!validWebUrl(url)) {
    return response.status(400).json({ error: "Provide a valid http:// or https:// URL." });
  }
  if (!process.env.FIRECRAWL_API_KEY) {
    return response.status(503).json({ error: "Deep Read is not configured yet." });
  }

  try {
    const firecrawlResponse = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true, timeout: 30000 }),
      signal: AbortSignal.timeout(40000),
    });
    const payload = await firecrawlResponse.json();
    if (!firecrawlResponse.ok || !payload.success) {
      throw new Error(payload.error || `Firecrawl returned HTTP ${firecrawlResponse.status}`);
    }

    const data = payload.data || {};
    const metadata = data.metadata || {};
    const finalUrl = metadata.sourceURL || metadata.url || url;
    return response.status(200).json({
      title: metadata.title || "Deep Read result",
      domain: new URL(finalUrl).hostname,
      url: finalUrl,
      description: metadata.description || "",
      content: String(data.markdown || "").slice(0, MAX_CONTENT_LENGTH),
    });
  } catch (error) {
    return response.status(502).json({ error: `Deep Read failed: ${error.message}` });
  }
}
