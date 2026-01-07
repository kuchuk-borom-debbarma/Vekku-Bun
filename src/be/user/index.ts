import { AuthServiceImpl } from "./_internal/AuthServiceImpl";
import type { IAuthService } from "./api";

export const authService: IAuthService = new AuthServiceImpl();
