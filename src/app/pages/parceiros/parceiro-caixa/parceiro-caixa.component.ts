import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ParceiroCaixaMovimento,
  ParceiroCaixaResumo,
  ParceiroCaixaSessao,
  ParceiroCaixaService,
} from '../../../services/parceiro-caixa.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-parceiro-caixa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './parceiro-caixa.component.html',
  styleUrls: ['./parceiro-caixa.component.scss'],
})
export class ParceiroCaixaComponent implements OnInit {
  readonly loading = signal(false);
  readonly sessao = signal<ParceiroCaixaSessao | null>(null);
  readonly resumo = signal<ParceiroCaixaResumo | null>(null);
  readonly historico = signal<ParceiroCaixaSessao[]>([]);
  readonly movimentos = signal<ParceiroCaixaMovimento[]>([]);

  valorAbertura = 0;
  obsAbertura = '';
  valorContado: number | null = null;
  obsFechamento = '';
  movTipo: 'sangria' | 'suprimento' | 'ajuste' = 'sangria';
  movValor = 0;
  movDescricao = '';

  constructor(
    private api: ParceiroCaixaService,
    public auth: ParceiroAuthService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    void this.reloadAll();
  }

  async reloadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const atual = await firstValueFrom(this.api.getSessaoAtual());
      this.sessao.set(atual.data);
      this.resumo.set(atual.resumo);
      const hist = await firstValueFrom(this.api.listSessoes(1, 15));
      this.historico.set(hist.data || []);
      if (atual.data?.id) {
        const movs = await firstValueFrom(this.api.listMovimentos(atual.data.id));
        this.movimentos.set(movs);
      } else {
        this.movimentos.set([]);
      }
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível carregar o caixa.');
    } finally {
      this.loading.set(false);
    }
  }

  async abrir(): Promise<void> {
    try {
      const s = await firstValueFrom(this.api.abrirSessao({ valor_abertura: Number(this.valorAbertura) || 0, obs_abertura: this.obsAbertura || null }));
      this.sessao.set(s);
      this.toast.success('Caixa aberto.');
      this.valorAbertura = 0;
      this.obsAbertura = '';
      await this.reloadAll();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível abrir o caixa.');
    }
  }

  async fechar(): Promise<void> {
    try {
      const r = await firstValueFrom(
        this.api.fecharSessao({
          valor_contado: this.valorContado,
          obs_fechamento: this.obsFechamento || null,
        }),
      );
      const d = r.conciliacao?.diferenca;
      this.toast.success(
        d != null && Math.abs(Number(d)) > 0.009
          ? `Caixa fechado. Diferença: R$ ${Number(d).toFixed(2)}`
          : 'Caixa fechado.',
      );
      this.valorContado = null;
      this.obsFechamento = '';
      await this.reloadAll();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível fechar o caixa.');
    }
  }

  async registrarMovimento(): Promise<void> {
    if (!this.auth.isMaster()) {
      this.toast.error('Apenas o master pode registrar sangria, suprimento ou ajuste.');
      return;
    }
    try {
      await firstValueFrom(
        this.api.postMovimento({
          tipo: this.movTipo,
          valor: Number(this.movValor) || 0,
          descricao: this.movDescricao || null,
        }),
      );
      this.toast.success('Movimento registrado.');
      this.movValor = 0;
      this.movDescricao = '';
      await this.reloadAll();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível registrar o movimento.');
    }
  }
}
