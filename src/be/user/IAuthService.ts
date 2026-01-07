export interface IAuthService {
  triggerEmailVerification(email: string): Promise<string>;
  verifyEmail(token: string, otp: string, password: string): Promise<boolean>;
  login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }>;
  refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }>;
}
