import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../services/session.service';
import { ParceiroAuthService } from '../../services/parceiro-auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PartnerChatApiService {
  private readonly apiBase = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private session: SessionService,
    private parceiroAuth: ParceiroAuthService
  ) {}

  private baseCliente(): string {
    return `${this.session.getBackendBaseUrl()}/platform/chat/cliente`;
  }

  private baseParceiro(): string {
    return `${this.apiBase}/platform/chat/parceiro`;
  }

  private headersCliente() {
    const h = this.session.getAuthHeaders();
    if (!h) {
      throw new Error('Sem sessão');
    }
    return h;
  }

  private headersParceiro(): { Authorization: string } {
    const h = this.parceiroAuth.getAuthHeaders();
    const auth = (h as { Authorization?: string }).Authorization;
    if (!auth) {
      throw new Error('Sessão do parceiro necessária');
    }
    return { Authorization: auth };
  }

  async ensureThreadCliente(parceiroId: number): Promise<{ threadId: string; created: boolean }> {
    const res = await firstValueFrom(
      this.http.post<{ ok: boolean; threadId: string; created: boolean }>(
        `${this.baseCliente()}/threads/ensure`,
        { parceiroId },
        { headers: this.headersCliente() }
      )
    );
    if (!res?.threadId) {
      throw new Error('Resposta inválida do servidor');
    }
    return { threadId: res.threadId, created: !!res.created };
  }

  async ensureThreadParceiro(clienteId: number): Promise<{ threadId: string; created: boolean }> {
    const res = await firstValueFrom(
      this.http.post<{ ok: boolean; threadId: string; created: boolean }>(
        `${this.baseParceiro()}/threads/ensure`,
        { clienteId },
        { headers: this.headersParceiro() }
      )
    );
    if (!res?.threadId) {
      throw new Error('Resposta inválida do servidor');
    }
    return { threadId: res.threadId, created: !!res.created };
  }

  async logMensagemClienteFireAndForget(p: {
    threadId: string;
    firebaseMessageId: string;
    text: string;
    senderRole: 'cliente';
    ts: number;
  }): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseCliente()}/mensagens`, p, { headers: this.headersCliente() })
      );
    } catch (e) {
      console.warn('[partner-chat] log mensagem (cliente) falhou', e);
    }
  }

  async logMensagemParceiroFireAndForget(p: {
    threadId: string;
    firebaseMessageId: string;
    text: string;
    senderRole: 'parceiro_staff';
    ts: number;
  }): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.baseParceiro()}/mensagens`, p, { headers: this.headersParceiro() })
      );
    } catch (e) {
      console.warn('[partner-chat] log mensagem (parceiro) falhou', e);
    }
  }
}
