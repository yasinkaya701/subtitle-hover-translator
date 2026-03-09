const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UNKNOWN_WORDS_FILE = path.join(DATA_DIR, "unknown-words.json");
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

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

ensureDataFile();

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname === "/api/translate" && req.method === "GET") {
      return handleTranslate(requestUrl, res);
    }

    if (requestUrl.pathname === "/api/unknown-words" && req.method === "GET") {
      return handleGetUnknownWords(res);
    }

    if (requestUrl.pathname === "/api/unknown-words" && req.method === "POST") {
      return handleSaveUnknownWord(req, res);
    }

    if (requestUrl.pathname === "/health" && req.method === "GET") {
      return sendJson(res, 200, { ok: true });
    }

    if (requestUrl.pathname === "/favicon.ico" && req.method === "GET") {
      res.writeHead(204);
      res.end();
      return;
    }

    return serveStatic(requestUrl.pathname, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      error: "Internal server error"
    });
  }
});

server.listen(PORT, () => {
  console.log(`Subtitle hover translator is running on http://localhost:${PORT}`);
});

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UNKNOWN_WORDS_FILE)) {
    fs.writeFileSync(UNKNOWN_WORDS_FILE, "[]", "utf8");
  }
}

function handleGetUnknownWords(res) {
  const entries = readUnknownWords();
  return sendJson(res, 200, { entries });
}

async function handleSaveUnknownWord(req, res) {
  const body = await readJsonBody(req);

  if (!body.sourceText || !body.translatedText) {
    return sendJson(res, 400, {
      error: "sourceText and translatedText are required"
    });
  }

  const entries = readUnknownWords();
  const normalizedText = normalizeKey(body.sourceText);
  const nextEntry = {
    id: normalizedText,
    sourceText: body.sourceText.trim(),
    translatedText: body.translatedText.trim(),
    sourceLang: (body.sourceLang || "auto").trim(),
    targetLang: (body.targetLang || "tr").trim(),
    context: (body.context || "").trim(),
    details: sanitizeTranslationDetails(body.details),
    savedAt: new Date().toISOString()
  };

  const existingIndex = entries.findIndex((entry) => entry.id === normalizedText);

  if (existingIndex >= 0) {
    entries[existingIndex] = {
      ...entries[existingIndex],
      ...nextEntry
    };
  } else {
    entries.unshift(nextEntry);
  }

  fs.writeFileSync(UNKNOWN_WORDS_FILE, JSON.stringify(entries, null, 2), "utf8");

  return sendJson(res, 201, {
    entry: nextEntry
  });
}

async function handleTranslate(requestUrl, res) {
  const text = requestUrl.searchParams.get("text");
  const source = requestUrl.searchParams.get("source") || "auto";
  const target = requestUrl.searchParams.get("target") || "tr";

  if (!text || !text.trim()) {
    return sendJson(res, 400, { error: "text is required" });
  }

  try {
    const translation = await translateText(text.trim(), source, target);
    return sendJson(res, 200, translation);
  } catch (error) {
    console.error("Translation failed:", error);
    return sendJson(res, 502, {
      error: "Translation service failed"
    });
  }
}

async function translateText(text, source, target) {
  const query = new URL("https://translate.googleapis.com/translate_a/single");
  query.searchParams.set("client", "gtx");
  query.searchParams.set("sl", source);
  query.searchParams.set("tl", target);
  query.searchParams.set("dt", "t");
  query.searchParams.append("dt", "bd");
  query.searchParams.append("dt", "md");
  query.searchParams.append("dt", "ss");
  query.searchParams.set("q", text);

  const response = await fetch(query, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }

  const payload = await response.json();
  const translatedText = Array.isArray(payload[0])
    ? payload[0].map((chunk) => chunk[0]).join("")
    : "";
  const detectedSourceLanguage = payload[2] || source;
  const details = isSingleDictionaryWord(text)
    ? buildTranslationDetails(payload, text, detectedSourceLanguage)
    : emptyTranslationDetails();

  return {
    sourceText: text,
    translatedText,
    detectedSourceLanguage,
    provider: "google-translate-web",
    details
  };
}

function isSingleDictionaryWord(text) {
  return SINGLE_WORD_REGEX.test(text);
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
    dictionaryDefinitions
  };
}

function emptyTranslationDetails() {
  return {
    headword: "",
    partOfSpeech: "",
    detailedMeanings: [],
    synonyms: [],
    wordForms: [],
    dictionaryDefinitions: []
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
            headword: safeText(entry?.headword)
          }))
          .filter((entry) => entry.definition)
          .slice(0, 3)
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
        headword
      });

      if (definitions.length >= 3) {
        return definitions;
      }
    }
  }

  return definitions;
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

function readUnknownWords() {
  ensureDataFile();
  const raw = fs.readFileSync(UNKNOWN_WORDS_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unknown words file is invalid JSON:", error);
    return [];
  }
}

function normalizeKey(value) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, " ");
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function serveStatic(requestPath, res) {
  let filePath = requestPath === "/" ? "/index.html" : requestPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");

  const absolutePath = path.join(PUBLIC_DIR, filePath);

  if (!absolutePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        return sendJson(res, 404, { error: "Not found" });
      }

      return sendJson(res, 500, { error: "File read error" });
    }

    const extname = path.extname(absolutePath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname] || "application/octet-stream"
    });
    res.end(content);
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}
