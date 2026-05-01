import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ParceiroAuthService } from './parceiro-auth.service';

export type FormaPagamentoPos = 'dinheiro' | 'pix' | 'cartao' | 'outro';

export interface ParceiroCaixaSessao {
  id: number;
  parceiro_id: number;
  colaborador_abertura_id: number;
  colaborador_fechamento_id?: number | null;
  aberto_em: string;
  fechado_em?: string | null;
  valor_abertura: number;
  valor_contado_fechamento?: number | null;
  diferenca_fechamento?: number | null;
  status: 'aberta' | 'fechada' | 'cancelada';
  obs_abertura?: string | null;
  obs_fechamento?: string | null;
}

export interface ParceiroCaixaResumo {
  soma_total: number;
  total_vendas: number;
  total_sangrias: number;
  total_suprimentos: number;
  total_ajustes: number;
  vendas_por_forma: Array<{ forma_pagamento: FormaPagamentoPos | null; total: number }>;
  esperado_caixa: number;
}

export interface ParceiroCaixaMovimento {
  id: number;
  sessao_id: number;
  parceiro_id: number;
  tipo: 'venda' | 'sangria' | 'suprimento' | 'ajuste';
  valor: number;
  forma_pagamento?: FormaPagamentoPos | null;
  pedido_id?: number | null;
  descricao?: string | null;
  colaborador_id: number;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class ParceiroCaixaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(ParceiroAuthService);
  private readonly base = `${environment.apiBaseUrl}/parceiro`;

  getSessaoAtual(): Observable<{ data: ParceiroCaixaSessao | null; resumo: ParceiroCaixaResumo | null }> {
    return this.http
      .get<{ data: ParceiroCaixaSessao | null; resumo: ParceiroCaixaResumo | null }>(`${this.base}/caixa/sessoes/atual`, {
        headers: this.auth.getAuthHeaders(),
      })
      .pipe(map((r) => ({ data: r.data ?? null, resumo: r.resumo ?? null })));
  }

  abrirSessao(body: { valor_abertura: number; obs_abertura?: string | null }): Observable<ParceiroCaixaSessao> {
    return this.http
      .post<{ data: ParceiroCaixaSessao }>(`${this.base}/caixa/sessoes/abrir`, body, { headers: this.auth.getAuthHeaders() })
      .pipe(map((r) => r.data));
  }

  fecharSessao(body: { valor_contado?: number | null; obs_fechamento?: string | null }): Observable<{
    data: ParceiroCaixaSessao;
    conciliacao: { esperado: number; contado: number | null; diferenca: number | null; totais_movimentos: Record<string, unknown> };
  }> {
    return this.http.post<{
      data: ParceiroCaixaSessao;
      conciliacao: { esperado: number; contado: number | null; diferenca: number | null; totais_movimentos: Record<string, unknown> };
    }>(`${this.base}/caixa/sessoes/fechar`, body, { headers: this.auth.getAuthHeaders() });
  }

  listSessoes(page = 1, pageSize = 20): Observable<{
    data: ParceiroCaixaSessao[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    return this.http.get<{
      data: ParceiroCaixaSessao[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }>(`${this.base}/caixa/sessoes`, { headers: this.auth.getAuthHeaders(), params });
  }

  listMovimentos(sessaoId: number): Observable<ParceiroCaixaMovimento[]> {
    return this.http
      .get<{ data: ParceiroCaixaMovimento[] }>(`${this.base}/caixa/sessoes/${sessaoId}/movimentos`, {
        headers: this.auth.getAuthHeaders(),
      })
      .pipe(map((r) => r.data || []));
  }

  postMovimento(body: { tipo: 'sangria' | 'suprimento' | 'ajuste'; valor: number; descricao?: string | null }): Observable<ParceiroCaixaMovimento> {
    return this.http
      .post<{ data: ParceiroCaixaMovimento }>(`${this.base}/caixa/movimentos`, body, { headers: this.auth.getAuthHeaders() })
      .pipe(map((r) => r.data));
  }

  postPosVenda(body: {
    itens: Array<{ produto_id: number; quantidade: number; preco_unit?: number | null }>;
    forma_pagamento: FormaPagamentoPos;
    cliente_id?: number | null;
    obs?: string | null;
  }): Observable<{ pedido_id: number; total_liquido: number; pagamento_forma: string }> {
    return this.http
      .post<{ data: { pedido_id: number; total_liquido: number; pagamento_forma: string } }>(`${this.base}/pos/vendas`, body, {
        headers: this.auth.getAuthHeaders(),
      })
      .pipe(map((r) => r.data));
  }
}
