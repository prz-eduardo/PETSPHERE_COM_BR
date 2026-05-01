import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParceiroSubscricaoDto {
  id: number;
  parceiro_id: number;
  plano_id: number;
  status: 'ativo' | 'cancelado' | 'expirado';
  data_inicio: string;
  data_fim: string | null;
  origem: string;
  observacoes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ParceiroPlanoResumoDto {
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
  features?: Record<string, unknown> | null;
  plano_ativo?: boolean;
}

export interface ParceiroAssinaturaAtual {
  subscricao: ParceiroSubscricaoDto;
  plano: ParceiroPlanoResumoDto;
}

export interface ParceiroHistoricoItem {
  subscricao: ParceiroSubscricaoDto;
  plano: { nome: string; slug: string };
}

export interface ParceiroMinhaAssinaturaResponse {
  atual: ParceiroAssinaturaAtual | null;
  historico: ParceiroHistoricoItem[];
}

@Injectable({ providedIn: 'root' })
export class ParceiroMonetizacaoService {
  private http = inject(HttpClient);
  private base = (environment as any).apiBaseUrl.replace(/\/$/, '');

  /** GET /parceiro/monetizacao/assinatura */
  getMinhaAssinatura(authHeaders: { Authorization: string }): Observable<ParceiroMinhaAssinaturaResponse> {
    return this.http.get<ParceiroMinhaAssinaturaResponse>(`${this.base}/parceiro/monetizacao/assinatura`, {
      headers: authHeaders,
    });
  }
}
