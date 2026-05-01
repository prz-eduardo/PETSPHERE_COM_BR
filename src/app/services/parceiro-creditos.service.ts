import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParceiroSaldoCreditos {
  parceiro_id: number;
  saldo: number;
  updated_at: string | null;
}

export interface ParceiroCreditoMovimentoExtrato {
  id: number;
  parceiro_id: number;
  delta: number;
  saldo_apos: number;
  tipo: string;
  source: string;
  evento_codigo: string | null;
  descricao: string | null;
  ref_tipo: string | null;
  ref_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ParceiroCreditoExtratoResponse {
  items: ParceiroCreditoMovimentoExtrato[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable({ providedIn: 'root' })
export class ParceiroCreditosService {
  private http = inject(HttpClient);
  private base = (environment as any).apiBaseUrl.replace(/\/$/, '');

  /** GET /parceiro/creditos/saldo — requer header Authorization do colaborador */
  getSaldo(authHeaders: { Authorization: string }): Observable<ParceiroSaldoCreditos> {
    return this.http.get<ParceiroSaldoCreditos>(`${this.base}/parceiro/creditos/saldo`, { headers: authHeaders });
  }

  /** GET /parceiro/creditos/extrato — movimentações do ledger (parceiro do token) */
  getExtrato(
    authHeaders: { Authorization: string },
    params?: { limit?: number; offset?: number; tipo?: string; evento_codigo?: string; source?: string }
  ): Observable<ParceiroCreditoExtratoResponse> {
    let httpParams = new HttpParams();
    if (params?.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.offset != null) httpParams = httpParams.set('offset', String(params.offset));
    if (params?.tipo) httpParams = httpParams.set('tipo', params.tipo);
    if (params?.evento_codigo) httpParams = httpParams.set('evento_codigo', params.evento_codigo);
    if (params?.source) httpParams = httpParams.set('source', params.source);
    return this.http.get<ParceiroCreditoExtratoResponse>(`${this.base}/parceiro/creditos/extrato`, {
      headers: authHeaders,
      params: httpParams,
    });
  }
}
