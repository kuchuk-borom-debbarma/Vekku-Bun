import { asClass, type AwilixContainer } from "awilix";
import { Hono } from "hono";
import { AuthServiceImpl } from "./_internal/AuthServiceImpl";
import { registerUserRoutes } from "./_internal/routes";
import { IAuthService } from "./api";

// Public API
export * from "./api";

// Registration Function (Services)
export const registerUserDomain = (container: AwilixContainer) => {
  container.register({
    authService: asClass(AuthServiceImpl).singleton(),
  });
};

// Mounting Function (Routes)
export const mountUserRoutes = (router: Hono, container: AwilixContainer) => {
  const authService = container.resolve<IAuthService>("authService");
  registerUserRoutes(router, authService);
};