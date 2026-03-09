const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const EXTENSION_PATH = path.resolve(__dirname, "..", "browser-extension");
const USER_DATA_DIR = "/tmp/pw-real-site-smoke-profile";
const CHROME_PATH =
  "/Users/yasinkaya/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const SITE_TIMEOUT_MS = 25000;

fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    })
  ]);
}

async function getServiceWorker(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 10000 }).catch(() => null);
  }
  return worker;
}

async function getTabDiagnostics(worker, page) {
  const domDiagnostics = await page.evaluate(() => ({
    runtime: document.documentElement?.dataset?.shtRuntime || "",
    state: document.documentElement?.dataset?.shtState || "",
    hasTooltipRoot: Boolean(document.querySelector(".sht-root"))
  })).catch(() => ({
    runtime: "",
    state: "",
    hasTooltipRoot: false
  }));

  if (!worker) {
    return {
      url: page.url(),
      tabId: null,
      enabled: true,
      domDiagnostics,
      pageContext: null,
      pageContextError: "service worker unavailable"
    };
  }

  const tabId = await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id || null;
  });

  const state = tabId
    ? await worker.evaluate(async ({ tabId }) => {
        return handleGetState(tabId);
      }, { tabId })
    : null;

  let pageContext = null;
  let pageContextError = "";
  if (tabId) {
    try {
      pageContext = await worker.evaluate(async ({ tabId }) => {
        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: "GET_PAGE_CONTEXT" }, (response) => {
            resolve({
              ok: !chrome.runtime.lastError,
              error: chrome.runtime.lastError?.message || "",
              response: response || null
            });
          });
        });
      }, { tabId });
    } catch (error) {
      pageContextError = error && error.message ? error.message : String(error);
    }
  }

  return {
    url: page.url(),
    tabId,
    enabled: Boolean(state?.state?.enabled),
    domDiagnostics,
    pageContext,
    pageContextError
  };
}

async function acceptConsentIfPresent(page) {
  const labels = [
    /Accept all/i,
    /I agree/i,
    /Kabul et/i,
    /Tumunu kabul et/i,
    /Tümünü kabul et/i
  ];

  for (const label of labels) {
    const button = page.getByRole("button", { name: label }).first();
    try {
      await button.click({ timeout: 1500 });
      await sleep(500);
      return true;
    } catch (error) {
      // ignore
    }
  }

  return false;
}

async function waitForTooltip(page, timeout = 8000) {
  await page.waitForFunction(() => {
    const tooltip = document.querySelector(".sht-root");
    return Boolean(tooltip && !tooltip.hidden);
  }, null, { timeout });

  return page.evaluate(() => {
    const tooltip = document.querySelector(".sht-root");
    return {
      source: tooltip?.querySelector("[data-role='source']")?.textContent?.trim() || "",
      target: tooltip?.querySelector("[data-role='target']")?.textContent?.trim() || "",
      kind: tooltip?.dataset.kind || "",
      surface: tooltip?.dataset.surface || ""
    };
  });
}

async function hoverWord(page, resolver, payload) {
  const point = await page.evaluate(resolver, payload);
  if (!point) {
    throw new Error("Kelime koordinati bulunamadi");
  }

  await page.mouse.move(point.x, point.y, { steps: 8 });
  return waitForTooltip(page);
}

function resolveWordPointInDocument({ scopeSelector, word }) {
  const root = scopeSelector ? document.querySelector(scopeSelector) : document.body;
  if (!root) {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent || "";
    const index = text.toLowerCase().indexOf(String(word).toLowerCase());
    if (index === -1) {
      continue;
    }

    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + word.length);
    const rect = range.getBoundingClientRect();

    if (
      !rect.width ||
      !rect.height ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      continue;
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  return null;
}

function resolveFirstVisibleWordPointInDocument({ scopeSelector }) {
  const root = scopeSelector ? document.querySelector(scopeSelector) : document.body;
  if (!root) {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.textContent || "").trim();
    if (!text) {
      continue;
    }

    const match = text.match(/[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/u);
    if (!match) {
      continue;
    }

    const index = text.indexOf(match[0]);
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + match[0].length);
    const rect = range.getBoundingClientRect();

    if (
      !rect.width ||
      !rect.height ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      continue;
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      word: match[0]
    };
  }

  return null;
}

async function runGenericTest(page, siteName, url, scopeSelector, word) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await acceptConsentIfPresent(page);
  await sleep(900);

  const resolver = word ? resolveWordPointInDocument : resolveFirstVisibleWordPointInDocument;
  const payload = word ? { scopeSelector, word } : { scopeSelector };
  const tooltip = await hoverWord(page, resolver, payload);

  return {
    site: siteName,
    url,
    ok: Boolean(tooltip.source),
    mode: "generic",
    tooltip
  };
}

async function runYouTubeTest(page) {
  const url = "https://www.youtube.com/results?search_query=ted+talk+english+subtitles";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await acceptConsentIfPresent(page);

  const tooltip = await hoverWord(
    page,
    resolveFirstVisibleWordPointInDocument,
    {
      scopeSelector: "ytd-video-renderer, ytd-rich-item-renderer, #contents"
    }
  ).catch(() => null);

  return {
    site: "YouTube",
    url,
    ok: Boolean(tooltip?.source),
    mode: tooltip ? "results-text" : "inconclusive",
    tooltip: tooltip || null
  };
}

async function main() {
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1440, height: 960 },
    executablePath: CHROME_PATH,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  try {
    context.setDefaultTimeout(12000);
    context.setDefaultNavigationTimeout(20000);

    await context.route("https://translate.googleapis.com/**", async (route) => {
      const url = new URL(route.request().url());
      const text = url.searchParams.get("q") || "unknown";
      const payload = [[[`[tr] ${text}`, text, null, null, 1]], null, "en"];

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(payload)
      });
    });

    const worker = await getServiceWorker(context);
    const page = context.pages()[0] || await context.newPage();

    await page.goto("https://en.wikipedia.org/wiki/OpenAI", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await sleep(900);

    const safeRun = async (runner, site) => {
      try {
        console.error(`[smoke] start ${site}`);
        const result = await withTimeout(
          runner(),
          SITE_TIMEOUT_MS,
          `${site} testi ${SITE_TIMEOUT_MS}ms icinde bitmedi.`
        );
        console.error(`[smoke] done ${site}: ${result.ok ? "ok" : "fail"}`);
        return result;
      } catch (error) {
        console.error(`[smoke] fail ${site}: ${error && error.message ? error.message : error}`);
        return {
          site,
          ok: false,
          mode: "error",
          error: error && error.message ? error.message : String(error),
          diagnostics: await getTabDiagnostics(worker, page).catch((diagnosticError) => ({
            error:
              diagnosticError && diagnosticError.message
                ? diagnosticError.message
                : String(diagnosticError)
          }))
        };
      }
    };

    const results = [];
    results.push(
      await safeRun(
        () =>
          runGenericTest(
            page,
            "Wikipedia",
            "https://en.wikipedia.org/wiki/OpenAI",
            "#mw-content-text",
            "artificial"
          ),
        "Wikipedia"
      )
    );
    results.push(
      await safeRun(
        () =>
          runGenericTest(
            page,
            "MDN",
            "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
            "main",
            "JavaScript"
          ),
        "MDN"
      )
    );
    results.push(
      await safeRun(
        () =>
          runGenericTest(
            page,
            "Max",
            "https://www.max.com/",
            "body",
            ""
          ),
        "Max"
      )
    );
    results.push(await safeRun(() => runYouTubeTest(page), "YouTube"));

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
