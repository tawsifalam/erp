import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { IntegrationsService } from "./integrations.service";

@Controller("integrations/webhooks")
export class IntegrationsWebhookController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post(":connectionId")
  receive(
    @Param("connectionId") connectionId: string,
    @Headers("x-webhook-secret") secret: string | undefined,
    @Body() body: unknown,
  ) {
    return this.integrations.handleWebhook(connectionId, secret, body);
  }
}
