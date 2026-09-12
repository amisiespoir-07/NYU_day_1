const loadButton = document.querySelector("#load-news");
const filterInput = document.querySelector("#filter");
const status = document.querySelector("#status");
const warnings = document.querySelector("#warnings");
const articlesContainer = document.querySelector("#articles");
const deepReadPanel = document.querySelector("#deep-read");
const explorerForm = document.querySelector("#explorer-form");
const explorerInput = document.querySelector("#explorer-url");
const explorerButton = document.querySelector("#scrape-page");
const explorerMessage = document.querySelector("#explorer-message");
const explorerResult = document.querySelector("#explorer-result");

let articles = [];

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderArticles() {
  const query = filterInput.value.trim().toLowerCase();
  const visible = articles.filter(({ title, summary }) =>
    `${title} ${summary}`.toLowerCase().includes(query),
  );

  articlesContainer.replaceChildren();
  status.textContent = articles.length
    ? `${visible.length} of ${articles.length} stories shown.`
    : "No stories loaded.";

  for (const article of visible) {
    const card = element("article", "", "article-card");
    card.append(element("p", article.source, "source"));
    card.append(element("h3", article.title));
    card.append(
      element(
        "p",
        article.publishedAt
          ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(article.publishedAt))
          : "Date unavailable",
        "date",
      ),
    );
    card.append(element("p", article.summary || "No RSS summary available.", "summary"));

    const actions = element("div", "", "article-actions");
    const original = element("a", "Read Original Article");
    original.href = article.url;
    original.target = "_blank";
    original.rel = "noopener noreferrer";

    const deepRead = element("button", "Deep Read");
    deepRead.type = "button";
    deepRead.addEventListener("click", () => loadDeepRead(article, deepRead));
    actions.append(original, deepRead);
    card.append(actions);
    articlesContainer.append(card);
  }
}

async function loadNews() {
  loadButton.disabled = true;
  loadButton.setAttribute("aria-busy", "true");
  loadButton.textContent = "Loading…";
  filterInput.disabled = true;
  warnings.hidden = true;
  status.textContent = "Contacting the three RSS sources…";

  try {
    const response = await fetch("/api/news");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "News could not be loaded.");

    articles = data.articles;
    filterInput.disabled = false;
    warnings.textContent = data.warnings?.join(" ") || "";
    warnings.hidden = !data.warnings?.length;
    renderArticles();
  } catch (error) {
    articles = [];
    articlesContainer.replaceChildren();
    status.textContent = `${error.message} Please try again.`;
  } finally {
    loadButton.disabled = false;
    loadButton.removeAttribute("aria-busy");
    loadButton.textContent = "Load Latest News";
  }
}

async function loadDeepRead(article, button) {
  const deepReadButtons = articlesContainer.querySelectorAll("button");
  deepReadButtons.forEach((item) => { item.disabled = true; });
  deepReadPanel.hidden = false;
  deepReadPanel.replaceChildren(
    element("p", "Firecrawl Deep Read", "eyebrow"),
    element("h3", `Retrieving “${article.title}”…`),
    element("p", "Reading this one page now.", "status"),
  );
  button.setAttribute("aria-busy", "true");

  try {
    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: article.url }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Deep Read failed.");

    const link = element("a", "Open Original Article", "button-link");
    link.href = data.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    deepReadPanel.replaceChildren(
      element("p", `Firecrawl · ${data.domain}`, "eyebrow"),
      element("h3", data.title),
      element("p", data.description, "summary"),
      element("p", data.content || "No readable content was returned.", "deep-content"),
      link,
    );
  } catch (error) {
    deepReadPanel.replaceChildren(
      element("p", "Deep Read unavailable", "eyebrow"),
      element("h3", article.title),
      element("p", `${error.message} Please try again.`, "warning"),
    );
  } finally {
    deepReadButtons.forEach((item) => { item.disabled = false; });
    button.removeAttribute("aria-busy");
  }
}

async function scrapePage(event) {
  event.preventDefault();
  explorerButton.disabled = true;
  explorerButton.setAttribute("aria-busy", "true");
  explorerButton.textContent = "Scraping…";
  explorerResult.hidden = true;
  explorerMessage.className = "status";
  explorerMessage.textContent = "Firecrawl is retrieving this one page…";

  try {
    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: explorerInput.value.trim() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The page could not be scraped.");

    const original = element("a", "Open Original Page", "button-link");
    original.href = data.url;
    original.target = "_blank";
    original.rel = "noopener noreferrer";
    explorerResult.replaceChildren(
      element("p", `Firecrawl · ${data.domain}`, "eyebrow"),
      element("h3", data.title),
      element("p", data.url, "result-url"),
      element("p", data.description || "No page description available.", "summary"),
      element("p", data.content || "No readable content was returned.", "deep-content"),
      original,
    );
    explorerResult.hidden = false;
    explorerMessage.textContent = "Page retrieved successfully.";
  } catch (error) {
    explorerMessage.className = "warning";
    explorerMessage.textContent = `${error.message} Check the URL and try again.`;
  } finally {
    explorerButton.disabled = false;
    explorerButton.removeAttribute("aria-busy");
    explorerButton.textContent = "Scrape Page";
  }
}

loadButton.addEventListener("click", loadNews);
filterInput.addEventListener("input", renderArticles);
explorerForm.addEventListener("submit", scrapePage);
