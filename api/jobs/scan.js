import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blockedAddresses = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 3],
]) blockedAddresses.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["100::", 64],
  ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
]) blockedAddresses.addSubnet(address, prefix, "ipv6");

const extractionSchema = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          employer: { type: "string" },
          location: { type: "string" },
          jobUrl: { type: "string" },
          postedDate: { type: "string" },
          employmentType: { type: "string" },
          description: { type: "string" },
          juniorEvidence: { type: "array", items: { type: "string" } },
          transferableSkills: { type: "array", items: { type: "string" } },
          futureRelevantSignals: { type: "array", items: { type: "string" } },
          learningSignals: { type: "array", items: { type: "string" } },
          seniorityWarnings: { type: "array", items: { type: "string" } },
        },
        required: [
          "title", "employer", "location", "jobUrl", "postedDate", "employmentType", "description",
          "juniorEvidence", "transferableSkills", "futureRelevantSignals", "learningSignals", "seniorityWarnings",
        ],
      },
    },
  },
  required: ["jobs"],
};

const extractionPrompt = `Extract up to 8 job opportunities visibly listed on this page. Focus on actual job postings, not navigation or promotional content. For each job return factual fields and visible evidence for junior or graduate accessibility, transferable skills, future-relevant technology, digital, data, policy or innovation exposure, learning or training, and evidence that the role is senior. Do not infer unsupported facts.`;

function blockedHostname(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const family = isIP(host);
  if (family) return blockedAddresses.check(host, family === 4 ? "ipv4" : "ipv6");
  return host === "localhost" || [".localhost", ".local", ".internal", ".home"].some((end) => host.endsWith(end));
}

async function publicUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Every job source must be a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || value.length > 2048) {
    throw new Error("Job sources must be public http:// or https:// URLs.");
  }
  if (blockedHostname(url.hostname)) throw new Error("Local or private-network URLs are not allowed.");
  if (["linkedin.com", "indeed.com"].some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
    throw new Error("Use a public job page that does not require LinkedIn or Indeed access.");
  }
  if (!isIP(url.hostname.replace(/^\[|\]$/g, ""))) {
    let addresses;
    try {
      addresses = await lookup(url.hostname, { all: true, verbatim: true });
    } catch {
      throw new Error(`Could not resolve ${url.hostname}.`);
    }
    if (!addresses.length || addresses.some(({ address }) => blockedHostname(address))) {
      throw new Error("Local or private-network URLs are not allowed.");
    }
  }
  return url.href;
}

export async function validateUrls(values) {
  if (!Array.isArray(values) || !values.length || values.length > 5
    || values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("Provide 1 to 5 job-source URLs.");
  }
  const supplied = values.map((value) => value.trim());
  return [...new Set(await Promise.all(supplied.map(publicUrl)))];
}

function strings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, 6).map((item) => item.trim().slice(0, 240))
    : [];
}

function safeJobUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !blockedHostname(url.hostname) ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeJob(job, sourceUrl) {
  const string = (value) => typeof value === "string" ? value.trim().slice(0, 500) : "";
  return {
    title: string(job?.title),
    employer: string(job?.employer),
    location: string(job?.location),
    jobUrl: safeJobUrl(job?.jobUrl),
    sourceUrl,
    sourceDomain: new URL(sourceUrl).hostname,
    postedDate: string(job?.postedDate),
    employmentType: string(job?.employmentType),
    description: string(job?.description),
    juniorEvidence: strings(job?.juniorEvidence),
    transferableSkills: strings(job?.transferableSkills),
    futureRelevantSignals: strings(job?.futureRelevantSignals),
    learningSignals: strings(job?.learningSignals),
    seniorityWarnings: strings(job?.seniorityWarnings),
  };
}

export function rankJobs(jobs) {
  const seen = new Set();
  return jobs
    .filter((job) => job.title)
    .map((job) => {
      const earlyTitle = job.title.match(/\b(junior|graduate|entry[- ]level|trainee|intern(?:ship)?|assistant|associate|coordinator|analyst)\b/i)?.[0];
      const seniorTitle = /\b(senior|lead|principal|head|director|executive)\b/i.test(job.title);
      const juniorEvidence = earlyTitle && !job.juniorEvidence.length
        ? [`The title explicitly uses “${earlyTitle}”.`]
        : job.juniorEvidence;
      const score = Math.min(juniorEvidence.length, 2) * 20
        + Math.min(job.transferableSkills.length, 3) * 10
        + Math.min(job.futureRelevantSignals.length, 2) * 10
        + Math.min(job.learningSignals.length, 2) * 5
        - (job.seniorityWarnings.length * 40)
        - (seniorTitle ? 60 : 0);
      return { ...job, juniorEvidence, score };
    })
    .sort((a, b) => b.score - a.score)
    .filter((job) => {
      const key = job.jobUrl || `${job.title}|${job.employer}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((job) => ({
      title: job.title,
      employer: job.employer,
      location: job.location,
      jobUrl: job.jobUrl || job.sourceUrl,
      sourceDomain: job.sourceDomain,
      postedDate: job.postedDate,
      employmentType: job.employmentType,
      reasons: [
        job.juniorEvidence[0] || "No explicit early-career evidence was found in the visible listing.",
        job.transferableSkills.slice(0, 2).join("; ") || "No transferable-skill evidence was extracted from the visible listing.",
        [...job.futureRelevantSignals, ...job.learningSignals].slice(0, 2).join("; ") || "No future-facing or learning evidence was extracted from the visible listing.",
      ],
    }));
}

async function scanSource(url) {
  const firecrawlResponse = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [{ type: "json", prompt: extractionPrompt, schema: extractionSchema }],
      onlyMainContent: true,
      timeout: 60000,
    }),
    signal: AbortSignal.timeout(70000),
  });
  const payload = await firecrawlResponse.json();
  if (!firecrawlResponse.ok || !payload.success) {
    throw new Error(payload.error || `Firecrawl returned HTTP ${firecrawlResponse.status}`);
  }
  return (Array.isArray(payload.data?.json?.jobs) ? payload.data.json.jobs : [])
    .slice(0, 8)
    .map((job) => normalizeJob(job, url))
    .filter((job) => job.title);
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed." });

  let urls;
  try {
    urls = await validateUrls(request.body?.urls);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }
  if (!process.env.FIRECRAWL_API_KEY) return response.status(503).json({ error: "Job Scout is not configured yet." });

  const settled = await Promise.allSettled(urls.map(scanSource));
  const sources = settled.map((result, index) => ({
    url: urls[index],
    status: result.status === "rejected" ? "failed" : result.value.length ? "extracted" : "no_jobs",
    count: result.status === "fulfilled" ? result.value.length : 0,
  }));
  const jobs = rankJobs(settled.flatMap((result) => result.status === "fulfilled" ? result.value : []));

  if (sources.every(({ status }) => status === "failed")) {
    return response.status(502).json({ error: "No job pages could be cleanly extracted. Try another public job page.", sources });
  }
  return response.status(200).json({ jobs, sources });
}
