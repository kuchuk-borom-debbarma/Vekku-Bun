import { asClass, type AwilixContainer } from "awilix";
import { AuthServiceImpl } from "./_internal/AuthServiceImpl";
import { UserController } from "./_internal/UserController";

// Public API
export * from "./api";

// Registration Function
export const registerUserDomain = (container: AwilixContainer) => {
  container.register({
    authService: asClass(AuthServiceImpl).singleton(),
    userController: asClass(UserController).singleton(),
  });
};
