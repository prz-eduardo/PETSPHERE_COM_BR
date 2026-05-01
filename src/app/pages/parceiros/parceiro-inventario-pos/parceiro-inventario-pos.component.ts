import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ParceiroComercialProdutosService, ListaProdutoParceiroRow } from '../../../services/parceiro-comercial-produtos.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';
import { BarcodeScanTargetDirective } from '../../../shared/barcode-scan-target.directive';

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
  /** Termo livre ou código lido pelo leitor (Enter pesquisa por EAN/SKU). */
  searchTerm = '';
  /** Carrinho MVP local para fluxo POS. */
  readonly cartLines = signal<Array<{ nome: string; preco: number; qty: number }>>([]);

  constructor(
    private produtosApi: ParceiroComercialProdutosService,
    public auth: ParceiroAuthService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    void this.reload();
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

  /** Enter no campo busca tenta SKU/EAN primeiro, depois filtro na lista local. */
  async onBuscaEnter(): Promise<void> {
    const term = this.searchTerm.trim();
    if (!term) return;
    try {
      const hit = await firstValueFrom(this.produtosApi.byCodigo(term));
      if (hit?.id != null) {
        void this.router.navigate(['/parceiros/catalogo-produto'], { queryParams: { produto_id: hit.id } });
        return;
      }
    } catch {
      /* sem match por código — segue filtro local */
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

  addToCart(p: ListaProdutoParceiroRow): void {
    const preco = Number(p.preco) || 0;
    const lines = [...this.cartLines()];
    const i = lines.findIndex((l) => l.nome === p.nome && l.preco === preco);
    if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + 1 };
    else lines.push({ nome: p.nome, preco, qty: 1 });
    this.cartLines.set(lines);
  }

  cartTotal(): number {
    return this.cartLines().reduce((s, l) => s + l.preco * l.qty, 0);
  }

  clearCart(): void {
    this.cartLines.set([]);
  }
}
