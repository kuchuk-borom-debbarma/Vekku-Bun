import { AuthServiceImpl } from "./_internal/AuthServiceImpl";
import { createUserRouter } from "./_internal/routes";
import type { IAuthService } from "./api";

export const authService: IAuthService = new AuthServiceImpl();
export const userRouter = createUserRouter(authService);
