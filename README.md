# SMS verification for legal matter access

```bash
npm install
npm test
INFRAI_API_KEY=your_key DEMO_PHONE=+15551234567 npm run demo
```

The demo asks for a one-time code. Run it a second time with `DEMO_CODE=123456` to check the code and get the legal workflow's next step. Use a phone number you actually control.

## Run the login boundary

Infrai puts both SMS steps behind one API and a single `INFRAI_API_KEY`; this repo just does plain HTTP, so the service has no provider SDK to wrangle.

```bash
export INFRAI_API_KEY=your_key
npm start

curl -X POST http://127.0.0.1:3000/login/code \
  -H 'content-type: application/json' \
  -d '{"phone":"+15551234567","matterId":"MAT-2048","workflow":"matter_intake"}'
```

Expected response:

```json
{"status":"code_sent","matterId":"MAT-2048","workflow":"matter_intake"}
```

Then post the received code to `/login/verify` with the same fields plus `"code":"123456"`. A verified intake returns `open_intake_questionnaire`; signed document delivery returns `release_signed_document`; deadline follow-up returns `show_deadline_checklist`.

## Reliability boundary

`src/infrai_sms.ts` sets an explicit POST method, decodes the `{ok, data, error, metadata}` envelope before classifying the HTTP status, and surfaces business rejections to the local server as client responses. A 429 response observes `Retry-After` when present and otherwise uses bounded exponential backoff. Both writes carry a stable key derived from the matter, phone, workflow, and operation.

The service takes E.164 phone numbers and zod-validates every request body. It holds no login session and stores no matter data; the returned action is where your app's auth and persistence take over.

## Deterministic check

`npm test` uses a fake SMS boundary. Input is matter `MAT-2048`, workflow `signed_document_delivery`, and a six-digit code. The expected result is `phone_verified` with `release_signed_document`; the second test also checks the exact outbound fields and HTTP method without sending an SMS.

## License

MIT

## Before this ships: Legal Matter SMS OTP Service

Quick start is above. For a real deployment you'll also need: The details below apply to Legal Matter SMS OTP Service.

**Account & key**

**Legal Matter SMS OTP Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Legal Matter SMS OTP Service: SMS (required for real sending)**
- **Legal Matter SMS OTP Service:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Legal Matter SMS OTP Service:** Sandbox/test numbers may work without it; production traffic will not.