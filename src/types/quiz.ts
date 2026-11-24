export type QuizInputMode = 'keyword' | 'file';

export type QuestionType = 'OX' | 'MULTIPLE_CHOICE';

export type TimeLimitSeconds = 10 | 15 | 20;

export type QuizDifficulty = 'ELEMENTARY' | 'MIDDLE' | 'HIGH';

export type AdvanceMode = 'auto' | 'manual';

export type GameStage = 'SETUP' | 'LOADING' | 'PLAYING' | 'REVEAL' | 'RESULT';

export interface UploadedLessonFile {
  name: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
  extractedText?: string;
  slideCount?: number;
}

export interface QuizConfig {
  mode: QuizInputMode;
  keyword: string;
  file: UploadedLessonFile | null;
  questionCount: number;
  timeLimit: TimeLimitSeconds;
  difficulty: QuizDifficulty;
  advanceMode: AdvanceMode;
  soundEnabled: boolean;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizAnswerRecord {
  questionId: string;
  selectedIndex: number | null;
  isCorrect: boolean;
  isTimeout: boolean;
  timeSpentMs: number;
  earnedPoints: number;
}

export interface GenerateQuizResponse {
  title: string;
  questions: QuizQuestion[];
  sourceSummary?: string;
}
