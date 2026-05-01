import { Injectable, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { ToastService } from '../../services/toast.service';
import { filter } from 'rxjs/operators';

export interface PartnerChatModalState {
  open: boolean;
  parceiroId: number | null;
  corridaId: number | null;
}

@Injectable({ providedIn: 'root' })
export class PartnerChatLauncherService {
  readonly state = signal<PartnerChatModalState>({ open: false, parceiroId: null, corridaId: null });

  constructor(
    private session: SessionService,
    private router: Router,
    private toast: ToastService
  ) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => {
        if (!this.state().open) {
          return;
        }
        this.close();
      });
  }

  openForPartner(parceiroId: number, corridaId?: number | null): void {
    if (!Number.isFinite(parceiroId) || parceiroId < 1) {
      this.toast.error('Não foi possível identificar esta loja para o chat.');
      return;
    }
    const decoded = this.session.decodeToken();
    const tipo = String(decoded?.tipo || decoded?.role || '');
    if (!this.session.hasValidSession(false) || tipo !== 'cliente') {
      this.toast.info('Entre na sua conta de cliente para enviar mensagens à loja.');
      try {
        sessionStorage.setItem('fp_post_login_chat_parceiro_id', String(parceiroId));
      } catch {
        /* ignore */
      }
      void this.router.navigate(['/area-cliente'], {
        queryParams: { login: '1', chatParceiro: String(parceiroId) },
      });
      return;
    }
    const cid = Number(corridaId);
    this.state.set({
      open: true,
      parceiroId,
      corridaId: Number.isFinite(cid) && cid > 0 ? cid : null,
    });
  }

  close(): void {
    this.state.set({ open: false, parceiroId: null, corridaId: null });
  }
}
