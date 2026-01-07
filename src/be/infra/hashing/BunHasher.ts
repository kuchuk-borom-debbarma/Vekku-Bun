import type { IHasher } from "./IHasher";

export class BunHasher implements IHasher {
  async hash(plain: string): Promise<string> {
    return await Bun.password.hash(plain);
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    return await Bun.password.verify(plain, hashed);
  }
}
