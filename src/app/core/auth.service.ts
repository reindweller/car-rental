import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { environment } from '../../environments/environment';

interface Session {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PasswordChallenge {
  session: string;
  username: string;
  requiredAttributes: string[];
}

export type LoginResult = { authenticated: true } | { authenticated: false; challenge?: PasswordChallenge; message?: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'billspremiere.cognito-session';
  private readonly client = new CognitoIdentityProviderClient({ region: environment.aws.region });
  private readonly session = signal<Session | null>(this.readSession());
  private readonly passwordChallenge = signal<PasswordChallenge | null>(null);
  readonly currentUser = signal<CurrentUser | null>(this.userFromToken(this.session()?.idToken));
  readonly idToken = computed(() => this.session()?.idToken ?? '');

  constructor(private readonly router: Router) {
    if (this.session() && this.session()!.expiresAt <= Date.now()) void this.refreshSession();
  }

  async login(email: string, password: string, remember = true): Promise<LoginResult> {
    try {
      const response = await this.client.send(new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: environment.aws.userPoolClientId,
        AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
      }));
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED' && response.Session) {
        const challenge = {
          session: response.Session,
          username: email.trim().toLowerCase(),
          requiredAttributes: JSON.parse(response.ChallengeParameters?.['requiredAttributes'] ?? '[]'),
        };
        this.passwordChallenge.set(challenge);
        return { authenticated: false, challenge };
      }
      if (!response.AuthenticationResult?.IdToken) return { authenticated: false, message: 'Sign-in did not return a valid session.' };
      this.saveAuthentication(response.AuthenticationResult, remember);
      return { authenticated: true };
    } catch (error) {
      return { authenticated: false, message: this.messageFor(error) };
    }
  }

  async completeNewPassword(newPassword: string, name: string, remember = true): Promise<LoginResult> {
    const challenge = this.passwordChallenge();
    if (!challenge) return { authenticated: false, message: 'The password setup session expired. Sign in again.' };
    try {
      const attributes: Record<string, string> = {};
      if (challenge.requiredAttributes.includes('userAttributes.name')) attributes['userAttributes.name'] = name.trim();
      const response = await this.client.send(new RespondToAuthChallengeCommand({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: environment.aws.userPoolClientId,
        Session: challenge.session,
        ChallengeResponses: {
          USERNAME: challenge.username,
          NEW_PASSWORD: newPassword,
          ...attributes,
        },
      }));
      if (!response.AuthenticationResult?.IdToken) return { authenticated: false, message: 'Password setup did not return a valid session.' };
      this.passwordChallenge.set(null);
      this.saveAuthentication(response.AuthenticationResult, remember);
      return { authenticated: true };
    } catch (error) {
      return { authenticated: false, message: this.messageFor(error) };
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    try {
      await this.client.send(new ForgotPasswordCommand({
        ClientId: environment.aws.userPoolClientId,
        Username: email.trim().toLowerCase(),
      }));
      return '';
    } catch (error) {
      return this.messageFor(error);
    }
  }

  async confirmPasswordReset(email: string, code: string, password: string): Promise<string> {
    try {
      await this.client.send(new ConfirmForgotPasswordCommand({
        ClientId: environment.aws.userPoolClientId,
        Username: email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
        Password: password,
      }));
      return '';
    } catch (error) {
      return this.messageFor(error);
    }
  }

  async refreshSession(): Promise<boolean> {
    const current = this.session();
    if (!current?.refreshToken) return false;
    try {
      const response = await this.client.send(new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: environment.aws.userPoolClientId,
        AuthParameters: { REFRESH_TOKEN: current.refreshToken },
      }));
      if (!response.AuthenticationResult?.IdToken) throw new Error('No token returned');
      this.saveAuthentication({ ...response.AuthenticationResult, RefreshToken: current.refreshToken }, true);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return Boolean(this.session()?.idToken && this.session()!.expiresAt > Date.now());
  }

  private saveAuthentication(result: { IdToken?: string; AccessToken?: string; RefreshToken?: string; ExpiresIn?: number }, remember: boolean): void {
    const session: Session = {
      idToken: result.IdToken!,
      accessToken: result.AccessToken ?? '',
      refreshToken: result.RefreshToken ?? '',
      expiresAt: Date.now() + (result.ExpiresIn ?? 3600) * 1000 - 30_000,
    };
    (remember ? localStorage : sessionStorage).setItem(this.storageKey, JSON.stringify(session));
    this.session.set(session);
    this.currentUser.set(this.userFromToken(session.idToken));
  }

  private readSession(): Session | null {
    try {
      const raw = localStorage.getItem(this.storageKey) ?? sessionStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    localStorage.removeItem(this.storageKey);
    sessionStorage.removeItem(this.storageKey);
    this.session.set(null);
    this.currentUser.set(null);
  }

  private userFromToken(token?: string): CurrentUser | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(this.decodeBase64Url(token.split('.')[1]));
      return {
        id: payload.sub,
        name: payload.name || payload.email,
        email: payload.email,
        role: payload['custom:role'] || 'Agent',
      };
    } catch {
      return null;
    }
  }

  private decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(Array.from(atob(normalized), character =>
      `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
  }

  private messageFor(error: unknown): string {
    const name = (error as { name?: string }).name;
    if (name === 'NotAuthorizedException') return 'Incorrect email or password.';
    if (name === 'UserNotFoundException') return 'No account was found for that email.';
    if (name === 'UserNotConfirmedException') return 'This account has not been confirmed yet.';
    if (name === 'PasswordResetRequiredException') return 'Reset your password before signing in.';
    if (name === 'CodeMismatchException') return 'The verification code is incorrect.';
    if (name === 'ExpiredCodeException') return 'The verification code has expired.';
    if (name === 'InvalidPasswordException') return 'Use at least 12 characters with uppercase, lowercase, a number, and a symbol.';
    if (name === 'LimitExceededException') return 'Too many attempts. Please wait and try again.';
    return (error as { message?: string }).message ?? 'AWS Cognito could not complete the request.';
  }
}
