import type { IHasher } from "../../lib/hashing";

export type AuthUser = {
  user: { id: string; name: string; role: string };
  accessToken: string;
  refreshToken: string;
};

export interface IAuthService {
  createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role?: string;
  }): Promise<{ id: string } | undefined>;

  loginUser(
    hasher: IHasher,
    email: string,
    password: string,
  ): Promise<AuthUser>;

  refreshToken(token: string): Promise<AuthUser>;

  checkUserExists(email: string): Promise<boolean>;

  getUserById(userId: string): Promise<{ id: string; name: string; role: string } | null>;
}