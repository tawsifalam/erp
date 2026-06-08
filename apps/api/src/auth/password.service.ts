import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

const ROUNDS = 12;

@Injectable()
export class PasswordService {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, ROUNDS);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
