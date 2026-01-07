import { asClass, asFunction, type AwilixContainer } from "awilix";
import { AuthServiceImpl } from "./_internal/AuthServiceImpl";
import { createUserRouter } from "./_internal/routes";
import { IAuthService } from "./api";

// Public API
export * from "./api";

// Registration Function
export const registerUserDomain = (container: AwilixContainer) => {
  container.register({
    authService: asClass(AuthServiceImpl).singleton(),
    userRouter: asFunction(({ authService }) => 
      createUserRouter(authService as IAuthService)
    ).singleton(),
  });
};
