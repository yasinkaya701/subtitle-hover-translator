const subtitleInput = document.getElementById("subtitle-input");
const subtitleFile = document.getElementById("subtitle-file");
const videoFile = document.getElementById("video-file");
const renderButton = document.getElementById("render-button");
const subtitleStage = document.getElementById("subtitle-stage");
const videoPlayer = document.getElementById("video-player");
const liveSubtitle = document.getElementById("live-subtitle");
const translationOutput = document.getElementById("translation-output");
const unknownWordsList = document.getElementById("unknown-words-list");
const hoverCard = document.getElementById("hover-card");
const hoverCardContent = document.getElementById("hover-card-content");
const saveHoveredWordButton = document.getElementById("save-hovered-word");
const sourceLanguageSelect = document.getElementById("source-language");
const targetLanguageSelect = document.getElementById("target-language");
const statusPill = document.getElementById("status-pill");

const translationCache = new Map();
let hoverTimeoutId = null;
let hideHoverTimeoutId = null;
let activeHoverPayload = null;
let unknownWords = [];
let subtitleCues = [];
let activeCueSignature = "";

const interactiveAreas = [subtitleStage, liveSubtitle];

renderButton.addEventListener("click", renderSubtitle);
subtitleInput.addEventListener("input", debounce(handleManualSubtitleInput, 250));
subtitleFile.addEventListener("change", handleSubtitleFileUpload);
videoFile.addEventListener("change", handleVideoFileUpload);
videoPlayer.addEventListener("timeupdate", syncLiveSubtitle);
videoPlayer.addEventListener("seeked", syncLiveSubtitle);
videoPlayer.addEventListener("loadedmetadata", syncLiveSubtitle);
interactiveAreas.forEach((area) => {
  area.addEventListener("mouseover", handleTokenHover);
  area.addEventListener("mouseout", handleTokenLeave);
  area.addEventListener("mousemove", moveHoverCard);
  area.addEventListener("mouseup", handleSelectionTranslate);
});
saveHoveredWordButton.addEventListener("click", saveActiveHoverPayload);
hoverCard.addEventListener("mouseenter", () => {
  clearTimeout(hideHoverTimeoutId);
});
hoverCard.addEventListener("mouseleave", scheduleHideHoverCard);
document.addEventListener("selectionchange", handleSelectionCleared);
document.addEventListener("click", (event) => {
  if (!hoverCard.contains(event.target) && !event.target.closest(".word-token")) {
    hideHoverCard();
  }
});

init();

async function init() {
  await refreshUnknownWords();
  renderSubtitle();
}

function renderSubtitle() {
  hideHoverCard();
  activeHoverPayload = null;
  subtitleStage.textContent = "";
  activeCueSignature = "";

  const cleanedText = cleanSubtitleText(subtitleInput.value);
  const lines = cleanedText.split("\n").filter((line) => line.trim());

  if (!lines.length) {
    subtitleStage.innerHTML = "<p class='empty-state'>Altyazi buraya islendikten sonra etkilesimli gorunur.</p>";
    renderLiveSubtitlePlaceholder("Video ve zamanli altyazi yuklediginde aktif satir burada gorunur.");
    updateStatus("Bos metin");
    return;
  }

  const fragment = document.createDocumentFragment();

  lines.forEach((line) => {
    const lineElement = document.createElement("p");
    lineElement.className = "subtitle-line";
    appendInteractiveTokens(lineElement, line);
    fragment.appendChild(lineElement);
  });

  subtitleStage.appendChild(fragment);
  syncLiveSubtitle();
  updateStatus(`${lines.length} satir hazir`);
}

function appendInteractiveTokens(container, line) {
  const wordPattern = /[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu;
  let lastIndex = 0;

  for (const match of line.matchAll(wordPattern)) {
    if (match.index > lastIndex) {
      container.append(line.slice(lastIndex, match.index));
    }

    const token = match[0];
    const span = document.createElement("span");
    span.className = "word-token";
    span.dataset.token = token;
    span.dataset.normalized = normalizeKey(token);
    span.textContent = token;

    if (isSavedToken(span.dataset.normalized)) {
      span.classList.add("saved-word");
    }

    container.appendChild(span);
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    container.append(line.slice(lastIndex));
  }
}

function handleManualSubtitleInput() {
  subtitleCues = [];
  renderSubtitle();
}

function handleSubtitleFileUpload(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  file.text().then((rawText) => {
    subtitleCues = parseTimedSubtitles(rawText);
    subtitleInput.value = cleanSubtitleText(rawText);
    renderSubtitle();
  });
}

function handleVideoFileUpload(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  const nextUrl = URL.createObjectURL(file);
  const previousUrl = videoPlayer.dataset.objectUrl;
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }

  videoPlayer.dataset.objectUrl = nextUrl;
  videoPlayer.src = nextUrl;
  videoPlayer.load();
  syncLiveSubtitle();
}

function cleanSubtitleText(rawText) {
  return rawText
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !/^\d+$/.test(trimmed) &&
        !/^\d{2}:\d{2}:\d{2}[,.:]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[,.:]\d{3}$/.test(trimmed) &&
        !/^WEBVTT$/i.test(trimmed)
      );
    })
    .join("\n");
}

function parseTimedSubtitles(rawText) {
  const normalized = rawText.replace(/\r/g, "").replace(/^WEBVTT\s*/i, "");

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (!lines.length) {
        return null;
      }

      if (/^\d+$/.test(lines[0])) {
        lines.shift();
      }

      const timeLine = lines.shift();
      if (!timeLine || !timeLine.includes("-->")) {
        return null;
      }

      const [startRaw, endRaw] = timeLine.split(/\s+-->\s+/);
      const text = lines
        .join(" ")
        .replace(/<[^>]+>/g, "")
        .trim();

      if (!text) {
        return null;
      }

      return {
        start: parseTimestamp(startRaw),
        end: parseTimestamp(endRaw),
        text
      };
    })
    .filter(Boolean);
}

function parseTimestamp(value) {
  const cleaned = value.replace(",", ".").trim();
  const [timePart] = cleaned.split(/\s+/);
  const pieces = timePart.split(":");

  if (pieces.length !== 3) {
    return 0;
  }

  const hours = Number.parseInt(pieces[0], 10);
  const minutes = Number.parseInt(pieces[1], 10);
  const seconds = Number.parseFloat(pieces[2]);
  return hours * 3600 + minutes * 60 + seconds;
}

function handleTokenHover(event) {
  const tokenElement = event.target.closest(".word-token");

  if (!tokenElement) {
    return;
  }

  clearTimeout(hoverTimeoutId);
  clearTimeout(hideHoverTimeoutId);
  hoverTimeoutId = setTimeout(async () => {
    try {
      const token = tokenElement.dataset.token;
      const translation = await fetchTranslation(token);
      activeHoverPayload = {
        sourceText: token,
        translatedText: translation.translatedText,
        sourceLang: sourceLanguageSelect.value,
        targetLang: targetLanguageSelect.value,
        context: tokenElement.parentElement?.textContent?.trim() || ""
      };
      showHoverCard(event, token, translation.translatedText);
      renderTranslationCard({
        title: `Kelime: ${token}`,
        sourceText: token,
        translatedText: translation.translatedText,
        sourceLang: translation.detectedSourceLanguage,
        canSave: true
      });
    } catch (error) {
      renderErrorCard("Kelime cevirisi alinamadi.");
      updateStatus("Ceviri hatasi");
    }
  }, 180);
}

function handleTokenLeave(event) {
  if (event.relatedTarget && hoverCard.contains(event.relatedTarget)) {
    return;
  }

  clearTimeout(hoverTimeoutId);
  scheduleHideHoverCard();
}

function moveHoverCard(event) {
  if (hoverCard.classList.contains("hidden")) {
    return;
  }

  const offset = 18;
  const cardWidth = 320;
  const maxLeft = window.innerWidth - cardWidth - 12;
  const nextLeft = Math.min(event.clientX + offset, maxLeft);
  const nextTop = Math.min(event.clientY + offset, window.innerHeight - hoverCard.offsetHeight - 12);

  hoverCard.style.left = `${Math.max(12, nextLeft)}px`;
  hoverCard.style.top = `${Math.max(12, nextTop)}px`;
}

async function handleSelectionTranslate() {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed) {
    return;
  }

  const selectedText = selection.toString().trim();
  if (!selectedText) {
    return;
  }

  const anchorNode = selection.anchorNode?.parentElement;
  if (!anchorNode || !isInInteractiveArea(anchorNode)) {
    return;
  }

  updateStatus("Secim cevriliyor");

  try {
    const translation = await fetchTranslation(selectedText);
    renderTranslationCard({
      title: "Secilen metin",
      sourceText: selectedText,
      translatedText: translation.translatedText,
      sourceLang: translation.detectedSourceLanguage,
      canSave: true
    });
  } catch (error) {
    renderErrorCard("Secim cevirisi alinamadi.");
  } finally {
    updateStatus("Hazir");
  }
}

function handleSelectionCleared() {
  const selection = window.getSelection();
  if (selection && selection.isCollapsed) {
    updateStatus("Hazir");
  }
}

function syncLiveSubtitle() {
  if (!subtitleCues.length) {
    renderLiveSubtitlePlaceholder("Canli altyazi icin zamanli .srt veya .vtt yukleyin.");
    return;
  }

  if (!videoPlayer.currentSrc) {
    renderLiveSubtitlePlaceholder("Simdi video yukle; oynarken aktif altyazi satiri burada akacak.");
    return;
  }

  const currentTime = videoPlayer.currentTime || 0;
  const activeCue = subtitleCues.find((cue) => currentTime >= cue.start && currentTime <= cue.end);

  if (!activeCue) {
    if (activeCueSignature !== "no-cue") {
      renderLiveSubtitlePlaceholder("Bu anda aktif altyazi yok.");
      activeCueSignature = "no-cue";
    }
    return;
  }

  const cueSignature = `${activeCue.start}-${activeCue.end}-${activeCue.text}`;
  if (cueSignature === activeCueSignature) {
    return;
  }

  activeCueSignature = cueSignature;
  liveSubtitle.classList.remove("empty-state");
  liveSubtitle.textContent = "";

  const lineElement = document.createElement("p");
  lineElement.className = "subtitle-line";
  appendInteractiveTokens(lineElement, activeCue.text);
  liveSubtitle.appendChild(lineElement);
}

function renderLiveSubtitlePlaceholder(message) {
  activeCueSignature = message;
  liveSubtitle.classList.add("empty-state");
  liveSubtitle.textContent = message;
}

async function fetchTranslation(text) {
  const source = sourceLanguageSelect.value;
  const target = targetLanguageSelect.value;
  const cacheKey = `${source}:${target}:${normalizeKey(text)}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  updateStatus("Ceviri aliniyor");

  const response = await fetch(
    `/api/translate?${new URLSearchParams({
      text,
      source,
      target
    }).toString()}`
  );

  if (!response.ok) {
    throw new Error("Translation request failed");
  }

  const payload = await response.json();
  translationCache.set(cacheKey, payload);
  updateStatus("Hazir");
  return payload;
}

function showHoverCard(event, token, translatedText) {
  hoverCardContent.innerHTML = `
    <p><strong>${escapeHtml(token)}</strong></p>
    <p>${escapeHtml(translatedText)}</p>
  `;
  hoverCard.classList.remove("hidden");
  moveHoverCard(event);
}

function hideHoverCard() {
  hoverCard.classList.add("hidden");
}

async function saveActiveHoverPayload() {
  if (!activeHoverPayload) {
    return;
  }

  await saveUnknownWord(activeHoverPayload);
  hideHoverCard();
}

async function saveUnknownWord(payload) {
  try {
    const response = await fetch("/api/unknown-words", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      renderErrorCard("Kelime kaydedilemedi.");
      return;
    }

    await refreshUnknownWords();
    renderSubtitle();
    updateStatus("Kaydedildi");
  } catch (error) {
    renderErrorCard("Kelime kaydedilemedi.");
    updateStatus("Kayit hatasi");
  }
}

async function refreshUnknownWords() {
  try {
    const response = await fetch("/api/unknown-words");
    const payload = await response.json();
    unknownWords = payload.entries || [];
    renderUnknownWordsList();
  } catch (error) {
    unknownWords = [];
    renderUnknownWordsList();
  }
}

function renderUnknownWordsList() {
  if (!unknownWords.length) {
    unknownWordsList.innerHTML = "Henuz kayit yok.";
    unknownWordsList.classList.add("empty-state");
    return;
  }

  unknownWordsList.classList.remove("empty-state");
  unknownWordsList.innerHTML = unknownWords
    .map(
      (entry) => `
        <article class="unknown-word-item">
          <h3>${escapeHtml(entry.sourceText)} -> ${escapeHtml(entry.translatedText)}</h3>
          <p>${escapeHtml(entry.context || "Baglam eklenmedi.")}</p>
          <time datetime="${escapeHtml(entry.savedAt)}">${new Date(entry.savedAt).toLocaleString("tr-TR")}</time>
        </article>
      `
    )
    .join("");
}

function renderTranslationCard({ title, sourceText, translatedText, sourceLang, canSave }) {
  translationOutput.classList.remove("empty-state");
  translationOutput.innerHTML = `
    <article class="translation-card">
      <h3>${escapeHtml(title)}</h3>
      <p><strong>Orijinal:</strong> ${escapeHtml(sourceText)}</p>
      <p><strong>Ceviri:</strong> ${escapeHtml(translatedText)}</p>
      <p class="translation-meta">Algilanan kaynak: ${escapeHtml(sourceLang || sourceLanguageSelect.value)}</p>
      ${
        canSave
          ? `<div class="translation-actions">
               <button class="primary-button" id="save-selection-button" type="button">Bilinmeyenlere ekle</button>
             </div>`
          : ""
      }
    </article>
  `;

  const saveSelectionButton = document.getElementById("save-selection-button");
  if (saveSelectionButton) {
    saveSelectionButton.addEventListener("click", () =>
      saveUnknownWord({
        sourceText,
        translatedText,
        sourceLang: sourceLang || sourceLanguageSelect.value,
        targetLang: targetLanguageSelect.value,
        context: sourceText
      })
    );
  }
}

function renderErrorCard(message) {
  translationOutput.classList.remove("empty-state");
  translationOutput.innerHTML = `
    <article class="translation-card">
      <h3>Hata</h3>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
}

function isSavedToken(normalizedToken) {
  return unknownWords.some((entry) => entry.id === normalizedToken);
}

function normalizeKey(value) {
  return value.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

function updateStatus(text) {
  statusPill.textContent = text;
}

function scheduleHideHoverCard() {
  clearTimeout(hideHoverTimeoutId);
  hideHoverTimeoutId = setTimeout(() => {
    hideHoverCard();
  }, 180);
}

function isInInteractiveArea(element) {
  return interactiveAreas.some((area) => area.contains(element));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function debounce(callback, delay) {
  let timeoutId = null;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}
