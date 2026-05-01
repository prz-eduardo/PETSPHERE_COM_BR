import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-parceiro-minha-loja',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './parceiro-minha-loja.component.html',
  styleUrls: ['./parceiro-minha-loja.component.scss'],
})
export class ParceiroMinhaLojaComponent implements OnInit {
  private readonly base = environment.apiBaseUrl;
  loading = signal(false);
  saving = signal(false);
  vitrine = signal<any | null>(null);
  readonly ofertaCatalog = signal<Array<{ slug: string; label_pt: string; scope: string }>>([]);
  readonly hotelGlobaisSelecionados = signal<string[]>([]);
  readonly catalogParceiroEntries = computed(() =>
    this.ofertaCatalog().filter((e) => e.scope === 'parceiro' || e.scope === 'both')
  );
  comercialProdutos = signal<any[]>([]);
  comercialCupons = signal<any[]>([]);
  comercialPromocoes = signal<any[]>([]);
  comercialCategorias = signal<any[]>([]);
  novoProduto = { nome: '', descricao: '', preco: '', categoria_id: '' };
  novoCupom = { codigo: '', descricao: '', tipo: 'percentual', valor: '', validade: '' };
  novaPromocao = { nome: '', descricao: '', tipo: 'percentual', valor: '', inicio: '', fim: '' };
  novaCategoria = { nome: '', slug: '' };

  readonly form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public auth: ParceiroAuthService,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      loja_slug: [''],
      texto_institucional: [''],
      mercadopago_access_token: [''],
    });
  }

  ngOnInit(): void {
    void Promise.all([this.loadHotelOfertaCatalog(), this.reload()]);
  }

  private async loadHotelOfertaCatalog(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ catalog: Array<{ slug: string; label_pt: string; scope: string }> }>(
          `${this.base}/parceiro/hospedagem/catalogo-ofertas`,
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.ofertaCatalog.set(Array.isArray(res?.catalog) ? res.catalog : []);
    } catch {
      this.ofertaCatalog.set([]);
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const loja = await firstValueFrom(this.http.get<any>(`${this.base}/parceiro/vitrine/loja`, { headers: this.auth.getAuthHeaders() }));
      this.vitrine.set(loja);
      const hg = loja?.hotel_servicos_globais;
      this.hotelGlobaisSelecionados.set(Array.isArray(hg) ? hg.map(String) : []);
      this.form.patchValue({
        loja_slug: loja?.loja_slug || '',
        texto_institucional: loja?.texto_institucional || '',
        mercadopago_access_token: '',
      });
      await this.reloadComercial();
    } catch {
      this.toast.error('Não foi possível carregar os dados da vitrine.');
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

  async salvarLoja(): Promise<void> {
    if (!this.auth.isMaster()) {
      this.toast.error('Apenas o usuário master pode alterar a vitrine.');
      return;
    }
    this.saving.set(true);
    try {
      const body: any = {
        loja_slug: (this.form.value.loja_slug || '').trim() || null,
        texto_institucional: this.form.value.texto_institucional ?? null,
        hotel_servicos_globais: [...this.hotelGlobaisSelecionados()],
      };
      const mpCtrl = this.form.get('mercadopago_access_token');
      if (mpCtrl?.dirty) {
        body.mercadopago_access_token = (this.form.value.mercadopago_access_token || '').trim();
      }
      const res = await firstValueFrom(
        this.http.patch<any>(`${this.base}/parceiro/vitrine/loja`, body, { headers: this.auth.getAuthHeaders() })
      );
      this.toast.success('Loja atualizada.');
      this.vitrine.set({ ...this.vitrine(), ...res });
      if (Array.isArray(res?.hotel_servicos_globais)) {
        this.hotelGlobaisSelecionados.set(res.hotel_servicos_globais.map(String));
      }
      this.form.patchValue({ mercadopago_access_token: '' });
    } catch (e: any) {
      const msg = e?.error?.error || 'Erro ao salvar.';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async criarProdutoComercial(): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      const preco = Number(String(this.novoProduto.preco || '').replace(',', '.'));
      await firstValueFrom(
        this.http.post(
          `${this.base}/parceiro/comercial/produtos`,
          {
            nome: this.novoProduto.nome,
            descricao: this.novoProduto.descricao,
            preco,
            categoria_id: this.novoProduto.categoria_id ? Number(this.novoProduto.categoria_id) : null,
          },
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.novoProduto = { nome: '', descricao: '', preco: '', categoria_id: '' };
      this.toast.success('Produto cadastrado com sucesso.');
      await this.reloadComercial();
      await this.reload();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível cadastrar produto.');
    }
  }

  async excluirProdutoComercial(id: number): Promise<void> {
    if (!this.auth.isMaster()) return;
    try {
      await firstValueFrom(this.http.delete(`${this.base}/parceiro/comercial/produtos/${id}`, { headers: this.auth.getAuthHeaders() }));
      this.toast.success('Produto removido.');
      await this.reloadComercial();
      await this.reload();
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

  toggleHotelGlobal(slug: string): void {
    const cur = [...this.hotelGlobaisSelecionados()];
    const i = cur.indexOf(slug);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(slug);
    this.hotelGlobaisSelecionados.set(cur);
  }

  hotelGlobalSelected(slug: string): boolean {
    return this.hotelGlobaisSelecionados().includes(slug);
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
      await this.reload();
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Não foi possível atualizar a vitrine.');
    }
  }
}
