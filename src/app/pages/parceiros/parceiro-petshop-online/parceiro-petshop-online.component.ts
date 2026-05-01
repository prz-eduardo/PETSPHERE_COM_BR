import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-parceiro-petshop-online',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './parceiro-petshop-online.component.html',
  styleUrls: ['./parceiro-petshop-online.component.scss'],
})
export class ParceiroPetshopOnlineComponent implements OnInit {
  private readonly base = environment.apiBaseUrl;
  loading = signal(false);
  comercialProdutos = signal<any[]>([]);
  comercialCupons = signal<any[]>([]);
  comercialPromocoes = signal<any[]>([]);
  comercialCategorias = signal<any[]>([]);
  novoCupom = { codigo: '', descricao: '', tipo: 'percentual', valor: '', validade: '' };
  novaPromocao = { nome: '', descricao: '', tipo: 'percentual', valor: '', inicio: '', fim: '' };
  novaCategoria = { nome: '', slug: '' };

  constructor(
    private http: HttpClient,
    public auth: ParceiroAuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      await this.reloadComercial();
    } finally {
      this.loading.set(false);
    }
  }

  async reloadComercial(): Promise<void> {
    try {
      const [prod, cup, pro, cat] = await Promise.all([
        firstValueFrom(this.http.get<any>(`${this.base}/parceiro/comercial/produtos`, { headers: this.auth.getAuthHeaders() })),
        firstValueFrom(this.http.get<any>(`${this.base}/parceiro/comercial/cupons`, { headers: this.auth.getAuthHeaders() })),
        firstValueFrom(this.http.get<any>(`${this.base}/parceiro/comercial/promocoes`, { headers: this.auth.getAuthHeaders() })),
        firstValueFrom(this.http.get<any>(`${this.base}/parceiro/comercial/categorias`, { headers: this.auth.getAuthHeaders() })),
      ]);
      this.comercialProdutos.set(prod?.data || []);
      this.comercialCupons.set(cup?.data || []);
      this.comercialPromocoes.set(pro?.data || []);
      this.comercialCategorias.set(cat?.data || []);
    } catch (e: any) {
      const msg = e?.error?.error || 'Não foi possível carregar produtos/cupons/promoções.';
      this.toast.error(msg);
    }
  }

  async excluirProdutoComercial(id: number): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(this.http.delete(`${this.base}/parceiro/comercial/produtos/${id}`, { headers: this.auth.getAuthHeaders() }));
      this.toast.success('Produto removido.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível remover produto.');
    }
  }

  async criarCupom(): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      const valor = Number(String(this.novoCupom.valor || '').replace(',', '.'));
      await firstValueFrom(
        this.http.post(
          `${this.base}/parceiro/comercial/cupons`,
          { ...this.novoCupom, valor },
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.novoCupom = { codigo: '', descricao: '', tipo: 'percentual', valor: '', validade: '' };
      this.toast.success('Cupom cadastrado.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível cadastrar cupom.');
    }
  }

  async excluirCupom(id: number): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(this.http.delete(`${this.base}/parceiro/comercial/cupons/${id}`, { headers: this.auth.getAuthHeaders() }));
      this.toast.success('Cupom removido.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível remover cupom.');
    }
  }

  async criarPromocao(): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      const valor = Number(String(this.novaPromocao.valor || '').replace(',', '.'));
      await firstValueFrom(
        this.http.post(
          `${this.base}/parceiro/comercial/promocoes`,
          { ...this.novaPromocao, valor },
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.novaPromocao = { nome: '', descricao: '', tipo: 'percentual', valor: '', inicio: '', fim: '' };
      this.toast.success('Promoção cadastrada.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível cadastrar promoção.');
    }
  }

  async excluirPromocao(id: number): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(this.http.delete(`${this.base}/parceiro/comercial/promocoes/${id}`, { headers: this.auth.getAuthHeaders() }));
      this.toast.success('Promoção removida.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível remover promoção.');
    }
  }

  async criarCategoria(): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(
        this.http.post(
          `${this.base}/parceiro/comercial/categorias`,
          { nome: this.novaCategoria.nome, slug: this.novaCategoria.slug || null },
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.novaCategoria = { nome: '', slug: '' };
      this.toast.success('Categoria cadastrada.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível cadastrar categoria.');
    }
  }

  async excluirCategoria(id: number): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(this.http.delete(`${this.base}/parceiro/comercial/categorias/${id}`, { headers: this.auth.getAuthHeaders() }));
      this.toast.success('Categoria removida.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível remover categoria.');
    }
  }

  async toggleVitrineProduto(p: { id: number; vitrine_ativo?: number }): Promise<void> {
    if (!this.auth.isMaster()) return;
    const next = !(Number(p.vitrine_ativo) === 1);
    try {
      await firstValueFrom(
        this.http.patch(
          `${this.base}/parceiro/comercial/produtos/${p.id}/vitrine`,
          { ativo: next ? 1 : 0 },
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.toast.success(next ? 'Produto visível na vitrine.' : 'Produto apenas no estoque.');
      await this.reloadComercial();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível atualizar a vitrine.');
    }
  }
}
