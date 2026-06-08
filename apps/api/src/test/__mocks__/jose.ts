type JwtPayload = Record<string, unknown>;

export class SignJWT {
  private payload: JwtPayload = {};
  private sub?: string;

  constructor(payload: JwtPayload) {
    this.payload = { ...payload };
  }

  setProtectedHeader(_header: Record<string, unknown>) {
    return this;
  }

  setExpirationTime(_exp: string | number) {
    return this;
  }

  setIssuedAt() {
    return this;
  }

  setSubject(sub: string) {
    this.sub = sub;
    return this;
  }

  async sign(_secret: Uint8Array) {
    const sub = this.sub ?? (this.payload.userId as string) ?? "mock-user";
    const encoded = Buffer.from(JSON.stringify({ ...this.payload, sub })).toString("base64url");
    return `mock.jwt.${sub}.${encoded}`;
  }
}

export async function jwtVerify(token: string, _secret: Uint8Array) {
  const parts = token.split(".");
  const sub = parts[2] ?? "mock-user";
  let payload: JwtPayload = { sub, email: `${sub}@test.local` };
  if (parts[3]) {
    try {
      payload = { ...payload, ...JSON.parse(Buffer.from(parts[3], "base64url").toString()) };
    } catch {
      // keep default payload
    }
  }
  return { payload };
}
