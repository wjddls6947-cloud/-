import { useState } from 'react';
import {
  CheckCircle2,
  ClockAlert,
  Home,
  RotateCcw,
  Trophy,
  XCircle,
} from 'lucide-react';
import type { QuizAnswerRecord, QuizQuestion } from '../types/quiz';
import { soundEngine } from '../utils/sound';

interface ResultStageProps {
  quizTitle: string;
  sourceSummary?: string;
  questions: QuizQuestion[];
  records: QuizAnswerRecord[];
  onReplaySameConfig: () => void;
  onGoSetup: () => void;
}

export function ResultStage({
  quizTitle,
  sourceSummary,
  questions,
  records,
  onReplaySameConfig,
  onGoSetup,
}: ResultStageProps) {
  const [filter, setFilter] = useState<'all' | 'wrong'>('all');

  const totalCount = questions.length;
  const correctCount = records.filter((r) => r.isCorrect).length;
  const wrongCount = totalCount - correctCount;
  const totalScore = records.reduce((sum, r) => sum + r.earnedPoints, 0);
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  let bestStreak = 0;
  let currentStreak = 0;
  for (const r of records) {
    if (r.isCorrect) {
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  const avgSeconds =
    records.length > 0
      ? (records.reduce((s, r) => s + r.timeSpentMs, 0) / records.length / 1000).toFixed(1)
      : '0.0';

  const oxQuestions = questions.filter((q) => q.type === 'OX');
  const oxCorrect = oxQuestions.filter((q) => {
    const rec = records.find((r) => r.questionId === q.id);
    return rec?.isCorrect;
  }).length;

  const mcQuestions = questions.filter((q) => q.type === 'MULTIPLE_CHOICE');
  const mcCorrect = mcQuestions.filter((q) => {
    const rec = records.find((r) => r.questionId === q.id);
    return rec?.isCorrect;
  }).length;

  const visibleItems = questions
    .map((question, idx) => ({
      question,
      index: idx,
      record: records.find((r) => r.questionId === question.id),
    }))
    .filter((item) => (filter === 'wrong' ? !item.record?.isCorrect : true));

  const gradeHeadline =
    accuracy >= 90
      ? '완벽에 가까운 퀴즈쇼 챔피언!'
      : accuracy >= 70
        ? '핵심 개념을 탄탄히 익혔어요!'
        : accuracy >= 50
          ? '좋은 출발이에요! 오답만 짚어볼까요?'
          : '해설을 보며 배운 내용을 복습해봐요!';

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12">
      {/* Summary Hero Card */}
      <section className="rounded-2xl border border-white/15 bg-[#121D3B] p-6 text-white shadow-2xl sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              <span>{quizTitle}</span>
              <span aria-hidden="true">·</span>
              <span>최종 결과</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl [text-wrap:balance]">
              {gradeHeadline}
            </h1>
            {sourceSummary && (
              <p className="mt-2 max-w-2xl text-sm text-slate-300">{sourceSummary}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReplaySameConfig();
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>같은 설정으로 새 퀴즈</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onGoSetup();
              }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15 whitespace-nowrap shrink-0"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>처음 화면으로</span>
            </button>
          </div>
        </div>

        {/* 4-column KPI strip */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium text-slate-300">최종 점수</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-amber-300 tabular-nums">
              {totalScore.toLocaleString()}점
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium text-slate-300">정답률</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-400 tabular-nums">
              {accuracy}% ({correctCount}/{totalCount})
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium text-slate-300">최고 연속 정답</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-white tabular-nums">
              {bestStreak}콤보
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium text-slate-300">평균 풀이 시간</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-white tabular-nums">
              {avgSeconds}초
            </p>
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
          {oxQuestions.length > 0 && (
            <span className="font-mono tabular-nums">
              OX 퀴즈: {oxCorrect}/{oxQuestions.length} 정답
            </span>
          )}
          {oxQuestions.length > 0 && mcQuestions.length > 0 && (
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
          )}
          {mcQuestions.length > 0 && (
            <span className="font-mono tabular-nums">
              객관식 퀴즈: {mcCorrect}/{mcQuestions.length} 정답
            </span>
          )}
        </div>
      </section>

      {/* Review List */}
      <section className="mt-8 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
              배운 내용 정리 · 전체 문제 해설
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              방금 푼 문제와 해설을 한눈에 다시 확인하세요
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 문제 ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('wrong')}
              className={`cursor-pointer rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filter === 'wrong'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              틀린 문제 ({wrongCount})
            </button>
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
            <p className="mt-3 text-base font-bold text-slate-900">
              틀린 문제가 하나도 없습니다!
            </p>
            <p className="mt-1 text-xs text-slate-500">
              모든 문제를 정확히 맞히셨습니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {visibleItems.map(({ question, index, record }) => {
              const isCorrect = Boolean(record?.isCorrect);
              const isTimeout = Boolean(record?.isTimeout);
              const correctAnswerText = question.options[question.correctIndex];
              const userAnswerText =
                record && record.selectedIndex !== null
                  ? question.options[record.selectedIndex]
                  : null;

              return (
                <article key={question.id} className="py-5 first:pt-6 last:pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span className="font-mono font-bold text-slate-800 tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{question.type === 'OX' ? 'OX 퀴즈' : '객관식'}</span>
                    </div>

                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>정답</span>
                      </span>
                    ) : isTimeout ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                        <ClockAlert className="h-4 w-4" aria-hidden="true" />
                        <span>시간 초과 (오답)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        <span>오답</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-base font-bold leading-snug text-slate-900">
                    {question.question}
                  </h3>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-emerald-800">
                      정답: {correctAnswerText}
                    </span>
                    {!isCorrect && userAnswerText && (
                      <span className="font-medium text-rose-700">
                        내 선택: {userAnswerText}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {question.explanation}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
