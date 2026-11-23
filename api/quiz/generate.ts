import JSZip from 'jszip';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export interface ApiRequest {
  method?: string;
  body?: unknown;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: unknown) => void;
  setHeader?: (name: string, value: string) => void;
}

interface GenerateQuizBody {
  mode?: 'keyword' | 'file';
  keyword?: string;
  questionCount?: number;
  file?: {
    name: string;
    mimeType: string;
    extractedText?: string;
    dataBase64?: string;
  };
}

interface RawQuizItem {
  type: 'OX' | 'MULTIPLE_CHOICE';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function extractTextFromSlideXml(xml: string): string {
  const paragraphs = xml.split(/<\/a:p>/g);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const matches = para.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (!matches) continue;
    const line = matches
      .map((tag) => decodeXmlEntities(tag.replace(/<a:t[^>]*>|<\/a:t>/g, '')))
      .join('')
      .trim();
    if (line.length > 0) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

async function extractTextFromPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    throw new Error('PPTX 파일 내부에서 슬라이드를 찾을 수 없습니다.');
  }

  const noteEntries = new Map<number, string>();
  for (const name of Object.keys(zip.files)) {
    const match = name.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/i);
    if (match) {
      noteEntries.set(Number(match[1]), name);
    }
  }

  const sections: string[] = [];
  for (const slidePath of slideEntries) {
    const slideNum = Number(slidePath.match(/slide(\d+)\.xml/i)?.[1] ?? 0);
    const slideXml = await zip.files[slidePath].async('string');
    const slideText = extractTextFromSlideXml(slideXml);

    let noteText = '';
    const notePath = noteEntries.get(slideNum);
    if (notePath && zip.files[notePath]) {
      const noteXml = await zip.files[notePath].async('string');
      noteText = extractTextFromSlideXml(noteXml);
    }

    if (slideText || noteText) {
      let block = `[슬라이드 ${slideNum}]`;
      if (slideText) block += `\n${slideText}`;
      if (noteText) block += `\n[발표자 노트]\n${noteText}`;
      sections.push(block);
    }
  }

  const combined = sections.join('\n\n').trim();
  if (!combined) {
    throw new Error(
      'PPTX 슬라이드에서 읽을 수 있는 텍스트를 찾지 못했습니다. 슬라이드가 이미지로만 구성된 경우 PDF로 내보내어 업로드해주세요.'
    );
  }

  return combined.slice(0, 80000);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeQuestions(rawList: RawQuizItem[], requestedCount: number) {
  const cleaned = rawList
    .map((item, idx) => {
      const question = String(item.question ?? '').trim();
      const explanation = String(item.explanation ?? '').trim();
      if (!question || !explanation) return null;

      if (item.type === 'OX') {
        const correctIndex = item.correctIndex === 1 ? 1 : 0;
        return {
          id: `q-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'OX' as const,
          question,
          options: ['O', 'X'],
          correctIndex,
          explanation,
        };
      }

      const rawOptions = Array.isArray(item.options)
        ? item.options.map((opt) => String(opt ?? '').trim()).filter(Boolean)
        : [];
      if (rawOptions.length < 4) return null;

      const fourOptions = rawOptions.slice(0, 4);
      const originalCorrectIdx =
        Number.isInteger(item.correctIndex) && item.correctIndex >= 0 && item.correctIndex < 4
          ? item.correctIndex
          : 0;
      const correctText = fourOptions[originalCorrectIdx];

      const tagged = fourOptions.map((text, optionIdx) => ({
        text,
        isCorrect: optionIdx === originalCorrectIdx,
      }));
      const shuffledTagged = shuffleArray(tagged);
      let newCorrectIndex = shuffledTagged.findIndex((t) => t.isCorrect);
      if (newCorrectIndex === -1) {
        newCorrectIndex = shuffledTagged.findIndex((t) => t.text === correctText);
      }

      return {
        id: `q-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'MULTIPLE_CHOICE' as const,
        question,
        options: shuffledTagged.map((t) => t.text),
        correctIndex: Math.max(0, newCorrectIndex),
        explanation,
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);

  return shuffleArray(cleaned).slice(0, requestedCount);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(500).json({
        error:
          'GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. Vercel 프로젝트 Settings > Environment Variables(또는 Secrets 패널)에 GEMINI_API_KEY를 등록한 뒤 다시 배포해주세요.',
      });
      return;
    }

    let body: GenerateQuizBody = {};
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body) as GenerateQuizBody;
      } catch {
        res.status(400).json({ error: '요청 JSON 형식이 올바르지 않습니다.' });
        return;
      }
    } else if (req.body && typeof req.body === 'object') {
      body = req.body as GenerateQuizBody;
    }

    const mode = body.mode === 'file' ? 'file' : 'keyword';
    const rawCount = Number(body.questionCount);
    const questionCount = Number.isFinite(rawCount)
      ? Math.min(30, Math.max(1, Math.round(rawCount)))
      : 10;

    let oxCount = 0;
    let mcCount = 0;
    if (questionCount === 1) {
      if (Math.random() < 0.5) oxCount = 1;
      else mcCount = 1;
    } else {
      const minOx = Math.max(1, Math.floor(questionCount * 0.3));
      const maxOx = Math.min(questionCount - 1, Math.ceil(questionCount * 0.7));
      oxCount = minOx + Math.floor(Math.random() * (maxOx - minOx + 1));
      mcCount = questionCount - oxCount;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `당신은 수업 내용을 핵심 개념 중심으로 재미있고 정확하게 복습할 수 있도록 돕는 대한민국 최고의 퀴즈쇼 출제 교사입니다.
사용자가 제공한 키워드 또는 수업 교안(PDF/PPT/텍스트)을 바탕으로 OX 퀴즈와 4지선다 객관식 퀴즈를 출제합니다.

[필수 출제 규칙]
1. 모든 문제, 선택지, 해설, 제목은 자연스럽고 정확한 한국어로 작성하세요.
2. 요청된 총 문제 수(${questionCount}개)를 정확히 지키고, OX 퀴즈 ${oxCount}개와 4지선다 객관식 퀴즈 ${mcCount}개를 섞어 생성하세요.
3. OX 퀴즈(type: "OX") 규칙:
   - 참/거짓이 명확히 판별되는 핵심 개념 문장을 출제하세요. (애매한 표현 금지)
   - options는 반드시 ["O", "X"]로 설정하세요.
   - 문장이 맞으면 correctIndex를 0("O"), 틀리면 correctIndex를 1("X")로 설정하세요.
4. 객관식 퀴즈(type: "MULTIPLE_CHOICE") 규칙:
   - options는 반드시 서로 구별되는 4개의 선택지를 제공하세요.
   - 정답 index(0~3)를 correctIndex에 정확히 지정하세요.
5. 해설(explanation) 규칙:
   - 각 문제를 푼 직후 학습자가 빠르게 읽고 핵심을 이해할 수 있도록 1~2문장(40~110자 내외)으로 간결하고 명쾌하게 설명하세요.
6. 교안 파일이 제공된 경우, 반드시 그 교안의 실제 개념·용어·원리·사례에 근거하여 출제하세요.`;

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (mode === 'keyword') {
      const keyword = String(body.keyword ?? '').trim();
      if (!keyword) {
        res.status(400).json({ error: '퀴즈를 만들 키워드나 학습 주제를 입력해주세요.' });
        return;
      }
      parts.push({
        text: `다음 키워드 및 학습 내용을 바탕으로 배운 내용을 정리하는 혼합 퀴즈 ${questionCount}문제(OX ${oxCount}문제, 객관식 ${mcCount}문제)를 출제해주세요.\n\n[학습 키워드/내용]\n${keyword}`,
      });
    } else {
      const file = body.file;
      if (!file || !file.name || (!file.extractedText && !file.dataBase64)) {
        res.status(400).json({ error: '업로드된 교안 파일 정보가 올바르지 않습니다.' });
        return;
      }

      const lowerName = file.name.toLowerCase();

      if (file.extractedText && file.extractedText.trim().length > 0) {
        const cleanExtracted = file.extractedText.trim().slice(0, 80000);
        parts.push({
          text: `다음은 수업 교안 파일("${file.name}")에서 추출한 전체 내용입니다. 이 내용을 바탕으로 핵심 개념을 복습하는 혼합 퀴즈 ${questionCount}문제(OX ${oxCount}문제, 객관식 ${mcCount}문제)를 출제해주세요.\n\n${cleanExtracted}`,
        });
      } else {
        const base64Clean = (file.dataBase64 ?? '').includes(',')
          ? (file.dataBase64 ?? '').split(',')[1]
          : (file.dataBase64 ?? '');
        const fileBuffer = Buffer.from(base64Clean, 'base64');

        const isOle2 =
          fileBuffer.length >= 4 &&
          fileBuffer[0] === 0xd0 &&
          fileBuffer[1] === 0xcf &&
          fileBuffer[2] === 0x11 &&
          fileBuffer[3] === 0xe0;

        if ((lowerName.endsWith('.ppt') && !lowerName.endsWith('.pptx')) || isOle2) {
          res.status(400).json({
            error:
              '구형 .ppt 바이너리 파일은 지원되지 않습니다. PowerPoint에서 [.pptx] 또는 [.pdf] 형식으로 저장한 뒤 업로드해주세요.',
          });
          return;
        }

        if (lowerName.endsWith('.pdf') || file.mimeType === 'application/pdf') {
          parts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Clean,
            },
          });
          parts.push({
            text: `첨부된 수업 교안 PDF("${file.name}")의 핵심 학습 내용을 정리하는 혼합 퀴즈 ${questionCount}문제(OX ${oxCount}문제, 객관식 ${mcCount}문제)를 출제해주세요.`,
          });
        } else if (
          lowerName.endsWith('.pptx') ||
          file.mimeType ===
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ) {
          const slideText = await extractTextFromPptx(fileBuffer);
          parts.push({
            text: `다음은 수업 교안 PowerPoint("${file.name}")에서 추출한 슬라이드 전체 내용입니다. 이 내용을 바탕으로 핵심 개념을 복습하는 혼합 퀴즈 ${questionCount}문제(OX ${oxCount}문제, 객관식 ${mcCount}문제)를 출제해주세요.\n\n${slideText}`,
          });
        } else if (
          lowerName.endsWith('.txt') ||
          lowerName.endsWith('.md') ||
          lowerName.endsWith('.csv') ||
          file.mimeType.startsWith('text/')
        ) {
          const textContent = fileBuffer.toString('utf-8').trim().slice(0, 80000);
          if (!textContent) {
            res.status(400).json({ error: '업로드한 텍스트 파일이 비어 있습니다.' });
            return;
          }
          parts.push({
            text: `다음은 수업 자료("${file.name}") 내용입니다. 이 내용을 바탕으로 혼합 퀴즈 ${questionCount}문제(OX ${oxCount}문제, 객관식 ${mcCount}문제)를 출제해주세요.\n\n${textContent}`,
          });
        } else {
          res.status(400).json({
            error:
              '지원하지 않는 파일 형식입니다. PDF(.pdf), PowerPoint(.pptx), 또는 텍스트(.txt, .md) 파일을 올려주세요.',
          });
          return;
        }
      }
    }

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: '퀴즈 세트를 대표하는 짧은 한국어 제목 (예: 광합성 핵심 복습 퀴즈)',
        },
        sourceSummary: {
          type: Type.STRING,
          description: '학습 주제를 한 줄로 요약한 문장',
        },
        questions: {
          type: Type.ARRAY,
          description: `정확히 ${questionCount}개의 OX 및 객관식 혼합 문제 목록`,
          items: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                enum: ['OX', 'MULTIPLE_CHOICE'],
              },
              question: {
                type: Type.STRING,
                description: '명확하고 읽기 쉬운 퀴즈 질문',
              },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'OX는 ["O", "X"], 객관식은 4개의 선택지',
              },
              correctIndex: {
                type: Type.INTEGER,
                description: '정답 선택지의 0부터 시작하는 인덱스',
              },
              explanation: {
                type: Type.STRING,
                description: '정답 확인 시 보여줄 간단하고 명쾌한 1~2문장 해설',
              },
            },
            required: ['type', 'question', 'options', 'correctIndex', 'explanation'],
          },
        },
      },
      required: ['title', 'questions'],
    };

    const candidateModels = [
      {
        model: 'gemini-4-hydrogen',
        thinkingLevel: ThinkingLevel.LOW,
        delayMs: 0,
        timeoutMs: 9000,
      },
      {
        model: 'gemini-3.1-flash-lite',
        thinkingLevel: ThinkingLevel.MINIMAL,
        delayMs: 200,
        timeoutMs: 12000,
      },
      {
        model: 'gemini-3.1-flash-lite',
        thinkingLevel: ThinkingLevel.MINIMAL,
        delayMs: 600,
        timeoutMs: 12000,
      },
    ];

    let responseText: string | undefined;
    let lastError: unknown;

    for (const attempt of candidateModels) {
      if (attempt.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, attempt.delayMs));
      }
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: attempt.model,
            contents: { parts },
            config: {
              systemInstruction,
              thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
              responseMimeType: 'application/json',
              responseSchema,
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('ETIMEDOUT: Gemini API timeout')), attempt.timeoutMs)
          ),
        ]);
        if (response.text) {
          responseText = response.text;
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        const errStr = err instanceof Error ? err.message : String(err);
        const isTransient =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('500') ||
          errStr.includes('INTERNAL') ||
          errStr.includes('ETIMEDOUT') ||
          errStr.includes('fetch failed');
        console.warn(
          `Quiz generation attempt failed (${attempt.model}, transient=${isTransient}):`,
          errStr
        );
        if (!isTransient) {
          throw err;
        }
      }
    }

    if (!responseText) {
      throw lastError ?? new Error('모델 응답을 받지 못했습니다.');
    }

    const rawText = responseText.trim();
    const parsed = JSON.parse(rawText) as {
      title?: string;
      sourceSummary?: string;
      questions?: RawQuizItem[];
    };

    const normalizedQuestions = normalizeQuestions(parsed.questions ?? [], questionCount);
    if (normalizedQuestions.length === 0) {
      res.status(502).json({
        error: '퀴즈 문제를 생성하지 못했습니다. 다른 키워드나 교안 내용으로 다시 시도해주세요.',
      });
      return;
    }

    res.status(200).json({
      title: (parsed.title ?? '').trim() || '핵심 복습 퀴즈쇼',
      sourceSummary: (parsed.sourceSummary ?? '').trim() || undefined,
      questions: normalizedQuestions,
    });
  } catch (err: unknown) {
    console.error('Quiz generation error:', err);
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('API_KEY_INVALID') || message.includes('PERMISSION_DENIED')) {
      res.status(403).json({
        error:
          'Gemini API 키가 유효하지 않거나 권한이 없습니다. Vercel Environment Variables(또는 Secrets 패널)에서 GEMINI_API_KEY를 확인해주세요.',
      });
      return;
    }
    if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
      res.status(429).json({
        error: '요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 API 키 할당량을 확인해주세요.',
      });
      return;
    }
    if (
      message.includes('503') ||
      message.includes('UNAVAILABLE') ||
      message.includes('high demand') ||
      message.includes('ETIMEDOUT')
    ) {
      res.status(503).json({
        error: '현재 AI 서버 응답이 지연되고 있습니다. 잠시 후 다시 게임 시작을 눌러주세요.',
      });
      return;
    }

    res.status(500).json({
      error: '퀴즈 생성 중 오류가 발생했습니다. 입력 내용을 확인하고 다시 시도해주세요.',
    });
  }
}
