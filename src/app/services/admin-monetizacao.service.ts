import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';

export interface PlanoSaaS {
  id: number;
  nome: string;
  slug: string;
  descricao?: string | null;
  preco_mensal: number;
  creditos_mensais_inclusos: number;
  permite_automacoes: boolean;
  max_colaboradores?: number | null;
  max_recursos?: number | null;
  max_agendamentos_mes?: number | null;
  features?: Record<string, any> | null;
  ativo: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export type CreditTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'PREMIUM';
export type CreditFallback = 'block' | 'warn' | 'fallback_internal' | 'fallback_template';

export interface CreditEvento {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  tier: CreditTier;
  fallback_strategy: CreditFallback;
  custo_creditos: number;
  requer_automacao: number | boolean;
  ativo: number | boolean;
  descricao?: string | null;
}

export interface CreditEventoMeta {
  tiers: CreditTier[];
  fallbacks: CreditFallback[];
}

export interface CreditPacote {
  id: number;
  nome: string;
  slug: string;
  preco_reais: number;
  creditos_incluidos: number;
  bonus_creditos: number;
  descricao?: string | null;
  destaque: number | boolean;
  ordem: number;
  ativo: number | boolean;
}

export interface CreditBalanceRow {
  parceiro_id: number;
  nome: string;
  email?: string | null;
  saldo: number;
  updated_at?: string | null;
}

export interface CreditMovimento {
  id: number;
  parceiro_id: number;
  delta: number;
  saldo_apos: number;
  tipo: string;
  evento_codigo?: string | null;
  descricao?: string | null;
  ref_tipo?: string | null;
  ref_id?: string | null;
  admin_user_id?: number | null;
  metadata?: any;
  created_at: string;
}

/** Agregados para o widget de créditos no painel admin */
export interface CreditosResumo {
  total_parceiros: number;
  saldo_total: number;
  parceiros_com_saldo_positivo: number;
  movimentos_ultimas_24h: number;
}

@Injectable({ providedIn: 'root' })
export class AdminMonetizacaoService {
  private http = inject(HttpClient);
  private session = inject(SessionService);
  private base = (environment as any).apiBaseUrl.replace(/\/$/, '');

  private get headers() {
    const token = this.session.getBackendToken();
    return token
      ? { Authorization: `Bearer ${token}` }
      : ({} as Record<string, string>);
  }

  // ---------- Planos ----------
  listPlanos(): Observable<{ data: PlanoSaaS[] }> {
    return this.http.get<{ data: PlanoSaaS[] }>(`${this.base}/admin/planos`, { headers: this.headers });
  }
  getPlano(id: number): Observable<PlanoSaaS> {
    return this.http.get<PlanoSaaS>(`${this.base}/admin/planos/${id}`, { headers: this.headers });
  }
  createPlano(body: Partial<PlanoSaaS>): Observable<PlanoSaaS> {
    return this.http.post<PlanoSaaS>(`${this.base}/admin/planos`, body, { headers: this.headers });
  }
  updatePlano(id: number, body: Partial<PlanoSaaS>): Observable<PlanoSaaS> {
    return this.http.put<PlanoSaaS>(`${this.base}/admin/planos/${id}`, body, { headers: this.headers });
  }
  removePlano(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/admin/planos/${id}`, { headers: this.headers });
  }

  // ---------- Eventos ----------
  listEventos(): Observable<{ data: CreditEvento[]; meta?: CreditEventoMeta }> {
    return this.http.get<{ data: CreditEvento[]; meta?: CreditEventoMeta }>(`${this.base}/admin/creditos/eventos`, { headers: this.headers });
  }
  createEvento(body: Partial<CreditEvento>): Observable<CreditEvento> {
    return this.http.post<CreditEvento>(`${this.base}/admin/creditos/eventos`, body, { headers: this.headers });
  }
  updateEvento(id: number, body: Partial<CreditEvento>): Observable<CreditEvento> {
    return this.http.put<CreditEvento>(`${this.base}/admin/creditos/eventos/${id}`, body, { headers: this.headers });
  }
  removeEvento(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/admin/creditos/eventos/${id}`, { headers: this.headers });
  }

  // ---------- Pacotes ----------
  listPacotes(): Observable<{ data: CreditPacote[] }> {
    return this.http.get<{ data: CreditPacote[] }>(`${this.base}/admin/creditos/pacotes`, { headers: this.headers });
  }
  createPacote(body: Partial<CreditPacote>): Observable<CreditPacote> {
    return this.http.post<CreditPacote>(`${this.base}/admin/creditos/pacotes`, body, { headers: this.headers });
  }
  updatePacote(id: number, body: Partial<CreditPacote>): Observable<CreditPacote> {
    return this.http.put<CreditPacote>(`${this.base}/admin/creditos/pacotes/${id}`, body, { headers: this.headers });
  }
  removePacote(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/admin/creditos/pacotes/${id}`, { headers: this.headers });
  }

  /** Resumo agregado (soma de saldos na rede, totais) — widget header admin */
  getCreditosResumo(): Observable<CreditosResumo> {
    return this.http.get<CreditosResumo>(`${this.base}/admin/creditos/resumo`, { headers: this.headers });
  }

  // ---------- Saldos & extrato ----------
  listBalances(opts: { page?: number; pageSize?: number; q?: string } = {}): Observable<{ data: CreditBalanceRow[]; page: number; pageSize: number; total: number }> {
    let params = new HttpParams();
    if (opts.page) params = params.set('page', String(opts.page));
    if (opts.pageSize) params = params.set('pageSize', String(opts.pageSize));
    if (opts.q) params = params.set('q', opts.q);
    return this.http.get<{ data: CreditBalanceRow[]; page: number; pageSize: number; total: number }>(
      `${this.base}/admin/creditos/saldos`,
      { headers: this.headers, params }
    );
  }
  getSaldo(parceiroId: number): Observable<{ parceiro_id: number; saldo: number; updated_at: string | null }> {
    return this.http.get<any>(`${this.base}/admin/creditos/parceiros/${parceiroId}/saldo`, { headers: this.headers });
  }
  getExtrato(parceiroId: number, opts: { limit?: number; offset?: number; tipo?: string } = {}): Observable<{ items: CreditMovimento[]; total: number; limit: number; offset: number }> {
    let params = new HttpParams();
    if (opts.limit) params = params.set('limit', String(opts.limit));
    if (opts.offset) params = params.set('offset', String(opts.offset));
    if (opts.tipo) params = params.set('tipo', opts.tipo);
    return this.http.get<any>(`${this.base}/admin/creditos/parceiros/${parceiroId}/extrato`, { headers: this.headers, params });
  }
  ajusteManual(parceiroId: number, delta: number, motivo: string): Observable<any> {
    return this.http.post(`${this.base}/admin/creditos/parceiros/${parceiroId}/ajuste`, { delta, motivo }, { headers: this.headers });
  }
  concederPacote(parceiroId: number, pacoteId: number, motivo?: string): Observable<any> {
    return this.http.post(
      `${this.base}/admin/creditos/parceiros/${parceiroId}/conceder-pacote`,
      { pacote_id: pacoteId, motivo: motivo || null },
      { headers: this.headers }
    );
  }
}
