import { KNOWLEDGE_BASE, type KnowledgeEntry } from "./knowledge-base";

export const MAX_ASSISTANT_QUERY = 240;

const STOP_WORDS = new Set(
  "а и или в во на у из с со до по от для без за про об о это как что где куда если ли какой какую какие зачем почему раст rust fps фпс гб пк игре игры игра мне мой меня очень подскажи делать заходить находится нужно стоит хочу можно при там есть is the a to how what should do with for on of in my i and or".split(" "),
);

function words(text: string): string[] {
  return (text.normalize("NFKC").toLowerCase().replaceAll("ё", "е")
    .replace(/(\d)\s*gb\b/g, "$1 гб")
    .match(/\d+(?:\.\d+)+|[a-zа-я0-9]+/g) ?? [])
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

const INDEX = KNOWLEDGE_BASE.map((entry) => {
  const phrases = entry.keywords.map(words).filter((phrase) => phrase.length > 0);
  return { entry, phrases, terms: [...new Set([...words(entry.title), ...phrases.flat()])] };
});

const TERM_COUNTS = new Map<string, number>();
for (const { terms } of INDEX) {
  for (const term of terms) TERM_COUNTS.set(term, (TERM_COUNTS.get(term) ?? 0) + 1);
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  // Keep numeric values, driver versions and CPU flags with digits exact.
  if (/\d/.test(a) || /\d/.test(b)) return 0;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return 0;
  let prefix = 0;
  while (prefix < short.length && short[prefix] === long[prefix]) prefix++;
  if (prefix >= 4 && /^[а-я]+$/.test(short) && /^[а-я]+$/.test(long) && long.length - prefix <= 3) return 0.85;
  if (long.length === short.length && short[prefix] === long[prefix + 1] &&
    short[prefix + 1] === long[prefix] && short.slice(prefix + 2) === long.slice(prefix + 2)) return 0.78;
  if (long.length >= 5 && long.length - short.length <= 1 &&
    long.slice(prefix + 1) === short.slice(prefix + (long.length === short.length ? 1 : 0))) return 0.75;
  return 0;
}

/** Exact phrases, inflected words and a single-letter typo; never synthesize an answer. */
export function findKnowledge(query: string): KnowledgeEntry | null {
  const tokens = words(query.slice(0, MAX_ASSISTANT_QUERY)).slice(0, 24);
  const terms = [...new Set(tokens)];
  if (!terms.length) return null;
  const phraseText = ` ${tokens.join(" ")} `;
  let best: KnowledgeEntry | null = null;
  let bestScore = 0;
  for (const item of INDEX) {
    const matches = terms.map((term) => item.terms.reduce((score, word) => Math.max(score, similarity(term, word)), 0));
    const count = matches.filter(Boolean).length;
    const strength = matches.reduce((sum, score) => sum + score, 0);
    // One distinctive exact keyword can identify a topic inside a long question.
    const distinctive = item.phrases.some(([keyword, second]) => !second && keyword.length >= 4 &&
      TERM_COUNTS.get(keyword) === 1 && terms.includes(keyword));
    if (!count || (!distinctive && (strength < terms.length * 0.4 || (terms.length > 1 && count < 2)))) continue;
    const phraseScore = item.phrases.reduce((best, phrase) =>
      phrase.length >= 2 && phraseText.includes(` ${phrase.join(" ")} `) ? Math.max(best, phrase.length * 0.35) : best, 0);
    const score = strength + phraseScore + (distinctive ? 0.2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = item.entry;
    }
  }
  return best;
}
