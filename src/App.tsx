import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { QuizStage } from './components/QuizStage';
import { ResultStage } from './components/ResultStage';
import { SetupStage } from './components/SetupStage';
import { TopBar } from './components/TopBar';
import type {
  GameStage,
  GenerateQuizResponse,
  QuizAnswerRecord,
  QuizConfig,
  QuizQuestion,
} from './types/quiz';
import { soundEngine } from './utils/sound';

const INITIAL_CONFIG: QuizConfig = {
  mode: 'keyword',
  keyword: '',
  file: null,
  questionCount: 10,
  timeLimit: 10,
  difficulty: 'MIDDLE',
  advanceMode: 'auto',
  soundEnabled: true,
};

const DIFFICULTY_LABEL: Record<QuizConfig['difficulty'], string> = {
  ELEMENTARY: '초등학교',
  MIDDLE: '중학교',
  HIGH: '고등학교',
};

export default function App() {
  const [stage, setStage] = useState<GameStage>('SETUP');
  const [config, setConfig] = useState<QuizConfig>(INITIAL_CONFIG);
  const [quizTitle, setQuizTitle] = useState('핵심 복습 퀴즈쇼');
  const [sourceSummary, setSourceSummary] = useState<string | undefined>(undefined);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [records, setRecords] = useState<QuizAnswerRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleUpdateConfig = (partial: Partial<QuizConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleToggleSound = () => {
    soundEngine.unlock();
    const next = !config.soundEnabled;
    handleUpdateConfig({ soundEnabled: next });
    soundEngine.setEnabled(next);
    if (next) {
      soundEngine.playClick();
    }
  };

  const handleStartGame = async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage(null);
    setStage('LOADING');
    soundEngine.setEnabled(config.soundEnabled);

    const timeoutId = window.setTimeout(() => {
      controller.abort('timeout');
    }, 45000);

    try {
      const payload =
        config.mode === 'keyword'
          ? {
              mode: 'keyword',
              keyword: config.keyword.trim(),
              questionCount: config.questionCount,
              difficulty: config.difficulty,
            }
          : {
              mode: 'file',
              questionCount: config.questionCount,
              difficulty: config.difficulty,
              file: config.file
                ? {
                    name: config.file.name,
                    mimeType: config.file.mimeType,
                    extractedText: config.file.extractedText,
                    dataBase64: config.file.extractedText ? undefined : config.file.dataBase64,
                  }
                : null,
            };

      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const rawText = await res.text();
      let data: (Partial<GenerateQuizResponse> & { error?: string }) | null = null;
      try {
        data = JSON.parse(rawText) as Partial<GenerateQuizResponse> & { error?: string };
      } catch {
        console.error('Non-JSON response from /api/quiz/generate:', res.status, rawText.slice(0, 300));
        if (res.status === 413) {
          throw new Error(
            '업로드한 파일 크기가 서버 제한을 초과했습니다. 더 작은 PDF를 사용하거나 PPTX 형식으로 올려주세요.'
          );
        }
        if (res.status === 502 || res.status === 503 || res.status === 504) {
          throw new Error(
            '서버 응답 시간이 초과되었거나 일시적으로 연결이 불안정합니다. 문제 수를 줄이거나 잠시 후 다시 시도해주세요.'
          );
        }
        if (res.status === 404 || rawText.includes('The page')) {
          throw new Error(
            `퀴즈 생성 서버 경로에 연결하지 못했습니다 (HTTP ${res.status}). 페이지를 새로고침하거나 잠시 후 다시 시도해주세요.`
          );
        }
        throw new Error(
          `서버에서 예상치 못한 응답을 반환했습니다 (HTTP ${res.status}). 잠시 후 다시 시도해주세요.`
        );
      }

      if (!res.ok || !data?.questions || data.questions.length === 0) {
        throw new Error(data?.error || '퀴즈를 생성하지 못했습니다. 다시 시도해주세요.');
      }

      setQuizTitle(data.title || '핵심 복습 퀴즈쇼');
      setSourceSummary(data.sourceSummary);
      setQuestions(data.questions);
      setRecords([]);
      setGameKey((k) => k + 1);
      setStage('PLAYING');
    } catch (err: unknown) {
      if (controller.signal.aborted && controller.signal.reason === 'timeout') {
        setErrorMessage(
          '퀴즈 생성 요청 시간이 초과되었습니다. 문제 개수를 줄이거나 잠시 후 다시 시도해주세요.'
        );
        setStage('SETUP');
        return;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message =
        err instanceof Error ? err.message : '서버와 통신하는 중 오류가 발생했습니다.';
      setErrorMessage(message);
      setStage('SETUP');
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const handleFinishQuiz = (finalRecords: QuizAnswerRecord[]) => {
    setRecords(finalRecords);
    setStage('RESULT');
  };

  const handleGoHome = () => {
    abortControllerRef.current?.abort();
    soundEngine.playClick();
    setStage('SETUP');
    setErrorMessage(null);
  };

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      <TopBar
        stage={stage}
        soundEnabled={config.soundEnabled}
        onToggleSound={handleToggleSound}
        onGoHome={handleGoHome}
        onScrollToSection={handleScrollToSection}
      />

      {stage === 'SETUP' && (
        <SetupStage
          config={config}
          errorMessage={errorMessage}
          onUpdateConfig={handleUpdateConfig}
          onStartGame={() => void handleStartGame()}
          onClearError={() => setErrorMessage(null)}
        />
      )}

      {stage === 'LOADING' && (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/15 text-amber-300">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold text-white">
            맞춤 퀴즈쇼를 준비하고 있습니다
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
            {config.mode === 'file' && config.file
              ? `교안 "${config.file.name}"의 핵심 내용을 ${DIFFICULTY_LABEL[config.difficulty]} 수준에 맞춰 OX·객관식 ${config.questionCount}문제로 출제하는 중입니다.`
              : `"${config.keyword.trim().slice(0, 40)}" 주제를 ${DIFFICULTY_LABEL[config.difficulty]} 수준에 맞춰 OX·객관식 ${config.questionCount}문제로 생성하고 있습니다.`}
          </p>
          <button
            type="button"
            onClick={handleGoHome}
            className="mt-8 cursor-pointer rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:bg-white/15 hover:text-white"
          >
            취소하고 돌아가기
          </button>
        </main>
      )}

      {(stage === 'PLAYING' || stage === 'REVEAL') && questions.length > 0 && (
        <QuizStage
          key={gameKey}
          quizTitle={quizTitle}
          questions={questions}
          timeLimit={config.timeLimit}
          difficulty={config.difficulty}
          advanceMode={config.advanceMode}
          onFinishQuiz={handleFinishQuiz}
        />
      )}

      {stage === 'RESULT' && (
        <ResultStage
          quizTitle={quizTitle}
          sourceSummary={sourceSummary}
          questions={questions}
          records={records}
          onReplaySameConfig={() => void handleStartGame()}
          onGoSetup={handleGoHome}
        />
      )}
    </div>
  );
}
