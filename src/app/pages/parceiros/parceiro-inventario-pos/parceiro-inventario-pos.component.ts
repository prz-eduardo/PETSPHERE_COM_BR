import { Component, OnInit, signal } from '@angular/core';
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

  constructor(
    private produtosApi: ParceiroComercialProdutosService,
    private caixaApi: ParceiroCaixaService,
    public auth: ParceiroAuthService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    void this.reload();
    void this.loadCaixa();
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
        String(row.sku || '').toLowerCase().includes(t)
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
    this.cartLines.set(this.cartLines().filter((l) => l.produto_id !== line.produto_id));
  }

  cartTotal(): number {
    return this.cartLines().reduce((s, l) => s + l.preco * l.qty, 0);
  }

  clearCart(): void {
    this.cartLines.set([]);
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
