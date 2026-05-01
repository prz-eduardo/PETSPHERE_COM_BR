import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PartnerThreadFacadeService } from '../../../features/partner-chat/partner-thread-facade.service';
import { PartnerChatThreadComponent } from '../../../features/partner-chat/partner-chat-thread/partner-chat-thread.component';
import { AgendaApiService } from '../agenda/services/agenda-api.service';

@Component({
  selector: 'app-parceiro-chat-cliente',
  standalone: true,
  imports: [CommonModule, RouterModule, PartnerChatThreadComponent],
  templateUrl: './parceiro-chat-cliente.component.html',
  styleUrls: ['./parceiro-chat-cliente.component.scss'],
})
export class ParceiroChatClienteComponent implements OnInit {
  readonly threadId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly loadErr = signal<string | null>(null);
  readonly clienteLabel = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private facade: PartnerThreadFacadeService,
    private agendaApi: AgendaApiService
  ) {}

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('clienteId');
    const clienteId = Number(raw);
    if (!Number.isFinite(clienteId) || clienteId < 1) {
      this.loadErr.set('Cliente inválido');
      this.loading.set(false);
      return;
    }
    void this.bootstrap(clienteId);
  }

  private async bootstrap(clienteId: number): Promise<void> {
    this.loading.set(true);
    this.loadErr.set(null);
    try {
      void this.resolveClienteLabel(clienteId);
      const tid = await this.facade.ensureThreadAsParceiro(clienteId);
      this.threadId.set(tid);
    } catch (e: unknown) {
      const httpErr = e as { error?: { error?: string } };
      this.loadErr.set(
        httpErr?.error?.error ||
          (e instanceof Error ? e.message : 'Não foi possível abrir o chat.')
      );
    } finally {
      this.loading.set(false);
    }
  }

  private async resolveClienteLabel(clienteId: number): Promise<void> {
    try {
      const rows = await this.agendaApi.listPermissoesDados();
      const row = rows.find((r) => Number(r.cliente_id) === Number(clienteId));
      this.clienteLabel.set(row?.cliente_nome || row?.cliente_email || `Cliente #${clienteId}`);
    } catch {
      this.clienteLabel.set(`Cliente #${clienteId}`);
    }
  }
}
