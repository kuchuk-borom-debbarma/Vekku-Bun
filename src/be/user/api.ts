export abstract class IAuthService {
  abstract triggerEmailVerification(email: string): Promise<string>;

  abstract verifyEmail(
    token: string,
    otp: string,
    password: string,
  ): Promise<boolean>;

  abstract login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
}
