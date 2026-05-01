import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { supportAuth } from '../../firebase-config';
import { SessionService } from '../../services/session.service';
import { ParceiroAuthService } from '../../services/parceiro-auth.service';
import { environment } from '../../../environments/environment';
import type { PartnerChatMode } from './partner-chat.models';

@Injectable({ providedIn: 'root' })
export class PartnerChatIdentityService {
  private signInFlight: Promise<string> | null = null;

  constructor(
    private http: HttpClient,
    private session: SessionService,
    private parceiroAuth: ParceiroAuthService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  async ensureFirebaseForChat(mode: PartnerChatMode): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return '';
    }
    const expectedUid = this.getExpectedChatUid(mode);
    const existing = supportAuth.currentUser?.uid;
    if (existing && expectedUid && existing === expectedUid) {
      return existing;
    }
    if (this.signInFlight) {
      return this.signInFlight;
    }
    this.signInFlight = (async () => {
      const url =
        mode === 'cliente'
          ? `${this.session.getBackendBaseUrl()}/auth/chat/firebase-token`
          : `${environment.apiBaseUrl}/parceiro/auth/chat/firebase-token`;
      let headers: { Authorization: string };
      if (mode === 'cliente') {
        const h = this.session.getAuthHeaders();
        if (!h) {
          throw new Error('Sessão necessária para o chat');
        }
        headers = h;
      } else {
        const h = this.parceiroAuth.getAuthHeaders();
        const auth = (h as { Authorization?: string }).Authorization;
        if (!auth) {
          throw new Error('Sessão do parceiro necessária');
        }
        headers = { Authorization: auth };
      }
      const res = await firstValueFrom(
        this.http.get<{ token: string; uid: string }>(url, {
          headers,
          responseType: 'json',
        })
      );
      if (!res?.token) {
        throw new Error('Resposta de token de chat inválida');
      }
      if (supportAuth.currentUser?.uid && supportAuth.currentUser.uid !== res.uid) {
        await signOut(supportAuth);
      }
      const cred = await signInWithCustomToken(supportAuth, res.token);
      if (expectedUid && cred.user.uid !== expectedUid) {
        throw new Error('Sessão de chat inconsistente com a sessão atual');
      }
      return cred.user.uid;
    })();
    try {
      return await this.signInFlight;
    } finally {
      this.signInFlight = null;
    }
  }

  getChatUidOrThrow(): string {
    const u = supportAuth.currentUser?.uid;
    if (!u) {
      throw new Error('Não autenticado no chat');
    }
    return u;
  }

  private getExpectedChatUid(mode: PartnerChatMode): string | null {
    if (mode === 'cliente') {
      const decoded = this.session.decodeToken();
      const id = decoded?.id;
      const tipo = String((decoded as { tipo?: string })?.tipo || '');
      if (id == null || tipo !== 'cliente') {
        return null;
      }
      return `cliente_${id}`;
    }
    const col = this.parceiroAuth.getCurrentColaborador();
    if (!col?.id) {
      return null;
    }
    return `parceiro_acc_${col.id}`;
  }
}
