import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { SessionService } from '../../../services/session.service';
import { PartnerChatThreadComponent } from '../partner-chat-thread/partner-chat-thread.component';
import { PartnerThreadFacadeService } from '../partner-thread-facade.service';
import { PartnerChatLauncherService } from '../partner-chat-launcher.service';

@Component({
  selector: 'app-partner-chat-modal',
  standalone: true,
  imports: [CommonModule, PartnerChatThreadComponent],
  templateUrl: './partner-chat-modal.component.html',
  styleUrls: ['./partner-chat-modal.component.scss'],
})
export class PartnerChatModalComponent {
  readonly state = computed(() => this.launcher.state());
  readonly open = computed(() => this.state().open);
  readonly parceiroId = computed(() => this.state().parceiroId);
  readonly corridaContexto = computed(() => this.state().corridaId);
  readonly threadId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadErr = signal<string | null>(null);
  readonly parceiroNome = signal<string | null>(null);

  constructor(
    private launcher: PartnerChatLauncherService,
    private facade: PartnerThreadFacadeService,
    private api: ApiService,
    private session: SessionService
  ) {
    effect(() => {
      const st = this.state();
      if (!st.open || !st.parceiroId) {
        this.threadId.set(null);
        this.loading.set(false);
        this.loadErr.set(null);
        this.parceiroNome.set(null);
        return;
      }
      void this.bootstrap(st.parceiroId);
    }, { allowSignalWrites: true });
  }

  close(): void {
    this.launcher.close();
  }

  private async bootstrap(parceiroId: number): Promise<void> {
    this.loading.set(true);
    this.loadErr.set(null);
    this.threadId.set(null);
    this.parceiroNome.set(null);
    try {
      const tid = await this.facade.ensureThreadAsCliente(parceiroId);
      this.threadId.set(tid);
      void this.loadNomeParceiro(parceiroId);
    } catch (e: unknown) {
      this.loadErr.set(this.mapOpenErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  private mapOpenErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'Sua sessão expirou. Faça login novamente para continuar.';
      }
      if (error.status === 403) {
        return 'Esta loja está indisponível para mensagens no momento.';
      }
      const body = error.error;
      if (body && typeof body === 'object' && typeof body.error === 'string') {
        return body.error;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Não foi possível abrir o chat agora. Tente novamente em alguns instantes.';
  }

  private async loadNomeParceiro(parceiroId: number): Promise<void> {
    const token = this.session.getBackendToken();
    if (!token) {
      return;
    }
    try {
      const res = await firstValueFrom(this.api.listClientePermissoesDadosParceiros(token));
      const row = res.permissoes?.find((p) => p.parceiro_id === parceiroId);
      this.parceiroNome.set(row?.parceiro_nome || null);
    } catch {
      this.parceiroNome.set(null);
    }
  }
}
