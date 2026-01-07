import { BetterAuthService } from "./_internal/BetterAuthService";

export type User = {};
export type LoginData = {};

export abstract class IAuthService {}

export const authService: IAuthService = new BetterAuthService();
