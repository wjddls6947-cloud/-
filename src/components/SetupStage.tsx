import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertCircle,
  BookOpen,
  Clock,
  FileText,
  Hash,
  Minus,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { QuizConfig, TimeLimitSeconds, UploadedLessonFile } from '../types/quiz';
import { soundEngine } from '../utils/sound';

interface SetupStageProps {
  config: QuizConfig;
  errorMessage: string | null;
  onUpdateConfig: (partial: Partial<QuizConfig>) => void;
  onStartGame: () => void;
  onClearError: () => void;
}

const QUESTION_PRESETS = [5, 10, 15, 20];
const TIME_OPTIONS: Array<{ seconds: TimeLimitSeconds; label: string; hint: string }> = [
  { seconds: 5, label: '5초', hint: '스피드 퀴즈' },
  { seconds: 10, label: '10초', hint: '표준 속도' },
  { seconds: 15, label: '15초', hint: '여유 있게' },
];

const QUICK_TOPICS = [
  '광합성과 세포 호흡의 원리',
  '조선 후기 실학 사상과 주요 학자',
  'HTTP 프로토콜과 REST API 구조',
  '기후 변화와 탄소 중립 에너지',
];

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF 교안';
  if (lower.endsWith('.pptx')) return 'PPTX 슬라이드';
  if (lower.endsWith('.md')) return '마크다운 문서';
  return '텍스트 문서';
}

export function SetupStage({
  config,
  errorMessage,
  onUpdateConfig,
  onStartGame,
  onClearError,
}: SetupStageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localFileError, setLocalFileError] = useState<string | null>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setLocalFileError(null);
    onClearError();

    const lower = file.name.toLowerCase();
    if (lower.endsWith('.ppt') && !lower.endsWith('.pptx')) {
      setLocalFileError(
        '구형 .ppt 파일은 직접 읽을 수 없습니다. PowerPoint에서 [.pptx] 또는 [.pdf]로 저장해 올려주세요.'
      );
      return;
    }

    const allowed =
      lower.endsWith('.pdf') ||
      lower.endsWith('.pptx') ||
      lower.endsWith('.txt') ||
      lower.endsWith('.md') ||
      lower.endsWith('.csv');

    if (!allowed) {
      setLocalFileError('PDF(.pdf), PowerPoint(.pptx), 또는 텍스트(.txt, .md) 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setLocalFileError('파일 크기가 20MB를 초과했습니다. 20MB 이하의 교안 파일을 올려주세요.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const uploaded: UploadedLessonFile = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataBase64: result,
      };
      onUpdateConfig({ mode: 'file', file: uploaded });
    };
    reader.onerror = () => {
      setLocalFileError('파일을 읽는 중 문제가 발생했습니다. 다시 선택해주세요.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleCountChange = (next: number) => {
    const clamped = Math.min(30, Math.max(1, Math.round(next)));
    onUpdateConfig({ questionCount: clamped });
  };

  const handlePreviewSound = () => {
    soundEngine.unlock();
    const prev = soundEngine.isEnabled();
    soundEngine.setEnabled(true);
    soundEngine.playCorrect();
    soundEngine.setEnabled(prev);
  };

  const canStart =
    config.mode === 'keyword'
      ? config.keyword.trim().length > 0
      : config.file !== null;

  const displayedError = localFileError || errorMessage;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-12">
      {/* Hero Headline */}
      <section className="mb-8 sm:mb-10">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-amber-300">
          <span>OX 퀴즈 · 4지선다 객관식 랜덤 혼합</span>
          <span aria-hidden="true">·</span>
          <span>정답 해설 3초 자동 진행</span>
        </div>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl [text-wrap:balance]">
          수업 교안이나 키워드로
          <span className="text-amber-400"> 실시간 복습 퀴즈쇼</span>를 시작하세요
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          배운 주제를 입력하거나 PDF·PPT 교안을 올리면 OX와 객관식 문제를 랜덤으로 섞어 출제합니다.
          문제당 제한 시간을 고르고 바로 게임에 도전해보세요.
        </p>
      </section>

      {displayedError && (
        <div
          role="alert"
          className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-rose-400/40 bg-rose-950/60 px-5 py-4 text-sm text-rose-100"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" aria-hidden="true" />
            <div>
              <p className="font-semibold text-rose-200">확인해주세요</p>
              <p className="mt-0.5 text-rose-100/90">{displayedError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLocalFileError(null);
              onClearError();
            }}
            className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-400/20 whitespace-nowrap shrink-0"
          >
            닫기
          </button>
        </div>
      )}

      {/* Main 2-Column Stage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        {/* Left: Input Source Card (Light surface for maximum clarity & contrast) */}
        <section
          id="source-panel"
          className="flex flex-col justify-between rounded-2xl bg-white p-6 text-slate-900 shadow-2xl sm:p-8 lg:col-span-7"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  1. 학습 자료 선택
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  키워드 입력 또는 수업 교안(PDF · PPTX) 중 한 가지를 선택하세요
                </p>
              </div>

              {/* Segmented Mode Switch */}
              <div
                role="tablist"
                aria-label="입력 방식 선택"
                className="flex items-center gap-1 rounded-xl bg-slate-100 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={config.mode === 'keyword'}
                  onClick={() => {
                    soundEngine.playClick();
                    setLocalFileError(null);
                    onUpdateConfig({ mode: 'keyword' });
                  }}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    config.mode === 'keyword'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>키워드 입력</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={config.mode === 'file'}
                  onClick={() => {
                    soundEngine.playClick();
                    setLocalFileError(null);
                    onUpdateConfig({ mode: 'file' });
                  }}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    config.mode === 'file'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>교안 파일 업로드</span>
                </button>
              </div>
            </div>

            {/* Tab Panel Content */}
            {config.mode === 'keyword' ? (
              <div className="mt-6">
                <label
                  htmlFor="keyword-input"
                  className="block text-sm font-semibold text-slate-800"
                >
                  수업 주제나 정리할 핵심 키워드
                </label>
                <textarea
                  id="keyword-input"
                  rows={6}
                  value={config.keyword}
                  onChange={(e) => {
                    if (errorMessage) onClearError();
                    onUpdateConfig({ keyword: e.target.value });
                  }}
                  placeholder="예: 세포 분열(체세포 분열과 감수 분열의 차이), 또는 수업 시간에 필기한 요약 문장을 그대로 붙여넣으세요."
                  className="mt-2.5 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />

                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-500">
                    빠른 예시 주제로 바로 채우기
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUICK_TOPICS.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onClearError();
                          onUpdateConfig({ keyword: topic });
                        }}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50/70 hover:text-indigo-900 truncate"
                        title={topic}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.pptx,.txt,.md,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  aria-label="수업 교안 파일 선택"
                />

                {!config.file ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      isDragging
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-700">
                      <Upload className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-sm font-bold text-slate-900">
                      여기를 클릭하거나 교안 파일을 끌어다 놓으세요
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500">
                      지원 형식: PDF (.pdf) · PowerPoint (.pptx) · 텍스트 (.txt, .md) · 최대 20MB
                    </p>
                    <span className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                      파일 찾아보기
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
                          <FileText className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">
                            {config.file.name}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                            <span>{getFileTypeLabel(config.file.name)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatBytes(config.file.size)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onUpdateConfig({ file: null });
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-rose-300 hover:text-rose-700 whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>제거</span>
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-indigo-200/70 pt-3 text-xs text-indigo-900">
                      <span>업로드 완료 · 교안 핵심 내용 기반으로 출제됩니다</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer font-semibold underline underline-offset-2 hover:text-indigo-700 whitespace-nowrap shrink-0"
                      >
                        다른 파일 선택
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
            OX 퀴즈와 4지선다 객관식이 매 게임마다 무작위 순서와 비율로 섞여 생성됩니다.
          </div>
        </section>

        {/* Right: Quiz Rules & Start CTA */}
        <section
          id="rules-panel"
          className="flex flex-col justify-between rounded-2xl border border-white/15 bg-[#121D3B] p-6 text-white shadow-2xl sm:p-8 lg:col-span-5"
        >
          <div className="space-y-7">
            <div className="border-b border-white/10 pb-5">
              <h2 className="text-lg font-bold text-white sm:text-xl">
                2. 퀴즈 규칙 설정
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                문제 수와 한 문제당 제한 시간을 정해주세요
              </p>
            </div>

            {/* Question Count */}
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="question-count-input"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-100"
                >
                  <Hash className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <span>총 문제 개수</span>
                </label>
                <span className="font-mono text-sm font-bold text-amber-300 tabular-nums">
                  {config.questionCount}문제
                </span>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {QUESTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      handleCountChange(preset);
                    }}
                    className={`cursor-pointer rounded-xl border py-2.5 font-mono text-sm font-bold transition-colors tabular-nums whitespace-nowrap ${
                      config.questionCount === preset
                        ? 'border-amber-400 bg-amber-400 text-slate-950'
                        : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    {preset}개
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2">
                <span className="text-xs text-slate-300">직접 조절 (1~30문제)</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="문제 수 1 감소"
                    onClick={() => {
                      soundEngine.playClick();
                      handleCountChange(config.questionCount - 1);
                    }}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <input
                    id="question-count-input"
                    type="number"
                    min={1}
                    max={30}
                    value={config.questionCount}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (!Number.isNaN(v)) handleCountChange(v);
                    }}
                    className="w-14 rounded-lg border border-white/15 bg-[#0B1226] py-1 text-center font-mono text-sm font-bold text-white tabular-nums focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    aria-label="문제 수 1 증가"
                    onClick={() => {
                      soundEngine.playClick();
                      handleCountChange(config.questionCount + 1);
                    }}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/20"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* Time Limit per Question */}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Clock className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>한 문제당 제한 시간</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {TIME_OPTIONS.map((opt) => {
                  const selected = config.timeLimit === opt.seconds;
                  return (
                    <button
                      key={opt.seconds}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onUpdateConfig({ timeLimit: opt.seconds });
                      }}
                      className={`cursor-pointer rounded-xl border px-3 py-3 text-center transition-colors ${
                        selected
                          ? 'border-amber-400 bg-amber-400 text-slate-950'
                          : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-mono text-base font-extrabold tabular-nums">
                        {opt.label}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] font-medium ${
                          selected ? 'text-slate-900' : 'text-slate-300'
                        }`}
                      >
                        {opt.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sound Toggle & Preview */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-2.5">
                {config.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-amber-300 shrink-0" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <p className="text-xs font-semibold text-white">정답·오답 효과음</p>
                  <p className="text-[11px] text-slate-300">
                    {config.soundEnabled ? '정답 팡파르와 오답 알림음 재생' : '음소거 상태로 진행'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePreviewSound}
                  className="cursor-pointer rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-white/10 whitespace-nowrap"
                >
                  미리듣기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !config.soundEnabled;
                    onUpdateConfig({ soundEnabled: next });
                    soundEngine.setEnabled(next);
                    if (next) soundEngine.playClick();
                  }}
                  aria-pressed={config.soundEnabled}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    config.soundEnabled
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  }`}
                >
                  {config.soundEnabled ? '켜짐' : '꺼짐'}
                </button>
              </div>
            </div>
          </div>

          {/* Primary CTA: 게임 시작 */}
          <div className="mt-7 pt-2">
            {displayedError && (
              <p className="mb-3 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3.5 py-2.5 text-xs font-medium text-rose-200">
                {displayedError}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.unlock();
                if (!canStart) {
                  setLocalFileError(
                    config.mode === 'keyword'
                      ? '먼저 퀴즈를 만들 키워드나 학습 주제를 입력하거나 예시 주제를 선택해주세요.'
                      : '먼저 PDF 또는 PPTX 수업 교안 파일을 업로드해주세요.'
                  );
                  if (config.mode === 'keyword') {
                    document.getElementById('keyword-input')?.focus();
                  }
                  return;
                }
                setLocalFileError(null);
                soundEngine.playClick();
                onStartGame();
              }}
              className={`flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-extrabold transition-all whitespace-nowrap ${
                canStart
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-300 active:scale-[0.99]'
                  : 'bg-amber-400/80 text-slate-950 hover:bg-amber-400'
              }`}
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              <span>게임 시작</span>
            </button>
            {!canStart && (
              <p className="mt-2 text-center text-xs text-slate-300">
                {config.mode === 'keyword'
                  ? '왼쪽 입력창에 키워드를 입력하거나 예시를 눌러보세요'
                  : '왼쪽 영역에 PDF 또는 PPTX 교안 파일을 올려주세요'}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* How it works strip */}
      <section
        id="how-it-works"
        className="mt-10 grid grid-cols-1 gap-4 border-t border-white/10 pt-8 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>01. 랜덤 혼합 출제</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">OX + 객관식 자동 조합</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            요청한 문제 수에 맞춰 OX 퀴즈와 4지선다 객관식 문제를 골고루 섞어 생성합니다.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            <span>02. 즉각 피드백 &amp; 효과음</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">정답 팡파르 · 오답 알림</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            문제를 맞히면 경쾌한 정답 소리와 함께 정답 판정이, 틀리면 구분되는 알림음이 울립니다.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>03. 해설 3초 자동 진행</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">핵심 해설 확인 후 다음 문제</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            풀이 직후 간단한 핵심 해설을 3초간 보여준 뒤 자동으로 다음 문제로 부드럽게 넘어갑니다.
          </p>
        </div>
      </section>
    </main>
  );
}
