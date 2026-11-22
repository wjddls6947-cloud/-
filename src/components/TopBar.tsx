import { Volume2, VolumeX } from 'lucide-react';
import type { GameStage } from '../types/quiz';

interface TopBarProps {
  stage: GameStage;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onGoHome: () => void;
  onScrollToSection: (sectionId: string) => void;
}

export function TopBar({
  stage,
  soundEnabled,
  onToggleSound,
  onGoHome,
  onScrollToSection,
}: TopBarProps) {
  return (
    <header className="w-full border-b border-white/10 bg-[#0B1226]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onGoHome}
          className="cursor-pointer text-left text-lg font-extrabold tracking-tight text-white transition-colors hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 whitespace-nowrap shrink-0"
        >
          퀴즈쇼 클래스
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {stage === 'SETUP' ? (
            <>
              <button
                type="button"
                onClick={() => onScrollToSection('source-panel')}
                className="cursor-pointer transition-colors hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                교안·키워드 입력
              </button>
              <button
                type="button"
                onClick={() => onScrollToSection('rules-panel')}
                className="cursor-pointer transition-colors hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                문제·시간 설정
              </button>
              <button
                type="button"
                onClick={() => onScrollToSection('how-it-works')}
                className="cursor-pointer transition-colors hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                게임 진행 안내
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onGoHome}
                className="cursor-pointer transition-colors hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
              >
                처음 화면
              </button>
              <span className="text-slate-600" aria-hidden="true">
                /
              </span>
              <span className="text-slate-200 whitespace-nowrap shrink-0">
                {stage === 'LOADING' && '퀴즈 생성 중'}
                {(stage === 'PLAYING' || stage === 'REVEAL') && '실시간 퀴즈쇼 진행 중'}
                {stage === 'RESULT' && '최종 결과 리포트'}
              </span>
            </>
          )}
        </nav>

        {/* Zone 3: 1 primary header control (Sound toggle) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundEnabled}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 ${
              soundEnabled
                ? 'border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25'
                : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-amber-300" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-400" aria-hidden="true" />
            )}
            <span>{soundEnabled ? '효과음 켜짐' : '효과음 꺼짐'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
