import { Hono } from "hono";
import type { IAuthService } from "../api";

type UserControllerDeps = {
  authService: IAuthService;
};

export class UserController {
  private authService: IAuthService;

  constructor({ authService }: UserControllerDeps) {
    this.authService = authService;
  }

  routes(): Hono {
    const router = new Hono();

    router.post("/trigger-verification", async (c) => {
      const { email } = await c.req.json();
      const token = await this.authService.triggerEmailVerification(email);
      return c.json({ token });
    });

    router.post("/verify-email", async (c) => {
      const { token, otp, password } = await c.req.json();
      const success = await this.authService.verifyEmail(token, otp, password);
      return c.json({ success });
    });

    router.post("/login", async (c) => {
      const { email, password } = await c.req.json();
      const result = await this.authService.login(email, password);
      return c.json(result);
    });

    router.post("/refresh-token", async (c) => {
      const { token } = await c.req.json();
      const result = await this.authService.refreshToken(token);
      return c.json(result);
    });

    return router;
  }
}