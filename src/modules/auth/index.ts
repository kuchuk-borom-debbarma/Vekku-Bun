import { getDb } from "../../db";
import type { IAuthService } from "./AuthService";
import { AuthServiceImpl } from "./AuthServiceImpl";

export const getAuthService = (): IAuthService => {
  return new AuthServiceImpl(getDb());
};
