"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webEnvSchema = exports.apiEnvSchema = void 0;
exports.parseApiEnv = parseApiEnv;
const zod_1 = require("zod");
exports.apiEnvSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
    API_PORT: zod_1.z.coerce.number().default(3001),
    DATABASE_URL: zod_1.z.string().min(1),
    REDIS_URL: zod_1.z.string().default("redis://localhost:6379"),
    CORS_ORIGIN: zod_1.z.string().default("http://localhost:3000"),
    PROPELAUTH_AUTH_URL: zod_1.z.string().url(),
    PROPELAUTH_API_KEY: zod_1.z.string().min(1),
    MINIO_ENDPOINT: zod_1.z.string().default("localhost"),
    MINIO_PORT: zod_1.z.coerce.number().default(9000),
    MINIO_ACCESS_KEY: zod_1.z.string().default("minioadmin"),
    MINIO_SECRET_KEY: zod_1.z.string().default("minioadmin"),
    MINIO_BUCKET: zod_1.z.string().default("erp-files"),
    MINIO_USE_SSL: zod_1.z
        .string()
        .transform((v) => v === "true")
        .default("false"),
});
exports.webEnvSchema = zod_1.z.object({
    NEXT_PUBLIC_API_URL: zod_1.z.string().url(),
    NEXT_PUBLIC_AUTH_URL: zod_1.z.string().url(),
    NEXT_PUBLIC_APP_URL: zod_1.z.string().url(),
});
function parseApiEnv(env = process.env) {
    return exports.apiEnvSchema.parse(env);
}
//# sourceMappingURL=env.js.map