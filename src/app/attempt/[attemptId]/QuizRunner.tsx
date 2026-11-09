"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Logo } from "@/components/AppHeader";
import { ThemeControls } from "@/components/ThemeControls";
import { saveAnswer, setFlag, submitAttempt } from "@/app/actions/quiz";

// The quiz screen: question panel, question, timer, flags and submit.
// Answers save to the server as they are chosen; scoring happens on the server.

type Question = { text: string; options: string[] };

const BANNER_AT = 15 * 60; // seconds left when the yellow reminder appears
const CRITICAL_AT = 5 * 60; // seconds left when the timer turns red and blinks

function FlagIcon({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M5 21V4h11l-1.5 4L16 12H7v9z" /></svg>;
}
function TickIcon({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

export function QuizRunner(props: {
  attemptId: string;
  title: string;
  userName: string;
  questions: Question[];
  initialAnswers: number[];
  initialFlagged: number[];
  deadline: number;
  serverNow: number;
}) {
  const { attemptId, questions } = props;
  const total = questions.length;
  const [answers, setAnswers] = useState<number[]>(props.initialAnswers);
  const [flagged, setFlagged] = useState<Set<number>>(new Set(props.initialFlagged));
  const [current, setCurrent] = useState(() => Math.max(0, props.initialAnswers.findIndex((a) => a === -1)));
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [submitting, startSubmit] = useTransition();
  const submittedRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Timer, kept in step with the server clock.
  const offset = useRef(0);
  useEffect(() => { offset.current = props.serverNow - Date.now(); }, [props.serverNow]);
  const secondsLeft = useCallback(() => Math.max(0, Math.floor((props.deadline - (Date.now() + offset.current)) / 1000)), [props.deadline]);
  // Start from the server's numbers so the first paint matches on server and browser.
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((props.deadline - props.serverNow) / 1000)));

  const submit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    startSubmit(() => submitAttempt(attemptId, answersRef.current));
  }, [attemptId]);

  useEffect(() => {
    const t = setInterval(() => {
      const s = secondsLeft();
      setLeft(s);
      if (s <= 0) submit();
    }, 500);
    return () => clearInterval(t);
  }, [secondsLeft, submit]);

  // Ask before leaving the page mid-quiz; discourage copying and printing.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (!submittedRef.current) e.preventDefault(); };
    const block = (e: Event) => e.preventDefault();
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "p", "s", "a", "u"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("keydown", keys);
    };
  }, []);

  const pendingSaves = useRef(0);
  const choose = async (choice: number) => {
    const pos = current;
    setAnswers((a) => a.map((v, i) => (i === pos ? choice : v)));
    pendingSaves.current++;
    setSaveState("saving");
    let ok = false;
    for (let tryNo = 0; tryNo < 3 && !ok; tryNo++) {
      try { ok = await saveAnswer(attemptId, pos, choice); } catch { ok = false; }
      if (!ok) await new Promise((r) => setTimeout(r, 800 * (tryNo + 1)));
    }
    pendingSaves.current--;
    setSaveState(ok ? (pendingSaves.current ? "saving" : "idle") : "error");
  };

  const toggleFlag = (pos: number) => {
    const on = !flagged.has(pos);
    setFlagged((f) => { const n = new Set(f); if (on) n.add(pos); else n.delete(pos); return n; });
    setFlag(attemptId, pos, on).catch(() => {});
  };

  const flaggedList = useMemo(() => [...flagged].sort((a, b) => a - b), [flagged]);
  const visible = flaggedOnly ? flaggedList : questions.map((_, i) => i);
  const answeredCount = answers.filter((a) => a !== -1).length;
  const unanswered = answers.map((a, i) => (a === -1 ? i : -1)).filter((i) => i >= 0);

  useEffect(() => { if (flaggedOnly && flaggedList.length === 0) setFlaggedOnly(false); }, [flaggedOnly, flaggedList.length]);

  // Next / Previous move through the visible list (all questions, or only flagged ones).
  const idx = visible.indexOf(current);
  const isLastVisible = idx === visible.length - 1;
  const isLastQuestion = current === total - 1;
  const goNext = () => {
    if (!isLastVisible) setCurrent(visible[idx + 1]);
    else if (flaggedOnly && !isLastQuestion) { setFlaggedOnly(false); }
    else setConfirming(true);
  };
  const goPrev = () => { if (idx > 0) setCurrent(visible[idx - 1]); };

  useEffect(() => {
    document.getElementById(`qbox-${current}`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [current]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const q = questions[current];

  const numberBox = (i: number) => {
    const isCurrent = i === current;
    const isAnswered = answers[i] !== -1;
    const bg = isCurrent ? "var(--q-current)" : isAnswered ? "var(--q-answered)" : "var(--q-unanswered)";
    const fg = isCurrent ? "var(--q-current-text)" : isAnswered ? "var(--q-answered-text)" : "var(--q-unanswered-text)";
    return (
      <button
        key={i}
        id={`qbox-${i}`}
        onClick={() => setCurrent(i)}
        className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold ${isCurrent ? "ring-2 ring-offset-2 ring-[var(--q-current)] ring-offset-[var(--surface)]" : ""}`}
        style={{ background: bg, color: fg }}
        aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}${flagged.has(i) ? ", flagged" : ""}`}
        aria-current={isCurrent}
      >
        {i + 1}
        {flagged.has(i) && <FlagIcon className="absolute right-0.5 top-0.5 h-3.5 w-3.5 text-flag" />}
        {isAnswered && <TickIcon className="absolute right-0.5 top-1/2 h-3 w-3 -translate-y-1/2 text-tick" />}
      </button>
    );
  };

  return (
    <div className="no-select flex flex-1 flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <Logo />
          <h1 className="min-w-0 flex-1 truncate font-bold">{props.title}</h1>
          <ThemeControls />
          <div
            className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${left <= CRITICAL_AT ? "timer-critical" : "bg-surface-2"}`}
            role="timer"
            aria-label={`${mm} minutes ${ss} seconds left`}
          >
            {mm}:{ss}
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pb-2 text-sm">
          <span className="whitespace-nowrap rounded-full bg-surface-2 px-3 py-1"><strong>{answeredCount}/{total}</strong> answered</span>
          <button
            onClick={() => { if (flaggedList.length) { setFlaggedOnly((f) => !f); if (!flaggedOnly) setCurrent(flaggedList[0]); } }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 font-semibold text-flag"
            style={{ borderColor: "var(--flag)", background: flaggedOnly ? "color-mix(in srgb, var(--flag) 18%, transparent)" : "transparent" }}
            aria-pressed={flaggedOnly}
            disabled={!flaggedList.length}
          >
            <FlagIcon className="h-4 w-4" /> Flagged: {flaggedList.length}
          </button>
          {flaggedOnly && <button className="text-primary underline" onClick={() => setFlaggedOnly(false)}>Show all</button>}
          <span className="ml-auto truncate text-right text-muted" aria-live="polite">
            {saveState === "saving" ? "Saving…" : saveState === "error" ? <span className="text-danger">Not saved. Check connection.</span> : "Saved"}
          </span>
        </div>
        {left <= BANNER_AT && left > CRITICAL_AT && !bannerClosed && (
          <div className="flex items-center gap-3 bg-warning-soft px-4 py-2 text-sm text-warning-text">
            <span className="mx-auto">Less than 15 minutes left. Check your flagged and unanswered questions.</span>
            <button onClick={() => setBannerClosed(true)} aria-label="Close reminder" className="font-bold">✕</button>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 md:flex-row">
        {/* Question panel: across the top on phones, on the left on wider screens */}
        <nav aria-label="Questions" className="md:w-64 md:shrink-0">
          <div className="card flex gap-2 overflow-x-auto p-3 md:grid md:grid-cols-5 md:overflow-visible">
            {visible.map(numberBox)}
          </div>
        </nav>

        {/* Question */}
        <main className="card flex flex-1 flex-col p-5 sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <span>Question {current + 1} of {total}</span>
            {flagged.has(current) && <span className="inline-flex items-center gap-1 text-flag"><FlagIcon className="h-4 w-4" /> Flagged</span>}
          </div>
          <p className="mt-3 whitespace-pre-line text-lg font-medium leading-relaxed sm:text-xl">{q.text}</p>
          <div className="mt-5 space-y-3" role="radiogroup" aria-label={`Answer options for question ${current + 1}`}>
            {q.options.map((opt, i) => {
              const picked = answers[current] === i;
              return (
                <button
                  key={i}
                  role="radio"
                  aria-checked={picked}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${picked ? "border-primary bg-primary-soft" : "border-border hover:border-muted"}`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold ${picked ? "border-primary bg-primary text-on-primary" : "border-border"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-base sm:text-lg">{opt}</span>
                </button>
              );
            })}
          </div>
          {answers[current] !== -1 && (
            <button onClick={() => choose(-1)} className="mt-3 self-start text-sm text-muted underline">Clear my answer</button>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
            <button className="btn btn-secondary" onClick={goPrev} disabled={idx <= 0}>Previous</button>
            <button
              className="btn border-2"
              style={{ borderColor: "var(--flag)", color: "var(--flag)", background: flagged.has(current) ? "color-mix(in srgb, var(--flag) 15%, transparent)" : "transparent" }}
              onClick={() => toggleFlag(current)}
              aria-pressed={flagged.has(current)}
            >
              <FlagIcon className="h-4 w-4" /> {flagged.has(current) ? "Unflag" : "Flag"}
            </button>
            <button className="btn btn-primary ml-auto" onClick={goNext} disabled={submitting}>
              {!isLastVisible ? "Next" : flaggedOnly && !isLastQuestion ? "Return" : "Submit"}
            </button>
          </div>
        </main>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="submit-title">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <h2 id="submit-title" className="text-xl font-bold">Submit your quiz?</h2>
            {unanswered.length === 0 ? (
              <p className="mt-3">You have answered all {total} questions.</p>
            ) : (
              <>
                <p className="mt-3"><strong>{unanswered.length}</strong> of {total} questions are not answered. Unanswered questions count as wrong.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {unanswered.slice(0, 30).map((i) => (
                    <button key={i} className="h-9 w-9 rounded-lg text-sm font-bold" style={{ background: "var(--q-unanswered)", color: "var(--q-unanswered-text)" }}
                      onClick={() => { setConfirming(false); setFlaggedOnly(false); setCurrent(i); }}>{i + 1}</button>
                  ))}
                </div>
              </>
            )}
            {flaggedList.length > 0 && <p className="mt-3 text-sm text-flag">{flaggedList.length} question{flaggedList.length > 1 ? "s are" : " is"} still flagged.</p>}
            <div className="mt-6 flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={() => setConfirming(false)} disabled={submitting}>Keep working</button>
              <button className="btn btn-primary flex-1" onClick={submit} disabled={submitting}>{submitting ? "Submitting…" : "Submit now"}</button>
            </div>
          </div>
        </div>
      )}
      {submitting && !confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="card px-6 py-4 font-semibold">Time is up. Submitting your answers…</div></div>
      )}
    </div>
  );
}
