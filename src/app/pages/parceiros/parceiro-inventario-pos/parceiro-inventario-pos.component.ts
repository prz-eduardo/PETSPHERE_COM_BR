import { afterNextRender, Component, ElementRef, OnInit, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ParceiroComercialProdutosService, ListaProdutoParceiroRow } from '../../../services/parceiro-comercial-produtos.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ParceiroCaixaService, FormaPagamentoPos, ParceiroCaixaSessao } from '../../../services/parceiro-caixa.service';
import { ToastService } from '../../../services/toast.service';
import { BarcodeScanTargetDirective } from '../../../shared/barcode-scan-target.directive';

export interface PosCartLine {
  produto_id: number;
  nome: string;
  preco: number;
  qty: number;
}

const POS_STEP_LABELS = ['Produtos', 'Carrinho', 'Pagamento'] as const;

@Component({
  selector: 'app-parceiro-inventario-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BarcodeScanTargetDirective],
  templateUrl: './parceiro-inventario-pos.component.html',
  styleUrls: ['./parceiro-inventario-pos.component.scss'],
})
export class ParceiroInventarioPosComponent implements OnInit {
  readonly loading = signal(false);
  readonly items = signal<ListaProdutoParceiroRow[]>([]);
  readonly sessaoCaixa = signal<ParceiroCaixaSessao | null>(null);
  readonly checkoutBusy = signal(false);
  searchTerm = '';
  readonly cartLines = signal<PosCartLine[]>([]);
  formaPagamento: FormaPagamentoPos = 'dinheiro';

  /** 0 = produtos, 1 = carrinho, 2 = pagamento */
  readonly posStep = signal(0);
  readonly posSteps = POS_STEP_LABELS.map((label) => ({ label }));

  /** Ponto único para plugar USB/SDK quando existir backend. */
  readonly pinpadIntegration = signal<'none' | 'usb' | 'sdk'>('none');

  readonly scanInput = viewChild<ElementRef<HTMLInputElement>>('scanInput');

  constructor(
    private produtosApi: ParceiroComercialProdutosService,
    private caixaApi: ParceiroCaixaService,
    public auth: ParceiroAuthService,
    private toast: ToastService,
    private router: Router,
  ) {
    afterNextRender(() => this.scheduleScanFocus());
  }

  ngOnInit(): void {
    void this.reload();
    void this.loadCaixa();
  }

  scanHintForStep(): string {
    switch (this.posStep()) {
      case 0:
        return 'A lista filtra conforme você digita. Com o leitor USB, o Enter confirma e adiciona ao carrinho.';
      case 1:
        return 'Continue escaneando para somar produtos sem voltar à lista.';
      case 2:
        return 'Última chance de incluir itens por código antes de confirmar a venda.';
      default:
        return '';
    }
  }

  pinpadStatusLabel(): string {
    return 'Pronto para uso manual';
  }

  pinpadIntegrationModeLabel(): string {
    switch (this.pinpadIntegration()) {
      case 'usb':
        return 'USB';
      case 'sdk':
        return 'SDK';
      default:
        return 'Nenhuma (manual)';
    }
  }

  onFormaPagamentoChange(): void {
    this.scheduleScanFocus();
  }

  /** Foco no campo de leitura após navegar no assistente (fluxo POS). */
  private scheduleScanFocus(): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        this.scanInput()?.nativeElement?.focus({ preventScroll: true });
      });
    });
  }

  async loadCaixa(): Promise<void> {
    try {
      const r = await firstValueFrom(this.caixaApi.getSessaoAtual());
      this.sessaoCaixa.set(r.data);
    } catch {
      this.sessaoCaixa.set(null);
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.produtosApi.listInventory());
      this.items.set(rows);
    } catch (e: any) {
      const msg = e?.error?.error || 'Não foi possível carregar o inventário.';
      this.toast.error(msg);
    } finally {
      this.loading.set(false);
      this.scheduleScanFocus();
    }
  }

  filtered(): ListaProdutoParceiroRow[] {
    const t = this.searchTerm.trim().toLowerCase();
    const all = this.items();
    if (!t) return all;
    return all.filter(
      (row) =>
        (row.nome || '').toLowerCase().includes(t) ||
        String(row.codigo_barras || '').toLowerCase().includes(t) ||
        String(row.sku || '').toLowerCase().includes(t),
    );
  }

  /** Enter no campo busca: código → adiciona ao carrinho; senão filtra na lista. */
  async onBuscaEnter(): Promise<void> {
    const term = this.searchTerm.trim();
    if (!term) return;
    try {
      const dto = await firstValueFrom(this.produtosApi.byCodigo(term));
      const id = dto.id != null ? Number(dto.id) : NaN;
      if (Number.isFinite(id) && id > 0) {
        const row = this.items().find((p) => p.id === id);
        if (row) this.addToCart(row);
        else {
          const nome = dto.name || dto.nome || `Produto #${id}`;
          const preco = Number(dto.price ?? dto.preco ?? 0) || 0;
          this.mergeCartLine({ produto_id: id, nome, preco, qty: 1 });
        }
        this.searchTerm = '';
        this.toast.success('Item adicionado ao carrinho.');
        return;
      }
    } catch {
      /* segue filtro local */
    }
  }

  irEditar(p: ListaProdutoParceiroRow): void {
    void this.router.navigate(['/parceiros/catalogo-produto'], { queryParams: { produto_id: p.id } });
  }

  async toggleVitrine(p: ListaProdutoParceiroRow, ev: Event): Promise<void> {
    ev.stopPropagation();
    if (!this.auth.isMaster()) {
      this.toast.error('Apenas o master pode alterar a vitrine.');
      return;
    }
    const next = !(Number(p.vitrine_ativo) === 1);
    try {
      await firstValueFrom(this.produtosApi.patchVitrine(p.id, next));
      this.toast.success(next ? 'Produto agora aparece na vitrine.' : 'Produto retirado da vitrine.');
      await this.reload();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível atualizar a vitrine.');
    }
  }

  private mergeCartLine(line: PosCartLine): void {
    const lines = [...this.cartLines()];
    const i = lines.findIndex((l) => l.produto_id === line.produto_id);
    if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + line.qty };
    else lines.push(line);
    this.cartLines.set(lines);
  }

  addToCart(p: ListaProdutoParceiroRow): void {
    const preco = Number(p.preco) || 0;
    this.mergeCartLine({ produto_id: p.id, nome: p.nome, preco, qty: 1 });
  }

  bumpQty(line: PosCartLine, delta: number): void {
    const lines = this.cartLines().map((l) => {
      if (l.produto_id !== line.produto_id) return l;
      const q = Math.max(1, l.qty + delta);
      return { ...l, qty: q };
    });
    this.cartLines.set(lines);
  }

  removeLine(line: PosCartLine): void {
    const next = this.cartLines().filter((l) => l.produto_id !== line.produto_id);
    this.cartLines.set(next);
    if (!next.length && this.posStep() > 0) {
      this.posStep.set(0);
      this.scheduleScanFocus();
    }
  }

  cartTotal(): number {
    return this.cartLines().reduce((s, l) => s + l.preco * l.qty, 0);
  }

  /** Quantidade total de unidades no carrinho (soma das qty). */
  cartUnitsTotal(): number {
    return this.cartLines().reduce((s, l) => s + l.qty, 0);
  }

  clearCart(): void {
    this.cartLines.set([]);
    this.posStep.set(0);
    this.scheduleScanFocus();
  }

  stepperProgressPct(): number {
    const last = this.posSteps.length - 1;
    if (last <= 0) return 100;
    return (this.posStep() / last) * 100;
  }

  canGoToStep(i: number): boolean {
    if (i < 0 || i >= this.posSteps.length) return false;
    const cur = this.posStep();
    if (i === cur) return true;
    if (i < cur) return true;
    return this.cartLines().length > 0;
  }

  /** Stepper: desabilita saltos à frente inválidos; o passo atual permanece clicável (no-op). */
  stepperBtnDisabled(i: number): boolean {
    return !this.canGoToStep(i) && this.posStep() !== i;
  }

  goToStep(i: number): void {
    if (!this.canGoToStep(i)) return;
    this.posStep.set(i);
    this.scheduleScanFocus();
  }

  nextStep(): void {
    const cur = this.posStep();
    if (cur >= this.posSteps.length - 1) return;
    if (!this.cartLines().length) return;
    this.posStep.set(cur + 1);
    this.scheduleScanFocus();
  }

  prevStep(): void {
    const cur = this.posStep();
    if (cur <= 0) return;
    this.posStep.set(cur - 1);
    this.scheduleScanFocus();
  }

  caixaAberto(): boolean {
    return this.sessaoCaixa() != null && this.sessaoCaixa()!.status === 'aberta';
  }

  async confirmarVenda(): Promise<void> {
    if (!this.caixaAberto()) {
      this.toast.error('Abra o caixa em “Caixa” antes de finalizar a venda.');
      return;
    }
    const lines = this.cartLines();
    if (!lines.length) return;
    this.checkoutBusy.set(true);
    try {
      await firstValueFrom(
        this.caixaApi.postPosVenda({
          itens: lines.map((l) => ({ produto_id: l.produto_id, quantidade: l.qty, preco_unit: l.preco })),
          forma_pagamento: this.formaPagamento,
        }),
      );
      this.toast.success('Venda registrada.');
      this.clearCart();
      await this.loadCaixa();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível concluir a venda.');
    } finally {
      this.checkoutBusy.set(false);
    }
  }
}
