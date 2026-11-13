import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CONFIG } from './config';
import {
  AuditResponse,
  ChargeRequest,
  ChargeResult,
  ChargeSession,
  CreatedUser,
  Decision,
  IntegrityResult,
  KcUser,
  Me,
  MfaEnrollment,
  MfaStatus,
  RegistrationRequest,
  NewUser,
  Overview,
  Policy,
  Station,
} from './models';

/** Tous les appels vont au backend Spring Boot ; c'est lui qui parle a FastAPI, a Keycloak et a la base. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = CONFIG.apiUrl;

  me() {
    return firstValueFrom(this.http.get<Me>(`${this.base}/me`));
  }

  stations() {
    return firstValueFrom(this.http.get<Station[]>(`${this.base}/stations`));
  }

  charge(stationId: number, body: ChargeRequest = {}) {
    return firstValueFrom(this.http.post<ChargeResult>(`${this.base}/stations/${stationId}/charge`, this.withRequestProof(body)));
  }

  mySessions() {
    return firstValueFrom(this.http.get<ChargeSession[]>(`${this.base}/sessions`));
  }

  stopSession(id: number) {
    return firstValueFrom(this.http.post<ChargeResult>(`${this.base}/sessions/${id}/stop`, this.withRequestProof()));
  }

  resources() {
    return firstValueFrom(this.http.get<Record<string, Policy>>(`${this.base}/resources`));
  }

  checkAccess(resource: string, body: ChargeRequest = {}) {
    return firstValueFrom(this.http.post<Decision>(`${this.base}/access/${encodeURIComponent(resource)}`, this.withRequestProof(body)));
  }

  // ---------------------------------------------------------------- inscription (publique)

  register(body: RegistrationRequest) {
    return firstValueFrom(this.http.post<{ username: string; role: string }>(`${this.base}/public/register`, body));
  }

  // ---------------------------------------------------------------- MFA de l'utilisateur connecté

  mfaStatus() {
    return firstValueFrom(this.http.get<MfaStatus>(`${this.base}/mfa/status`));
  }

  /** currentOtp : requis seulement pour renouveler un secret déjà actif. */
  mfaEnroll(currentOtp?: string) {
    return firstValueFrom(this.http.post<MfaEnrollment>(`${this.base}/mfa/enroll`, currentOtp ? { currentOtp } : {}));
  }

  mfaConfirm(otp: string) {
    return firstValueFrom(this.http.post<MfaStatus>(`${this.base}/mfa/confirm`, { otp }));
  }

  private withRequestProof(body: ChargeRequest = {}): ChargeRequest {
    return { ...body, nonce: crypto.randomUUID(), timestamp: Date.now() };
  }

  // ---------------------------------------------------------------- administration

  overview() {
    return firstValueFrom(this.http.get<Overview>(`${this.base}/admin/overview`));
  }

  allSessions() {
    return firstValueFrom(this.http.get<ChargeSession[]>(`${this.base}/admin/sessions`));
  }

  audit(limit = 50) {
    const params = new HttpParams().set('limit', limit);
    return firstValueFrom(this.http.get<AuditResponse>(`${this.base}/admin/audit`, { params }));
  }

  integrity(requestId: string) {
    return firstValueFrom(this.http.get<IntegrityResult>(`${this.base}/admin/audit/${requestId}`));
  }

  users() {
    return firstValueFrom(this.http.get<KcUser[]>(`${this.base}/admin/users`));
  }

  createUser(user: NewUser) {
    return firstValueFrom(this.http.post<CreatedUser>(`${this.base}/admin/users`, user));
  }

  revokeUser(username: string) {
    return firstValueFrom(
      this.http.post<{ username: string; txHash: string; keycloakDisabled: boolean }>(
        `${this.base}/admin/users/${encodeURIComponent(username)}/revoke`,
        {},
      ),
    );
  }

  resetUserMfa(username: string) {
    return firstValueFrom(this.http.post<MfaStatus>(`${this.base}/admin/users/${encodeURIComponent(username)}/mfa/reset`, {}));
  }

  attackStatus() {
    return firstValueFrom(this.http.get<{ attack_active: boolean }>(`${this.base}/admin/attack`));
  }


}
