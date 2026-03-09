const extensionApi = globalThis.browser || globalThis.chrome;
const usesPromiseMessagingApi =
  typeof globalThis.browser !== "undefined" && extensionApi === globalThis.browser;
const MANAGED_SITE_IDS = new Set(["youtube", "netflix", "max"]);

const enabledToggle = document.getElementById("enabled-toggle");
const sourceLanguage = document.getElementById("source-language");
const targetLanguage = document.getElementById("target-language");
const currentSite = document.getElementById("current-site");
const siteMode = document.getElementById("site-mode");
const statusChip = document.getElementById("status-chip");
const modePill = document.getElementById("mode-pill");
const toggleCopy = document.getElementById("toggle-copy");
const toggleState = document.getElementById("toggle-state");
const usageTip = document.getElementById("usage-tip");
const saveStatus = document.getElementById("save-status");
const unknownCount = document.getElementById("unknown-count");
const unknownWordsList = document.getElementById("unknown-words-list");
const clearWordsButton = document.getElementById("clear-words");
const siteProfileCard = document.getElementById("site-profile-card");
const siteProfileName = document.getElementById("site-profile-name");
const siteProfileCopy = document.getElementById("site-profile-copy");
const profileHoverDelay = document.getElementById("profile-hover-delay");
const profilePlacement = document.getElementById("profile-placement");
const profileSize = document.getElementById("profile-size");
const reviewCount = document.getElementById("review-count");
const reviewPanel = document.getElementById("review-panel");
const reviewEmpty = document.getElementById("review-empty");
const reviewSource = document.getElementById("review-source");
const reviewContext = document.getElementById("review-context");
const reviewTarget = document.getElementById("review-target");
const reviewExtra = document.getElementById("review-extra");
const reviewSite = document.getElementById("review-site");
const reviewStatePill = document.getElementById("review-state-pill");
const reviewAnswer = document.getElementById("review-answer");
const reviewRevealButton = document.getElementById("review-reveal");
const reviewAgainButton = document.getElementById("review-again");
const reviewHardButton = document.getElementById("review-hard");
const reviewEasyButton = document.getElementById("review-easy");
const exportAnkiButton = document.getElementById("export-anki");
const exportCsvButton = document.getElementById("export-csv");
const exportStatus = document.getElementById("export-status");

let currentTabId = null;
let currentPageContext = null;
let currentSettings = {
  sourceLang: "auto",
  targetLang: "tr",
  siteProfiles: {}
};
let unknownEntries = [];
let reviewCursor = 0;
let reviewRevealed = false;

enabledToggle.addEventListener("change", handleToggleChange);
sourceLanguage.addEventListener("change", saveLanguageSettings);
targetLanguage.addEventListener("change", saveLanguageSettings);
clearWordsButton.addEventListener("click", clearUnknownWords);
profileHoverDelay.addEventListener("change", saveSiteProfileSettings);
profilePlacement.addEventListener("change", saveSiteProfileSettings);
profileSize.addEventListener("change", saveSiteProfileSettings);
reviewRevealButton.addEventListener("click", () => {
  reviewRevealed = true;
  renderReviewPanel();
});
reviewAgainButton.addEventListener("click", () => submitReview("again"));
reviewHardButton.addEventListener("click", () => submitReview("hard"));
reviewEasyButton.addEventListener("click", () => submitReview("easy"));
exportAnkiButton.addEventListener("click", () => exportEntries("anki"));
exportCsvButton.addEventListener("click", () => exportEntries("csv"));

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

  renderPageContext(currentPageContext);
  renderEnabledState(enabledToggle.checked);
  renderSiteProfileCard();
  await loadUnknownWords();
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
      targetLang: targetLanguage.value
    },
    tabId: currentTabId
  });

  currentSettings = normalizeSettings(response.settings);

  const sourceLabel = getSelectedLabel(sourceLanguage);
  const targetLabel = getSelectedLabel(targetLanguage);
  writeTransientStatus(`Dil ayari kaydedildi: ${sourceLabel} -> ${targetLabel}`);
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
          tooltipSize: profileSize.value
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
}

function renderUnknownWords(entries) {
  const sortedEntries = [...entries].sort(
    (left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
  );

  unknownCount.textContent = `${sortedEntries.length} kayit`;
  clearWordsButton.disabled = sortedEntries.length === 0;

  if (!sortedEntries.length) {
    unknownWordsList.innerHTML =
      "Kayit listen bos. Bir kelimeyi ya da secimi kaydettiginde burada gorunecek.";
    unknownWordsList.classList.add("empty-state");
    return;
  }

  unknownWordsList.classList.remove("empty-state");
  unknownWordsList.innerHTML = sortedEntries
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

function formatSavedDetails(entry) {
  const details = entry?.details || {};
  const lines = [];
  const firstDefinition = details.dictionaryDefinitions?.[0]?.definition;
  const synonyms = Array.isArray(details.synonyms) ? details.synonyms.slice(0, 3) : [];
  const wordForms = Array.isArray(details.wordForms)
    ? details.wordForms.map((item) => `${item.label}: ${item.value}`).slice(0, 4)
    : [];
  const firstPhrase = Array.isArray(details.phraseMatches) ? details.phraseMatches[0] : null;
  const firstExample = Array.isArray(details.examples) ? details.examples[0] : "";

  if (firstDefinition) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Sozluk:</span> ${escapeHtml(firstDefinition)}</p>`
    );
  }

  if (synonyms.length) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Synonym:</span> ${escapeHtml(synonyms.join(", "))}</p>`
    );
  }

  if (wordForms.length) {
    lines.push(
      `<p class="detail-line"><span class="detail-label">Word formation:</span> ${escapeHtml(wordForms.join(" • "))}</p>`
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
    return;
  }

  if (pageContext.allowGenericText) {
    modePill.dataset.mode = "web";
    modePill.textContent = "Web modu";
    siteMode.textContent = "Genel web metni modu aktif.";
    usageTip.textContent =
      "Paragraf, baslik ve gorunur metinlerde hover ile kelime; secerek kisa ifade cevirisi alabilirsin.";
    renderEnabledState(enabledToggle.checked);
    return;
  }

  modePill.dataset.mode = "idle";
  modePill.textContent = "Metin yok";
  siteMode.textContent = "Bu sekmede cevrilecek gorunur metin bulunamadi.";
  usageTip.textContent =
    "Sayfada secilebilir ya da gorunur bir metin oldugunda uzanti ayni sekmede hemen kullanilabilir.";
  renderEnabledState(enabledToggle.checked);
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
}

function renderSiteProfileCard() {
  const siteId = currentPageContext?.siteId || "";
  if (!siteId || !MANAGED_SITE_IDS.has(siteId)) {
    siteProfileCard.hidden = true;
    return;
  }

  siteProfileCard.hidden = false;
  const profileSettings = currentSettings.siteProfiles?.[siteId] || {};

  siteProfileName.textContent = currentPageContext?.siteLabel || siteId;
  siteProfileCopy.textContent =
    "Bu site icin hover hizi, tooltip yeri ve boyutu ayri tutulur. Sorun cikarsa backup surume donebiliriz.";
  profileHoverDelay.value = String(profileSettings.hoverDelayMs || 140);
  profilePlacement.value = profileSettings.tooltipPlacement || "auto";
  profileSize.value = profileSettings.tooltipSize || "balanced";
}

function renderReviewPanel() {
  const queue = buildReviewQueue(unknownEntries);
  reviewCount.textContent = queue.length
    ? `${queue.length} kart hazir`
    : "Kayit ekleyince mini quiz burada acilir";

  if (!queue.length) {
    reviewPanel.hidden = true;
    reviewEmpty.hidden = false;
    return;
  }

  if (reviewCursor >= queue.length) {
    reviewCursor = 0;
  }

  const entry = queue[reviewCursor];
  const stateLabel = getReviewLabel(entry);
  const details = entry?.details || {};
  const firstDefinition = details.dictionaryDefinitions?.[0]?.definition || "";
  const synonyms = Array.isArray(details.synonyms) ? details.synonyms.slice(0, 3).join(", ") : "";
  const phrase = Array.isArray(details.phraseMatches) && details.phraseMatches[0]?.text
    ? `${details.phraseMatches[0].text} -> ${details.phraseMatches[0].translatedText}`
    : "";

  reviewPanel.hidden = false;
  reviewEmpty.hidden = true;
  reviewSource.textContent = entry.sourceText;
  reviewContext.textContent = entry.context || "Baglam kaydedilmemis.";
  reviewTarget.textContent = entry.translatedText;
  reviewExtra.textContent = [firstDefinition, synonyms, phrase].filter(Boolean).join(" • ");
  reviewSite.textContent = entry.hostname || "site yok";
  reviewStatePill.textContent = stateLabel;
  reviewStatePill.dataset.state = getReviewState(entry);
  reviewAnswer.hidden = !reviewRevealed;
  reviewRevealButton.disabled = reviewRevealed;
  reviewAgainButton.disabled = !reviewRevealed;
  reviewHardButton.disabled = !reviewRevealed;
  reviewEasyButton.disabled = !reviewRevealed;
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
    ? "Anki icin TSV, genel kullanim icin CSV hazir."
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
          : ""
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
    "context",
    "hostname",
    "savedAt",
    "reviewState",
    "dictionaryDefinition",
    "synonyms",
    "wordForms",
    "examples",
    "phrase"
  ];
  const rows = entries.map((entry) => [
    entry.sourceText,
    entry.translatedText,
    entry.context || "",
    entry.hostname || "",
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
      : ""
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
    siteProfiles: {
      youtube: {
        hoverDelayMs: 110,
        tooltipPlacement: "right",
        tooltipSize: "compact"
      },
      netflix: {
        hoverDelayMs: 150,
        tooltipPlacement: "top",
        tooltipSize: "balanced"
      },
      max: {
        hoverDelayMs: 175,
        tooltipPlacement: "left",
        tooltipSize: "compact"
      }
    }
  };

  if (!settings || typeof settings !== "object") {
    return base;
  }

  return {
    sourceLang: settings.sourceLang || base.sourceLang,
    targetLang: settings.targetLang || base.targetLang,
    siteProfiles: {
      ...base.siteProfiles,
      ...(settings.siteProfiles || {})
    }
  };
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
