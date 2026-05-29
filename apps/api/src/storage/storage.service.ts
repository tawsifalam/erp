import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
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
    try {
      this.client = new Minio.Client({
        endPoint: this.config.get("MINIO_ENDPOINT", "localhost"),
        port: this.config.get<number>("MINIO_PORT", 9000),
        useSSL: this.config.get("MINIO_USE_SSL") === "true",
        accessKey: this.config.get("MINIO_ACCESS_KEY", "minioadmin"),
        secretKey: this.config.get("MINIO_SECRET_KEY", "minioadmin"),
      });
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) await this.client.makeBucket(this.bucket);
    } catch (e) {
      this.enabled = false;
      this.logger.warn(`MinIO unavailable, storage uploads disabled: ${e}`);
    }
  }

  async upload(key: string, body: Buffer, contentType: string) {
    if (!this.enabled) return { key, url: null };
    await this.client.putObject(this.bucket, key, body, body.length, {
      "Content-Type": contentType,
    });
    return { key, url: `${this.bucket}/${key}` };
  }
}
