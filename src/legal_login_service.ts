import { createHash } from "node:crypto";
import { z } from "zod";
import type { SmsGateway } from "./infrai_sms.js";

export const legalLoginBody = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  matterId: z.string().min(3).max(80),
  workflow: z.enum(["matter_intake", "signed_document_delivery", "deadline_follow_up"]),
});

export const legalVerifyBody = legalLoginBody.extend({
  code: z.string().regex(/^\d{4,8}$/),
});

export type LegalLogin = z.infer<typeof legalLoginBody>;
export type LegalVerification = z.infer<typeof legalVerifyBody>;

const nextAction = {
  matter_intake: "open_intake_questionnaire",
  signed_document_delivery: "release_signed_document",
  deadline_follow_up: "show_deadline_checklist",
} as const;

function operationKey(action: string, input: LegalLogin): string {
  return createHash("sha256")
    .update(`${action}:${input.matterId}:${input.phone}:${input.workflow}`)
    .digest("hex");
}

export class LegalLoginService {
  private readonly sms: SmsGateway;

  constructor(sms: SmsGateway) {
    this.sms = sms;
  }

  async requestCode(body: unknown) {
    const input = legalLoginBody.parse(body);
    await this.sms.requestOtp(input.phone, operationKey("request", input));
    return {
      status: "code_sent" as const,
      matterId: input.matterId,
      workflow: input.workflow,
    };
  }

  async verifyCode(body: unknown) {
    const input = legalVerifyBody.parse(body);
    await this.sms.verifyOtp(input.phone, input.code, operationKey("verify", input));
    return {
      status: "phone_verified" as const,
      matterId: input.matterId,
      nextAction: nextAction[input.workflow],
    };
  }
}
