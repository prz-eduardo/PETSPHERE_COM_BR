import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatComercialFinalAction {
  type: string;
  route: string | null;
  confidence: number;
  requiresConfirmation: boolean;
}

export interface ChatComercialDecisionTrace {
  correlationId?: string | null;
  decisionSchemaVersion?: string;
  policyBundleVersion?: string;
  flow?: string;
  intent?: string;
  finalDecision?: string;
  reason?: string;
  billingOutcome?: string | null;
  idempotencyKey?: string | null;
}

export interface ChatComercialResponse {
  message: string;
  severity?: string;
  leadStage?: string;
  finalAction: ChatComercialFinalAction;
  billing: {
    charge: boolean;
    tier?: number;
    eventCode?: string | null;
    creditsCharged?: number;
  };
  decisionTrace?: ChatComercialDecisionTrace;
}

@Injectable({ providedIn: 'root' })
export class ParceiroChatComercialService {
  private http = inject(HttpClient);
  private base = (environment as { apiBaseUrl: string }).apiBaseUrl.replace(/\/$/, '');

  postComercial(
    body: { message: string; sessionId?: string; clientMessageId?: string },
    authHeaders: { Authorization: string }
  ): Observable<ChatComercialResponse> {
    return this.http.post<ChatComercialResponse>(`${this.base}/parceiro/chat/comercial`, body, {
      headers: authHeaders,
    });
  }
}
