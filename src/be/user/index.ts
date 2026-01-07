import { BetterAuthService } from "./_internal/BetterAuthService";
import type { IAuthService } from "./api";

export const authService: IAuthService = new BetterAuthService();
