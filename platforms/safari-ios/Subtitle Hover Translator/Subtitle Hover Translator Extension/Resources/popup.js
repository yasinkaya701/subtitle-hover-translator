const extensionApi = globalThis.browser || globalThis.chrome;
const usesPromiseMessagingApi =
  typeof globalThis.browser !== "undefined" && extensionApi === globalThis.browser;
const MANAGED_SITE_IDS = new Set([
  "youtube",
  "netflix",
  "max",
  "prime-video",
  "disney-plus",
  "udemy",
  "twitch"
]);

const enabledToggle = document.getElementById("enabled-toggle");
const sourceLanguage = document.getElementById("source-language");
const targetLanguage = document.getElementById("target-language");
const displayMode = document.getElementById("display-mode");
const uiTheme = document.getElementById("ui-theme");
const subtitleHistoryLimit = document.getElementById("subtitle-history-limit");
const syncWordPool = document.getElementById("sync-word-pool");
const currentSite = document.getElementById("current-site");
const siteMode = document.getElementById("site-mode");
const statusChip = document.getElementById("status-chip");
const modePill = document.getElementById("mode-pill");
const overviewFocusTitle = document.getElementById("overview-focus-title");
const overviewFocusCopy = document.getElementById("overview-focus-copy");
const overviewQueueTitle = document.getElementById("overview-queue-title");
const overviewQueueCopy = document.getElementById("overview-queue-copy");
const overviewLibraryTitle = document.getElementById("overview-library-title");
const overviewLibraryCopy = document.getElementById("overview-library-copy");
const toggleCopy = document.getElementById("toggle-copy");
const toggleState = document.getElementById("toggle-state");
const usageTip = document.getElementById("usage-tip");
const saveStatus = document.getElementById("save-status");
const actionCopy = document.getElementById("action-copy");
const jumpReviewButton = document.getElementById("jump-review");
const jumpHistoryButton = document.getElementById("jump-history");
const jumpWordsButton = document.getElementById("jump-words");
const unknownCount = document.getElementById("unknown-count");
const unknownWordsList = document.getElementById("unknown-words-list");
const clearWordsButton = document.getElementById("clear-words");
const unknownSearch = document.getElementById("unknown-search");
const libraryFilterButtons = Array.from(document.querySelectorAll("[data-library-filter]"));
const siteProfileCard = document.getElementById("site-profile-card");
const siteProfileName = document.getElementById("site-profile-name");
const siteProfileCopy = document.getElementById("site-profile-copy");
const siteProfileSummary = document.getElementById("site-profile-summary");
const profileHoverDelay = document.getElementById("profile-hover-delay");
const profilePlacement = document.getElementById("profile-placement");
const profileSize = document.getElementById("profile-size");
const profileDisplayMode = document.getElementById("profile-display-mode");
const profileOcrEnabled = document.getElementById("profile-ocr-enabled");
const reviewCount = document.getElementById("review-count");
const reviewPanel = document.getElementById("review-panel");
const reviewEmpty = document.getElementById("review-empty");
const reviewSource = document.getElementById("review-source");
const reviewContext = document.getElementById("review-context");
const reviewTarget = document.getElementById("review-target");
const reviewExtra = document.getElementById("review-extra");
const reviewSite = document.getElementById("review-site");
const reviewStatePill = document.getElementById("review-state-pill");
const reviewProgress = document.getElementById("review-progress");
const reviewAnswer = document.getElementById("review-answer");
const reviewRevealButton = document.getElementById("review-reveal");
const reviewAgainButton = document.getElementById("review-again");
const reviewHardButton = document.getElementById("review-hard");
const reviewEasyButton = document.getElementById("review-easy");
const exportAnkiButton = document.getElementById("export-anki");
const exportCsvButton = document.getElementById("export-csv");
const exportStatus = document.getElementById("export-status");
const analyticsCopy = document.getElementById("analytics-copy");
const analyticsTotal = document.getElementById("analytics-total");
const analyticsKnown = document.getElementById("analytics-known");
const analyticsLearning = document.getElementById("analytics-learning");
const analyticsDue = document.getElementById("analytics-due");
const analyticsSummary = document.getElementById("analytics-summary");
const subtitleHistoryList = document.getElementById("subtitle-history-list");
const subtitleHistoryCopy = document.getElementById("subtitle-history-copy");
const subtitleHistoryCard = document.getElementById("subtitle-history-card");
const reviewCard = document.getElementById("review-card");
const libraryCard = document.getElementById("library-card");

let currentTabId = null;
let currentPageContext = null;
let currentSettings = {
  sourceLang: "auto",
  targetLang: "tr",
  displayMode: "auto",
  uiTheme: "aurora",
  subtitleHistoryLimit: 10,
  syncWordPool: true,
  siteProfiles: {}
};
let unknownEntries = [];
let subtitleHistoryEntries = [];
let reviewCursor = 0;
let reviewRevealed = false;
let unknownSearchQuery = "";
let unknownFilterState = "all";

enabledToggle.addEventListener("change", handleToggleChange);
sourceLanguage.addEventListener("change", saveLanguageSettings);
targetLanguage.addEventListener("change", saveLanguageSettings);
displayMode.addEventListener("change", saveLanguageSettings);
uiTheme.addEventListener("change", saveLanguageSettings);
subtitleHistoryLimit.addEventListener("change", saveLanguageSettings);
syncWordPool.addEventListener("change", saveLanguageSettings);
clearWordsButton.addEventListener("click", clearUnknownWords);
profileHoverDelay.addEventListener("change", saveSiteProfileSettings);
profilePlacement.addEventListener("change", saveSiteProfileSettings);
profileSize.addEventListener("change", saveSiteProfileSettings);
profileDisplayMode.addEventListener("change", saveSiteProfileSettings);
profileOcrEnabled.addEventListener("change", saveSiteProfileSettings);
reviewRevealButton.addEventListener("click", () => {
  reviewRevealed = true;
  renderReviewPanel();
});
reviewAgainButton.addEventListener("click", () => submitReview("again"));
reviewHardButton.addEventListener("click", () => submitReview("hard"));
reviewEasyButton.addEventListener("click", () => submitReview("easy"));
exportAnkiButton.addEventListener("click", () => exportEntries("anki"));
exportCsvButton.addEventListener("click", () => exportEntries("csv"));
jumpReviewButton.addEventListener("click", () => jumpToCard(reviewCard));
jumpHistoryButton.addEventListener("click", () => jumpToCard(subtitleHistoryCard));
jumpWordsButton.addEventListener("click", () => jumpToCard(libraryCard));
unknownSearch.addEventListener("input", handleUnknownSearch);
libraryFilterButtons.forEach((button) => {
  button.addEventListener("click", () => setUnknownFilter(button.dataset.libraryFilter || "all"));
});

init().catch((error) => {
  currentSite.textContent = "Aktif sekme okunamadi.";
  siteMode.textContent = "Durum bilgisi alinamadi.";
  usageTip.textContent = "Popup acildi ama sekme bilgisi okunamadi.";
  statusChip.dataset.state = "blocked";
  statusChip.textContent = "Sorun";
  modePill.dataset.mode = "idle";
  modePill.textContent = "Bilinmiyor";
  saveStatus.textContent = error.message;
});

async function init() {
  const [activeTab] = await extensionApi.tabs.query({
    active: true,
    currentWindow: true
  });

  currentTabId = activeTab?.id || null;
  currentSite.textContent = activeTab?.url
    ? safeHostname(activeTab.url)
    : "Korunmus veya desteklenmeyen sekme";

  const pageContextResponse = currentTabId
    ? await sendTabMessage(currentTabId, {
        type: "GET_PAGE_CONTEXT"
      }).catch(() => null)
    : null;

  const stateResponse = currentTabId
    ? await sendRuntimeMessage({
        type: "GET_STATE",
        tabId: currentTabId
      })
    : {
        state: {
          enabled: false,
          settings: currentSettings
        }
      };

  currentPageContext = pageContextResponse?.pageContext || null;
  currentSettings = normalizeSettings(stateResponse.state.settings);

  enabledToggle.checked = Boolean(stateResponse.state.enabled);
  sourceLanguage.value = currentSettings.sourceLang;
  targetLanguage.value = currentSettings.targetLang;
  displayMode.value = currentSettings.displayMode || "auto";
  uiTheme.value = normalizeUiTheme(currentSettings.uiTheme);
  subtitleHistoryLimit.value = String(currentSettings.subtitleHistoryLimit || 10);
  syncWordPool.checked = Boolean(currentSettings.syncWordPool);
  applyPopupTheme(uiTheme.value);

  renderPageContext(currentPageContext);
  renderEnabledState(enabledToggle.checked);
  renderSiteProfileCard();
  renderOverview();
  await loadUnknownWords();
  await loadSubtitleHistory();
}

function jumpToCard(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function handleUnknownSearch(event) {
  unknownSearchQuery = String(event.target?.value || "").trim().toLocaleLowerCase("tr");
  renderUnknownWords(unknownEntries);
  renderOverview();
}

function setUnknownFilter(filterState) {
  unknownFilterState = filterState || "all";
  libraryFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.libraryFilter === unknownFilterState);
  });
  renderUnknownWords(unknownEntries);
  renderOverview();
}

async function handleToggleChange() {
  if (!currentTabId) {
    enabledToggle.checked = false;
    return;
  }

  const response = await sendRuntimeMessage({
    type: "SET_TAB_ENABLED",
    tabId: currentTabId,
    enabled: enabledToggle.checked
  });

  enabledToggle.checked = response.state.enabled;
  renderEnabledState(Boolean(response.state.enabled));
}

async function saveLanguageSettings() {
  const response = await sendRuntimeMessage({
    type: "UPDATE_SETTINGS",
    settings: {
      sourceLang: sourceLanguage.value,
      targetLang: targetLanguage.value,
      displayMode: displayMode.value,
      uiTheme: uiTheme.value,
      subtitleHistoryLimit: Number(subtitleHistoryLimit.value),
      syncWordPool: syncWordPool.checked
    },
    tabId: currentTabId
  });

  currentSettings = normalizeSettings(response.settings);
  displayMode.value = currentSettings.displayMode || "auto";
  uiTheme.value = normalizeUiTheme(currentSettings.uiTheme);
  subtitleHistoryLimit.value = String(currentSettings.subtitleHistoryLimit || 10);
  syncWordPool.checked = Boolean(currentSettings.syncWordPool);
  applyPopupTheme(uiTheme.value);

  const sourceLabel = getSelectedLabel(sourceLanguage);
  const targetLabel = getSelectedLabel(targetLanguage);
  writeTransientStatus(`Ayarlar kaydedildi: ${sourceLabel} -> ${targetLabel}`);
}

async function saveSiteProfileSettings() {
  const siteId = currentPageContext?.siteId;
  if (!siteId || !MANAGED_SITE_IDS.has(siteId)) {
    return;
  }

  const response = await sendRuntimeMessage({
    type: "UPDATE_SETTINGS",
    settings: {
      siteProfiles: {
        [siteId]: {
          hoverDelayMs: Number(profileHoverDelay.value),
          tooltipPlacement: profilePlacement.value,
          tooltipSize: profileSize.value,
          displayMode: profileDisplayMode.value,
          ocrEnabled: profileOcrEnabled.checked
        }
      }
    },
    tabId: currentTabId
  });

  currentSettings = normalizeSettings(response.settings);
  renderSiteProfileCard();
  writeTransientStatus(`${currentPageContext.siteLabel || siteId} profili guncellendi.`);
}

async function loadUnknownWords() {
  const response = await sendRuntimeMessage({
    type: "GET_UNKNOWN_WORDS"
  });

  unknownEntries = Array.isArray(response.entries) ? response.entries : [];
  renderUnknownWords(unknownEntries);
  renderReviewPanel();
  renderExportState();
  renderAnalytics();
  renderOverview();
}

async function clearUnknownWords() {
  const response = await sendRuntimeMessage({
    type: "CLEAR_UNKNOWN_WORDS"
  });

  unknownEntries = Array.isArray(response.entries) ? response.entries : [];
  reviewCursor = 0;
  reviewRevealed = false;
  renderUnknownWords(unknownEntries);
  renderReviewPanel();
  renderExportState();
  renderAnalytics();
  renderOverview();
}

async function loadSubtitleHistory() {
  if (!currentTabId) {
    subtitleHistoryEntries = [];
    renderSubtitleHistory();
    return;
  }

  const response = await sendRuntimeMessage({
    type: "GET_SUBTITLE_HISTORY",
    tabId: currentTabId
  }).catch(() => ({ history: [] }));

  subtitleHistoryEntries = Array.isArray(response.history) ? response.history : [];
  renderSubtitleHistory();
  renderOverview();
}

function renderUnknownWords(entries) {
  const sortedEntries = [...entries].sort(
    (left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
  );
  const visibleEntries = filterUnknownEntries(sortedEntries);

  unknownCount.textContent = buildUnknownCountLabel(sortedEntries.length, visibleEntries.length);
  clearWordsButton.disabled = sortedEntries.length === 0;

  if (!sortedEntries.length) {
    unknownWordsList.innerHTML =
      "Kayit listen bos. Bir kelimeyi ya da secimi kaydettiginde burada gorunecek.";
    unknownWordsList.classList.add("empty-state");
    return;
  }

  if (!visibleEntries.length) {
    unknownWordsList.innerHTML =
      "Bu filtrede kayit bulunamadi. Arama metnini temizleyip farkli bir durum sec.";
    unknownWordsList.classList.add("empty-state");
    return;
  }

  unknownWordsList.classList.remove("empty-state");
  unknownWordsList.innerHTML = visibleEntries
    .map(
      (entry) => `
        <article class="unknown-word-item">
          <div class="item-head">
            <div>
              <h3>${escapeHtml(entry.sourceText)}</h3>
              <p class="item-target">${escapeHtml(entry.translatedText)}</p>
            </div>
            <div class="item-head-side">
              <span class="item-site">${escapeHtml(entry.hostname || "site yok")}</span>
              <span class="item-review-state item-review-${escapeHtml(getReviewState(entry))}">${escapeHtml(
                getReviewLabel(entry)
              )}</span>
            </div>
          </div>
          ${formatSavedDetails(entry)}
          <p class="item-context">${escapeHtml(entry.context || "Baglam eklenmedi.")}</p>
          <time class="item-time" datetime="${escapeHtml(entry.savedAt)}">${formatSavedTime(entry.savedAt)}</time>
        </article>
      `
    )
    .join("");
}

function filterUnknownEntries(entries) {
  return entries.filter((entry) => matchesUnknownFilter(entry) && matchesUnknownSearch(entry));
}

function matchesUnknownFilter(entry) {
  if (unknownFilterState === "all") {
    return true;
  }

  if (unknownFilterState === "due") {
    return getReviewDueTimestamp(entry) <= Date.now();
  }

  return getReviewState(entry) === unknownFilterState;
}

function matchesUnknownSearch(entry) {
  if (!unknownSearchQuery) {
    return true;
  }

  const fields = [
    entry.sourceText,
    entry.translatedText,
    entry.context,
    entry.hostname,
    entry.details?.dictionaryDefinitions?.[0]?.definition,
    Array.isArray(entry.details?.synonyms) ? entry.details.synonyms.join(" ") : ""
  ];

  return fields.some((value) =>
    String(value || "").toLocaleLowerCase("tr").includes(unknownSearchQuery)
  );
}

function buildUnknownCountLabel(totalCount, visibleCount) {
  if (!totalCount) {
    return "0 kayit";
  }

  if (visibleCount === totalCount) {
    return `${totalCount} kayit`;
  }

  return `${visibleCount} gorunuyor • ${totalCount} toplam`;
}

function renderSubtitleHistory() {
  if (!subtitleHistoryEntries.length) {
    subtitleHistoryList.classList.add("empty-state");
    subtitleHistoryList.innerHTML = "Bu sekmede son altyazi satirlari burada gorunecek.";
    subtitleHistoryCopy.textContent = "Aktif sekmedeki son altyazi satirlari.";
    return;
  }

  subtitleHistoryList.classList.remove("empty-state");
  subtitleHistoryCopy.textContent = `${subtitleHistoryEntries.length} satir yakalandi.`;
  subtitleHistoryList.innerHTML = subtitleHistoryEntries
    .map(
      (entry) => `
        <article class="unknown-word-item">
          <div class="item-head">
            <div>
              <h3>${escapeHtml(entry.text || "")}</h3>
              <p class="item-target">${escapeHtml(entry.source || "Altyazi")}</p>
            </div>
          </div>
          <time class="item-time" datetime="${escapeHtml(entry.savedAt || "")}">${formatSavedTime(entry.savedAt)}</time>
        </article>
      `
    )
    .join("");
}

function renderAnalytics() {
  const total = unknownEntries.length;
  const known = unknownEntries.filter((entry) => getReviewState(entry) === "known").length;
  const learning = unknownEntries.filter((entry) => getReviewState(entry) === "learning").length;
  const dueNow = buildReviewQueue(unknownEntries).filter((entry) => getReviewDueTimestamp(entry) <= Date.now()).length;
  const uniqueSites = new Set(unknownEntries.map((entry) => entry.hostname).filter(Boolean));
  const syncedLabel = currentSettings.syncWordPool ? "Sync acik" : "Sync kapali";

  analyticsTotal.textContent = String(total);
  analyticsKnown.textContent = String(known);
  analyticsLearning.textContent = String(learning);
  analyticsDue.textContent = String(dueNow);
  analyticsCopy.textContent = total
    ? `${uniqueSites.size || 1} site, ${syncedLabel}, ${currentSettings.subtitleHistoryLimit || 10} satir history.`
    : "Kayitlar geldikce ogrenme ozetin burada gorunecek.";

  if (!total) {
    analyticsSummary.textContent = "Ilk kartlari kaydettiginde tekrar yogunlugu ve ilerleme burada hesaplanir.";
    return;
  }

  const accuracy = Math.round((known / Math.max(total, 1)) * 100);
  analyticsSummary.textContent = `${accuracy}% bilinen, ${dueNow} kart hemen tekrar bekliyor, ${uniqueSites.size || 1} farkli siteden veri var.`;
}

function formatSavedDetails(entry) {
  const details = entry?.details || {};
  const lines = [];
  const firstDefinition = details.dictionaryDefinitions?.[0]?.definition;
  const synonyms = Array.isArray(details.synonyms) ? details.synonyms.slice(0, 6) : [];
  const wordForms = Array.isArray(details.wordForms)
    ? details.wordForms.map((item) => `${item.label}: ${item.value}`).slice(0, 4)
    : [];
  const firstPhrase = Array.isArray(details.phraseMatches) ? details.phraseMatches[0] : null;
  const firstExample = Array.isArray(details.examples) ? details.examples[0] : "";
  const grammar = details.grammarBreakdown
    ? [details.grammarBreakdown.summary, details.grammarBreakdown.structure, details.grammarBreakdown.tense]
        .filter(Boolean)
        .join(" • ")
    : "";
  const insight = Array.isArray(details.contextInsights) ? details.contextInsights[0] : "";

  if (firstDefinition) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Definition:</span> ${escapeHtml(firstDefinition)}</p>`
    );
  }

  if (synonyms.length) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Synonyms:</span> ${escapeHtml(synonyms.join(", "))}</p>`
    );
  }

  if (wordForms.length) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Forms:</span> ${escapeHtml(wordForms.join(", "))}</p>`
    );
  }

  if (firstPhrase?.text && firstPhrase?.translatedText) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Phrase:</span> ${escapeHtml(
        `${firstPhrase.text} -> ${firstPhrase.translatedText}`
      )}</p>`
    );
  }

  if (firstExample) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Example:</span> ${escapeHtml(firstExample)}</p>`
    );
  }

  if (grammar) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Grammar:</span> ${escapeHtml(grammar)}</p>`
    );
  }

  if (insight) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Insight:</span> ${escapeHtml(insight)}</p>`
    );
  }

  return lines.length ? `<div class="detail-list">${lines.join("")}</div>` : "";
}

function renderPageContext(pageContext) {
  currentPageContext = pageContext;

  if (!pageContext) {
    modePill.dataset.mode = "idle";
    modePill.textContent = "Korunmus alan";
    siteMode.textContent =
      "Bu sekmede icerik betigi aktif degil. Chrome yeni sekme, ayarlar ve benzeri alanlarda calismaz.";
    usageTip.textContent =
      "Normal bir web sayfasi ya da video sayfasi acinca hover ve secim cevirisi otomatik hazir olur.";
    renderEnabledState(enabledToggle.checked);
    renderOverview();
    return;
  }

  if (pageContext.pageMode === "video") {
    modePill.dataset.mode = "video";
    modePill.textContent = "Video modu";

    if (pageContext.siteLabel && pageContext.usingFallback) {
      siteMode.textContent = `${pageContext.siteLabel} video sayfasi algilandi. Genel altyazi taramasi ile devam ediliyor.`;
    } else if (pageContext.siteLabel) {
      siteMode.textContent = `${pageContext.siteLabel} video sayfasi algilandi.`;
    } else if (pageContext.hasVisibleVideo) {
      siteMode.textContent = "Genel video overlay modu aktif.";
    } else {
      siteMode.textContent = "Video benzeri sayfa algilandi.";
    }

    usageTip.textContent =
      "Kelime icin altyazinin ustune git. 2-3 kelime icin drag yap. S ile kaydet, P ile sabitle, Esc ile kapat.";
    renderEnabledState(enabledToggle.checked);
    renderOverview();
    return;
  }

  if (pageContext.allowGenericText) {
    modePill.dataset.mode = "web";
    modePill.textContent = "Web modu";
    siteMode.textContent = "Genel web metni modu aktif.";
    usageTip.textContent =
      "Paragraf, baslik ve gorunur metinlerde hover ile kelime; secerek kisa ifade cevirisi alabilirsin.";
    renderEnabledState(enabledToggle.checked);
    renderOverview();
    return;
  }

  modePill.dataset.mode = "idle";
  modePill.textContent = "Metin yok";
  siteMode.textContent = "Bu sekmede cevrilecek gorunur metin bulunamadi.";
  usageTip.textContent =
    "Sayfada secilebilir ya da gorunur bir metin oldugunda uzanti ayni sekmede hemen kullanilabilir.";
  renderEnabledState(enabledToggle.checked);
  renderOverview();
}

function renderEnabledState(enabled) {
  const isBlocked = !currentTabId || !currentPageContext;
  const state = isBlocked ? "blocked" : enabled ? "on" : "off";

  statusChip.dataset.state = state;
  statusChip.textContent = isBlocked ? "Pasif" : enabled ? "Acik" : "Kapali";
  toggleState.dataset.state = enabled ? "on" : "off";
  toggleState.textContent = enabled
    ? "Bu sekmede canli"
    : isBlocked
      ? "Bu alanda calismaz"
      : "Bu sekmede kapali";

  if (isBlocked) {
    toggleCopy.textContent =
      "Bu sekme tarayici tarafindan korunuyor ya da icerik betigi buraya yuklenemiyor.";
    return;
  }

  if (!enabled) {
    toggleCopy.textContent =
      "Bu sekmede duraklatildi. Anahtar tekrar acilinca hover, secim ve kaydetme akisi hemen geri gelir.";
    return;
  }

  if (currentPageContext?.pageMode === "video") {
    toggleCopy.textContent =
      "Video altyazilarinda hover cevirisi, phrase algisi, pin ve quick save acik.";
    return;
  }

  toggleCopy.textContent =
    "Genel web metninde hover ile tek kelime, secim ile kisa ifade cevirisi acik.";
  renderOverview();
}

function renderSiteProfileCard() {
  const siteId = currentPageContext?.siteId || "";
  if (!siteId || !MANAGED_SITE_IDS.has(siteId)) {
    siteProfileCard.hidden = true;
    renderOverview();
    return;
  }

  siteProfileCard.hidden = false;
  const profileSettings = currentSettings.siteProfiles?.[siteId] || {};

  siteProfileName.textContent = currentPageContext?.siteLabel || siteId;
  siteProfileCopy.textContent =
    "Bu site icin hover hizi, tooltip yeri, panel modu ve OCR fallback ayri tutulur.";
  profileHoverDelay.value = String(profileSettings.hoverDelayMs || 140);
  profilePlacement.value = profileSettings.tooltipPlacement || "auto";
  profileSize.value = profileSettings.tooltipSize || "balanced";
  profileDisplayMode.value = profileSettings.displayMode || "auto";
  profileOcrEnabled.checked = Boolean(profileSettings.ocrEnabled);
  siteProfileSummary.textContent = buildSiteProfileSummary(
    currentPageContext?.siteLabel || siteId,
    profileSettings
  );
  renderOverview();
}

function renderReviewPanel() {
  const queue = buildReviewQueue(unknownEntries);
  reviewCount.textContent = queue.length
    ? `${queue.length} kart hazir`
    : "Kayit ekleyince mini quiz burada acilir";

  if (!queue.length) {
    reviewPanel.hidden = true;
    reviewEmpty.hidden = false;
    if (reviewProgress) {
      reviewProgress.textContent = "0 / 0";
    }
    renderOverview();
    return;
  }

  if (reviewCursor >= queue.length) {
    reviewCursor = 0;
  }

  const entry = queue[reviewCursor];
  if (reviewProgress) {
    reviewProgress.textContent = `${reviewCursor + 1} / ${queue.length}`;
  }
  const stateLabel = getReviewLabel(entry);
  const details = entry?.details || {};
  const firstDefinition = details.dictionaryDefinitions?.[0]?.definition || "";
  const synonyms = Array.isArray(details.synonyms) ? details.synonyms.slice(0, 4).join(", ") : "";
  const phrase = Array.isArray(details.phraseMatches) && details.phraseMatches[0]?.text
    ? `${details.phraseMatches[0].text} -> ${details.phraseMatches[0].translatedText}`
    : "";
  const extraText = [firstDefinition, synonyms, phrase].filter(Boolean).join(" • ");

  reviewPanel.hidden = false;
  reviewEmpty.hidden = true;
  reviewSource.textContent = entry.sourceText;
  reviewContext.textContent = entry.context || "Baglam kaydedilmemis.";
  reviewTarget.textContent = reviewRevealed ? entry.translatedText : "";
  reviewExtra.textContent = reviewRevealed ? extraText : "";
  reviewSite.textContent = entry.hostname || "site yok";
  reviewStatePill.textContent = stateLabel;
  reviewStatePill.dataset.state = getReviewState(entry);
  reviewAnswer.hidden = !reviewRevealed;
  reviewRevealButton.disabled = reviewRevealed;
  reviewAgainButton.disabled = !reviewRevealed;
  reviewHardButton.disabled = !reviewRevealed;
  reviewEasyButton.disabled = !reviewRevealed;
  renderOverview();
}

function renderOverview() {
  const queue = buildReviewQueue(unknownEntries);
  const dueNow = queue.filter((entry) => getReviewDueTimestamp(entry) <= Date.now()).length;
  const visibleEntries = filterUnknownEntries(unknownEntries);
  const hasVideoMode = currentPageContext?.pageMode === "video";
  const siteId = currentPageContext?.siteId || "";
  const siteLabel = currentPageContext?.siteLabel || currentSite.textContent || "Bu sekme";
  const siteProfile = currentSettings.siteProfiles?.[siteId] || null;
  const historyCount = subtitleHistoryEntries.length;
  const syncLabel = currentSettings.syncWordPool ? "Sync acik" : "Sync kapali";

  overviewFocusTitle.textContent = currentPageContext
    ? `${siteLabel} • ${hasVideoMode ? "Video" : currentPageContext.allowGenericText ? "Web" : "Pasif"}`
    : "Korunmus sekme";
  overviewFocusCopy.textContent = currentPageContext
    ? siteProfile && MANAGED_SITE_IDS.has(siteId)
      ? buildSiteProfileSummary(siteLabel, siteProfile)
      : hasVideoMode
        ? "Video davranisi aktif. Docked ya da tooltip modu sayfaya gore secilir."
        : "Genel web metni taraniyor. Hover ve secim cevirisi hazir."
    : "Tarayici tarafindan korunan alanlarda uzanti dogrudan calismaz.";

  overviewQueueTitle.textContent = queue.length ? `${queue.length} kart • ${dueNow} due` : "Kuyruk bos";
  overviewQueueCopy.textContent = queue.length
    ? `Siradaki: ${queue[reviewCursor % queue.length]?.sourceText || queue[0]?.sourceText || "kart"}`
    : "Kayit ekledikce review kuyruğu burada ozetlenir.";

  overviewLibraryTitle.textContent = `${unknownEntries.length} kayit`;
  overviewLibraryCopy.textContent = unknownEntries.length
    ? `${visibleEntries.length} gorunen, ${historyCount} history, ${syncLabel}.`
    : `${historyCount} history satiri var, ${syncLabel}.`;

  jumpReviewButton.disabled = queue.length === 0;
  jumpHistoryButton.disabled = historyCount === 0;
  jumpWordsButton.disabled = unknownEntries.length === 0;
  actionCopy.textContent = queue.length
    ? `${dueNow ? `${dueNow} kart hemen bekliyor.` : "Review sirasi hazir."} Istegin yere tek tikla in.`
    : unknownEntries.length
      ? "Kelimeler kayitli. Review daha sonra buradan hizli acilir."
      : "Ilk kelimeyi kaydettiğinde review ve disa aktarma akisi burada hizlanir.";
}

function buildSiteProfileSummary(siteLabel, profileSettings = {}) {
  const mode = profileSettings.displayMode || "auto";
  const placement = profileSettings.tooltipPlacement || "auto";
  const speed = Number(profileSettings.hoverDelayMs) || 140;
  const size = profileSettings.tooltipSize || "balanced";
  const ocrLabel = profileSettings.ocrEnabled ? "OCR acik" : "OCR kapali";

  return `${siteLabel} icin ${mode} panel, ${placement} yerlesim, ${speed}ms hover, ${size} boyut, ${ocrLabel}.`;
}

function buildReviewQueue(entries) {
  const now = Date.now();
  return [...entries].sort((left, right) => {
    const leftDue = getReviewDueTimestamp(left);
    const rightDue = getReviewDueTimestamp(right);
    const leftScore = leftDue <= now ? 0 : 1;
    const rightScore = rightDue <= now ? 0 : 1;
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime();
  });
}

function getReviewDueTimestamp(entry) {
  const value = Date.parse(entry?.review?.nextReviewAt || "");
  return Number.isNaN(value) ? 0 : value;
}

async function submitReview(outcome) {
  const queue = buildReviewQueue(unknownEntries);
  const entry = queue[reviewCursor];
  if (!entry) {
    return;
  }

  await sendRuntimeMessage({
    type: "UPDATE_UNKNOWN_WORD_REVIEW",
    entryId: entry.id,
    outcome
  });

  reviewCursor += 1;
  reviewRevealed = false;
  await loadUnknownWords();
}

function renderExportState() {
  const hasEntries = unknownEntries.length > 0;
  exportAnkiButton.disabled = !hasEntries;
  exportCsvButton.disabled = !hasEntries;
  exportStatus.textContent = hasEntries
    ? `${unknownEntries.length} kayit disa aktarilabilir. Anki icin TSV, diger kullanimlar icin CSV hazir.`
    : "Disa aktarma icin once birkac kelime kaydet.";
}

function exportEntries(type) {
  if (!unknownEntries.length) {
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  if (type === "anki") {
    downloadTextFile(
      `subtitle-hover-translator-${stamp}.tsv`,
      buildAnkiExport(unknownEntries),
      "text/tab-separated-values;charset=utf-8"
    );
    exportStatus.textContent = "Anki TSV indirildi.";
    return;
  }

  downloadTextFile(
    `subtitle-hover-translator-${stamp}.csv`,
    buildCsvExport(unknownEntries),
    "text/csv;charset=utf-8"
  );
  exportStatus.textContent = "CSV indirildi.";
}

function buildAnkiExport(entries) {
  return [...entries]
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())
    .map((entry) => {
      const notes = [
        entry.context ? `Baglam: ${entry.context}` : "",
        entry.details?.dictionaryDefinitions?.[0]?.definition
          ? `Sozluk: ${entry.details.dictionaryDefinitions[0].definition}`
          : "",
        Array.isArray(entry.details?.synonyms) && entry.details.synonyms.length
          ? `Synonym: ${entry.details.synonyms.join(", ")}`
          : "",
        Array.isArray(entry.details?.examples) && entry.details.examples.length
          ? `Examples: ${entry.details.examples.join(" | ")}`
          : "",
        Array.isArray(entry.details?.phraseMatches) && entry.details.phraseMatches[0]?.text
          ? `Phrase: ${entry.details.phraseMatches[0].text} -> ${entry.details.phraseMatches[0].translatedText}`
          : "",
        entry.details?.grammarBreakdown?.summary
          ? `Grammar: ${[
              entry.details.grammarBreakdown.summary,
              entry.details.grammarBreakdown.structure,
              entry.details.grammarBreakdown.tense
            ]
              .filter(Boolean)
              .join(" • ")}`
          : "",
        Array.isArray(entry.details?.contextInsights) && entry.details.contextInsights.length
          ? `Insights: ${entry.details.contextInsights.join(" | ")}`
          : "",
        entry.pageUrl ? `URL: ${entry.pageUrl}` : "",
        entry.details?.pronunciation?.lang ? `Voice: ${entry.details.pronunciation.lang}` : ""
      ]
        .filter(Boolean)
        .join("<br>");

      return [entry.sourceText, entry.translatedText, notes]
        .map((cell) => sanitizeDelimitedCell(cell))
        .join("\t");
    })
    .join("\n");
}

function buildCsvExport(entries) {
  const header = [
    "sourceText",
    "translatedText",
    "sourceLang",
    "targetLang",
    "context",
    "hostname",
    "pageUrl",
    "savedAt",
    "reviewState",
    "dictionaryDefinition",
    "synonyms",
    "wordForms",
    "examples",
    "phrase",
    "grammar",
    "contextInsights",
    "pronunciationLang"
  ];
  const rows = entries.map((entry) => [
    entry.sourceText,
    entry.translatedText,
    entry.sourceLang || "",
    entry.targetLang || "",
    entry.context || "",
    entry.hostname || "",
    entry.pageUrl || "",
    entry.savedAt || "",
    getReviewLabel(entry),
    entry.details?.dictionaryDefinitions?.[0]?.definition || "",
    Array.isArray(entry.details?.synonyms) ? entry.details.synonyms.join(" | ") : "",
    Array.isArray(entry.details?.wordForms)
      ? entry.details.wordForms.map((item) => `${item.label}: ${item.value}`).join(" | ")
      : "",
    Array.isArray(entry.details?.examples) ? entry.details.examples.join(" | ") : "",
    Array.isArray(entry.details?.phraseMatches) && entry.details.phraseMatches[0]?.text
      ? `${entry.details.phraseMatches[0].text} -> ${entry.details.phraseMatches[0].translatedText}`
      : "",
    entry.details?.grammarBreakdown
      ? [
          entry.details.grammarBreakdown.summary,
          entry.details.grammarBreakdown.structure,
          entry.details.grammarBreakdown.tense,
          ...(entry.details.grammarBreakdown.notes || [])
        ]
          .filter(Boolean)
          .join(" | ")
      : "",
    Array.isArray(entry.details?.contextInsights) ? entry.details.contextInsights.join(" | ") : "",
    entry.details?.pronunciation?.lang || ""
  ]);

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function getReviewState(entry) {
  return entry?.review?.status || "new";
}

function getReviewLabel(entry) {
  const state = getReviewState(entry);
  if (state === "known") {
    return "Bildim";
  }

  if (state === "learning") {
    return "Tekrarda";
  }

  return "Yeni";
}

function writeTransientStatus(message) {
  saveStatus.textContent = message;
  window.clearTimeout(writeTransientStatus.timer);
  writeTransientStatus.timer = window.setTimeout(() => {
    saveStatus.textContent = "";
  }, 1800);
}

function normalizeSettings(settings) {
  const base = {
    sourceLang: "auto",
    targetLang: "tr",
    displayMode: "auto",
    uiTheme: "aurora",
    subtitleHistoryLimit: 10,
    syncWordPool: true,
    siteProfiles: {
      youtube: {
        hoverDelayMs: 110,
        tooltipPlacement: "right",
        tooltipSize: "compact",
        displayMode: "tooltip",
        ocrEnabled: false
      },
      netflix: {
        hoverDelayMs: 150,
        tooltipPlacement: "top",
        tooltipSize: "balanced",
        displayMode: "docked",
        ocrEnabled: true
      },
      max: {
        hoverDelayMs: 175,
        tooltipPlacement: "left",
        tooltipSize: "compact",
        displayMode: "docked",
        ocrEnabled: true
      },
      "prime-video": {
        hoverDelayMs: 160,
        tooltipPlacement: "left",
        tooltipSize: "balanced",
        displayMode: "docked",
        ocrEnabled: true
      },
      "disney-plus": {
        hoverDelayMs: 160,
        tooltipPlacement: "top",
        tooltipSize: "balanced",
        displayMode: "docked",
        ocrEnabled: true
      },
      udemy: {
        hoverDelayMs: 115,
        tooltipPlacement: "right",
        tooltipSize: "compact",
        displayMode: "tooltip",
        ocrEnabled: false
      },
      twitch: {
        hoverDelayMs: 125,
        tooltipPlacement: "right",
        tooltipSize: "compact",
        displayMode: "tooltip",
        ocrEnabled: false
      }
    }
  };

  if (!settings || typeof settings !== "object") {
    return base;
  }

  return {
    sourceLang: settings.sourceLang || base.sourceLang,
    targetLang: settings.targetLang || base.targetLang,
    displayMode: settings.displayMode || base.displayMode,
    uiTheme: normalizeUiTheme(settings.uiTheme, base.uiTheme),
    subtitleHistoryLimit: Number(settings.subtitleHistoryLimit) || base.subtitleHistoryLimit,
    syncWordPool:
      typeof settings.syncWordPool === "boolean"
        ? settings.syncWordPool
        : base.syncWordPool,
    siteProfiles: {
      ...base.siteProfiles,
      ...(settings.siteProfiles || {})
    }
  };
}

function normalizeUiTheme(value, fallback = "aurora") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "aurora" || normalized === "sand" || normalized === "ink") {
    return normalized;
  }
  return fallback;
}

function applyPopupTheme(theme) {
  document.body.dataset.theme = normalizeUiTheme(theme);
}

function downloadTextFile(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeDelimitedCell(value) {
  return String(value || "")
    .replaceAll("\t", " ")
    .replaceAll("\n", " ")
    .trim();
}

function escapeCsvCell(value) {
  const normalized = String(value || "").replaceAll("\r", " ").replaceAll("\n", " ");
  return `"${normalized.replaceAll('"', '""')}"`;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = (response) => {
      if (settled) {
        return;
      }
      settled = true;

      if (!response?.ok) {
        reject(new Error(response?.error || "Extension request failed"));
        return;
      }

      resolve(response);
    };
    const finishReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error || "Extension request failed")));
    };

    try {
      if (usesPromiseMessagingApi) {
        extensionApi.runtime.sendMessage(message).then(finishResolve).catch(finishReject);
        return;
      }

      const maybePromise = extensionApi.runtime.sendMessage(message, (response) => {
        const runtimeError = extensionApi.runtime.lastError;
        if (runtimeError) {
          finishReject(new Error(runtimeError.message));
          return;
        }

        finishResolve(response);
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(finishResolve).catch(finishReject);
      }
    } catch (error) {
      finishReject(error);
    }
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = (response) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(response);
    };
    const finishReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error instanceof Error ? error : new Error(String(error || "Tab request failed")));
    };

    try {
      if (usesPromiseMessagingApi) {
        extensionApi.tabs.sendMessage(tabId, message).then(finishResolve).catch(finishReject);
        return;
      }

      const maybePromise = extensionApi.tabs.sendMessage(tabId, message, (response) => {
        const runtimeError = extensionApi.runtime.lastError;
        if (runtimeError) {
          finishReject(new Error(runtimeError.message));
          return;
        }

        finishResolve(response);
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(finishResolve).catch(finishReject);
      }
    } catch (error) {
      finishReject(error);
    }
  });
}

function getSelectedLabel(select) {
  return select.options[select.selectedIndex]?.text || select.value;
}

function formatSavedTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Zaman okunamadi"
    : date.toLocaleString("tr-TR");
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "Korunmus veya desteklenmeyen sekme";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
