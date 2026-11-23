import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import healthHandler from './api/health.ts';
import quizGenerateHandler from './api/quiz/generate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '35mb' }));

  app.get('/api/health', (req: Request, res: Response) => {
    healthHandler(req, res);
  });

  app.post('/api/quiz/generate', (req: Request, res: Response) => {
    void quizGenerateHandler(req, res);
  });

  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: '요청하신 API 경로를 찾을 수 없습니다.' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('Express middleware error:', err);
    const errObj = err as { type?: string; status?: number };
    if (errObj?.type === 'entity.too.large' || errObj?.status === 413) {
      res.status(413).json({
        error: '업로드한 파일 용량이 너무 큽니다. 더 작은 파일을 업로드해주세요.',
      });
      return;
    }
    res.status(errObj?.status || 500).json({
      error: '서버 요청 처리 중 오류가 발생했습니다.',
    });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuizShow Class server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
