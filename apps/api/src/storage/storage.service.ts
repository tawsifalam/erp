import {
  Injectable,
  OnModuleInit,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";

@Injectable()
export class StorageService implements OnModuleInit {
  private client!: Minio.Client;
  private bucket!: string;
  private readonly logger = new Logger(StorageService.name);
  private enabled = true;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.bucket = this.config.get("MINIO_BUCKET", "erp-files");
    await this.connect();
  }

  isEnabled() {
    return this.enabled;
  }

  private async connect(): Promise<boolean> {
    try {
      this.client = new Minio.Client({
        endPoint: this.config.get("MINIO_ENDPOINT", "localhost"),
        port: Number(this.config.get("MINIO_PORT", 9000)),
        useSSL: this.config.get("MINIO_USE_SSL") === "true",
        accessKey: this.config.get("MINIO_ACCESS_KEY", "minioadmin"),
        secretKey: this.config.get("MINIO_SECRET_KEY", "minioadmin"),
      });
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) await this.client.makeBucket(this.bucket);
      this.enabled = true;
      return true;
    } catch (e) {
      this.enabled = false;
      this.logger.warn(`MinIO unavailable, storage uploads disabled: ${e}`);
      return false;
    }
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.enabled) return true;
    return this.connect();
  }

  async upload(key: string, body: Buffer, contentType: string) {
    if (!(await this.ensureConnected())) {
      throw new ServiceUnavailableException("File storage is unavailable");
    }
    await this.client.putObject(this.bucket, key, body, body.length, {
      "Content-Type": contentType,
    });
    return { key, url: `${this.bucket}/${key}` };
  }

  async download(key: string): Promise<Buffer | null> {
    if (!(await this.ensureConnected())) return null;
    try {
      const stream = await this.client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];
      return await new Promise((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    } catch {
      return null;
    }
  }
}
