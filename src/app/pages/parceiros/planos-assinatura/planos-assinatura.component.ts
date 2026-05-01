import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import {
  ParceiroHistoricoItem,
  ParceiroMinhaAssinaturaResponse,
  ParceiroMonetizacaoService,
} from '../../../services/parceiro-monetizacao.service';
import {
  ParceiroCreditoExtratoResponse,
  ParceiroCreditoMovimentoExtrato,
  ParceiroCreditosService,
} from '../../../services/parceiro-creditos.service';

@Component({
  selector: 'app-parceiros-planos-assinatura',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './planos-assinatura.component.html',
  styleUrls: ['./planos-assinatura.component.scss'],
})
export class PlanosAssinaturaComponent implements OnInit {
  private monetizacao = inject(ParceiroMonetizacaoService);
  private creditos = inject(ParceiroCreditosService);
  auth = inject(ParceiroAuthService);

  loading = true;
  error = '';
  assinatura: ParceiroMinhaAssinaturaResponse | null = null;
  saldo: number | null = null;
  saldoUpdatedAt: string | null = null;

  readonly extratoLimit = 25;
  extratoOffset = 0;
  extrato: ParceiroCreditoExtratoResponse | null = null;
  extratoLoading = false;
  extratoError = '';

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.error = '';
    this.loading = true;
    const headers = this.auth.getAuthHeaders();
    if (!('Authorization' in headers) || !headers.Authorization) {
      this.error = 'Sessão expirada. Faça login novamente.';
      this.loading = false;
      return;
    }
    this.extratoOffset = 0;
    this.extrato = null;
    this.extratoError = '';
    try {
      const [sub, saldoRes] = await Promise.all([
        lastValueFrom(this.monetizacao.getMinhaAssinatura(headers as { Authorization: string })),
        lastValueFrom(this.creditos.getSaldo(headers as { Authorization: string })).catch(() => null),
      ]);
      this.assinatura = sub;
      if (saldoRes) {
        this.saldo = saldoRes.saldo;
        this.saldoUpdatedAt = saldoRes.updated_at;
      }
      await this.loadExtrato();
    } catch (e: any) {
      this.error = e?.error?.error || 'Não foi possível carregar plano e assinatura.';
    } finally {
      this.loading = false;
    }
  }

  async loadExtrato(): Promise<void> {
    const headers = this.auth.getAuthHeaders();
    if (!('Authorization' in headers) || !headers.Authorization) return;

    this.extratoLoading = true;
    this.extratoError = '';
    try {
      this.extrato = await lastValueFrom(
        this.creditos.getExtrato(headers as { Authorization: string }, {
          limit: this.extratoLimit,
          offset: this.extratoOffset,
        })
      );
    } catch {
      this.extratoError = 'Não foi possível carregar o extrato de créditos.';
      this.extrato = null;
    } finally {
      this.extratoLoading = false;
    }
  }

  extratoPrev(): void {
    if (this.extratoOffset <= 0) return;
    this.extratoOffset = Math.max(0, this.extratoOffset - this.extratoLimit);
    void this.loadExtrato();
  }

  extratoNext(): void {
    if (!this.extrato || this.extratoOffset + this.extratoLimit >= this.extrato.total) return;
    this.extratoOffset += this.extratoLimit;
    void this.loadExtrato();
  }

  extratoCanPrev(): boolean {
    return this.extratoOffset > 0;
  }

  extratoCanNext(): boolean {
    if (!this.extrato) return false;
    return this.extratoOffset + this.extratoLimit < this.extrato.total;
  }

  formatDelta(delta: number): string {
    const abs = Math.abs(Number(delta) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    if (delta > 0) return `+${abs}`;
    if (delta < 0) return `-${abs}`;
    return abs;
  }

  formatBRL(v: number): string {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatData(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  statusLabel(s: string): string {
    const m: Record<string, string> = {
      ativo: 'Ativo',
      cancelado: 'Cancelado',
      expirado: 'Expirado',
    };
    return m[s] || s;
  }

  limiteLabel(n: number | null | undefined): string {
    if (n == null) return 'Ilimitado';
    return String(n);
  }

  trackHist(_i: number, row: ParceiroHistoricoItem): number {
    return row.subscricao.id;
  }

  trackExtrato(_i: number, row: ParceiroCreditoMovimentoExtrato): number {
    return row.id;
  }
}
