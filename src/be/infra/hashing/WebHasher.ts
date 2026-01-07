import type { IHasher } from "./IHasher";

export class WebHasher implements IHasher {
  async hash(plain: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    const newHash = await this.hash(plain);
    return newHash === hashed;
  }
}
