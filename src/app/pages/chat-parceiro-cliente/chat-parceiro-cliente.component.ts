import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NavmenuComponent } from '../../navmenu/navmenu.component';
import { PartnerThreadFacadeService } from '../../features/partner-chat/partner-thread-facade.service';
import { PartnerChatThreadComponent } from '../../features/partner-chat/partner-chat-thread/partner-chat-thread.component';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-chat-parceiro-cliente',
  standalone: true,
  imports: [CommonModule, RouterModule, NavmenuComponent, PartnerChatThreadComponent],
  templateUrl: './chat-parceiro-cliente.component.html',
  styleUrls: ['./chat-parceiro-cliente.component.scss'],
})
export class ChatParceiroClienteComponent implements OnInit {
  readonly threadId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadErr = signal<string | null>(null);
  readonly parceiroNome = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private facade: PartnerThreadFacadeService,
    private api: ApiService,
    private session: SessionService
  ) {}

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('parceiroId');
    const parceiroId = Number(raw);
    if (!Number.isFinite(parceiroId) || parceiroId < 1) {
      this.loadErr.set('Parceiro inválido');
      this.loading.set(false);
      return;
    }
    void this.bootstrap(parceiroId);
  }

  private async bootstrap(parceiroId: number): Promise<void> {
    this.loading.set(true);
    this.loadErr.set(null);
    try {
      const tid = await this.facade.ensureThreadAsCliente(parceiroId);
      this.threadId.set(tid);
      void this.loadNomeParceiro(parceiroId);
    } catch (e: unknown) {
      let msg: string | null = null;
      if (e instanceof HttpErrorResponse) {
        const body = e.error;
        if (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: string }).error === 'string') {
          msg = (body as { error: string }).error;
        }
      } else if (e instanceof Error) {
        msg = e.message;
      }
      this.loadErr.set(
        msg ||
          'Não foi possível abrir o chat. Verifique se há permissão concedida com esta loja.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async loadNomeParceiro(parceiroId: number): Promise<void> {
    const token = this.session.getBackendToken();
    if (!token) {
      this.parceiroNome.set(null);
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
