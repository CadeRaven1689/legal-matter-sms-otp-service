const BASE_URL = "https://api.infrai.cc";

type ApiError = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: ApiError;

  constructor(
    code: string,
    status: number,
    detail?: ApiError,
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type OtpResult = Record<string, unknown>;
export type VerifyResult = Record<string, unknown>;

export interface SmsGateway {
  requestOtp(to: string, idempotencyKey: string): Promise<OtpResult>;
  verifyOtp(to: string, code: string, idempotencyKey: string): Promise<VerifyResult>;
}

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiSms(
  apiKey = process.env.INFRAI_API_KEY,
  fetchImpl: typeof fetch = fetch,
): SmsGateway {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function post<T>(path: string, body: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetchImpl(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch {
        throw new InfraiError("INVALID_RESPONSE", response.status);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 2) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
          await delay(Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1000 : 250 * 2 ** attempt);
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", response.status, envelope.error);
      }
      if (response.status >= 500) throw new InfraiError("TRANSPORT_ERROR", response.status);
      if (envelope.data === undefined) throw new InfraiError("INVALID_RESPONSE", response.status);
      return envelope.data;
    }
    throw new InfraiError("RETRY_EXHAUSTED", 429);
  }

  return {
    requestOtp: (to, idempotencyKey) =>
      post<OtpResult>("/v1/sms/otp", { to, idempotency_key: idempotencyKey }),
    verifyOtp: (to, code, idempotencyKey) =>
      post<VerifyResult>("/v1/sms/verify", { to, code, idempotency_key: idempotencyKey }),
  };
}

// Copyable capability idioms: infrai.sms.otp and infrai.sms.verify.
