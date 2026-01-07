export abstract class IAuthService {
  abstract triggerEmailVerification(
    email: string,
    password: string,
    username: string,
  ): Promise<string>;

  abstract verifyEmail(token: string, otp: string): Promise<boolean>;

  abstract login(
    key: string,
    loginType: "EMAIL" | "USERNAME",
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
}
