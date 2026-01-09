export interface IHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hashed: string): Promise<boolean>;
}

const bunHasher: IHasher = {
  async hash(plain: string): Promise<string> {
    return await Bun.password.hash(plain);
  },

  async verify(plain: string, hashed: string): Promise<boolean> {
    return await Bun.password.verify(plain, hashed);
  },
};

const webHasher: IHasher = {
  async hash(plain: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  },

  async verify(plain: string, hashed: string): Promise<boolean> {
    const newHash = await this.hash(plain);
    return newHash === hashed;
  },
};

export const getHasher = (env: { WORKER?: string }): IHasher => {
  return env.WORKER ? webHasher : bunHasher;
};