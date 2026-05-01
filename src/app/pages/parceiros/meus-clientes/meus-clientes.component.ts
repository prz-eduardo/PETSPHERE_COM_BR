import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  AgendaApiService,
  DiscoveryCandidateRow,
  PermissaoDadosRow,
} from '../agenda/services/agenda-api.service';

type EscopoPermissao = 'dados_basicos' | 'pets' | 'completo';

@Component({
  selector: 'app-meus-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './meus-clientes.component.html',
  styleUrls: ['./meus-clientes.component.scss'],
})
export class MeusClientesComponent {
  loading = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);
  submitError = signal<string | null>(null);
  submitSuccess = signal<string | null>(null);
  tokenHint = signal<string | null>(null);
  searchLoading = signal(false);
  candidates = signal<DiscoveryCandidateRow[]>([]);
  selectedCandidate = signal<DiscoveryCandidateRow | null>(null);
  searchError = signal<string | null>(null);

  filtro = signal('');
  permissoes = signal<PermissaoDadosRow[]>([]);

  email = signal('');
  escopo = signal<EscopoPermissao>('dados_basicos');
  private discoveryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly permissoesFiltradas = computed(() => {
    const q = this.normalize(this.filtro());
    if (!q) return this.permissoes();
    return this.permissoes().filter((row) => {
      const nome = this.normalize(row.cliente_nome || '');
      const email = this.normalize(row.cliente_email || '');
      const status = this.normalize(row.status || '');
      return nome.includes(q) || email.includes(q) || status.includes(q);
    });
  });

  constructor(private readonly agendaApi: AgendaApiService) {
    this.carregarClientes();
  }

  async carregarClientes(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rows = await this.agendaApi.listPermissoesDados();
      this.permissoes.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.permissoes.set([]);
      this.error.set('Nao foi possivel carregar os clientes da loja.');
    } finally {
      this.loading.set(false);
    }
  }

  async solicitarPermissao(): Promise<void> {
    const selected = this.selectedCandidate();
    const email = this.email().trim().toLowerCase();
    if (!email && !selected) {
      this.submitError.set('Informe e-mail ou selecione um cliente na busca.');
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);
    this.tokenHint.set(null);

    try {
      const res = await this.agendaApi.postConviteCliente({
        cliente_id: selected?.cliente_id,
        cliente_email: selected ? undefined : email,
        escopo: this.escopo(),
        days_valid: 7,
      });
      const convite = (res?.convite || null) as { token?: string } | null;
      this.tokenHint.set(convite?.token ?? null);
      this.submitSuccess.set('Solicitacao enviada com sucesso para o cliente.');
      this.email.set('');
      this.candidates.set([]);
      this.selectedCandidate.set(null);
      await this.carregarClientes();
    } catch (e: unknown) {
      const msg = (e as { error?: { error?: string } })?.error?.error ?? 'Falha ao solicitar permissao';
      this.submitError.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  trackByPermissao(_: number, row: PermissaoDadosRow): number {
    return row.id;
  }

  onSearchChange(value: string): void {
    this.email.set(value);
    this.selectedCandidate.set(null);
    this.searchError.set(null);

    if (this.discoveryTimer) clearTimeout(this.discoveryTimer);
    const term = value.trim();
    if (term.length < 3) {
      this.candidates.set([]);
      return;
    }

    this.discoveryTimer = setTimeout(() => {
      void this.buscarCandidatos(term);
    }, 300);
  }

  selectCandidate(candidate: DiscoveryCandidateRow): void {
    this.selectedCandidate.set(candidate);
    this.email.set(candidate.email_masked || candidate.telefone_masked || candidate.cpf_masked || '');
    this.candidates.set([]);
  }

  private async buscarCandidatos(term: string): Promise<void> {
    this.searchLoading.set(true);
    try {
      const rows = await this.agendaApi.discoverClientes(term);
      this.candidates.set(Array.isArray(rows) ? rows : []);
      this.searchError.set(null);
    } catch (e: unknown) {
      const msg = (e as { error?: { error?: string } })?.error?.error ?? 'Falha ao buscar clientes';
      this.searchError.set(msg);
      this.candidates.set([]);
    } finally {
      this.searchLoading.set(false);
    }
  }

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
