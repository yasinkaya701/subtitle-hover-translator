const DEFAULT_SITE_PROFILE_SETTINGS = {
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
};

const DEFAULT_SETTINGS = {
  sourceLang: "auto",
  targetLang: "tr",
  displayMode: "auto",
  uiTheme: "aurora",
  subtitleHistoryLimit: 10,
  syncWordPool: Boolean(globalThis.browser?.storage?.sync || globalThis.chrome?.storage?.sync),
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
  disabledTabs: "disabledTabs",
  sharedWordPool: "sharedWordPool",
  subtitleHistory: "subtitleHistory"
};

const REVIEW_OUTCOME_CONFIG = {
  again: { nextHours: 0.15, streak: 0, status: "learning", correctDelta: 0 },
  hard: { nextHours: 12, streakDelta: 1, status: "learning", correctDelta: 1 },
  easy: { nextHours: 72, streakDelta: 1, status: "known", correctDelta: 1 }
};
const TRANSLATE_FETCH_TIMEOUT_MS = 4500;
const TRANSLATE_FETCH_RETRIES = 1;
const TRANSLATE_FETCH_RETRY_DELAY_MS = 220;
const TRANSLATE_FAST_TIMEOUT_MS = 2600;
const TRANSLATE_FAST_RETRIES = 0;
const TRANSLATE_FAST_RETRY_DELAY_MS = 140;
const LEXICON_FETCH_TIMEOUT_MS = 1600;
const LEXICON_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const LEXICON_CACHE_MAX = 320;
const CONTEXT_TARGET_MARKER = "[[*]]";
const CONTEXT_TARGET_MARKER_END = "[[/]]";
const MAX_CONTEXT_PHRASE_CANDIDATES = 2;

const extensionApi = globalThis.browser || globalThis.chrome;
const sessionStorageArea = extensionApi.storage.session || extensionApi.storage.local;
const syncStorageArea = extensionApi.storage.sync || null;
const lexiconCache = new Map();

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
    [STORAGE_KEYS.disabledTabs]: {},
    [STORAGE_KEYS.subtitleHistory]: {}
  });

  if (syncStorageArea) {
    const syncCurrent = await syncStorageArea.get(STORAGE_KEYS.sharedWordPool);
    if (!Array.isArray(syncCurrent[STORAGE_KEYS.sharedWordPool])) {
      await syncStorageArea.set({
        [STORAGE_KEYS.sharedWordPool]: []
      });
    }
  }
});

extensionApi.tabs.onRemoved.addListener(async (tabId) => {
  const [disabledTabs, subtitleHistory] = await Promise.all([
    getDisabledTabs(),
    getSubtitleHistoryMap()
  ]);

  let changed = false;
  if (disabledTabs[tabId]) {
    delete disabledTabs[tabId];
    changed = true;
  }

  if (subtitleHistory[tabId]) {
    delete subtitleHistory[tabId];
    changed = true;
  }

  if (changed) {
    await sessionStorageArea.set({
      [STORAGE_KEYS.disabledTabs]: disabledTabs,
      [STORAGE_KEYS.subtitleHistory]: subtitleHistory
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
          message.targetLang,
          {
            mode: message.mode,
            contextText: message.contextText,
            markedContextText: message.markedContextText,
            phraseCandidates: message.phraseCandidates,
            requestKey: message.requestKey,
            tabId: sender?.tab?.id
          }
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
    case "GET_SUBTITLE_HISTORY":
      return {
        history: await getSubtitleHistory(message.tabId ?? sender.tab?.id)
      };
    case "UPDATE_SUBTITLE_HISTORY":
      return {
        history: await updateSubtitleHistory(message.tabId ?? sender.tab?.id, message.items)
      };
    case "UPDATE_UNKNOWN_WORD_REVIEW":
      return {
        entry: await updateUnknownWordReview(message.entryId, message.outcome)
      };
    case "CAPTURE_VISIBLE_TAB":
      return {
        imageDataUrl: await captureVisibleTab(sender)
      };
    case "CLEAR_UNKNOWN_WORDS":
      await extensionApi.storage.local.set({
        [STORAGE_KEYS.unknownWords]: []
      });
      if (syncStorageArea) {
        await syncStorageArea.set({
          [STORAGE_KEYS.sharedWordPool]: []
        });
      }
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
      enabled: tabId ? !Boolean(disabledTabs[tabId]) : true,
      capabilities: getRuntimeCapabilities()
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

  await notifyAllTabs({
    type: "SETTINGS_UPDATED",
    settings: nextSettings,
    capabilities: getRuntimeCapabilities()
  });

  return { settings: nextSettings };
}

async function translateText(text, sourceLang = "auto", targetLang = "tr", options = {}) {
  if (!text || !text.trim()) {
    throw new Error("text is required");
  }

  const normalizedText = text.trim();
  const translatePolicy = resolveTranslatePolicy(options?.mode);
  const baseResult = await fetchGoogleTranslation(
    normalizedText,
    sourceLang,
    targetLang,
    translatePolicy
  );
  const { payload } = baseResult;
  const detectedSourceLanguage = baseResult.detectedSourceLanguage;
  const dictionaryDetails = isDictionaryLookupCandidate(normalizedText)
    ? buildTranslationDetails(payload, normalizedText, detectedSourceLanguage)
    : emptyTranslationDetails();

  const baseDetails = sanitizeTranslationDetails({
    ...dictionaryDetails,
    phraseMatches: [],
    grammarBreakdown: buildGrammarBreakdown(
      normalizedText,
      baseResult.translatedText,
      detectedSourceLanguage
    ),
    contextInsights: buildContextInsights(
      normalizedText,
      baseResult.translatedText,
      detectedSourceLanguage,
      dictionaryDetails,
      {
        contextualGloss: "",
        baseTranslatedText: baseResult.translatedText
      }
    ),
    pronunciation: buildPronunciationDetails(normalizedText, detectedSourceLanguage)
  });

  const baseTranslation = {
    sourceText: normalizedText,
    translatedText: baseResult.translatedText,
    detectedSourceLanguage,
    provider: "google-translate-web",
    details: baseDetails,
    requestKey: safeText(options?.requestKey)
  };

  const tabId = Number.isInteger(options?.tabId) ? options.tabId : null;
  if (tabId) {
    void buildEnrichedTranslation(
      normalizedText,
      baseResult,
      dictionaryDetails,
      detectedSourceLanguage,
      targetLang,
      {
        ...options,
        translatePolicy: resolveTranslatePolicy(options?.mode)
      }
    )
      .then((enrichedTranslation) => {
        if (shouldDispatchEnrichedTranslation(baseTranslation, enrichedTranslation)) {
          notifyTab(tabId, {
            type: "TRANSLATION_ENRICHED",
            translation: enrichedTranslation,
            requestKey: enrichedTranslation.requestKey
          });
        }
      })
      .catch((err) => {
        console.warn("Async enrichment failed:", err);
      });

    return baseTranslation;
  }

  try {
    return await buildEnrichedTranslation(
      normalizedText,
      baseResult,
      dictionaryDetails,
      detectedSourceLanguage,
      targetLang,
      {
        ...options,
        translatePolicy: resolveTranslatePolicy(options?.mode)
      }
    );
  } catch (error) {
    console.error("Enriched translation failed, falling back:", error);
    return baseTranslation;
  }
}

function resolveTranslatePolicy(mode) {
  const normalizedMode = safeText(mode).toLowerCase();
  if (normalizedMode === "hover") {
    return {
      timeoutMs: TRANSLATE_FAST_TIMEOUT_MS,
      retries: TRANSLATE_FAST_RETRIES,
      retryDelayMs: TRANSLATE_FAST_RETRY_DELAY_MS
    };
  }

  return {
    timeoutMs: TRANSLATE_FETCH_TIMEOUT_MS,
    retries: TRANSLATE_FETCH_RETRIES,
    retryDelayMs: TRANSLATE_FETCH_RETRY_DELAY_MS
  };
}

async function buildEnrichedTranslation(
  normalizedText,
  baseResult,
  dictionaryDetails,
  detectedSourceLanguage,
  targetLang,
  options = {}
) {
  const translatePolicy = options?.translatePolicy || resolveTranslatePolicy(options?.mode);
  const [contextTranslation, enrichedDetails] = await Promise.all([
    buildContextAwareTranslation(
      normalizedText,
      detectedSourceLanguage,
      targetLang,
      options,
      translatePolicy
    ),
    enrichTranslationDetails(dictionaryDetails, normalizedText, detectedSourceLanguage)
  ]);
  const finalTranslatedText = contextTranslation.contextualGloss || baseResult.translatedText;
  const lexiconBoosted = Boolean(enrichedDetails?.__lexiconBoosted);
  const details = sanitizeTranslationDetails({
    ...enrichedDetails,
    phraseMatches: contextTranslation.phraseMatches,
    grammarBreakdown: buildGrammarBreakdown(
      normalizedText,
      finalTranslatedText,
      detectedSourceLanguage
    ),
    contextInsights: buildContextInsights(
      normalizedText,
      finalTranslatedText,
      detectedSourceLanguage,
      enrichedDetails,
      {
        contextualGloss: contextTranslation.contextualGloss,
        baseTranslatedText: baseResult.translatedText
      }
    ),
    pronunciation: buildPronunciationDetails(normalizedText, detectedSourceLanguage)
  });

  return {
    sourceText: normalizedText,
    translatedText: finalTranslatedText,
    detectedSourceLanguage,
    provider: lexiconBoosted
      ? contextTranslation.contextualGloss
        ? "google-translate-web+context+lexicon"
        : "google-translate-web+lexicon"
      : contextTranslation.contextualGloss
        ? "google-translate-web+context"
        : "google-translate-web",
    details,
    requestKey: safeText(options?.requestKey)
  };
}

function shouldDispatchEnrichedTranslation(baseTranslation, enrichedTranslation) {
  if (!enrichedTranslation) {
    return false;
  }

  if (safeText(enrichedTranslation.translatedText) !== safeText(baseTranslation.translatedText)) {
    return true;
  }

  if (enrichedTranslation.provider !== baseTranslation.provider) {
    return true;
  }

  const baseDetails = baseTranslation.details || {};
  const enrichedDetails = enrichedTranslation.details || {};
  const counts = [
    ["dictionaryDefinitions", 0],
    ["synonyms", 0],
    ["examples", 0],
    ["phraseMatches", 0],
    ["wordForms", 0]
  ];

  return counts.some(([key, fallback]) => {
    const baseCount = Array.isArray(baseDetails[key]) ? baseDetails[key].length : fallback;
    const enrichedCount = Array.isArray(enrichedDetails[key]) ? enrichedDetails[key].length : fallback;
    return enrichedCount > baseCount;
  });
}

async function fetchGoogleTranslation(text, sourceLang = "auto", targetLang = "tr", requestPolicy = {}) {
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

  const response = await fetchWithTimeoutAndRetry(query.toString(), requestPolicy);

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

  return {
    payload,
    translatedText,
    detectedSourceLanguage: payload[2] || sourceLang
  };
}

async function enrichTranslationDetails(baseDetails, sourceText, detectedSourceLanguage) {
  if (!shouldUseExternalLexicon(sourceText, detectedSourceLanguage)) {
    return baseDetails;
  }

  const normalizedSource = safeText(sourceText);
  const normalizedLexeme = normalizeLexeme(normalizedSource);
  const [dictionaryEntry, datamuseSynonyms] = await Promise.all([
    fetchDictionaryApiLexicon(normalizedSource),
    fetchDatamuseSynonyms(normalizedSource)
  ]);

  if (!dictionaryEntry && (!datamuseSynonyms || datamuseSynonyms.length === 0)) {
    return baseDetails;
  }

  const nextDetails = {
    ...baseDetails
  };

  if (!nextDetails.headword && dictionaryEntry?.headword) {
    nextDetails.headword = dictionaryEntry.headword;
  }

  if (!nextDetails.partOfSpeech && dictionaryEntry?.partOfSpeech) {
    nextDetails.partOfSpeech = dictionaryEntry.partOfSpeech;
  }

  const mergedDefinitions = mergeDictionaryDefinitions(
    nextDetails.dictionaryDefinitions || [],
    dictionaryEntry?.definitions || []
  );
  nextDetails.dictionaryDefinitions = mergedDefinitions.slice(0, 4);

  if (!Array.isArray(nextDetails.detailedMeanings) || nextDetails.detailedMeanings.length === 0) {
    nextDetails.detailedMeanings = buildMeaningGroupsFromDefinitions(mergedDefinitions);
  }

  const mergedSynonyms = mergeUniqueLexemes(
    [
      ...(Array.isArray(nextDetails.synonyms) ? nextDetails.synonyms : []),
      ...(dictionaryEntry?.synonyms || []),
      ...(datamuseSynonyms || [])
    ],
    normalizedLexeme
  );
  nextDetails.synonyms = mergedSynonyms.slice(0, 6);

  if (!Array.isArray(nextDetails.examples) || nextDetails.examples.length === 0) {
    nextDetails.examples = (dictionaryEntry?.examples || []).slice(0, 3);
  }

  if (
    (!Array.isArray(nextDetails.wordForms) || nextDetails.wordForms.length === 0) &&
    nextDetails.headword &&
    nextDetails.partOfSpeech
  ) {
    nextDetails.wordForms = buildWordForms(
      nextDetails.headword,
      nextDetails.partOfSpeech,
      detectedSourceLanguage
    );
  }

  nextDetails.__lexiconBoosted = true;
  return nextDetails;
}

function shouldUseExternalLexicon(sourceText, detectedSourceLanguage) {
  const normalizedText = safeText(sourceText);
  if (!normalizedText) {
    return false;
  }

  if (!String(detectedSourceLanguage || "").toLowerCase().startsWith("en")) {
    return false;
  }

  if (!SINGLE_WORD_REGEX.test(normalizedText)) {
    return false;
  }

  return /^[A-Za-z][A-Za-z'’-]*$/.test(normalizedText);
}

async function fetchDictionaryApiLexicon(word) {
  const normalizedWord = safeText(word).toLowerCase();
  if (!normalizedWord) {
    return null;
  }

  const cacheKey = `dict:${normalizedWord}`;
  const cached = getLexiconCache(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
      normalizedWord
    )}`;
    const response = await fetchWithTimeout(url, LEXICON_FETCH_TIMEOUT_MS);
    if (!response.ok) {
      setLexiconCache(cacheKey, null);
      return null;
    }

    const payload = await response.json();
    const parsed = parseDictionaryApiPayload(payload, normalizedWord);
    setLexiconCache(cacheKey, parsed);
    return parsed;
  } catch (error) {
    setLexiconCache(cacheKey, null);
    return null;
  }
}

async function fetchDatamuseSynonyms(word) {
  const normalizedWord = safeText(word).toLowerCase();
  if (!normalizedWord) {
    return [];
  }

  const cacheKey = `datamuse:${normalizedWord}`;
  const cached = getLexiconCache(cacheKey);
  if (cached !== undefined) {
    return cached || [];
  }

  try {
    const url = new URL("https://api.datamuse.com/words");
    url.searchParams.set("rel_syn", normalizedWord);
    url.searchParams.set("max", "8");
    const response = await fetchWithTimeout(url.toString(), LEXICON_FETCH_TIMEOUT_MS);
    if (!response.ok) {
      setLexiconCache(cacheKey, []);
      return [];
    }

    const payload = await response.json();
    const synonyms = Array.isArray(payload)
      ? payload
          .map((entry) => safeText(entry?.word))
          .filter(Boolean)
      : [];
    setLexiconCache(cacheKey, synonyms);
    return synonyms;
  } catch (error) {
    setLexiconCache(cacheKey, []);
    return [];
  }
}

function parseDictionaryApiPayload(payload, fallbackWord) {
  const entry = Array.isArray(payload) ? payload[0] : null;
  if (!entry) {
    return null;
  }

  const headword = safeText(entry?.word || fallbackWord);
  const meanings = Array.isArray(entry?.meanings) ? entry.meanings : [];
  const definitions = [];
  const synonyms = [];
  const examples = [];
  const seenSynonyms = new Set();
  let primaryPartOfSpeech = "";

  for (const meaning of meanings) {
    const partOfSpeech = safeText(meaning?.partOfSpeech);
    if (!primaryPartOfSpeech && partOfSpeech) {
      primaryPartOfSpeech = partOfSpeech;
    }

    const meaningSynonyms = Array.isArray(meaning?.synonyms) ? meaning.synonyms : [];
    for (const synonym of meaningSynonyms) {
      const normalizedSyn = normalizeLexeme(synonym);
      if (!normalizedSyn || seenSynonyms.has(normalizedSyn)) {
        continue;
      }
      seenSynonyms.add(normalizedSyn);
      synonyms.push(String(synonym).trim());
    }

    const defs = Array.isArray(meaning?.definitions) ? meaning.definitions : [];
    for (const def of defs) {
      const definitionText = safeText(def?.definition);
      if (!definitionText) {
        continue;
      }
      definitions.push({
        partOfSpeech,
        definition: definitionText,
        headword,
        example: safeText(def?.example)
      });

      const defSynonyms = Array.isArray(def?.synonyms) ? def.synonyms : [];
      for (const synonym of defSynonyms) {
        const normalizedSyn = normalizeLexeme(synonym);
        if (!normalizedSyn || seenSynonyms.has(normalizedSyn)) {
          continue;
        }
        seenSynonyms.add(normalizedSyn);
        synonyms.push(String(synonym).trim());
      }

      if (def?.example) {
        examples.push(def.example);
      }

      if (definitions.length >= 6) {
        break;
      }
    }

    if (definitions.length >= 6) {
      break;
    }
  }

  return {
    headword,
    partOfSpeech: primaryPartOfSpeech,
    definitions,
    synonyms,
    examples
  };
}

function buildMeaningGroupsFromDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) {
    return [];
  }

  const grouped = new Map();
  for (const entry of definitions) {
    const partOfSpeech = safeText(entry?.partOfSpeech);
    const definition = safeText(entry?.definition);
    if (!definition) {
      continue;
    }

    const key = partOfSpeech || "Meaning";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    const list = grouped.get(key);
    if (list.length < 3) {
      list.push(definition);
    }
  }

  return Array.from(grouped.entries())
    .map(([partOfSpeech, meanings]) => ({
      partOfSpeech,
      meanings
    }))
    .slice(0, 3);
}

function mergeDictionaryDefinitions(base, incoming) {
  const definitions = [];
  const seen = new Set();

  for (const entry of [...base, ...incoming]) {
    const definition = safeText(entry?.definition);
    if (!definition) {
      continue;
    }
    const key = normalizeKey(definition);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    definitions.push(entry);
  }

  return definitions;
}

function mergeUniqueLexemes(values, normalizedSource) {
  const list = [];
  const seen = new Set();

  for (const value of values) {
    const normalizedValue = normalizeLexeme(value);
    if (!normalizedValue || normalizedValue === normalizedSource || seen.has(normalizedValue)) {
      continue;
    }
    seen.add(normalizedValue);
    list.push(String(value).trim());
  }

  return list;
}

function getLexiconCache(key) {
  const entry = lexiconCache.get(key);
  if (!entry) {
    return undefined;
  }

  if (Date.now() - entry.at > LEXICON_CACHE_TTL_MS) {
    lexiconCache.delete(key);
    return undefined;
  }

  return entry.value;
}

function setLexiconCache(key, value) {
  if (lexiconCache.size >= LEXICON_CACHE_MAX) {
    const firstKey = lexiconCache.keys().next().value;
    if (firstKey) {
      lexiconCache.delete(firstKey);
    }
  }

  lexiconCache.set(key, { value, at: Date.now() });
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    return await fetch(url, {
      signal: controller?.signal,
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function buildContextAwareTranslation(
  sourceText,
  sourceLang,
  targetLang,
  options = {},
  requestPolicy = {}
) {
  const phraseCandidates = sanitizePhraseCandidates(options?.phraseCandidates);
  const markedContextText = safeText(options?.markedContextText);
  const shouldDisambiguate =
    safeText(options?.mode) === "hover" &&
    SINGLE_WORD_REGEX.test(sourceText) &&
    (Boolean(markedContextText) || phraseCandidates.length > 0);

  if (!shouldDisambiguate) {
    return {
      contextualGloss: "",
      phraseMatches: []
    };
  }

  const markedContextPromise = markedContextText
    ? fetchGoogleTranslation(markedContextText, sourceLang, targetLang, requestPolicy).catch(() => null)
    : Promise.resolve(null);
  const phraseMatchesPromise = phraseCandidates.length
    ? Promise.all(
        phraseCandidates.map(async (candidate) => {
          try {
            const result = await fetchGoogleTranslation(candidate, sourceLang, targetLang, requestPolicy);
            return {
              text: candidate,
              translatedText: result.translatedText,
              partOfSpeech: "",
              examples: []
            };
          } catch (error) {
            return null;
          }
        })
      )
    : Promise.resolve([]);

  const [markedContextResult, rawPhraseMatches] = await Promise.all([
    markedContextPromise,
    phraseMatchesPromise
  ]);

  return {
    contextualGloss: extractContextualGloss(
      markedContextResult?.translatedText || "",
      rawPhraseMatches
    ),
    phraseMatches: rawPhraseMatches.filter(
      (entry) => entry?.text && entry?.translatedText && normalizeKey(entry.text) !== normalizeKey(sourceText)
    )
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
    phraseMatches: [],
    grammarBreakdown: null,
    contextInsights: [],
    pronunciation: null
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
              ? group.meanings.map(safeText).filter(Boolean).slice(0, 4)
              : []
          }))
          .filter((group) => group.partOfSpeech && group.meanings.length)
          .slice(0, 4)
      : [],
    synonyms: Array.isArray(details.synonyms)
      ? details.synonyms.map(safeText).filter(Boolean).slice(0, 6)
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
      ? details.examples.map(safeText).filter(Boolean).slice(0, 5)
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
      : [],
    grammarBreakdown: sanitizeGrammarBreakdown(details.grammarBreakdown),
    contextInsights: Array.isArray(details.contextInsights)
      ? details.contextInsights.map(safeText).filter(Boolean).slice(0, 4)
      : [],
    pronunciation: sanitizePronunciation(details.pronunciation)
  };
}

function sanitizeGrammarBreakdown(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const summary = safeText(value.summary);
  const structure = safeText(value.structure);
  const tense = safeText(value.tense);
  const notes = Array.isArray(value.notes)
    ? value.notes.map(safeText).filter(Boolean).slice(0, 4)
    : [];

  if (!summary && !structure && !tense && !notes.length) {
    return null;
  }

  return {
    summary,
    structure,
    tense,
    notes
  };
}

function sanitizePronunciation(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const text = safeText(value.text);
  const lang = safeText(value.lang);
  const label = safeText(value.label);
  const slowerLabel = safeText(value.slowerLabel);

  if (!text) {
    return null;
  }

  return {
    text,
    lang,
    label,
    slowerLabel
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
        ? entry[1].map(safeText).filter(Boolean).slice(0, 4)
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
    .slice(0, 4);
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
        if (synonyms.length >= 4) {
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

      if (definitions.length >= 4) {
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
      if (examples.length >= 5) {
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
    displayMode: normalizeDisplayMode(settings?.displayMode, DEFAULT_SETTINGS.displayMode),
    uiTheme: normalizeUiTheme(settings?.uiTheme, DEFAULT_SETTINGS.uiTheme),
    subtitleHistoryLimit: normalizeHistoryLimit(
      settings?.subtitleHistoryLimit,
      DEFAULT_SETTINGS.subtitleHistoryLimit
    ),
    syncWordPool:
      typeof settings?.syncWordPool === "boolean"
        ? settings.syncWordPool
        : DEFAULT_SETTINGS.syncWordPool,
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
  const displayMode = normalizeDisplayMode(settings?.displayMode, normalizedDefaults.displayMode || "auto");

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
      : normalizedDefaults.tooltipSize || "balanced",
    displayMode,
    ocrEnabled:
      typeof settings?.ocrEnabled === "boolean"
        ? settings.ocrEnabled
        : Boolean(normalizedDefaults.ocrEnabled)
  };
}

function normalizeDisplayMode(value, fallback = "auto") {
  const normalized = safeText(value);
  return ["auto", "tooltip", "docked"].includes(normalized) ? normalized : fallback;
}

function normalizeUiTheme(value, fallback = "aurora") {
  const normalized = safeText(value).toLowerCase();
  return ["aurora", "sand", "ink"].includes(normalized) ? normalized : fallback;
}

function normalizeHistoryLimit(value, fallback = 10) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 5 && numeric <= 24
    ? Math.round(numeric)
    : fallback;
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

  const settings = await getSettings();
  await syncSharedWordPool(nextEntry, settings);

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
  const settings = await getSettings();
  const [localResult, sharedPool] = await Promise.all([
    extensionApi.storage.local.get(STORAGE_KEYS.unknownWords),
    getSharedWordPoolEntries(settings)
  ]);
  const localEntries = Array.isArray(localResult[STORAGE_KEYS.unknownWords])
    ? localResult[STORAGE_KEYS.unknownWords]
    : [];

  const merged = new Map();
  for (const entry of [...sharedPool, ...localEntries]) {
    const normalizedEntry = {
      ...entry,
      details: sanitizeTranslationDetails(entry?.details),
      review: buildInitialReviewState(entry?.review)
    };
    const current = merged.get(normalizedEntry.id);
    if (!current || Date.parse(normalizedEntry.savedAt || "") >= Date.parse(current.savedAt || "")) {
      merged.set(normalizedEntry.id, normalizedEntry);
    }
  }

  return Array.from(merged.values()).sort(
    (left, right) => Date.parse(right.savedAt || "") - Date.parse(left.savedAt || "")
  );
}

async function getDisabledTabs() {
  const result = await sessionStorageArea.get(STORAGE_KEYS.disabledTabs);
  return result[STORAGE_KEYS.disabledTabs] || {};
}

async function getSubtitleHistoryMap() {
  const result = await sessionStorageArea.get(STORAGE_KEYS.subtitleHistory);
  return result[STORAGE_KEYS.subtitleHistory] || {};
}

async function getSubtitleHistory(tabId) {
  if (!tabId) {
    return [];
  }

  const subtitleHistory = await getSubtitleHistoryMap();
  return Array.isArray(subtitleHistory[tabId]) ? subtitleHistory[tabId] : [];
}

async function updateSubtitleHistory(tabId, items) {
  if (!tabId) {
    return [];
  }

  const settings = await getSettings();
  const subtitleHistory = await getSubtitleHistoryMap();
  const limit = settings.subtitleHistoryLimit || DEFAULT_SETTINGS.subtitleHistoryLimit;
  const normalizedItems = Array.isArray(items)
    ? items
        .map((entry) => ({
          text: safeText(entry?.text),
          source: safeText(entry?.source),
          savedAt: safeText(entry?.savedAt) || new Date().toISOString()
        }))
        .filter((entry) => entry.text)
        .slice(0, limit)
    : [];

  subtitleHistory[tabId] = normalizedItems;
  await sessionStorageArea.set({
    [STORAGE_KEYS.subtitleHistory]: subtitleHistory
  });

  return normalizedItems;
}

async function captureVisibleTab(sender) {
  const windowId = sender?.tab?.windowId;
  if (typeof extensionApi.tabs.captureVisibleTab !== "function") {
    throw new Error("captureVisibleTab desteklenmiyor");
  }

  return extensionApi.tabs.captureVisibleTab(windowId, { format: "png" });
}

async function getSharedWordPoolEntries(settings = null) {
  if (!syncStorageArea) {
    return [];
  }

  const normalizedSettings = settings || (await getSettings());
  if (!normalizedSettings.syncWordPool) {
    return [];
  }

  const result = await syncStorageArea.get(STORAGE_KEYS.sharedWordPool);
  return Array.isArray(result[STORAGE_KEYS.sharedWordPool])
    ? result[STORAGE_KEYS.sharedWordPool].map((entry) => ({
        ...entry,
        details: sanitizeTranslationDetails(entry?.details),
        review: buildInitialReviewState(entry?.review)
      }))
    : [];
}

async function syncSharedWordPool(entry, settings = null) {
  if (!syncStorageArea || !entry) {
    return;
  }

  const normalizedSettings = settings || (await getSettings());
  if (!normalizedSettings.syncWordPool) {
    return;
  }

  const currentEntries = await getSharedWordPoolEntries(normalizedSettings);
  const compactEntry = buildSharedWordPoolEntry(entry);
  const nextEntries = currentEntries.filter((item) => item.id !== compactEntry.id);
  nextEntries.unshift(compactEntry);

  await syncStorageArea.set({
    [STORAGE_KEYS.sharedWordPool]: nextEntries.slice(0, 60)
  });
}

function buildSharedWordPoolEntry(entry) {
  const safeEntry = {
    ...entry,
    details: sanitizeTranslationDetails(entry?.details),
    review: buildInitialReviewState(entry?.review)
  };

  return {
    id: safeEntry.id,
    sourceText: safeEntry.sourceText,
    translatedText: safeEntry.translatedText,
    sourceLang: safeEntry.sourceLang,
    targetLang: safeEntry.targetLang,
    context: safeText(safeEntry.context).slice(0, 180),
    hostname: safeText(safeEntry.hostname),
    pageUrl: safeText(safeEntry.pageUrl),
    savedAt: safeText(safeEntry.savedAt) || new Date().toISOString(),
    details: {
      headword: safeText(safeEntry.details?.headword),
      partOfSpeech: safeText(safeEntry.details?.partOfSpeech),
      synonyms: Array.isArray(safeEntry.details?.synonyms)
        ? safeEntry.details.synonyms.slice(0, 3)
        : [],
      examples: Array.isArray(safeEntry.details?.examples)
        ? safeEntry.details.examples.slice(0, 2)
        : [],
      phraseMatches: Array.isArray(safeEntry.details?.phraseMatches)
        ? safeEntry.details.phraseMatches.slice(0, 1)
        : [],
      grammarBreakdown: sanitizeGrammarBreakdown(safeEntry.details?.grammarBreakdown),
      contextInsights: Array.isArray(safeEntry.details?.contextInsights)
        ? safeEntry.details.contextInsights.slice(0, 2)
        : [],
      pronunciation: sanitizePronunciation(safeEntry.details?.pronunciation)
    },
    review: buildInitialReviewState(safeEntry.review)
  };
}

function buildPronunciationDetails(text, language) {
  const safeSource = safeText(text);
  if (!safeSource) {
    return null;
  }

  const safeLanguage = safeText(language).toLowerCase();
  const lang = safeLanguage.startsWith("tr")
    ? "tr-TR"
    : safeLanguage.startsWith("de")
      ? "de-DE"
      : safeLanguage.startsWith("fr")
        ? "fr-FR"
        : safeLanguage.startsWith("es")
          ? "es-ES"
          : "en-US";

  return {
    text: safeSource,
    lang,
    label: "Dinle",
    slowerLabel: "Yavas"
  };
}

function buildGrammarBreakdown(text, translatedText, language) {
  const normalizedText = safeText(text);
  if (!normalizedText) {
    return null;
  }

  const parts = normalizedText.split(/\s+/).filter(Boolean);
  const lowerText = normalizedText.toLowerCase();
  const notes = [];
  let summary = parts.length === 1 ? "Tek kelime" : parts.length <= 4 ? "Kisa ifade" : "Cumle";
  let structure = normalizedText.endsWith("?")
    ? "Soru yapisi"
    : /\b(not|never|no|n't)\b/i.test(normalizedText)
      ? "Olumsuz yapi"
      : "Duz ifade";
  let tense = "";

  if (String(language || "").toLowerCase().startsWith("en")) {
    if (/\b(will|going to)\b/i.test(lowerText)) {
      tense = "Future";
      notes.push("Gelecek zamana isaret eden bir yapi var.");
    } else if (/\b(have|has|had)\b.+\b\w+ed\b/i.test(lowerText)) {
      tense = "Perfect";
      notes.push("Perfect benzeri bir tamamlanmislik yapisi var.");
    } else if (/\b(am|is|are|was|were)\b.+ing\b/i.test(lowerText)) {
      tense = "Continuous";
      notes.push("Suregiden eylem vurgusu var.");
    } else if (/\b\w+ed\b/.test(lowerText)) {
      tense = "Past";
      notes.push("Gecmis zaman izi goruluyor.");
    } else if (parts.length > 1) {
      tense = "Present / base";
      notes.push("Temel simdiki-genis zaman hissi veriyor.");
    }

    if (/\b(can|could|may|might|must|should|would)\b/i.test(lowerText)) {
      notes.push("Modal kullanimi var.");
    }

    if (/\b(and|but|because|if|when|while)\b/i.test(lowerText)) {
      notes.push("Baglac ile genisleyen bir yapi var.");
    }
  }

  if (translatedText && parts.length > 1) {
    notes.push(`Hedef anlam: ${safeText(translatedText).slice(0, 80)}`);
  }

  return sanitizeGrammarBreakdown({
    summary,
    structure,
    tense,
    notes
  });
}

function buildContextInsights(text, translatedText, language, details, contextData = null) {
  const normalizedText = safeText(text);
  if (!normalizedText) {
    return [];
  }

  const insights = [];
  const lowerText = normalizedText.toLowerCase();
  const firstMeaning = details?.detailedMeanings?.[0]?.meanings?.[0];
  const firstDefinition = details?.dictionaryDefinitions?.[0]?.definition;
  const contextualGloss = safeText(contextData?.contextualGloss);
  const baseTranslatedText = safeText(contextData?.baseTranslatedText);

  if (contextualGloss) {
    insights.push(`Bu baglamda en yakin anlam: ${contextualGloss}`);
  }

  if (normalizedText.split(/\s+/).length === 1) {
    insights.push("Kelime tek basina geliyor; baglam anlam secimini degistirebilir.");
  } else if (normalizedText.split(/\s+/).length <= 4) {
    insights.push("Bu ifade buyuk ihtimalle kalip veya baglamsal bir birim olarak okunmali.");
  } else {
    insights.push("Cumle seviyesinde ceviri yapildi; zaman ve ton baglamla birlikte okunmali.");
  }

  if (/\bformal|official|statement\b/i.test(lowerText)) {
    insights.push("Resmi veya aciklayici bir ton olabilir.");
  }

  if (/\bhey|wow|oh|uh|gonna|wanna\b/i.test(lowerText)) {
    insights.push("Gundelik veya konusma dili tonu var.");
  }

  if (firstMeaning) {
    insights.push(`En yakin cekirdek anlam: ${firstMeaning}`);
  } else if (firstDefinition) {
    insights.push(`Sozluk odagi: ${firstDefinition}`);
  }

  if (translatedText) {
    insights.push(`Cevrilen hedef: ${safeText(translatedText).slice(0, 90)}`);
  }

  if (baseTranslatedText && baseTranslatedText !== translatedText) {
    insights.push(`Temel ceviri: ${baseTranslatedText.slice(0, 90)}`);
  }

  if (String(language || "").toLowerCase().startsWith("en")) {
    insights.push("Ingilizce kaynakta phrase / tense degisimi anlami hizli kaydirabilir.");
  }

  return insights.map(safeText).filter(Boolean).slice(0, 4);
}

function sanitizePhraseCandidates(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set();
  const candidates = [];

  for (const value of values) {
    const candidate = safeText(value).replace(/\s+/g, " ");
    const key = normalizeKey(candidate);
    if (!candidate || seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push(candidate);

    if (candidates.length >= MAX_CONTEXT_PHRASE_CANDIDATES) {
      break;
    }
  }

  return candidates;
}

function extractContextualGloss(translatedText, phraseMatches = []) {
  const normalizedText = safeText(translatedText);
  if (!normalizedText) {
    return "";
  }

  // Try robust bracket extraction [[*]]word[[/]] with flexibility for spaces
  let startMatch = normalizedText.match(/\[\[\s*\*\s*\]\]/);
  if (!startMatch) {
    // Some engines might double the asterisk or skip spaces differently
    startMatch = normalizedText.match(/\[\[\s*\*+\s*\]\]/);
  }
  let endMatch = normalizedText.match(/\[\[\s*\/\s*\]\]/);

  if (startMatch && endMatch && endMatch.index > startMatch.index) {
    const betweenRaw = normalizedText.slice(
      startMatch.index + startMatch[0].length,
      endMatch.index
    );
    const between = sanitizeGlossCandidate(betweenRaw);
    if (between) {
      return between;
    }
  }

  // Fallback: single-marker extraction (backward compatibility for old markers)
  const legacyMarkerPattern = /(\bQXMARK9[78]\b|<m>|<\/m>)/i;
  const markerMatch = legacyMarkerPattern.exec(normalizedText) || startMatch || endMatch;
  if (!markerMatch) {
    return "";
  }

  const before = normalizedText.slice(0, markerMatch.index);
  const after = normalizedText.slice(markerMatch.index + markerMatch[0].length);
  const candidates = [
    ...extractGlossCandidates(before, "before"),
    ...extractGlossCandidates(after, "after")
  ];
  const normalizedPhraseMatches = phraseMatches
    .map((entry) => normalizeGlossForMatch(entry?.translatedText))
    .filter(Boolean);

  let bestCandidate = "";
  let bestScore = -1;

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeGlossForMatch(candidate);
    if (!normalizedCandidate) {
      continue;
    }

    let score = bestCandidate ? 0 : 1;
    if (normalizedPhraseMatches.some((value) => value.includes(normalizedCandidate))) {
      score += 3;
    }

    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
}

function extractGlossCandidates(text, direction) {
  const normalizedText = safeText(text);
  if (!normalizedText) {
    return [];
  }

  const tokenPattern = /[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu;
  const tokens = Array.from(normalizedText.matchAll(tokenPattern)).map((match) => match[0]);
  if (!tokens.length) {
    return [];
  }

  const selectedTokens = direction === "after" ? tokens.slice(0, 3) : tokens.slice(-3).reverse();
  const candidates = [];

  for (let index = 0; index < selectedTokens.length; index += 1) {
    const candidate = sanitizeGlossCandidate(selectedTokens[index]);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  if (selectedTokens.length >= 2) {
    const pair = direction === "after"
      ? `${selectedTokens[0]} ${selectedTokens[1]}`
      : `${selectedTokens[1]} ${selectedTokens[0]}`;
    const sanitizedPair = sanitizeGlossCandidate(pair);
    if (sanitizedPair) {
      candidates.push(sanitizedPair);
    }
  }

  return candidates;
}

function sanitizeGlossCandidate(value) {
  const gloss = safeText(value)
    .replace(/^[\s"'“”‘’([{.,;:!?-]+/g, "")
    .replace(/[\s"'“”‘’)\]}.,;:!?-]+$/g, "");

  if (!gloss || gloss.split(/\s+/).length > 4 || gloss.length > 48) {
    return "";
  }

  return gloss;
}

function normalizeGlossForMatch(value) {
  return safeText(value)
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{M}\d\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => stemGlossToken(token))
    .filter(Boolean)
    .join(" ");
}

function stemGlossToken(token) {
  let current = safeText(token);
  if (!current) {
    return "";
  }

  const suffixes = [
    "lardan",
    "lerden",
    "larında",
    "lerinde",
    "larından",
    "lerinden",
    "ndaki",
    "ndeki",
    "ndan",
    "nden",
    "ların",
    "lerin",
    "ları",
    "leri",
    "daki",
    "deki",
    "daki",
    "sini",
    "sını",
    "sunu",
    "sünü",
    "sina",
    "sine",
    "suna",
    "süne",
    "sında",
    "sinde",
    "sundan",
    "sünden",
    "sından",
    "sinden",
    "si",
    "sı",
    "su",
    "sü",
    "na",
    "ne",
    "da",
    "de",
    "ta",
    "te",
    "dan",
    "den",
    "tan",
    "ten",
    "yi",
    "yı",
    "yu",
    "yü",
    "i",
    "ı",
    "u",
    "ü"
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (current.length > suffix.length + 2 && current.endsWith(suffix)) {
        current = current.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }

  return current;
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

async function notifyAllTabs(message) {
  if (typeof extensionApi.tabs?.query !== "function") {
    return;
  }

  let tabs = [];
  try {
    tabs = await extensionApi.tabs.query({});
  } catch (error) {
    return;
  }

  await Promise.all(
    tabs
      .map((tab) => tab?.id)
      .filter(Boolean)
      .map((tabId) => notifyTab(tabId, message))
  );
}

function getRuntimeCapabilities() {
  return {
    ocrCaptureSupported: typeof extensionApi.tabs?.captureVisibleTab === "function",
    syncStorageSupported: Boolean(syncStorageArea)
  };
}

async function fetchWithTimeoutAndRetry(url, options = {}) {
  let lastError = null;
  const timeoutMs =
    typeof options.timeoutMs === "number" ? options.timeoutMs : TRANSLATE_FETCH_TIMEOUT_MS;
  const retries =
    typeof options.retries === "number" ? options.retries : TRANSLATE_FETCH_RETRIES;
  const retryDelayMs =
    typeof options.retryDelayMs === "number"
      ? options.retryDelayMs
      : TRANSLATE_FETCH_RETRY_DELAY_MS;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetch(url, {
        signal: controller?.signal,
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Translation failed with status ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        break;
      }

      await sleep(retryDelayMs * (attempt + 1));
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  if (lastError?.name === "AbortError") {
    throw new Error("Translation request timed out");
  }

  throw lastError instanceof Error ? lastError : new Error("Translation request failed");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
