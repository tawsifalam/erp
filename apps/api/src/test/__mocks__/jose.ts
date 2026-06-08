export class SignJWT {
  private payload: Record<string, unknown> = {};

  constructor(_payload: Record<string, unknown>) {
    this.payload = { ..._payload };
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

  async sign(_secret: Uint8Array) {
    const sub = this.payload.sub ?? "mock-user";
    return `mock.jwt.${sub}`;
  }
}

export async function jwtVerify(token: string, _secret: Uint8Array) {
  const parts = token.split(".");
  const sub = parts[2] ?? "mock-user";
  return {
    payload: {
      sub,
      email: `${sub}@test.local`,
    },
  };
}
