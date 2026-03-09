const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT_DIR = path.resolve(__dirname, "..");
const EXTENSION_PATH = path.join(ROOT_DIR, "browser-extension");
const USER_DATA_DIR = "/tmp/pw-sht-stability-smoke";
const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Users/yasinkaya/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3017";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForTooltip(page, timeout = 8000) {
  await page.waitForFunction(() => {
    const tooltip = document.querySelector(".sht-root");
    return Boolean(tooltip && !tooltip.hidden);
  }, null, { timeout });

  return page.evaluate(() => {
    const tooltip = document.querySelector(".sht-root");
    return {
      visible: Boolean(tooltip && !tooltip.hidden),
      source: tooltip?.querySelector("[data-role='source']")?.textContent?.trim() || "",
      target: tooltip?.querySelector("[data-role='target']")?.textContent?.trim() || "",
      kind: tooltip?.dataset.kind || "",
      surface: tooltip?.dataset.surface || "",
      manualPinned: tooltip?.dataset.manualPinned || ""
    };
  });
}

async function tryHoverPoints(page, points, timeout = 1200) {
  for (const point of points) {
    await page.mouse.move(point.x, point.y, { steps: 5 });

    try {
      return await waitForTooltip(page, timeout);
    } catch (error) {
      // try next point
    }
  }

  throw new Error("Tooltip bulunamadi");
}

async function resolveWordPoint(page, selector, pattern) {
  return page.evaluate(
    ({ selector, pattern }) => {
      const expression = new RegExp(pattern, "i");
      const target = Array.from(document.querySelectorAll(selector)).find((node) =>
        expression.test(node.textContent || "")
      );
      if (!target) {
        return null;
      }

      const rect = target.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    },
    { selector, pattern }
  );
}

async function resolveRangePoint(page, selector, word) {
  return page.evaluate(
    ({ selector, word }) => {
      const root = document.querySelector(selector);
      const node = root?.firstChild;
      const text = node?.textContent || "";
      const index = text.toLowerCase().indexOf(word.toLowerCase());
      if (!node || index === -1) {
        return null;
      }

      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + word.length);
      const rect = range.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    },
    { selector, word }
  );
}

async function runGenericHoverTest(page) {
  await page.goto(`${BASE_URL}/mock-generic-site.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const point = await resolveRangePoint(page, ".story", "Quiet");
  assert(point, "Generic hover kelimesi bulunamadi");

  await page.mouse.move(point.x, point.y, { steps: 8 });
  const tooltip = await waitForTooltip(page);

  assert(tooltip.visible, "Generic tooltip gorunmuyor");
  assert(/quiet/i.test(tooltip.source), "Generic tooltip beklenen kelimeyi gostermiyor");
  assert(tooltip.surface === "web", "Generic tooltip web yuzeyinde degil");

  return tooltip;
}

async function runPinnedVideoTest(page) {
  await page.goto(`${BASE_URL}/mock-video-sites.html?shtSite=max`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(1000);

  const point = await resolveWordPoint(page, ".caption-word", "subtitle");
  assert(point, "Video hover kelimesi bulunamadi");

  await page.mouse.move(point.x, point.y, { steps: 8 });
  await waitForTooltip(page);
  await page.click(".sht-pin");
  await page.mouse.move(200, 200, { steps: 5 });
  await page.waitForTimeout(1400);

  const tooltip = await waitForTooltip(page);
  const playerState = await page.evaluate(() => window.getMockPlayerState?.() || null);

  assert(tooltip.manualPinned === "true", "Tooltip sabit moda gecmedi");
  assert(/subtitle/i.test(tooltip.source), "Pinned tooltip beklenen kelimeyi korumuyor");
  assert(playerState && playerState.captionVersion >= 2, "Fixture yeniden render olmadigi icin pin testi gecersiz");
  assert(playerState.controlsVisible === false, "Player kontrol bari acik kaldi");

  return {
    tooltip,
    playerState
  };
}

async function runNativeTrackTest(page) {
  await page.goto(`${BASE_URL}/mock-video-sites.html?shtSite=native`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForTimeout(1000);

  const points = await page.evaluate(() => {
    const video = document.getElementById("mock-video");
    const rect = video?.getBoundingClientRect();
    if (!rect) {
      return [];
    }

    const y = rect.bottom - Math.max(48, rect.height * 0.12);
    return [-160, -90, -30, 30, 90, 160].map((offset) => ({
      x: rect.left + rect.width / 2 + offset,
      y
    }));
  });

  assert(points.length, "Native test noktasi olusturulamadi");

  const tooltip = await tryHoverPoints(page, points, 1600);
  const playerState = await page.evaluate(() => window.getMockPlayerState?.() || null);

  assert(tooltip.visible, "Native track tooltip gorunmuyor");
  assert(tooltip.surface === "video", "Native track tooltip video yuzeyinde degil");
  assert(Boolean(tooltip.source), "Native track tooltip kaynak kelime gostermiyor");
  assert(playerState && /native track/i.test(playerState.nativeCueText), "Native cue state beklenen metni vermiyor");

  return {
    tooltip,
    playerState
  };
}

async function main() {
  fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/mock-generic-site.html`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    const generic = await runGenericHoverTest(page);
    const pinnedVideo = await runPinnedVideoTest(page);
    const nativeTrack = await runNativeTrackTest(page);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: BASE_URL,
          generic,
          pinnedVideo,
          nativeTrack
        },
        null,
        2
      )
    );
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error && error.message ? error.message : String(error)
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
