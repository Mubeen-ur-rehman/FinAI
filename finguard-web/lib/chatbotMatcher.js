
import { FAQS, FAQ_FALLBACK } from "./chatbotFAQs";

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTokens(text) {
  const ignored = new Set([
    "the", "is", "a", "an", "to", "of", "in",
    "on", "for", "my", "me", "do", "does", "how",
    "can", "i", "what", "why", "where", "and",
    "it", "this", "that", "please", "with",
  ]);

  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 1 && !ignored.has(word));
}

export function findFAQ(userQuestion) {
  const question = normalize(userQuestion);

  if (!question) {
    return {
      answer: "Please type a question about FinGuard AI.",
      faq: null,
    };
  }

  let bestMatch = null;
  let bestScore = 0;

  const userTokens = new Set(getTokens(question));

  for (const faq of FAQS) {
    const candidates = [
      faq.question,
      ...faq.keywords,
    ].map(normalize);

    let score = 0;

    for (const candidate of candidates) {
      if (question === candidate) {
        score = Math.max(score, 1);
        continue;
      }

      if (
        candidate.length >= 5 &&
        (question.includes(candidate) || candidate.includes(question))
      ) {
        score = Math.max(score, 0.9);
      }

      const candidateTokens = getTokens(candidate);
      const matched = candidateTokens.filter((token) =>
        userTokens.has(token)
      ).length;

      const overlap =
        candidateTokens.length > 0
          ? matched / candidateTokens.length
          : 0;

      const coverage =
        userTokens.size > 0
          ? matched / userTokens.size
          : 0;

      const combinedScore = overlap * 0.65 + coverage * 0.35;

      score = Math.max(score, combinedScore);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  // Avoid displaying unrelated answers for vague questions.
  if (!bestMatch || bestScore < 0.48) {
    return {
      answer: FAQ_FALLBACK,
      faq: null,
    };
  }

  return {
    answer: bestMatch.answer,
    faq: bestMatch,
  };
}
