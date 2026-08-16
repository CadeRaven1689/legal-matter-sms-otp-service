import { createInfraiSms } from "../src/infrai_sms.js";
import { LegalLoginService } from "../src/legal_login_service.js";

const phone = process.env.DEMO_PHONE;
const code = process.env.DEMO_CODE;
if (!phone) throw new Error("DEMO_PHONE is required");

const service = new LegalLoginService(createInfraiSms());
const login = { phone, matterId: "MAT-2048", workflow: "signed_document_delivery" as const };

if (code) {
  console.log(await service.verifyCode({ ...login, code }));
} else {
  console.log(await service.requestCode(login));
}
