"use client";

import { useEffect, useState } from "react";

const words = ["calm", "organized"] as const;

export default function TypingWord() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const word = words[wordIndex];

  useEffect(() => {
    const wordIsComplete = text === word;
    const wordIsEmpty = text.length === 0;
    const delay =
      wordIsComplete && !deleting ? 1500 : deleting ? 55 : 95;

    const timer = window.setTimeout(() => {
      if (wordIsComplete && !deleting) {
        setDeleting(true);
        return;
      }

      if (deleting && wordIsEmpty) {
        setDeleting(false);
        setWordIndex((current) => (current + 1) % words.length);
        return;
      }

      setText(
        deleting
          ? word.slice(0, Math.max(0, text.length - 1))
          : word.slice(0, text.length + 1),
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [deleting, text, word]);

  return (
    <span className="inline-flex items-baseline whitespace-nowrap text-[var(--blue-strong)]">
      {text}
      <span
        aria-hidden="true"
        className="typing-cursor ml-1 inline-block h-[0.82em] w-[3px] translate-y-[0.05em] bg-current"
      />
    </span>
  );
}
