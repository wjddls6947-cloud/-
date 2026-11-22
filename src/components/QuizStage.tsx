import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ClockAlert,
  Flame,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { QuizAnswerRecord, QuizQuestion, TimeLimitSeconds } from '../types/quiz';
import { soundEngine } from '../utils/sound';

interface QuizStageProps {
  quizTitle: string;
  questions: QuizQuestion[];
  timeLimit: TimeLimitSeconds;
  onFinishQuiz: (records: QuizAnswerRecord[]) => void;
}

const AUTO_ADVANCE_MS = 3000;

export function QuizStage({
  quizTitle,
  questions,
  timeLimit,
  onFinishQuiz,
}: QuizStageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'PLAYING' | 'REVEAL'>('PLAYING');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);
  const [remainingMs, setRemainingMs] = useState(timeLimit * 1000);
  const [revealRemainingMs, setRevealRemainingMs] = useState(AUTO_ADVANCE_MS);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);
  const [records, setRecords] = useState<QuizAnswerRecord[]>([]);

  const lastTickSecondRef = useRef<number | null>(null);
  const recordsRef = useRef<QuizAnswerRecord[]>([]);
  const phaseRef = useRef<'PLAYING' | 'REVEAL'>('PLAYING');

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Countdown timer during PLAYING phase
  useEffect(() => {
    if (phase !== 'PLAYING') return;

    const totalMs = timeLimit * 1000;
    const startTime = performance.now();
    lastTickSecondRef.current = null;
    setRemainingMs(totalMs);

    const intervalId = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const nextRemaining = Math.max(0, totalMs - elapsed);
      setRemainingMs(nextRemaining);

      // Subtle tick on final 3 seconds
      const secLeft = Math.ceil(nextRemaining / 1000);
      if (secLeft >= 1 && secLeft <= 3 && lastTickSecondRef.current !== secLeft) {
        lastTickSecondRef.current = secLeft;
        soundEngine.playTick();
      }

      if (nextRemaining <= 0) {
        window.clearInterval(intervalId);
        if (phaseRef.current !== 'PLAYING') return;

        // Handle Timeout
        phaseRef.current = 'REVEAL';
        setPhase('REVEAL');
        setSelectedOption(null);
        setIsTimeout(true);
        setStreak(0);
        setLastEarnedPoints(0);
        soundEngine.playTimeout();

        const record: QuizAnswerRecord = {
          questionId: currentQuestion.id,
          selectedIndex: null,
          isCorrect: false,
          isTimeout: true,
          timeSpentMs: totalMs,
          earnedPoints: 0,
        };
        const updated = [...recordsRef.current, record];
        recordsRef.current = updated;
        setRecords(updated);
      }
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [currentIndex, phase, timeLimit, currentQuestion.id]);

  // 3-second auto-advance timer during REVEAL phase
  useEffect(() => {
    if (phase !== 'REVEAL') return;

    const startTime = performance.now();
    setRevealRemainingMs(AUTO_ADVANCE_MS);

    const intervalId = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const next = Math.max(0, AUTO_ADVANCE_MS - elapsed);
      setRevealRemainingMs(next);

      if (next <= 0) {
        window.clearInterval(intervalId);
        advanceToNext();
      }
    }, 50);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  const advanceToNext = () => {
    if (currentIndex + 1 >= totalQuestions) {
      soundEngine.playVictory();
      onFinishQuiz(recordsRef.current);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setIsTimeout(false);
    setLastEarnedPoints(0);
    setRemainingMs(timeLimit * 1000);
    setRevealRemainingMs(AUTO_ADVANCE_MS);
    setPhase('PLAYING');
  };

  const handleSelectAnswer = (optionIdx: number) => {
    if (phase !== 'PLAYING') return;
    phaseRef.current = 'REVEAL';

    const totalMs = timeLimit * 1000;
    const spentMs = Math.max(0, totalMs - remainingMs);
    const isCorrect = optionIdx === currentQuestion.correctIndex;

    let earned = 0;
    if (isCorrect) {
      const speedBonus = Math.round((remainingMs / totalMs) * 50);
      const streakBonus = Math.min(streak * 15, 60);
      earned = 100 + speedBonus + streakBonus;
      setScore((prev) => prev + earned);
      setStreak((prev) => prev + 1);
      soundEngine.playCorrect();
    } else {
      setStreak(0);
      soundEngine.playIncorrect();
    }

    setSelectedOption(optionIdx);
    setIsTimeout(false);
    setLastEarnedPoints(earned);
    setPhase('REVEAL');

    const record: QuizAnswerRecord = {
      questionId: currentQuestion.id,
      selectedIndex: optionIdx,
      isCorrect,
      isTimeout: false,
      timeSpentMs: spentMs,
      earnedPoints: earned,
    };
    const updated = [...recordsRef.current, record];
    recordsRef.current = updated;
    setRecords(updated);
  };

  // Keyboard shortcuts during quiz
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'PLAYING') {
        if (currentQuestion.type === 'OX') {
          if (e.key === '1' || e.key.toLowerCase() === 'o') {
            e.preventDefault();
            handleSelectAnswer(0);
          } else if (e.key === '2' || e.key.toLowerCase() === 'x') {
            e.preventDefault();
            handleSelectAnswer(1);
          }
        } else {
          if (['1', '2', '3', '4'].includes(e.key)) {
            const idx = Number(e.key) - 1;
            if (idx < currentQuestion.options.length) {
              e.preventDefault();
              handleSelectAnswer(idx);
            }
          }
        }
      } else if (phase === 'REVEAL') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          advanceToNext();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, remainingMs]);

  const timerRatio = Math.max(0, Math.min(1, remainingMs / (timeLimit * 1000)));
  const secondsDisplay = (remainingMs / 1000).toFixed(1);
  const isUrgent = phase === 'PLAYING' && remainingMs <= 3000;
  const isWarning = phase === 'PLAYING' && remainingMs > 3000 && remainingMs <= 6000;

  const isCorrectReveal =
    phase === 'REVEAL' && selectedOption !== null && selectedOption === currentQuestion.correctIndex;
  const isWrongReveal = phase === 'REVEAL' && !isCorrectReveal;

  const revealProgress = Math.max(0, Math.min(1, 1 - revealRemainingMs / AUTO_ADVANCE_MS));
  const revealSecondsLeft = Math.max(1, Math.ceil(revealRemainingMs / 1000));

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6 sm:py-10">
      {/* Quiz Title & HUD Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-300">{quizTitle}</p>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
            <span className="font-mono font-bold text-white tabular-nums">
              문제 {String(currentIndex + 1).padStart(2, '0')} / {String(totalQuestions).padStart(2, '0')}
            </span>
            <span className="text-slate-500" aria-hidden="true">
              ·
            </span>
            <span className="font-semibold text-amber-300">
              {currentQuestion.type === 'OX' ? 'OX 퀴즈' : '객관식 4지선다'}
            </span>
          </div>
        </div>

        {/* Score & Streak */}
        <div className="flex items-center gap-5">
          {streak >= 2 && (
            <div className="flex items-center gap-1.5 text-sm font-bold text-amber-300">
              <Flame className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span className="font-mono tabular-nums">{streak}연속 정답</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2">
            <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span className="font-mono text-base font-extrabold text-white tabular-nums">
              {score.toLocaleString()}점
            </span>
          </div>
        </div>
      </div>

      {/* Countdown Timer Bar */}
      <div className="mb-6 rounded-xl border border-white/10 bg-[#121D3B] p-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Clock
              className={`h-4 w-4 ${
                isUrgent ? 'text-rose-400' : isWarning ? 'text-amber-300' : 'text-emerald-400'
              }`}
              aria-hidden="true"
            />
            <span>{phase === 'PLAYING' ? '남은 제한 시간' : '시간 정지'}</span>
          </div>
          <span
            className={`font-mono text-base font-extrabold tabular-nums ${
              isUrgent ? 'text-rose-400' : isWarning ? 'text-amber-300' : 'text-white'
            }`}
          >
            {secondsDisplay}초
          </span>
        </div>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full origin-left rounded-full transition-colors duration-150 ${
              isUrgent
                ? 'bg-rose-500'
                : isWarning
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            }`}
            style={{ transform: `scaleX(${timerRatio})` }}
          />
        </div>
      </div>

      {/* Main Question Stage Card */}
      <section
        className={`rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-9 ${
          isWrongReveal ? 'animate-quiz-shake' : isCorrectReveal ? 'animate-quiz-pop' : ''
        }`}
      >
        {/* Question Headline */}
        <h2 className="text-xl font-extrabold leading-snug text-slate-900 sm:text-2xl [text-wrap:balance]">
          {currentQuestion.question}
        </h2>

        {/* Answer Options */}
        {currentQuestion.type === 'OX' ? (
          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {['O', 'X'].map((symbol, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectChoice = currentQuestion.correctIndex === idx;
              const isO = idx === 0;

              let cardClasses =
                'border-slate-200 bg-slate-50 text-slate-900 hover:border-indigo-400 hover:bg-indigo-50/60';

              if (phase === 'REVEAL') {
                if (isCorrectChoice) {
                  cardClasses =
                    'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30';
                } else if (isSelected && !isCorrectChoice) {
                  cardClasses =
                    'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30';
                } else {
                  cardClasses = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                }
              }

              return (
                <button
                  key={symbol}
                  type="button"
                  disabled={phase !== 'PLAYING'}
                  onClick={() => handleSelectAnswer(idx)}
                  className={`group flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 p-6 transition-all duration-150 disabled:cursor-default ${cardClasses}`}
                >
                  <span
                    className={`text-5xl font-black tracking-tight ${
                      phase === 'REVEAL'
                        ? isCorrectChoice
                          ? 'text-emerald-600'
                          : isSelected
                            ? 'text-rose-600'
                            : 'text-slate-400'
                        : isO
                          ? 'text-indigo-600 group-hover:scale-105 transition-transform'
                          : 'text-rose-600 group-hover:scale-105 transition-transform'
                    }`}
                  >
                    {symbol}
                  </span>
                  <span className="mt-2 text-sm font-bold">
                    {isO ? '그렇다 (참)' : '아니다 (거짓)'}
                  </span>
                  {phase === 'PLAYING' ? (
                    <span className="mt-1.5 font-mono text-[11px] font-medium text-slate-400">
                      키보드 {isO ? 'O / 1' : 'X / 2'}
                    </span>
                  ) : (
                    <span className="mt-2 text-xs font-bold">
                      {isCorrectChoice ? '정답' : isSelected ? '내 선택' : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {currentQuestion.options.map((optionText, idx) => {
              const isSelected = selectedOption === idx;
              const isCorrectChoice = currentQuestion.correctIndex === idx;

              let cardClasses =
                'border-slate-200 bg-slate-50 text-slate-900 hover:border-indigo-500 hover:bg-indigo-50/70';
              let badgeClasses = 'bg-slate-200 text-slate-700';

              if (phase === 'REVEAL') {
                if (isCorrectChoice) {
                  cardClasses =
                    'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/30';
                  badgeClasses = 'bg-emerald-600 text-white';
                } else if (isSelected && !isCorrectChoice) {
                  cardClasses =
                    'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-500/30';
                  badgeClasses = 'bg-rose-600 text-white';
                } else {
                  cardClasses = 'border-slate-200 bg-slate-50 text-slate-400 opacity-60';
                  badgeClasses = 'bg-slate-200 text-slate-400';
                }
              }

              return (
                <button
                  key={`${currentQuestion.id}-opt-${idx}`}
                  type="button"
                  disabled={phase !== 'PLAYING'}
                  onClick={() => handleSelectAnswer(idx)}
                  className={`flex min-h-[68px] cursor-pointer items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all duration-150 disabled:cursor-default ${cardClasses}`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-extrabold tabular-nums ${badgeClasses}`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold leading-snug sm:text-base">
                      {optionText}
                    </span>
                  </div>
                  {phase === 'REVEAL' && isCorrectChoice && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700 whitespace-nowrap">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>정답</span>
                    </span>
                  )}
                  {phase === 'REVEAL' && isSelected && !isCorrectChoice && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-rose-700 whitespace-nowrap">
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      <span>내 선택</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Reveal Banner + Explanation + 3-second Auto-Advance */}
        {phase === 'REVEAL' && (
          <div
            className={`mt-7 rounded-xl border p-5 ${
              isCorrectReveal
                ? 'border-emerald-300 bg-emerald-50/90 text-emerald-950'
                : 'border-rose-300 bg-rose-50/90 text-rose-950'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {isCorrectReveal ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden="true" />
                ) : isTimeout ? (
                  <ClockAlert className="h-6 w-6 text-rose-600 shrink-0" aria-hidden="true" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-600 shrink-0" aria-hidden="true" />
                )}
                <span className="text-lg font-extrabold">
                  {isCorrectReveal ? '정답입니다!' : isTimeout ? '시간 초과! 오답입니다' : '오답입니다'}
                </span>
              </div>
              {isCorrectReveal && (
                <span className="font-mono text-sm font-extrabold text-emerald-700 tabular-nums">
                  +{lastEarnedPoints}점
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-800">
              <span className="font-bold text-slate-900">간단 해설: </span>
              {currentQuestion.explanation}
            </p>

            {/* 3-Second Auto-Advance Bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3.5">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>
                    {currentIndex + 1 >= totalQuestions
                      ? `${revealSecondsLeft}초 후 결과 화면으로 이동합니다`
                      : `${revealSecondsLeft}초 후 다음 문제로 자동 이동합니다`}
                  </span>
                  <span className="font-mono tabular-nums">
                    {(revealRemainingMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                  <div
                    className={`h-full origin-left rounded-full ${
                      isCorrectReveal ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                    style={{ transform: `scaleX(${revealProgress})` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={advanceToNext}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <span>{currentIndex + 1 >= totalQuestions ? '결과 바로 보기' : '바로 다음 문제'}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Subtle Progress Dots */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5" aria-hidden="true">
        {questions.map((q, idx) => {
          const rec = records[idx];
          let color = 'bg-white/15';
          if (idx === currentIndex && phase === 'PLAYING') color = 'bg-amber-400 scale-110';
          else if (rec?.isCorrect) color = 'bg-emerald-400';
          else if (rec && !rec.isCorrect) color = 'bg-rose-400';
          return <span key={q.id} className={`h-2 w-6 rounded-full transition-transform ${color}`} />;
        })}
      </div>
    </main>
  );
}
