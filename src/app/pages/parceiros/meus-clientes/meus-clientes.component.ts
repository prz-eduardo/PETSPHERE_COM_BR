import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SideDrawerComponent } from '../../../shared/side-drawer/side-drawer.component';
import {
  AgendaApiService,
  DiscoveryCandidateRow,
  PanoramaClientePermitidoResponse,
  PermissaoDadosRow,
} from '../agenda/services/agenda-api.service';

type EscopoPermissao = 'dados_basicos' | 'pets' | 'completo';
type StatusTab = 'todos' | 'concedido' | 'pendente' | 'revogado';
type Ordenacao = 'recentes' | 'nome' | 'status';

const AVATAR_PALETTE = [
  ['#6366f1', '#8b5cf6'],
  ['#0ea5e9', '#22d3ee'],
  ['#10b981', '#34d399'],
  ['#f59e0b', '#fbbf24'],
  ['#ef4444', '#f87171'],
  ['#ec4899', '#f472b6'],
  ['#14b8a6', '#2dd4bf'],
  ['#a855f7', '#c084fc'],
];

@Component({
  selector: 'app-meus-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SideDrawerComponent],
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

  statusTab = signal<StatusTab>('todos');
  ordenacao = signal<Ordenacao>('recentes');

  inviteDrawerOpen = signal(false);
  detailsDrawerOpen = signal(false);
  detailsLoading = signal(false);
  detailsError = signal<string | null>(null);
  detailsData = signal<PanoramaClientePermitidoResponse | null>(null);
  selectedRow = signal<PermissaoDadosRow | null>(null);

  confirmRevokeId = signal<number | null>(null);
  rowActionLoadingId = signal<number | null>(null);
  actionFeedback = signal<{ kind: 'ok' | 'error'; message: string } | null>(null);
  copyFeedbackId = signal<number | null>(null);
  inviteCopied = signal(false);

  private discoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  private inviteCopyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly kpis = computed(() => {
    const rows = this.permissoes();
    const concedidos = rows.filter((r) => r.status === 'concedido').length;
    const pendentes = rows.filter((r) => r.status === 'pendente').length;
    const revogados = rows.filter((r) => r.status === 'revogado').length;
    const total = rows.length;
    const conversao = total > 0 ? Math.round((concedidos / total) * 100) : 0;
    return { total, concedidos, pendentes, revogados, conversao };
  });

  readonly contagemPorStatus = computed(() => {
    const rows = this.permissoes();
    return {
      todos: rows.length,
      concedido: rows.filter((r) => r.status === 'concedido').length,
      pendente: rows.filter((r) => r.status === 'pendente').length,
      revogado: rows.filter((r) => r.status === 'revogado').length,
    };
  });

  readonly permissoesFiltradas = computed(() => {
    const tab = this.statusTab();
    const q = this.normalize(this.filtro());
    const ord = this.ordenacao();

    let rows = this.permissoes();

    if (tab !== 'todos') {
      rows = rows.filter((r) => r.status === tab);
    }

    if (q) {
      rows = rows.filter((row) => {
        const nome = this.normalize(row.cliente_nome || '');
        const email = this.normalize(row.cliente_email || '');
        const status = this.normalize(row.status || '');
        const escopo = this.normalize(row.escopo || '');
        return (
          nome.includes(q) ||
          email.includes(q) ||
          status.includes(q) ||
          escopo.includes(q)
        );
      });
    }

    const sorted = [...rows];
    if (ord === 'nome') {
      sorted.sort((a, b) =>
        (a.cliente_nome || '').localeCompare(b.cliente_nome || '', 'pt-BR', {
          sensitivity: 'base',
        })
      );
    } else if (ord === 'status') {
      const order: Record<string, number> = {
        pendente: 0,
        concedido: 1,
        revogado: 2,
      };
      sorted.sort(
        (a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)
      );
    } else {
      sorted.sort((a, b) => (b.id || 0) - (a.id || 0));
    }
    return sorted;
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

  setStatusTab(tab: StatusTab): void {
    this.statusTab.set(tab);
  }

  openInviteDrawer(): void {
    this.submitError.set(null);
    this.submitSuccess.set(null);
    this.tokenHint.set(null);
    this.searchError.set(null);
    this.candidates.set([]);
    this.selectedCandidate.set(null);
    this.email.set('');
    this.escopo.set('dados_basicos');
    this.inviteCopied.set(false);
    this.inviteDrawerOpen.set(true);
  }

  closeInviteDrawer(): void {
    this.inviteDrawerOpen.set(false);
  }

  async openDetails(row: PermissaoDadosRow): Promise<void> {
    this.selectedRow.set(row);
    this.detailsData.set(null);
    this.detailsError.set(null);
    this.detailsDrawerOpen.set(true);

    if (row.status !== 'concedido') {
      return;
    }

    this.detailsLoading.set(true);
    try {
      const data = await this.agendaApi.getClientePanoramaDados(row.cliente_id);
      this.detailsData.set(data);
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ??
        'Nao foi possivel carregar os detalhes do cliente.';
      this.detailsError.set(msg);
    } finally {
      this.detailsLoading.set(false);
    }
  }

  closeDetailsDrawer(): void {
    this.detailsDrawerOpen.set(false);
    this.selectedRow.set(null);
    this.detailsData.set(null);
    this.detailsError.set(null);
    this.confirmRevokeId.set(null);
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
      const msg =
        (e as { error?: { error?: string } })?.error?.error ??
        'Falha ao solicitar permissao';
      this.submitError.set(msg);
    } finally {
      this.submitting.set(false);
    }
  }

  async reenviarConvite(row: PermissaoDadosRow): Promise<void> {
    this.rowActionLoadingId.set(row.id);
    try {
      await this.agendaApi.postConviteCliente({
        cliente_id: row.cliente_id,
        escopo: (row.escopo as EscopoPermissao) || 'dados_basicos',
        days_valid: 7,
      });
      this.flashFeedback('ok', `Convite reenviado para ${row.cliente_nome || 'cliente'}.`);
      await this.carregarClientes();
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ??
        'Falha ao reenviar convite.';
      this.flashFeedback('error', msg);
    } finally {
      this.rowActionLoadingId.set(null);
    }
  }

  pedirConfirmacaoRevogar(row: PermissaoDadosRow): void {
    this.confirmRevokeId.set(row.id);
  }

  cancelarConfirmacao(): void {
    this.confirmRevokeId.set(null);
  }

  async revogar(row: PermissaoDadosRow): Promise<void> {
    this.rowActionLoadingId.set(row.id);
    try {
      await this.agendaApi.revokePermissaoDados(row.id);
      this.flashFeedback(
        'ok',
        `Permissao de ${row.cliente_nome || 'cliente'} foi revogada.`
      );
      this.confirmRevokeId.set(null);
      await this.carregarClientes();
      if (this.selectedRow()?.id === row.id) {
        this.closeDetailsDrawer();
      }
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ??
        'Falha ao revogar permissao.';
      this.flashFeedback('error', msg);
    } finally {
      this.rowActionLoadingId.set(null);
    }
  }

  async copiarEmail(row: PermissaoDadosRow, event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!row.cliente_email) return;
    try {
      await navigator.clipboard.writeText(row.cliente_email);
      this.copyFeedbackId.set(row.id);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copyFeedbackId.set(null), 1800);
    } catch {
      this.flashFeedback('error', 'Nao foi possivel copiar o email.');
    }
  }

  async copiarLinkConvite(token: string): Promise<void> {
    const link = `${window.location.origin}/convite-dados/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      this.inviteCopied.set(true);
      if (this.inviteCopyTimer) clearTimeout(this.inviteCopyTimer);
      this.inviteCopyTimer = setTimeout(() => this.inviteCopied.set(false), 1800);
    } catch {
      this.submitError.set('Nao foi possivel copiar o link.');
    }
  }

  trackByPermissao(_: number, row: PermissaoDadosRow): number {
    return row.id;
  }

  trackByCandidate(_: number, row: DiscoveryCandidateRow): number {
    return row.cliente_id;
  }

  trackByPet(_: number, pet: { id: number }): number {
    return pet.id;
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
    this.email.set(
      candidate.email_masked ||
        candidate.telefone_masked ||
        candidate.cpf_masked ||
        ''
    );
    this.candidates.set([]);
  }

  iniciaisDe(nome?: string | null): string {
    if (!nome) return '?';
    const partes = nome
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);
    if (!partes.length) return '?';
    if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
    const first = partes[0]![0] ?? '';
    const last = partes[partes.length - 1]![0] ?? '';
    return (first + last).toUpperCase();
  }

  avatarGradient(id: number): string {
    const safeId = Math.abs(Number.isFinite(id) ? id : 0);
    const idx = safeId % AVATAR_PALETTE.length;
    const [from, to] = AVATAR_PALETTE[idx]!;
    return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
  }

  statusLabel(status: string | null | undefined): string {
    switch (status) {
      case 'concedido':
        return 'Acesso concedido';
      case 'pendente':
        return 'Aguardando cliente';
      case 'revogado':
        return 'Acesso revogado';
      default:
        return status || '—';
    }
  }

  escopoLabel(escopo: string | null | undefined): string {
    switch (escopo) {
      case 'dados_basicos':
        return 'Dados basicos';
      case 'pets':
        return 'Dados + pets';
      case 'completo':
        return 'Acesso completo';
      default:
        return escopo || '—';
    }
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  conviteLink(token: string | null | undefined): string {
    if (!token) return '';
    if (typeof window === 'undefined') return `/convite-dados/${token}`;
    return `${window.location.origin}/convite-dados/${token}`;
  }

  private flashFeedback(kind: 'ok' | 'error', message: string): void {
    this.actionFeedback.set({ kind, message });
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => this.actionFeedback.set(null), 3500);
  }

  private async buscarCandidatos(term: string): Promise<void> {
    this.searchLoading.set(true);
    try {
      const rows = await this.agendaApi.discoverClientes(term);
      this.candidates.set(Array.isArray(rows) ? rows : []);
      this.searchError.set(null);
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ??
        'Falha ao buscar clientes';
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
