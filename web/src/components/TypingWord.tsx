"use client";

import { useEffect, useState } from "react";

const words = ["organized", "balanced"] as const;

export default function TypingWord() {
  const [wordIndex, setWordIndex] = useState(0);
  const [displayedWord, setDisplayedWord] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex];

    let delay = isDeleting ? 55 : 90;

    if (!isDeleting && displayedWord === currentWord) {
      delay = 1600;
    }

    const timer = window.setTimeout(() => {
      if (!isDeleting && displayedWord.length < currentWord.length) {
        setDisplayedWord(
          currentWord.slice(0, displayedWord.length + 1),
        );
        return;
      }

      if (!isDeleting && displayedWord === currentWord) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && displayedWord.length > 0) {
        setDisplayedWord(
          currentWord.slice(0, displayedWord.length - 1),
        );
        return;
      }

      setIsDeleting(false);

      setWordIndex((currentIndex) => {
        return (currentIndex + 1) % words.length;
      });
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [displayedWord, isDeleting, wordIndex]);

  return (
    <span className="inline-grid align-baseline text-[#6F9F73]">
      <span
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 whitespace-nowrap"
      >
        organized|
      </span>

      <span className="col-start-1 row-start-1 whitespace-nowrap">
        {displayedWord}

        <span
          aria-hidden="true"
          className="ml-[0.04em] inline-block animate-pulse font-normal text-[##6F9F73]"
        >
          |
        </span>
      </span>
    </span>
  );
}