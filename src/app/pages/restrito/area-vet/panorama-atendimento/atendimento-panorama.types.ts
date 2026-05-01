/** Status operacional do atendimento (visão geral). */
export type PanoramaAtendimentoStatus =
  | 'rascunho'
  | 'agendado'
  | 'deslocamento'
  | 'em_atendimento'
  | 'concluido'
  | 'cancelado';

/** Exames — alinhado ao fluxo tutor → vet (quando houver API, estes campos mapeiam fácil). */
export type PanoramaExameStatus =
  | 'solicitado'
  | 'enviado_tutor'
  | 'recebido_lab'
  | 'em_analise'
  | 'resultado_ok'
  | 'cancelado';

export interface PanoramaExame {
  id: string;
  nome: string;
  status: PanoramaExameStatus;
  observacao?: string;
  /** ISO ou texto livre (ex.: data que o tutor enviou). */
  dataReferencia?: string;
}

export interface PanoramaExtraLinha {
  id: string;
  descricao: string;
  valor: number;
}

export interface PanoramaAtendimento {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  tutorNome: string;
  petNome: string;
  tutorTelefone?: string;
  status: PanoramaAtendimentoStatus;
  /** Origem do deslocamento (ex.: clínica) */
  origemLat: number;
  origemLng: number;
  /** Destino (domicílio do tutor) */
  destinoLat: number;
  destinoLng: number;
  /** Km pela rota (OSRM) ou último cálculo bem-sucedido */
  kmRota?: number;
  /** Linha reta (Haversine) */
  kmLinhaReta?: number;
  /** Se o vet ajustar manualmente os km usados na cobrança */
  kmManual?: number | null;
  valorPorKm: number;
  valorConsulta: number;
  /** Taxa fixa (urgência, plantão, feriado…) */
  taxaAdicional: number;
  extras: PanoramaExtraLinha[];
  descontoPercent: number;
  formaPagamento?: string;
  notas?: string;
  exames: PanoramaExame[];
}
