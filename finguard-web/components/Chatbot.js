
"use client";

import { useMemo, useState } from "react";
import { FAQS, FAQ_CATEGORIES, FAQ_FALLBACK } from "@/lib/chatbotFAQs";
import { findFAQ } from "@/lib/chatbotMatcher";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [showQuestions, setShowQuestions] = useState(true);

  const filteredFAQs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return FAQS.filter((faq) => {
      const matchesCategory =
        category === "All" || faq.category === category;

      const matchesSearch =
        !query ||
        faq.question.toLowerCase().includes(query) ||
        faq.keywords.some((word) =>
          word.toLowerCase().includes(query)
        );

      return matchesCategory && matchesSearch;
    }).slice(0, 12);
  }, [search, category]);

  function askQuestion(question) {
    const result = findFAQ(question);

    const userMessage = {
      id: Date.now() + "-user",
      role: "user",
      text: question,
    };

    const botMessage = {
      id: Date.now() + "-bot",
      role: "bot",
      text: result.answer || FAQ_FALLBACK,
      faq: result.faq,
    };

    setMessages((previous) => [
      ...previous,
      userMessage,
      botMessage,
    ]);

    setSearch("");
    setShowQuestions(false);
  }

  function handleSubmit(event) {
    event.preventDefault();

    const question = search.trim();

    if (!question) return;

    askQuestion(question);
  }

  function resetChat() {
    setMessages([]);
    setSearch("");
    setCategory("All");
    setFeedback({});
    setShowQuestions(true);
  }

  return (
    <>
      {/* Floating chatbot button */}
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        aria-label={isOpen ? "Close FinGuard Assistant" : "Open FinGuard Assistant"}
        className="fixed bottom-6 right-6 z-[9999] flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-gradient-to-br from-cyan-400 to-teal-500 text-3xl text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.25)] transition duration-300 hover:scale-110"
      >
        {isOpen ? "×" : "✦"}
      </button>

      {/* Chat window */}
      {isOpen && (
        <section
          className="fixed bottom-24 right-4 z-[9998] flex h-[min(680px,calc(100vh-130px))] w-[min(410px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#081827] shadow-2xl shadow-black/50"
          aria-label="FinGuard AI Assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#102D42] to-[#0C2436] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/15 text-2xl text-cyan-300">
                ✦
              </div>

              <div>
                <h3 className="font-bold text-white">
                  FinGuard Assistant
                </h3>
                <p className="text-xs text-cyan-300">
                  Your website help center
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetChat}
                title="New conversation"
                className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                ↻
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chatbot"
                className="rounded-lg px-3 py-2 text-xl text-slate-300 hover:bg-white/10"
              >
                ×
              </button>
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="max-w-[95%] rounded-2xl rounded-tl-sm border border-cyan-400/10 bg-[#122F43] p-4 text-sm leading-6 text-slate-200">
                  <p className="mb-2 font-semibold text-cyan-300">
                    Welcome to FinGuard AI! 👋
                  </p>
                  I can help you understand the dashboard, upload
                  datasets, fraud detection, alerts, reports, and
                  common website issues.
                  <p className="mt-2 text-xs text-slate-400">
                    Choose a question or type your own below.
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">
                      Browse questions
                    </h4>

                    <button
                      type="button"
                      onClick={() =>
                        setShowQuestions((previous) => !previous)
                      }
                      className="text-xs text-cyan-300"
                    >
                      {showQuestions ? "Hide" : "Show"}
                    </button>
                  </div>

                  {showQuestions && (
                    <>
                      <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
                        {["All", ...FAQ_CATEGORIES].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCategory(item)}
                            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
                              category === item
                                ? "border-cyan-400 bg-cyan-400/15 text-cyan-300"
                                : "border-white/10 text-slate-400 hover:border-cyan-400/40"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {filteredFAQs.map((faq) => (
                          <button
                            key={faq.id}
                            type="button"
                            onClick={() => askQuestion(faq.question)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left text-sm text-slate-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.06]"
                          >
                            <span>{faq.question}</span>
                            <span className="shrink-0 text-cyan-300">
                              →
                            </span>
                          </button>
                        ))}

                        {filteredFAQs.length === 0 && (
                          <p className="py-4 text-center text-sm text-slate-400">
                            No saved questions found.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl p-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-tr-sm bg-cyan-500 text-slate-950"
                      : "rounded-tl-sm border border-white/10 bg-[#122F43] text-slate-200"
                  }`}
                >
                  {message.text}

                  {message.role === "bot" && (
                    <div className="mt-3 border-t border-white/10 pt-2">
                      <p className="mb-2 text-[11px] text-slate-400">
                        {message.faq
                          ? `Category: ${message.faq.category}`
                          : "FinGuard Help Center"}
                      </p>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          Helpful?
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setFeedback((previous) => ({
                              ...previous,
                              [message.id]: "yes",
                            }))
                          }
                          className={`text-xs ${
                            feedback[message.id] === "yes"
                              ? "text-cyan-300"
                              : "text-slate-400 hover:text-cyan-300"
                          }`}
                        >
                          👍 Yes
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setFeedback((previous) => ({
                              ...previous,
                              [message.id]: "no",
                            }))
                          }
                          className={`text-xs ${
                            feedback[message.id] === "no"
                              ? "text-red-300"
                              : "text-slate-400 hover:text-red-300"
                          }`}
                        >
                          👎 No
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Search and question input */}
          <div className="border-t border-white/10 bg-[#0B2031] p-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ask about FinGuard AI..."
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#102B3F] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />

              <button
                type="submit"
                disabled={!search.trim()}
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 text-lg font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send question"
              >
                ➤
              </button>
            </form>

            <p className="mt-2 text-center text-[10px] text-slate-500">
              FinGuard AI Help Center · Predefined answers
            </p>
          </div>
        </section>
      )}
    </>
  );
}
