import { Controller, Get } from "@nestjs/common";

@Controller("integrations")
export class IntegrationsController {
  @Get("health")
  health() {
    return { status: "ok", message: "Integrations stub — channel manager in Phase 2" };
  }
}
