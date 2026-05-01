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

/** Defaults injetados ao criar um novo registro (API parceiro + preferências). */
export interface PanoramaDefaults {
  origemEnderecoTexto?: string;
  origemLat?: number;
  origemLng?: number;
  destinoLat?: number;
  destinoLng?: number;
  valorPorKm?: number;
  valorConsulta?: number;
  taxaAdicional?: number;
  descontoPercent?: number;
  formaPagamento?: string | null;
}

export interface PanoramaAtendimento {
  id: string;
  /** Quando o cartão veio do fluxo clínico (evita duplicar ao reabrir ?atendimentoId=). */
  linkedAtendimentoId?: number | null;
  criadoEm: string;
  atualizadoEm: string;
  tutorNome: string;
  petNome: string;
  tutorTelefone?: string;
  /** Quando preenchido a partir de «Meus clientes» / permissões LGPD. */
  clienteIdPermitido?: number | null;
  petId?: number | null;
  /** Texto livre para geocodificar a origem (ex.: clínica) via OpenStreetMap. */
  origemEnderecoTexto?: string;
  /** Texto livre para geocodificar o destino (domicílio). */
  destinoEnderecoTexto?: string;
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
