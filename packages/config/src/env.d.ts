import { z } from "zod";
export declare const apiEnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    API_PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    REDIS_URL: z.ZodDefault<z.ZodString>;
    CORS_ORIGIN: z.ZodDefault<z.ZodString>;
    PROPELAUTH_AUTH_URL: z.ZodString;
    PROPELAUTH_API_KEY: z.ZodString;
    MINIO_ENDPOINT: z.ZodDefault<z.ZodString>;
    MINIO_PORT: z.ZodDefault<z.ZodNumber>;
    MINIO_ACCESS_KEY: z.ZodDefault<z.ZodString>;
    MINIO_SECRET_KEY: z.ZodDefault<z.ZodString>;
    MINIO_BUCKET: z.ZodDefault<z.ZodString>;
    MINIO_USE_SSL: z.ZodDefault<z.ZodEffects<z.ZodString, boolean, string>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: "development" | "production" | "test";
    API_PORT: number;
    DATABASE_URL: string;
    REDIS_URL: string;
    CORS_ORIGIN: string;
    PROPELAUTH_AUTH_URL: string;
    PROPELAUTH_API_KEY: string;
    MINIO_ENDPOINT: string;
    MINIO_PORT: number;
    MINIO_ACCESS_KEY: string;
    MINIO_SECRET_KEY: string;
    MINIO_BUCKET: string;
    MINIO_USE_SSL: boolean;
}, {
    DATABASE_URL: string;
    PROPELAUTH_AUTH_URL: string;
    PROPELAUTH_API_KEY: string;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    API_PORT?: number | undefined;
    REDIS_URL?: string | undefined;
    CORS_ORIGIN?: string | undefined;
    MINIO_ENDPOINT?: string | undefined;
    MINIO_PORT?: number | undefined;
    MINIO_ACCESS_KEY?: string | undefined;
    MINIO_SECRET_KEY?: string | undefined;
    MINIO_BUCKET?: string | undefined;
    MINIO_USE_SSL?: string | undefined;
}>;
export declare const webEnvSchema: z.ZodObject<{
    NEXT_PUBLIC_API_URL: z.ZodString;
    NEXT_PUBLIC_AUTH_URL: z.ZodString;
    NEXT_PUBLIC_APP_URL: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_AUTH_URL: string;
    NEXT_PUBLIC_APP_URL: string;
}, {
    NEXT_PUBLIC_API_URL: string;
    NEXT_PUBLIC_AUTH_URL: string;
    NEXT_PUBLIC_APP_URL: string;
}>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;
export declare function parseApiEnv(env?: Record<string, string | undefined>): ApiEnv;
