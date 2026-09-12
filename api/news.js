import { XMLParser } from "fast-xml-parser";

export const feeds = [
  { source: "WIRED", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { source: "VentureBeat", url: "https://venturebeat.com/category/ai/feed/" },
];

const parser = new XMLParser({ ignoreAttributes: false });

function text(value) {
  if (Array.isArray(value)) return text(value[0]);
  if (value && typeof value === "object") return text(value["#text"] ?? value.__cdata);
  return String(value ?? "");
}

function clean(value) {
  return text(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeFeed(xml, source) {
  const channel = parser.parse(xml)?.rss?.channel;
  const items = Array.isArray(channel?.item) ? channel.item : channel?.item ? [channel.item] : [];

  return items.slice(0, 6).map((item, index) => {
    const url = text(item.link);
    const rawDate = text(item.pubDate ?? item["dc:date"]);
    const date = new Date(rawDate);
    return {
      id: text(item.guid) || url || `${source}-${index}`,
      source,
      title: clean(item.title) || "Untitled story",
      url,
      publishedAt: Number.isNaN(date.valueOf()) ? "" : date.toISOString(),
      summary: clean(item.description ?? item["content:encoded"]),
    };
  }).filter((article) => article.url);
}

async function loadFeed(feed) {
  const response = await fetch(feed.url, {
    headers: { "User-Agent": "AI-News-Assistant/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return normalizeFeed(await response.text(), feed.source);
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed." });

  const results = await Promise.allSettled(feeds.map(loadFeed));
  const articles = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 18);
  const warnings = results.flatMap((result, index) =>
    result.status === "rejected" ? [`${feeds[index].source} is temporarily unavailable.`] : [],
  );

  if (!articles.length) {
    return response.status(502).json({ error: "No news sources responded.", warnings });
  }
  return response.status(200).json({ articles, warnings });
}
