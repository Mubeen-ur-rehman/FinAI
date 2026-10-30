
import { FAQS, FAQ_FALLBACK } from "./chatbotFAQs";

function normalize(text) {
  return String(text ?? "")
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
    "are", "was", "were", "be", "will", "would",
    "could", "should", "your", "you", "about",
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

  if (!Array.isArray(FAQS) || FAQS.length === 0) {
    return {
      answer: FAQ_FALLBACK,
      faq: null,
    };
  }

  let bestMatch = null;
  let bestScore = 0;

  const userTokens = new Set(getTokens(question));

  for (const faq of FAQS) {
    if (!faq || typeof faq.question !== "string" || !faq.answer) {
      continue;
    }

    const keywords = Array.isArray(faq.keywords)
      ? faq.keywords
      : [];

    const candidates = [
      faq.question,
      ...keywords.filter((keyword) => typeof keyword === "string"),
    ].map(normalize).filter(Boolean);

    let score = 0;

    for (const candidate of candidates) {
      // Exact question or keyword match
      if (question === candidate) {
        score = Math.max(score, 1);
        continue;
      }

      // Strong phrase match
      if (
        candidate.length >= 5 &&
        (
          question.includes(candidate) ||
          candidate.includes(question)
        )
      ) {
        score = Math.max(score, 0.9);
      }

      const candidateTokens = getTokens(candidate);

      if (candidateTokens.length === 0 || userTokens.size === 0) {
        continue;
      }

      const matched = candidateTokens.filter((token) =>
        userTokens.has(token)
      ).length;

      const overlap = matched / candidateTokens.length;
      const coverage = matched / userTokens.size;

      const combinedScore =
        overlap * 0.65 + coverage * 0.35;

      score = Math.max(score, combinedScore);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  // Return fallback when no sufficiently relevant FAQ is found
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
