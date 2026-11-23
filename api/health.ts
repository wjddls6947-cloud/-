interface HealthRequest {
  method?: string;
}

interface HealthResponse {
  status: (code: number) => HealthResponse;
  json: (data: unknown) => void;
}

export default function handler(_req: HealthRequest, res: HealthResponse) {
  res.status(200).json({ ok: true });
}
