import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { parseApiEnv } from "@erp/config";

async function bootstrap() {
  const env = parseApiEnv();
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.setGlobalPrefix("api");

  await app.listen(env.API_PORT);
  console.log(`API listening on http://localhost:${env.API_PORT}`);
}

bootstrap();
