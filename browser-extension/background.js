const DEFAULT_SITE_PROFILE_SETTINGS = {
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
};

const DEFAULT_SETTINGS = {
  sourceLang: "auto",
  targetLang: "tr",
  siteProfiles: cloneDefaultSiteProfiles()
};

const SINGLE_WORD_REGEX = /^[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*$/u;
const IRREGULAR_VERB_FORMS = {
  be: { thirdPerson: "is", past: "was / were", gerund: "being" },
  do: { thirdPerson: "does", past: "did", gerund: "doing" },
  get: { thirdPerson: "gets", past: "got", gerund: "getting" },
  go: { thirdPerson: "goes", past: "went", gerund: "going" },
  have: { thirdPerson: "has", past: "had", gerund: "having" },
  make: { thirdPerson: "makes", past: "made", gerund: "making" },
  run: { thirdPerson: "runs", past: "ran", gerund: "running" },
  say: { thirdPerson: "says", past: "said", gerund: "saying" },
  see: { thirdPerson: "sees", past: "saw", gerund: "seeing" },
  take: { thirdPerson: "takes", past: "took", gerund: "taking" },
  write: { thirdPerson: "writes", past: "wrote", gerund: "writing" }
};
const IRREGULAR_NOUN_PLURALS = {
  child: "children",
  foot: "feet",
  goose: "geese",
  man: "men",
  mouse: "mice",
  person: "people",
  tooth: "teeth",
  woman: "women"
};
const IRREGULAR_ADJECTIVE_FORMS = {
  bad: { comparative: "worse", superlative: "worst" },
  far: { comparative: "farther", superlative: "farthest" },
  good: { comparative: "better", superlative: "best" },
  little: { comparative: "less", superlative: "least" }
};

const STORAGE_KEYS = {
  settings: "settings",
  unknownWords: "unknownWords",
  disabledTabs: "disabledTabs"
};

const REVIEW_OUTCOME_CONFIG = {
  again: { nextHours: 0.15, streak: 0, status: "learning", correctDelta: 0 },
  hard: { nextHours: 12, streakDelta: 1, status: "learning", correctDelta: 1 },
  easy: { nextHours: 72, streakDelta: 1, status: "known", correctDelta: 1 }
};

const extensionApi = globalThis.browser || globalThis.chrome;
const sessionStorageArea = extensionApi.storage.session || extensionApi.storage.local;

extensionApi.runtime.onInstalled.addListener(async () => {
  const current = await extensionApi.storage.local.get([
    STORAGE_KEYS.settings,
    STORAGE_KEYS.unknownWords
  ]);

  await extensionApi.storage.local.set({
    [STORAGE_KEYS.settings]: normalizeSettings(current[STORAGE_KEYS.settings])
  });

  if (!Array.isArray(current[STORAGE_KEYS.unknownWords])) {
    await extensionApi.storage.local.set({
      [STORAGE_KEYS.unknownWords]: []
    });
  }

  await sessionStorageArea.set({
    [STORAGE_KEYS.disabledTabs]: {}
  });
});

extensionApi.tabs.onRemoved.addListener(async (tabId) => {
  const disabledTabs = await getDisabledTabs();
  if (disabledTabs[tabId]) {
    delete disabledTabs[tabId];
    await sessionStorageArea.set({
      [STORAGE_KEYS.disabledTabs]: disabledTabs
    });
  }
});

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      console.error("Extension error:", error);
      sendResponse({
        ok: false,
        error: error.message || "Unexpected extension error"
      });
    });

  return true;
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case "GET_STATE":
      return handleGetState(message.tabId ?? sender.tab?.id);
    case "SET_TAB_ENABLED":
      return handleSetTabEnabled(message.tabId, Boolean(message.enabled));
    case "UPDATE_SETTINGS":
      return handleUpdateSettings(message.settings, message.tabId);
    case "TRANSLATE_TEXT":
      return {
        translation: await translateText(
          message.text,
          message.sourceLang,
          message.targetLang
        )
      };
    case "SAVE_UNKNOWN_WORD":
      return {
        entry: await saveUnknownWord(message.payload, sender)
      };
    case "GET_UNKNOWN_WORDS":
      return {
        entries: await getUnknownWords()
      };
    case "UPDATE_UNKNOWN_WORD_REVIEW":
      return {
        entry: await updateUnknownWordReview(message.entryId, message.outcome)
      };
    case "CLEAR_UNKNOWN_WORDS":
      await extensionApi.storage.local.set({
        [STORAGE_KEYS.unknownWords]: []
      });
      return { entries: [] };
    default:
      throw new Error(`Unsupported message type: ${message.type}`);
  }
}

async function handleGetState(tabId) {
  const [settings, disabledTabs] = await Promise.all([
    getSettings(),
    getDisabledTabs()
  ]);

  return {
    state: {
      settings,
      enabled: tabId ? !Boolean(disabledTabs[tabId]) : true
    }
  };
}

async function handleSetTabEnabled(tabId, enabled) {
  if (!tabId) {
    throw new Error("tabId is required");
  }

  const disabledTabs = await getDisabledTabs();

  if (enabled) {
    delete disabledTabs[tabId];
  } else {
    disabledTabs[tabId] = true;
  }

  await sessionStorageArea.set({
    [STORAGE_KEYS.disabledTabs]: disabledTabs
  });

  await updateBadge(tabId, enabled);
  await notifyTab(tabId, {
    type: "STATE_UPDATED",
    enabled
  });

  return {
    state: {
      enabled,
      settings: await getSettings()
    }
  };
}

async function handleUpdateSettings(partialSettings, tabId) {
  const currentSettings = await getSettings();
  const nextSettings = mergeSettings(currentSettings, partialSettings);

  await extensionApi.storage.local.set({
    [STORAGE_KEYS.settings]: nextSettings
  });

  if (tabId) {
    await notifyTab(tabId, {
      type: "SETTINGS_UPDATED",
      settings: nextSettings
    });
  }

  return { settings: nextSettings };
}

async function translateText(text, sourceLang = "auto", targetLang = "tr") {
  if (!text || !text.trim()) {
    throw new Error("text is required");
  }

  const normalizedText = text.trim();
  const query = new URL("https://translate.googleapis.com/translate_a/single");
  query.searchParams.set("client", "gtx");
  query.searchParams.set("sl", sourceLang);
  query.searchParams.set("tl", targetLang);
  query.searchParams.set("dt", "t");
  query.searchParams.append("dt", "bd");
  query.searchParams.append("dt", "md");
  query.searchParams.append("dt", "ss");
  query.searchParams.append("dt", "ex");
  query.searchParams.set("q", normalizedText);

  const response = await fetch(query.toString());

  if (!response.ok) {
    throw new Error(`Translation failed with status ${response.status}`);
  }

  const payload = await response.json();
  const translatedText = Array.isArray(payload[0])
    ? payload[0].map((part) => part[0]).join("")
    : "";

  if (!translatedText) {
    throw new Error("Empty translation result");
  }

  const detectedSourceLanguage = payload[2] || sourceLang;
  const details = isDictionaryLookupCandidate(normalizedText)
    ? buildTranslationDetails(payload, normalizedText, detectedSourceLanguage)
    : emptyTranslationDetails();

  return {
    sourceText: normalizedText,
    translatedText,
    detectedSourceLanguage,
    provider: "google-translate-web",
    details
  };
}

function isDictionaryLookupCandidate(text) {
  const normalizedText = safeText(text);
  if (!normalizedText) {
    return false;
  }

  if (SINGLE_WORD_REGEX.test(normalizedText)) {
    return true;
  }

  const parts = normalizedText.split(/\s+/).filter(Boolean);
  return (
    parts.length >= 2 &&
    parts.length <= 4 &&
    parts.every((part) => SINGLE_WORD_REGEX.test(part))
  );
}

function buildTranslationDetails(payload, sourceText, detectedSourceLanguage) {
  const detailedMeanings = parseDetailedMeanings(payload[1]);
  const synonymsResult = parseSynonyms(payload[11], sourceText);
  const dictionaryDefinitions = parseDictionaryDefinitions(payload[12]);
  const headword =
    dictionaryDefinitions[0]?.headword ||
    synonymsResult.headword ||
    sourceText;
  const partOfSpeech =
    dictionaryDefinitions[0]?.partOfSpeech ||
    detailedMeanings[0]?.partOfSpeech ||
    "";

  return {
    headword,
    partOfSpeech,
    detailedMeanings,
    synonyms: synonymsResult.synonyms,
    wordForms: buildWordForms(headword, partOfSpeech, detectedSourceLanguage),
    dictionaryDefinitions,
    examples: parseExampleSentences(payload[12]),
    phraseMatches: []
  };
}

function emptyTranslationDetails() {
  return {
    headword: "",
    partOfSpeech: "",
    detailedMeanings: [],
    synonyms: [],
    wordForms: [],
    dictionaryDefinitions: [],
    examples: [],
    phraseMatches: []
  };
}

function sanitizeTranslationDetails(details) {
  if (!details || typeof details !== "object") {
    return emptyTranslationDetails();
  }

  return {
    headword: safeText(details.headword),
    partOfSpeech: safeText(details.partOfSpeech),
    detailedMeanings: Array.isArray(details.detailedMeanings)
      ? details.detailedMeanings
          .map((group) => ({
            partOfSpeech: safeText(group?.partOfSpeech),
            meanings: Array.isArray(group?.meanings)
              ? group.meanings.map(safeText).filter(Boolean).slice(0, 3)
              : []
          }))
          .filter((group) => group.partOfSpeech && group.meanings.length)
          .slice(0, 3)
      : [],
    synonyms: Array.isArray(details.synonyms)
      ? details.synonyms.map(safeText).filter(Boolean).slice(0, 3)
      : [],
    wordForms: Array.isArray(details.wordForms)
      ? details.wordForms
          .map((entry) => ({
            label: safeText(entry?.label),
            value: safeText(entry?.value)
          }))
          .filter((entry) => entry.label && entry.value)
          .slice(0, 4)
      : [],
    dictionaryDefinitions: Array.isArray(details.dictionaryDefinitions)
      ? details.dictionaryDefinitions
          .map((entry) => ({
            partOfSpeech: safeText(entry?.partOfSpeech),
            definition: safeText(entry?.definition),
            headword: safeText(entry?.headword),
            example: safeText(entry?.example)
          }))
          .filter((entry) => entry.definition)
          .slice(0, 3)
      : [],
    examples: Array.isArray(details.examples)
      ? details.examples.map(safeText).filter(Boolean).slice(0, 4)
      : [],
    phraseMatches: Array.isArray(details.phraseMatches)
      ? details.phraseMatches
          .map((entry) => ({
            text: safeText(entry?.text),
            translatedText: safeText(entry?.translatedText),
            partOfSpeech: safeText(entry?.partOfSpeech),
            examples: Array.isArray(entry?.examples)
              ? entry.examples.map(safeText).filter(Boolean).slice(0, 2)
              : []
          }))
          .filter((entry) => entry.text && entry.translatedText)
          .slice(0, 2)
      : []
  };
}

function parseDetailedMeanings(rawDictionaryEntries) {
  if (!Array.isArray(rawDictionaryEntries)) {
    return [];
  }

  return rawDictionaryEntries
    .map((entry) => {
      const partOfSpeech = safeText(Array.isArray(entry) ? entry[0] : "");
      const meanings = Array.isArray(entry?.[1])
        ? entry[1].map(safeText).filter(Boolean).slice(0, 3)
        : [];

      if (!partOfSpeech || !meanings.length) {
        return null;
      }

      return {
        partOfSpeech,
        meanings
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

function parseSynonyms(rawSynonymGroups, sourceText) {
  const synonyms = [];
  const seen = new Set();
  let headword = "";
  const normalizedSource = normalizeLexeme(sourceText);

  if (!Array.isArray(rawSynonymGroups)) {
    return { headword, synonyms };
  }

  for (const group of rawSynonymGroups) {
    if (!headword) {
      headword = safeText(Array.isArray(group) ? group[2] : "");
    }

    const clusters = Array.isArray(group?.[1]) ? group[1] : [];
    for (const cluster of clusters) {
      const candidates = Array.isArray(cluster?.[0]) ? cluster[0] : [];
      for (const candidate of candidates) {
        const normalizedCandidate = normalizeLexeme(candidate);
        if (
          !normalizedCandidate ||
          normalizedCandidate === normalizedSource ||
          seen.has(normalizedCandidate)
        ) {
          continue;
        }

        seen.add(normalizedCandidate);
        synonyms.push(String(candidate).trim());
        if (synonyms.length >= 3) {
          return { headword, synonyms };
        }
      }
    }
  }

  return { headword, synonyms };
}

function parseDictionaryDefinitions(rawDefinitionGroups) {
  const definitions = [];

  if (!Array.isArray(rawDefinitionGroups)) {
    return definitions;
  }

  for (const group of rawDefinitionGroups) {
    const partOfSpeech = safeText(Array.isArray(group) ? group[0] : "");
    const headword = safeText(Array.isArray(group) ? group[2] : "");
    const entries = Array.isArray(group?.[1]) ? group[1] : [];

    for (const entry of entries) {
      const definition = safeText(Array.isArray(entry) ? entry[0] : "");
      if (!definition) {
        continue;
      }

      definitions.push({
        partOfSpeech,
        definition,
        headword,
        example: safeText(Array.isArray(entry) ? entry[2] : "")
      });

      if (definitions.length >= 3) {
        return definitions;
      }
    }
  }

  return definitions;
}

function parseExampleSentences(rawDefinitionGroups) {
  const examples = [];
  const seen = new Set();

  if (!Array.isArray(rawDefinitionGroups)) {
    return examples;
  }

  for (const group of rawDefinitionGroups) {
    const entries = Array.isArray(group?.[1]) ? group[1] : [];
    for (const entry of entries) {
      const example = safeText(Array.isArray(entry) ? entry[2] : "");
      const key = normalizeKey(example);
      if (!example || seen.has(key)) {
        continue;
      }

      seen.add(key);
      examples.push(example);
      if (examples.length >= 3) {
        return examples;
      }
    }
  }

  return examples;
}

function buildWordForms(headword, partOfSpeech, language) {
  if (!headword || !String(language || "").toLowerCase().startsWith("en")) {
    return [];
  }

  const normalizedHeadword = headword.trim();
  const normalizedPartOfSpeech = String(partOfSpeech || "").toLowerCase();

  if (!/^[A-Za-z][A-Za-z'’-]*$/.test(normalizedHeadword)) {
    return [];
  }

  if (normalizedPartOfSpeech === "verb") {
    const lower = normalizedHeadword.toLowerCase();
    const irregular = IRREGULAR_VERB_FORMS[lower] || {};
    return compactWordForms([
      { label: "base", value: normalizedHeadword },
      { label: "3rd sg", value: irregular.thirdPerson || inflectThirdPerson(normalizedHeadword) },
      { label: "past", value: irregular.past || inflectPast(normalizedHeadword) },
      { label: "-ing", value: irregular.gerund || inflectGerund(normalizedHeadword) }
    ]);
  }

  if (normalizedPartOfSpeech === "noun") {
    return compactWordForms([
      { label: "singular", value: normalizedHeadword },
      {
        label: "plural",
        value:
          IRREGULAR_NOUN_PLURALS[normalizedHeadword.toLowerCase()] ||
          inflectPlural(normalizedHeadword)
      }
    ]);
  }

  if (normalizedPartOfSpeech === "adjective" || normalizedPartOfSpeech === "adverb") {
    const lower = normalizedHeadword.toLowerCase();
    const irregular = IRREGULAR_ADJECTIVE_FORMS[lower] || {};
    return compactWordForms([
      { label: "base", value: normalizedHeadword },
      {
        label: "comparative",
        value: irregular.comparative || inflectComparative(normalizedHeadword)
      },
      {
        label: "superlative",
        value: irregular.superlative || inflectSuperlative(normalizedHeadword)
      }
    ]);
  }

  return [];
}

function compactWordForms(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    const label = safeText(entry.label);
    const value = safeText(entry.value);
    if (!label || !value) {
      return false;
    }

    const key = `${label}:${normalizeLexeme(value)}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    entry.label = label;
    entry.value = value;
    return true;
  });
}

function inflectThirdPerson(word) {
  const lower = word.toLowerCase();
  if (/(s|x|z|ch|sh|o)$/.test(lower)) {
    return `${word}es`;
  }

  if (endsWithConsonantY(lower)) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function inflectPast(word) {
  const lower = word.toLowerCase();
  if (lower.endsWith("e")) {
    return `${word}d`;
  }

  if (endsWithConsonantY(lower)) {
    return `${word.slice(0, -1)}ied`;
  }

  if (shouldDoubleFinalConsonant(lower)) {
    return `${word}${word.slice(-1)}ed`;
  }

  return `${word}ed`;
}

function inflectGerund(word) {
  const lower = word.toLowerCase();
  if (lower.endsWith("ie")) {
    return `${word.slice(0, -2)}ying`;
  }

  if (lower.endsWith("e") && !lower.endsWith("ee")) {
    return `${word.slice(0, -1)}ing`;
  }

  if (shouldDoubleFinalConsonant(lower)) {
    return `${word}${word.slice(-1)}ing`;
  }

  return `${word}ing`;
}

function inflectPlural(word) {
  const lower = word.toLowerCase();
  if (/(s|x|z|ch|sh)$/.test(lower)) {
    return `${word}es`;
  }

  if (endsWithConsonantY(lower)) {
    return `${word.slice(0, -1)}ies`;
  }

  return `${word}s`;
}

function inflectComparative(word) {
  const lower = word.toLowerCase();
  if (endsWithConsonantY(lower)) {
    return `${word.slice(0, -1)}ier`;
  }

  if (shouldDoubleFinalConsonant(lower)) {
    return `${word}${word.slice(-1)}er`;
  }

  if (lower.endsWith("e")) {
    return `${word}r`;
  }

  return `${word}er`;
}

function inflectSuperlative(word) {
  const lower = word.toLowerCase();
  if (endsWithConsonantY(lower)) {
    return `${word.slice(0, -1)}iest`;
  }

  if (shouldDoubleFinalConsonant(lower)) {
    return `${word}${word.slice(-1)}est`;
  }

  if (lower.endsWith("e")) {
    return `${word}st`;
  }

  return `${word}est`;
}

function endsWithConsonantY(word) {
  return /[^aeiou]y$/i.test(word);
}

function shouldDoubleFinalConsonant(word) {
  return (
    word.length >= 3 &&
    !/[wxy]$/i.test(word) &&
    /[aeiou][^aeiou]$/i.test(word) &&
    !/[aeiou][^aeiou]{2}$/i.test(word)
  );
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLexeme(value) {
  return safeText(value).toLocaleLowerCase("en-US");
}

function cloneDefaultSiteProfiles() {
  return JSON.parse(JSON.stringify(DEFAULT_SITE_PROFILE_SETTINGS));
}

function normalizeSettings(settings) {
  const normalized = {
    sourceLang: safeText(settings?.sourceLang) || DEFAULT_SETTINGS.sourceLang,
    targetLang: safeText(settings?.targetLang) || DEFAULT_SETTINGS.targetLang,
    siteProfiles: cloneDefaultSiteProfiles()
  };

  const rawProfiles = settings?.siteProfiles;
  if (rawProfiles && typeof rawProfiles === "object") {
    for (const siteId of Object.keys(DEFAULT_SITE_PROFILE_SETTINGS)) {
      normalized.siteProfiles[siteId] = normalizeSiteProfileSettings(
        rawProfiles[siteId],
        DEFAULT_SITE_PROFILE_SETTINGS[siteId]
      );
    }
  }

  return normalized;
}

function mergeSettings(currentSettings, partialSettings) {
  const normalizedCurrent = normalizeSettings(currentSettings);
  const normalizedPartial = partialSettings && typeof partialSettings === "object"
    ? partialSettings
    : {};

  return normalizeSettings({
    ...normalizedCurrent,
    ...normalizedPartial,
    siteProfiles: {
      ...normalizedCurrent.siteProfiles,
      ...(normalizedPartial.siteProfiles || {})
    }
  });
}

function normalizeSiteProfileSettings(settings, defaults) {
  const normalizedDefaults = defaults || {};
  const hoverDelayMs = Number(settings?.hoverDelayMs);
  const tooltipPlacement = safeText(settings?.tooltipPlacement) || normalizedDefaults.tooltipPlacement;
  const tooltipSize = safeText(settings?.tooltipSize) || normalizedDefaults.tooltipSize;

  return {
    hoverDelayMs:
      Number.isFinite(hoverDelayMs) && hoverDelayMs >= 60 && hoverDelayMs <= 400
        ? Math.round(hoverDelayMs)
        : normalizedDefaults.hoverDelayMs || 140,
    tooltipPlacement: ["auto", "right", "left", "top", "bottom"].includes(tooltipPlacement)
      ? tooltipPlacement
      : normalizedDefaults.tooltipPlacement || "auto",
    tooltipSize: ["compact", "balanced", "wide"].includes(tooltipSize)
      ? tooltipSize
      : normalizedDefaults.tooltipSize || "balanced"
  };
}

function buildInitialReviewState(previousReview) {
  return {
    reviewCount: Number(previousReview?.reviewCount) || 0,
    correctCount: Number(previousReview?.correctCount) || 0,
    streak: Number(previousReview?.streak) || 0,
    status: safeText(previousReview?.status) || "new",
    lastOutcome: safeText(previousReview?.lastOutcome),
    lastReviewedAt: safeText(previousReview?.lastReviewedAt),
    nextReviewAt: safeText(previousReview?.nextReviewAt)
  };
}

async function saveUnknownWord(payload, sender) {
  if (!payload?.sourceText || !payload?.translatedText) {
    throw new Error("sourceText and translatedText are required");
  }

  const entries = await getUnknownWords();
  const entryId = buildEntryId(payload.sourceText, payload.targetLang);
  const existingEntry = entries.find((entry) => entry.id === entryId);
  const nextEntry = {
    id: entryId,
    sourceText: payload.sourceText.trim(),
    translatedText: payload.translatedText.trim(),
    sourceLang: (payload.sourceLang || "auto").trim(),
    targetLang: (payload.targetLang || "tr").trim(),
    context: (payload.context || "").trim(),
    details: sanitizeTranslationDetails(payload.details),
    hostname: safeHostname(sender.tab?.url),
    pageUrl: sender.tab?.url || "",
    savedAt: new Date().toISOString(),
    review: buildInitialReviewState(existingEntry?.review)
  };

  const dedupedEntries = entries.filter((entry) => entry.id !== nextEntry.id);
  dedupedEntries.unshift(nextEntry);

  await extensionApi.storage.local.set({
    [STORAGE_KEYS.unknownWords]: dedupedEntries.slice(0, 500)
  });

  return nextEntry;
}

async function updateUnknownWordReview(entryId, outcome) {
  const normalizedOutcome = safeText(outcome).toLowerCase();
  const config = REVIEW_OUTCOME_CONFIG[normalizedOutcome];
  if (!entryId || !config) {
    throw new Error("Valid entryId and outcome are required");
  }

  const entries = await getUnknownWords();
  const entryIndex = entries.findIndex((entry) => entry.id === entryId);
  if (entryIndex < 0) {
    throw new Error("Entry not found");
  }

  const now = new Date();
  const nextReviewAt = new Date(now.getTime() + config.nextHours * 60 * 60 * 1000);
  const currentReview = buildInitialReviewState(entries[entryIndex].review);
  const review = {
    ...currentReview,
    reviewCount: currentReview.reviewCount + 1,
    correctCount: currentReview.correctCount + config.correctDelta,
    streak: config.streak ?? currentReview.streak + (config.streakDelta || 0),
    status: config.status,
    lastOutcome: normalizedOutcome,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: nextReviewAt.toISOString()
  };

  const nextEntry = {
    ...entries[entryIndex],
    review
  };

  const nextEntries = [...entries];
  nextEntries[entryIndex] = nextEntry;

  await extensionApi.storage.local.set({
    [STORAGE_KEYS.unknownWords]: nextEntries
  });

  return nextEntry;
}

async function getSettings() {
  const result = await extensionApi.storage.local.get(STORAGE_KEYS.settings);
  return normalizeSettings(result[STORAGE_KEYS.settings]);
}

async function getUnknownWords() {
  const result = await extensionApi.storage.local.get(STORAGE_KEYS.unknownWords);
  return Array.isArray(result[STORAGE_KEYS.unknownWords])
    ? result[STORAGE_KEYS.unknownWords].map((entry) => ({
        ...entry,
        details: sanitizeTranslationDetails(entry?.details),
        review: buildInitialReviewState(entry?.review)
      }))
    : [];
}

async function getDisabledTabs() {
  const result = await sessionStorageArea.get(STORAGE_KEYS.disabledTabs);
  return result[STORAGE_KEYS.disabledTabs] || {};
}

async function updateBadge(tabId, enabled) {
  if (!extensionApi.action?.setBadgeText) {
    return;
  }

  await extensionApi.action.setBadgeText({
    tabId,
    text: enabled ? "" : "OFF"
  });

  await extensionApi.action.setBadgeBackgroundColor({
    tabId,
    color: enabled ? "#b45732" : "#6f6259"
  });
}

async function notifyTab(tabId, message) {
  if (!tabId) {
    return;
  }

  try {
    await extensionApi.tabs.sendMessage(tabId, message);
  } catch (error) {
    // Content script might not be ready on this tab yet.
  }
}

function buildEntryId(sourceText, targetLang = "tr") {
  return `${normalizeKey(sourceText)}::${targetLang}`;
}

function normalizeKey(value) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ");
}

function safeHostname(url) {
  try {
    return url ? new URL(url).hostname : "";
  } catch (error) {
    return "";
  }
}
