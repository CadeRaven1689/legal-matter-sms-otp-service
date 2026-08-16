import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { createInfraiSms, InfraiError } from "./infrai_sms.js";
import { LegalLoginService } from "./legal_login_service.js";

const service = new LegalLoginService(createInfraiSms());

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    if (request.url === "/login/code") {
      json(response, 202, await service.requestCode(body));
      return;
    }
    if (request.url === "/login/verify") {
      json(response, 200, await service.verifyCode(body));
      return;
    }
    json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(response, status, { error: error.code });
      return;
    }
    json(response, 500, { error: "internal_error" });
  }
}).listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () => {
  console.log(`legal login service listening on http://127.0.0.1:${process.env.PORT ?? 3000}`);
});
