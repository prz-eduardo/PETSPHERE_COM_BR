import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ParceiroAuthService } from './parceiro-auth.service';
import { AdminApiService, ProdutoDto } from './admin-api.service';

export interface ListaProdutoParceiroRow {
  id: number;
  nome: string;
  descricao?: string | null;
  preco: number;
  ativo: number;
  created_at?: string;
  vitrine_ativo?: number;
  imagem_thumb?: string | null;
  codigo_barras?: string | null;
  sku?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ParceiroComercialProdutosService {
  private readonly base = `${environment.apiBaseUrl}/parceiro/comercial/produtos`;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(ParceiroAuthService);
  private readonly adminNorm = inject(AdminApiService);

  listInventory(): Observable<ListaProdutoParceiroRow[]> {
    return this.http
      .get<{ data: ListaProdutoParceiroRow[] }>(this.base, { headers: this.auth.getAuthHeaders() })
      .pipe(map((r) => r.data || []));
  }

  listCategoriasParceiro(): Observable<Array<{ id: number; nome: string }>> {
    return this.http
      .get<{ data: Array<{ id: number; nome: string }> }>(
        `${environment.apiBaseUrl}/parceiro/comercial/categorias`,
        { headers: this.auth.getAuthHeaders() }
      )
      .pipe(map((r) => r.data || []));
  }

  getCatalogoSuporteProduto(): Observable<{
    tags: Array<{ id: number; nome: string }>;
    dosagens: Array<{ id: number; nome: string }>;
    embalagens: Array<{ id: number; nome: string }>;
  }> {
    return this.http
      .get<{
        tags: Array<{ id: number; nome: string }>;
        dosagens: Array<{ id: number; nome: string }>;
        embalagens: Array<{ id: number; nome: string }>;
      }>(`${environment.apiBaseUrl}/parceiro/comercial/catalogo-suporte-produto`, {
        headers: this.auth.getAuthHeaders(),
      });
  }

  /** Categorias do parceiro + tags/dosagens/embalagens para o wizard. */
  taxonomiasWizardParceiro() {
    return forkJoin({
      categorias: this.listCategoriasParceiro(),
      support: this.getCatalogoSuporteProduto(),
    });
  }

  /** GET full com vitrine flags do backend */
  getFull(id: string | number): Observable<ProdutoDto & { vitrine_ativo?: number; mostrar_na_loja?: boolean }> {
    return this.http.get<any>(`${this.base}/${encodeURIComponent(String(id))}/full`, { headers: this.auth.getAuthHeaders() }).pipe(
      map((raw) => ({
        ...this.adminNorm.normalizeMarketplaceProdutoPayload(raw),
        vitrine_ativo: raw.vitrine_ativo,
        mostrar_na_loja: raw.mostrar_na_loja,
      }))
    );
  }

  createFull(body: Record<string, unknown>): Observable<any> {
    return this.http.post<any>(`${this.base}/full`, body, {
      headers: this.auth.getAuthHeaders(),
    });
  }

  updateFull(id: string | number, body: Record<string, unknown>): Observable<any> {
    return this.http.put<any>(`${this.base}/${encodeURIComponent(String(id))}/full`, body, {
      headers: this.auth.getAuthHeaders(),
    });
  }

  patchVitrine(id: number, ativo: boolean): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(
      `${this.base}/${id}/vitrine`,
      { ativo },
      { headers: this.auth.getAuthHeaders() }
    );
  }

  byCodigo(q: string): Observable<ProdutoDto> {
    return this.http
      .get<any>(`${this.base}/by-codigo`, {
        headers: this.auth.getAuthHeaders(),
        params: { q: q.trim() },
      })
      .pipe(map((raw) => this.adminNorm.normalizeMarketplaceProdutoPayload(raw)));
  }
}
