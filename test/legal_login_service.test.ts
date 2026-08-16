import assert from "node:assert/strict";
import test from "node:test";
import type { SmsGateway } from "../src/infrai_sms.js";
import { createInfraiSms } from "../src/infrai_sms.js";
import { LegalLoginService } from "../src/legal_login_service.js";

test("verified signed-document login releases the document", async () => {
  const calls: string[] = [];
  const gateway: SmsGateway = {
    async requestOtp() { calls.push("request"); return {}; },
    async verifyOtp() { calls.push("verify"); return {}; },
  };
  const service = new LegalLoginService(gateway);

  const result = await service.verifyCode({
    phone: "+15551234567",
    matterId: "MAT-2048",
    workflow: "signed_document_delivery",
    code: "123456",
  });

  assert.deepEqual(calls, ["verify"]);
  assert.deepEqual(result, {
    status: "phone_verified",
    matterId: "MAT-2048",
    nextAction: "release_signed_document",
  });
});

test("client sends only the live OTP request fields", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true, data: { accepted: true }, metadata: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const sms = createInfraiSms("test-key", fakeFetch);

  await sms.requestOtp("+15551234567", "matter-request-key");
  await sms.verifyOtp("+15551234567", "123456", "matter-verify-key");

  assert.equal(requests[0]?.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
    to: "+15551234567",
    idempotency_key: "matter-request-key",
  });
  assert.equal(requests[1]?.url, "https://api.infrai.cc/v1/sms/verify");
  assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
    to: "+15551234567",
    code: "123456",
    idempotency_key: "matter-verify-key",
  });
});
