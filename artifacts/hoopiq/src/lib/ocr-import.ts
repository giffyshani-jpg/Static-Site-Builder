// OCR lineup import utilities.
//
// Extracts text lines from an image using Tesseract.js (loaded lazily so
// the ~10 MB WASM binary never hits initial page load), then fuzzy-matches
// each line against a known player list using Levenshtein distance.
//
// Design notes:
//   • Each matched player is consumed once (no duplicate allocations).
//   • Lines below 2 chars or above 40 chars are skipped (unlikely player names).
//   • Threshold = 0.60 — below this the match is surfaced as "unmatched" so
//     the user can pick manually rather than getting a wrong auto-selection.

export type KnownPlayer = { id: string; name: string };

export type OcrMatchResult = {
  /** Raw text line from OCR output */
  ocrText: string;
  /** Best-matching player, or null if confidence < threshold */
  matchedPlayer: KnownPlayer | null;
  /** Similarity score 0–1 */
  confidence: number;
};

// ── String normalization ──────────────────────────────────────────────────────

// Common generational/suffix tokens that show up after a surname and would
// otherwise corrupt "last word = last name" matching (e.g. "James Jr." would
// treat "jr" as the last name instead of "james").
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

// Small set of common first-name nicknames/abbreviations seen in fantasy
// screenshots. Bidirectional: either side may be the short or long form.
const NICKNAMES: Record<string, string[]> = {
  steph: ["stephen"],
  mike: ["michael"],
  chris: ["christopher"],
  alex: ["alexander"],
  nick: ["nicholas"],
  rob: ["robert"],
  bobby: ["robert"],
  will: ["william"],
  bill: ["william"],
  joe: ["joseph"],
  tony: ["anthony"],
  ed: ["edward"],
  eddie: ["edward"],
  zach: ["zachary"],
  matt: ["matthew"],
  dan: ["daniel"],
  danny: ["daniel"],
  jimmy: ["james"],
  jj: ["j.j.", "j j"],
  cj: ["c.j.", "c j"],
  tj: ["t.j.", "t j"],
  pj: ["p.j.", "p j"],
  dj: ["d.j.", "d j"],
  kj: ["k.j.", "k j"],
};

/** Lowercase + strip anything but letters/spaces/apostrophes/periods/hyphens. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z\s'.\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fully punctuation- and whitespace-insensitive: letters only, no spaces. */
function squash(s: string): string {
  return normalize(s).replace(/[^a-z]/g, "");
}

/** Drops a trailing generational suffix word ("jr", "sr", "iii", ...). */
function stripSuffix(words: string[]): string[] {
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1].replace(/\./g, ""))) {
    return words.slice(0, -1);
  }
  return words;
}

/** Splits a normalized name into words with any trailing suffix removed. */
function nameWords(normalized: string): string[] {
  return stripSuffix(normalized.split(" ").filter(Boolean));
}

/** True if two first-name tokens are the same person, allowing nicknames. */
function firstNamesMatch(a: string, b: string): boolean {
  const na = a.replace(/\./g, "");
  const nb = b.replace(/\./g, "");
  if (na === nb) return true;
  const expand = (short: string) => NICKNAMES[short]?.map((n) => n.replace(/\./g, "")) ?? [];
  return expand(na).includes(nb) || expand(nb).includes(na);
}

// ── Levenshtein distance ──────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Rolling two-row DP to keep memory O(n).
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = [...curr];
  }
  return prev[n];
}

// ── Similarity scoring ────────────────────────────────────────────────────────

const MATCH_THRESHOLD = 0.60;

function similarity(ocrText: string, playerName: string): number {
  const a = normalize(ocrText);
  const b = normalize(playerName);
  if (!a || !b) return 0;

  // Exact match after normalisation.
  if (a === b) return 1;

  // Fully punctuation/whitespace-insensitive exact match (handles OCR
  // dropping periods/apostrophes/hyphens/spaces: "OBrien" ~ "O'Brien",
  // "PJ Washington" ~ "P.J. Washington", "LeBronJames" ~ "LeBron James").
  const squashedA = squash(a);
  const squashedB = squash(b);
  if (squashedA && squashedA === squashedB) return 0.97;

  const aWords = nameWords(a);
  const bWords = nameWords(b);
  const lastNameA = aWords[aWords.length - 1];
  const lastNameB = bWords[bWords.length - 1];

  // Last-name-only match (very common in fantasy app screenshots where names
  // are truncated or shown surname-first). Punctuation-insensitive too.
  if (lastNameB.length >= 3 && aWords.length === 1 && squash(aWords[0]) === squash(lastNameB)) {
    return 0.88;
  }

  // Full name match allowing nickname/abbreviation first names and
  // suffix/punctuation differences, e.g. "Steph Curry" ~ "Stephen Curry",
  // "CJ McCollum" ~ "C.J. McCollum".
  if (
    aWords.length >= 2 &&
    bWords.length >= 2 &&
    squash(lastNameA) === squash(lastNameB) &&
    firstNamesMatch(aWords[0], bWords[0])
  ) {
    return 0.93;
  }

  // First-letter + last-name (e.g. "L. James" → "LeBron James").
  // Punctuation-insensitive: matches "l james", "l. james", and "ljames".
  if (bWords.length >= 2 && lastNameB.length >= 2) {
    const abbrevSquashed = `${bWords[0][0]}${squash(lastNameB)}`;
    if (squashedA === abbrevSquashed) return 0.85;
  }

  // Common abbreviation first name (e.g. "cj" / "c.j." / "c j") + last name,
  // independent of the nickname map above (covers initials not listed there).
  if (aWords.length >= 2 && bWords.length >= 2 && squash(lastNameA) === squash(lastNameB)) {
    const aInitials = squash(aWords.slice(0, -1).join(""));
    const bFirstInitial = bWords[0][0];
    if (aInitials.length >= 1 && aInitials.length <= 3 && aInitials[0] === bFirstInitial) {
      return 0.82;
    }
  }

  // Prefix of full name (truncated display names).
  if (b.startsWith(a) && a.length >= 4) return 0.80;

  // Substring of full name.
  if (b.includes(a) && a.length >= 4) return 0.75;

  // Levenshtein-based similarity, computed on the squashed (punctuation- and
  // whitespace-insensitive) forms so stray periods/hyphens/spaces from OCR
  // don't tank an otherwise-close match.
  const dist = levenshtein(squashedA, squashedB);
  const maxLen = Math.max(squashedA.length, squashedB.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

// ── Matching ──────────────────────────────────────────────────────────────────

/**
 * Match an array of OCR text lines to known players. Each player can only be
 * matched once. Lines that produce no match above MATCH_THRESHOLD are surfaced
 * as unmatched so the user can correct them.
 */
export function matchOcrLinesToPlayers(
  ocrLines: string[],
  players: KnownPlayer[],
): OcrMatchResult[] {
  const usedIds = new Set<string>();
  const results: OcrMatchResult[] = [];

  for (const rawLine of ocrLines) {
    const trimmed = rawLine.trim();
    // Skip obviously non-name lines: too short, too long, or all digits.
    if (trimmed.length < 2 || trimmed.length > 40) continue;
    if (/^\d+$/.test(trimmed)) continue;

    let bestScore = 0;
    let bestPlayer: KnownPlayer | null = null;

    for (const player of players) {
      if (usedIds.has(player.id)) continue;
      const score = similarity(trimmed, player.name);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = player;
      }
    }

    if (bestScore >= MATCH_THRESHOLD && bestPlayer) {
      usedIds.add(bestPlayer.id);
      results.push({ ocrText: trimmed, matchedPlayer: bestPlayer, confidence: bestScore });
    } else {
      results.push({ ocrText: trimmed, matchedPlayer: null, confidence: bestScore });
    }
  }

  return results;
}

// ── OCR extraction ────────────────────────────────────────────────────────────

export type OcrProgress =
  | { phase: "loading" }
  | { phase: "recognizing"; pct: number }
  | { phase: "done" };

/**
 * Run OCR on an image File using Tesseract.js (dynamically imported).
 * Returns raw text lines from the recognised output, longest-first to
 * put full names before fragments.
 */
export async function extractLinesFromImage(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string[]> {
  onProgress?.({ phase: "loading" });

  // Dynamic import keeps the ~10 MB WASM out of the initial bundle.
  const { createWorker } = await import("tesseract.js");

  const worker = await createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress?.({ phase: "recognizing", pct: Math.round(m.progress * 100) });
      }
    },
  });

  try {
    const url = URL.createObjectURL(file);
    const result = await worker.recognize(url);
    URL.revokeObjectURL(url);
    onProgress?.({ phase: "done" });

    // data.text is always available in all Tesseract.js versions.
    const rawText: string = (result.data as { text: string }).text ?? "";

    // Split into lines, then also emit individual tokens for single-word
    // names that appear on one line with stats (e.g. "James 28 10 5").
    const textLines = rawText
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Tokens: split each line by whitespace and keep tokens ≥ 3 chars that
    // aren't purely numeric — these are potential name fragments.
    const tokens = textLines.flatMap((l) =>
      l.split(/\s+/).filter((t) => t.length >= 3 && !/^\d+$/.test(t)),
    );

    const combined = Array.from(new Set([...textLines, ...tokens]));
    // Longest first: full names before fragments.
    combined.sort((a, b) => b.length - a.length);
    return combined;
  } finally {
    await worker.terminate();
  }
}
