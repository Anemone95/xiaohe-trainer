"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CardKind = "声母" | "韵母";

type Card = {
  id: string;
  prompt: string;
  key: string;
  kind: CardKind;
};

type ReviewState = {
  level: number;
  due: number;
  mistakes: number;
};

type MistakeLog = {
  id: string;
  prompt: string;
  key: string;
  time: number;
  source: "direct" | "slow";
};

const INITIALS: Card[] = [
  ..."bpmfdtnlgkhjqxrzcsyw".split("").map((letter) => ({
    id: `initial-${letter}`,
    prompt: letter,
    key: letter,
    kind: "声母" as const,
  })),
  { id: "initial-zh", prompt: "zh", key: "v", kind: "声母" },
  { id: "initial-ch", prompt: "ch", key: "i", kind: "声母" },
  { id: "initial-sh", prompt: "sh", key: "u", kind: "声母" },
];

const FINAL_MAP: Record<string, string[]> = {
  q: ["iu"], w: ["ei"], e: ["e"], r: ["uan"], t: ["üe", "ue"],
  y: ["un"], u: ["u"], i: ["i"], o: ["o", "uo"], p: ["ie"],
  a: ["a"], s: ["ong", "iong"], d: ["ai"], f: ["en"], g: ["eng"],
  h: ["ang"], j: ["an"], k: ["ing", "uai"], l: ["uang", "iang"],
  z: ["ou"], x: ["ua", "ia"], c: ["ao"], v: ["ui"], b: ["in"],
  n: ["iao"], m: ["ian"],
};

const FINALS: Card[] = Object.entries(FINAL_MAP).flatMap(([key, prompts]) =>
  prompts.map((prompt) => ({ id: `final-${prompt}`, prompt, key, kind: "韵母" as const })),
);
const CARDS = [...INITIALS, ...FINALS];
const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));
const SELF_CARDS = CARDS.filter((card) => card.prompt === card.key);
const REVIEW_INTERVALS = [0, 60_000, 10 * 60_000, 60 * 60_000, 24 * 60 * 60_000,
  3 * 24 * 60 * 60_000, 7 * 24 * 60 * 60_000, 15 * 24 * 60 * 60_000, 30 * 24 * 60 * 60_000];
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const STORAGE_KEY = "xiaohe-shuangpin-progress-v1";
const FIRST_ANSWER_TIMEOUT_MS = 5_000;
const SECOND_ANSWER_TIMEOUT_MS = 8_000;

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function loadProgress(): { reviews: Record<string, ReviewState>; mistakes: MistakeLog[]; correct: number; total: number; timedMode: boolean } {
  if (typeof window === "undefined") return { reviews: {}, mistakes: [], correct: 0, total: 0, timedMode: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return saved && typeof saved === "object"
      ? { reviews: saved.reviews ?? {}, mistakes: saved.mistakes ?? [], correct: saved.correct ?? 0, total: saved.total ?? 0, timedMode: saved.timedMode ?? false }
      : { reviews: {}, mistakes: [], correct: 0, total: 0, timedMode: false };
  } catch {
    return { reviews: {}, mistakes: [], correct: 0, total: 0, timedMode: false };
  }
}

export default function Home() {
  const [card, setCard] = useState<Card>(INITIALS[0]);
  const [misses, setMisses] = useState<("direct" | "slow")[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "wrong" | "slow" | "revealed" | "correct">("idle");
  const [pressedKey, setPressedKey] = useState("");
  const [reviews, setReviews] = useState<Record<string, ReviewState>>({});
  const [mistakes, setMistakes] = useState<MistakeLog[]>([]);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [timedMode, setTimedMode] = useState(false);
  const [ready, setReady] = useState(false);
  const shortReviews = useRef<{ id: string; remaining: number }[]>([]);
  const answerTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const timerToken = useRef(0);

  const chooseNext = useCallback((currentId?: string) => {
    shortReviews.current = shortReviews.current.map((item) => ({ ...item, remaining: item.remaining - 1 }));
    const rapid = shortReviews.current.find((item) => item.remaining <= 0 && item.id !== currentId);
    if (rapid) {
      shortReviews.current = shortReviews.current.filter((item) => item !== rapid);
      return CARD_BY_ID.get(rapid.id) ?? INITIALS[0];
    }

    const now = Date.now();
    const dueCards = Object.entries(reviews)
      .filter(([id, state]) => state.due <= now && id !== currentId)
      .map(([id]) => CARD_BY_ID.get(id))
      .filter((item): item is Card => Boolean(item));
    if (dueCards.length && Math.random() < 0.72) return randomFrom(dueCards);

    let pool: Card[];
    const roll = Math.random();
    if (roll < 0.08) pool = SELF_CARDS;
    else if (roll < 0.52) pool = INITIALS;
    else pool = FINALS;
    const candidates = pool.filter((item) => item.id !== currentId);
    return randomFrom(candidates.length ? candidates : pool);
  }, [reviews]);

  useEffect(() => {
    const saved = loadProgress();
    setReviews(saved.reviews);
    setMistakes(saved.mistakes);
    setCorrect(saved.correct);
    setTotal(saved.total);
    setTimedMode(saved.timedMode);
    setCard(randomFrom(CARDS));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ reviews, mistakes, correct, total, timedMode }));
  }, [reviews, mistakes, correct, total, timedMode, ready]);

  const clearAnswerTimer = useCallback(() => {
    timerToken.current += 1;
    if (answerTimer.current !== null) window.clearTimeout(answerTimer.current);
    answerTimer.current = null;
  }, []);

  const nextCard = useCallback(() => {
    setCard((current) => chooseNext(current.id));
    setMisses([]);
    setFeedback("idle");
    setPressedKey("");
  }, [chooseNext]);

  const registerMiss = useCallback((source: "direct" | "slow") => {
    setTotal((value) => value + 1);
    const nextMisses = [...misses, source];
    setMisses(nextMisses);
    if (nextMisses.length < 2) {
      setFeedback(source === "direct" ? "wrong" : "slow");
      return;
    }

    setFeedback("revealed");
    const strongestSource = nextMisses.includes("direct") ? "direct" : "slow";
    const log: MistakeLog = { id: card.id, prompt: card.prompt, key: card.key, time: Date.now(), source: strongestSource };
    setMistakes((current) => [log, ...current.filter((item) => item.id !== card.id)].slice(0, 12));
    setReviews((current) => ({
      ...current,
      [card.id]: { level: 0, due: Date.now(), mistakes: (current[card.id]?.mistakes ?? 0) + 1 },
    }));
    if (!shortReviews.current.some((item) => item.id === card.id)) {
      shortReviews.current.push({ id: card.id, remaining: strongestSource === "direct" ? 3 : 5 });
    }
  }, [card, misses]);

  const answer = useCallback((key: string) => {
    const normalized = key.toLowerCase();
    if (!/^[a-z]$/.test(normalized)) return;
    clearAnswerTimer();
    setPressedKey(normalized);

    if (normalized === card.key) {
      setTotal((value) => value + 1);
      setCorrect((value) => value + 1);
      setFeedback("correct");
      const previous = reviews[card.id];
      if (previous) {
        const level = Math.min(previous.level + 1, REVIEW_INTERVALS.length - 1);
        setReviews((current) => ({
          ...current,
          [card.id]: { ...current[card.id], level, due: Date.now() + REVIEW_INTERVALS[level] },
        }));
      }
      window.setTimeout(nextCard, 180);
      return;
    }

    registerMiss("direct");
  }, [card, clearAnswerTimer, nextCard, registerMiss, reviews]);

  useEffect(() => {
    clearAnswerTimer();
    if (!ready || !timedMode || feedback === "revealed" || feedback === "correct") return;
    const token = timerToken.current;
    answerTimer.current = window.setTimeout(() => {
      if (timerToken.current !== token) return;
      answerTimer.current = null;
      registerMiss("slow");
    }, misses.length === 0 ? FIRST_ANSWER_TIMEOUT_MS : SECOND_ANSWER_TIMEOUT_MS);
    return clearAnswerTimer;
  }, [card.id, clearAnswerTimer, feedback, misses.length, ready, registerMiss, timedMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      answer(event.key);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [answer]);

  const accuracy = total ? Math.round((correct / total) * 100) : 100;
  const dueCount = useMemo(() => Object.values(reviews).filter((item) => item.due <= Date.now()).length, [reviews, card]);

  const resetProgress = () => {
    if (!window.confirm("清空全部练习进度和错题记录？")) return;
    localStorage.removeItem(STORAGE_KEY);
    setReviews({});
    setMistakes([]);
    setCorrect(0);
    setTotal(0);
    setTimedMode(false);
    shortReviews.current = [];
    setCard(randomFrom(CARDS));
    setMisses([]);
    setFeedback("idle");
    setPressedKey("");
  };

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">鹤</span><span>小鹤双拼练习</span></div>
        <div className="topbar-actions">
          <label className="timer-toggle">
            <input type="checkbox" checked={timedMode} onChange={(event) => setTimedMode(event.target.checked)} />
            <span className="toggle-track" aria-hidden="true"><i /></span>
            <span>计时模式</span>
          </label>
          <div className="stats" aria-label="练习统计">
            <span><b>{accuracy}%</b> 正确率</span>
            <span><b>{correct}</b> 答对</span>
            <span><b>{dueCount}</b> 待复习</span>
          </div>
        </div>
      </header>

      <section className={`practice-card ${feedback}`} aria-live="polite">
        <div className="kind-pill">{card.kind}</div>
        <p className="instruction">请按对应的小鹤双拼键</p>
        <h1>{card.prompt}</h1>
        <div className="answer-area">
          {feedback === "idle" && <span className="hint">直接按键作答</span>}
          {feedback === "wrong" && <span className="error-text">不对，再试一次</span>}
          {feedback === "slow" && <span className="slow-text">反应稍慢，继续作答</span>}
          {feedback === "revealed" && <span className="reveal">正确按键是 <kbd>{card.key.toUpperCase()}</kbd></span>}
          {feedback === "correct" && <span className="success-text">正确</span>}
        </div>
        <div className="attempt-dots" aria-label={`已错 ${misses.length} 次`}>
          <i className={misses[0] ? `used ${misses[0]}` : ""} />
          <i className={misses[1] ? `used ${misses[1]}` : ""} />
        </div>
      </section>

      <section className="keyboard" aria-label="屏幕键盘">
        {KEY_ROWS.map((row) => (
          <div className="key-row" key={row}>
            {row.split("").map((key) => {
              const isPressed = pressedKey === key;
              const state = isPressed ? (key === card.key ? "key-correct" : "key-wrong") : "";
              return <button type="button" className={`key ${state}`} key={key} onClick={() => answer(key)}>{key.toUpperCase()}</button>;
            })}
          </div>
        ))}
      </section>

      <div className="lower-grid">
        <section className="panel mistake-panel">
          <div className="panel-title"><h2>近期错题</h2><span>{mistakes.length ? "会自动安排复习" : "还没有错题"}</span></div>
          {mistakes.length ? (
            <div className="mistake-list">
              {mistakes.slice(0, 6).map((item) => (
                <div className="mistake-item" key={item.id}>
                  <span>{item.prompt}</span><span className="arrow">→</span><kbd>{item.key.toUpperCase()}</kbd>
                  {item.source === "slow" && <small>慢</small>}
                </div>
              ))}
            </div>
          ) : <p className="empty-copy">连续错两次的项目会出现在这里。</p>}
        </section>

        <details className="panel reference-panel">
          <summary>查看小鹤键位表</summary>
          <div className="mapping-grid">
            {Object.entries(FINAL_MAP).map(([key, values]) => (
              <div className="mapping" key={key}><kbd>{key.toUpperCase()}</kbd><span>{values.join(" · ")}</span></div>
            ))}
          </div>
          <p className="initial-note">特殊声母：zh → V　ch → I　sh → U；其余声母按本身字母。</p>
        </details>
      </div>

      <footer>
        <span>错题会先短期重现，再逐步拉长复习间隔</span>
        <button type="button" onClick={resetProgress}>清空进度</button>
      </footer>
    </main>
  );
}
