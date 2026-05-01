import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { PartnerChatMode } from '../../../features/partner-chat/partner-chat.models';
import { PartnerChatThreadComponent } from '../../../features/partner-chat/partner-chat-thread/partner-chat-thread.component';
import { PartnerThreadFacadeService } from '../../../features/partner-chat/partner-thread-facade.service';
import {
  AgendaApiService,
  type PermissaoDadosRow,
} from '../agenda/services/agenda-api.service';

@Component({
  selector: 'app-parceiro-mensagens',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, PartnerChatThreadComponent],
  templateUrl: './parceiro-mensagens.component.html',
  styleUrls: ['./parceiro-mensagens.component.scss'],
})
export class ParceiroMensagensComponent implements OnInit {
  readonly modeParceiro: PartnerChatMode = 'parceiro';

  readonly rows = signal<PermissaoDadosRow[]>([]);
  readonly listLoading = signal(true);
  readonly listErr = signal<string | null>(null);

  readonly search = signal('');

  readonly selectedClienteId = signal<number | null>(null);

  readonly threadId = signal<string | null>(null);
  readonly threadBootLoading = signal(false);
  readonly threadBootErr = signal<string | null>(null);

  private readonly facade = inject(PartnerThreadFacadeService);
  private readonly agendaApi = inject(AgendaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly chatEligible = computed(() =>
    this.rows().filter((r) => String(r.status).toLowerCase() === 'concedido')
  );

  readonly filteredClients = computed(() => {
    const q = this.search()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const list = this.chatEligible();
    if (!q) {
      return list;
    }
    return list.filter((r) => {
      const nome = String(r.cliente_nome || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const email = String(r.cliente_email || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const id = String(r.cliente_id);
      return nome.includes(q) || email.includes(q) || id.includes(q);
    });
  });

  readonly selectedLabel = computed(() => {
    const id = this.selectedClienteId();
    if (!id) {
      return null;
    }
    const row = this.chatEligible().find((r) => Number(r.cliente_id) === id);
    return row?.cliente_nome || row?.cliente_email || `Cliente #${id}`;
  });

  private listLoadInFlight: Promise<void> | null = null;

  ngOnInit(): void {
    void this.loadClientList();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pm) => {
      const raw = pm.get('clienteId');
      const id = raw ? Number(raw) : NaN;
      if (Number.isFinite(id) && id >= 1) {
        void this.selectClienteRouting(id);
      } else {
        this.clearThreadState();
      }
    });
  }

  private clearThreadState(): void {
    this.selectedClienteId.set(null);
    this.threadId.set(null);
    this.threadBootErr.set(null);
    this.threadBootLoading.set(false);
  }

  private async selectClienteRouting(clienteId: number): Promise<void> {
    this.selectedClienteId.set(clienteId);
    await this.bootstrapThread(clienteId);
  }

  private async loadClientList(): Promise<void> {
    if (this.listLoadInFlight) {
      return this.listLoadInFlight;
    }
    this.listLoadInFlight = (async () => {
      this.listLoading.set(true);
      this.listErr.set(null);
      try {
        const list = await this.agendaApi.listPermissoesDados();
        this.rows.set(list || []);
        const cid = this.selectedClienteId();
        if (cid != null && !this.chatEligible().some((r) => Number(r.cliente_id) === cid)) {
          this.threadBootErr.set(
            'Este cliente ainda não tem permissão concedida; abra primeiro em Meus clientes.'
          );
        }
      } catch {
        this.listErr.set('Não foi possível carregar a lista de clientes.');
      } finally {
        this.listLoading.set(false);
      }
    })().finally(() => {
      this.listLoadInFlight = null;
    });
    return this.listLoadInFlight;
  }

  private async bootstrapThread(clienteId: number): Promise<void> {
    this.threadBootLoading.set(true);
    this.threadBootErr.set(null);
    this.threadId.set(null);
    try {
      await this.loadClientList();
      if (!this.chatEligible().some((r) => Number(r.cliente_id) === clienteId)) {
        throw new Error('Cliente sem permissão concedida para contacto.');
      }
      const tid = await this.facade.ensureThreadAsParceiro(clienteId);
      this.threadId.set(tid);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Não foi possível abrir a conversa.';
      this.threadBootErr.set(msg);
      this.threadId.set(null);
    } finally {
      this.threadBootLoading.set(false);
    }
  }

  pickCliente(row: PermissaoDadosRow): void {
    void this.router.navigate(['/parceiros/mensagens', row.cliente_id]);
  }

  goBackLista(): void {
    void this.router.navigate(['/parceiros/mensagens']);
  }

  refreshList(): void {
    void this.loadClientList();
  }

  trackByClienteId(_: number, row: PermissaoDadosRow): number {
    return row.cliente_id;
  }
}
