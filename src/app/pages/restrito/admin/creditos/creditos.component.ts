import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminMonetizacaoService,
  CreditEvento,
  CreditEventoMeta,
  CreditPacote,
  CreditBalanceRow,
  CreditMovimento,
  CreditTier,
  CreditFallback,
} from '../../../../services/admin-monetizacao.service';

const TIER_RANGES: Record<CreditTier, { min: number; max: number; label: string }> = {
  LOW:     { min: 1,  max: 2,        label: '1 – 2 créditos' },
  MEDIUM:  { min: 3,  max: 7,        label: '3 – 7 créditos' },
  HIGH:    { min: 8,  max: 15,       label: '8 – 15 créditos' },
  PREMIUM: { min: 16, max: 1_000_000, label: '16 + créditos' },
};
const FALLBACK_LABELS: Record<CreditFallback, string> = {
  block:               'Bloqueia (default seguro)',
  warn:                'Avisa, mas executa',
  fallback_internal:   'Notificação interna no painel',
  fallback_template:   'Template/conteúdo padrão',
};

type TabKey = 'eventos' | 'pacotes' | 'saldos';

@Component({
  selector: 'app-creditos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './creditos.component.html',
  styleUrls: ['./creditos.component.scss'],
})
export class CreditosAdminComponent implements OnInit {
  private api = inject(AdminMonetizacaoService);

  tab = signal<TabKey>('eventos');
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);

  // Eventos
  eventos = signal<CreditEvento[]>([]);
  eventosMeta: CreditEventoMeta = { tiers: ['LOW','MEDIUM','HIGH','PREMIUM'], fallbacks: ['block','warn','fallback_internal','fallback_template'] };
  editingEvento: Partial<CreditEvento> | null = null;
  readonly tierRanges = TIER_RANGES;
  readonly fallbackLabels = FALLBACK_LABELS;

  // Pacotes
  pacotes = signal<CreditPacote[]>([]);
  editingPacote: Partial<CreditPacote> | null = null;

  // Saldos
  saldos = signal<CreditBalanceRow[]>([]);
  saldosTotal = 0;
  saldosPage = 1;
  saldosPageSize = 25;
  saldosQuery = '';
  selectedParceiro = signal<CreditBalanceRow | null>(null);
  extrato = signal<CreditMovimento[]>([]);
  ajusteDelta = 0;
  ajusteMotivo = '';

  ngOnInit() { this.changeTab('eventos'); }

  changeTab(t: TabKey) {
    this.tab.set(t);
    this.errorMsg.set(null);
    if (t === 'eventos') this.loadEventos();
    else if (t === 'pacotes') this.loadPacotes();
    else this.loadSaldos();
  }

  // ---------- Eventos ----------
  loadEventos() {
    this.loading.set(true);
    this.api.listEventos().subscribe({
      next: (r) => {
        this.eventos.set(r.data || []);
        if (r.meta) this.eventosMeta = r.meta;
        this.loading.set(false);
      },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.loading.set(false); },
    });
  }
  novoEvento() {
    this.editingEvento = {
      codigo: '', nome: '', categoria: 'geral',
      tier: 'LOW', fallback_strategy: 'block',
      custo_creditos: 1, requer_automacao: 0, ativo: 1,
    };
  }

  /** Sugere tier ao mudar custo no formulário. */
  onCustoChange() {
    if (!this.editingEvento) return;
    const c = Number(this.editingEvento.custo_creditos || 0);
    let tier: CreditTier = 'LOW';
    if (c <= 2) tier = 'LOW';
    else if (c <= 7) tier = 'MEDIUM';
    else if (c <= 15) tier = 'HIGH';
    else tier = 'PREMIUM';
    this.editingEvento.tier = tier;
  }

  tierLabel(t: CreditTier | undefined): string { return t ? `${t} · ${TIER_RANGES[t].label}` : ''; }
  fallbackLabel(f: CreditFallback | undefined): string { return f ? FALLBACK_LABELS[f] : ''; }
  editarEvento(e: CreditEvento) { this.editingEvento = { ...e }; }
  cancelarEvento() { this.editingEvento = null; }
  salvarEvento() {
    if (!this.editingEvento) return;
    this.saving.set(true);
    const op = this.editingEvento.id
      ? this.api.updateEvento(this.editingEvento.id, this.editingEvento)
      : this.api.createEvento(this.editingEvento);
    op.subscribe({
      next: () => { this.saving.set(false); this.editingEvento = null; this.loadEventos(); },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.saving.set(false); },
    });
  }
  removerEvento(e: CreditEvento) {
    if (!confirm(`Desativar evento "${e.nome}"?`)) return;
    this.api.removeEvento(e.id).subscribe({
      next: () => this.loadEventos(),
      error: (err) => this.errorMsg.set(this.extractError(err)),
    });
  }

  // ---------- Pacotes ----------
  loadPacotes() {
    this.loading.set(true);
    this.api.listPacotes().subscribe({
      next: (r) => { this.pacotes.set(r.data || []); this.loading.set(false); },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.loading.set(false); },
    });
  }
  novoPacote() {
    this.editingPacote = { nome: '', slug: '', preco_reais: 0, creditos_incluidos: 0, bonus_creditos: 0, ordem: 0, destaque: 0, ativo: 1 };
  }
  editarPacote(p: CreditPacote) { this.editingPacote = { ...p }; }
  cancelarPacote() { this.editingPacote = null; }
  salvarPacote() {
    if (!this.editingPacote) return;
    this.saving.set(true);
    const op = this.editingPacote.id
      ? this.api.updatePacote(this.editingPacote.id, this.editingPacote)
      : this.api.createPacote(this.editingPacote);
    op.subscribe({
      next: () => { this.saving.set(false); this.editingPacote = null; this.loadPacotes(); },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.saving.set(false); },
    });
  }
  removerPacote(p: CreditPacote) {
    if (!confirm(`Desativar pacote "${p.nome}"?`)) return;
    this.api.removePacote(p.id).subscribe({
      next: () => this.loadPacotes(),
      error: (e) => this.errorMsg.set(this.extractError(e)),
    });
  }

  // ---------- Saldos ----------
  loadSaldos() {
    this.loading.set(true);
    this.api.listBalances({ page: this.saldosPage, pageSize: this.saldosPageSize, q: this.saldosQuery || undefined }).subscribe({
      next: (r) => { this.saldos.set(r.data || []); this.saldosTotal = r.total; this.loading.set(false); },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.loading.set(false); },
    });
  }
  buscarSaldos() { this.saldosPage = 1; this.loadSaldos(); }
  abrirParceiro(p: CreditBalanceRow) {
    this.selectedParceiro.set(p);
    this.ajusteDelta = 0;
    this.ajusteMotivo = '';
    this.api.getExtrato(p.parceiro_id, { limit: 50 }).subscribe({
      next: (r) => this.extrato.set(r.items || []),
      error: (e) => this.errorMsg.set(this.extractError(e)),
    });
  }
  fecharParceiro() { this.selectedParceiro.set(null); this.extrato.set([]); }
  aplicarAjuste() {
    const p = this.selectedParceiro();
    if (!p) return;
    if (!this.ajusteDelta || !this.ajusteMotivo.trim()) {
      this.errorMsg.set('Informe delta != 0 e motivo.');
      return;
    }
    this.saving.set(true);
    this.api.ajusteManual(p.parceiro_id, Math.trunc(this.ajusteDelta), this.ajusteMotivo.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.ajusteDelta = 0; this.ajusteMotivo = '';
        this.abrirParceiro(p);
        this.loadSaldos();
      },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.saving.set(false); },
    });
  }

  trackById(_i: number, x: { id: number }) { return x.id; }
  trackByPid(_i: number, x: CreditBalanceRow) { return x.parceiro_id; }

  bool(v: any): boolean { return !!Number(v); }
  setBool(target: 'evento' | 'pacote', field: string, value: boolean) {
    const obj: any = target === 'evento' ? this.editingEvento : this.editingPacote;
    if (!obj) return;
    obj[field] = value ? 1 : 0;
  }

  formatBRL(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private extractError(err: any): string {
    return err?.error?.error || err?.message || 'Erro inesperado.';
  }
}
