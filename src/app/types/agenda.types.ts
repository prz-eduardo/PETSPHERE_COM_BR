// =============================================================================
// Agenda Inteligente Modular — PetSphere
// Shared types used by all agenda components and services
// =============================================================================

export type PartnerType = 'PETSHOP' | 'CLINIC' | 'SITTER' | 'HOTEL' | 'DAYCARE';

export type ViewMode = 'DAY' | 'WEEK' | 'TIMELINE' | 'LIST';

export type AgendaStatus =
  | 'AGENDADO'
  | 'CONFIRMADO'
  | 'EM_ANDAMENTO'
  | 'ATRASADO'
  | 'FINALIZADO'
  | 'CANCELADO';

export type EscopoPermissaoDados = 'dados_basicos' | 'pets' | 'completo';

export type TipoRecurso = 'INDIVIDUAL' | 'COMPARTILHADO';

export type RoleColaborador = 'master' | 'colaborador';

export interface AgendaConfig {
  multiProfessional: boolean;
  allowOverlap: boolean;
  defaultDuration: number; // minutes
  servicesEnabled: boolean;
  viewModes: ViewMode[];
  workStart: number; // hour (8 = 08:00)
  workEnd: number;   // hour (20 = 20:00)
}

export interface Colaborador {
  id: number;
  parceiroId: number;
  nome: string;
  email: string;
  role: RoleColaborador;
  ativo: boolean;
  parceiroNome?: string;
  /** Slug da vitrine (loja_slug) vindo de GET /parceiro/auth/me */
  parceiroLojaSlug?: string | null;
  /** Slug vindo de GET /parceiro/auth/me (parceiro_tipos.slug) */
  parceiroTipoSlug?: string | null;
  created_at?: string;
  last_login_at?: string | null;
  /** Quando a API retorna em snake_case (listagem MySQL) */
  parceiro_id?: number;
  tem_vet?: number | boolean;
  vet_id?: number | null;
  vet_approved?: number | null;
  vet_crmv?: string | null;
  /** Quando a API retorna vínculo com estabelecimento (snake_case). */
  estabelecimento_id?: number | null;
}

export interface Recurso {
  id: number;
  estabelecimentoId: number;
  nome: string;
  tipo: TipoRecurso;
  ownerColaboradorId?: number | null;
  ativo: boolean;
  criado_em: string;
  updated_at: string;
}

export interface PermissaoRecurso {
  id: number;
  recursoId: number;
  colaboradorId: number;
  podeVisualizar: boolean;
  podeCriar: boolean;
  podeEditar: boolean;
  podeCancelar: boolean;
}

export interface Profissional {
  id: string;
  nome: string;
  avatarUrl?: string;
  especialidade?: string;
  ativo: boolean;
}

export interface Servico {
  id: string;
  nome: string;
  duracaoMin: number;
  preco?: number;
  cor?: string; // hex
}

/** Linha da tabela `servicos` (API /parceiro/servicos). */
export interface ParceiroServico {
  id: number;
  parceiro_id: number;
  nome: string;
  duracao_minutos: number;
  preco: number;
  ativo: number | boolean;
  created_at?: string;
}

export interface PetResumido {
  id: string;
  nome: string;
  especie: 'Cão' | 'Gato' | 'Outro';
  raca?: string;
  photoUrl?: string;
  alergias: string[];
  observacoes?: string;
  temMedicacao: boolean;
  temRestricao: boolean;
  temAlimentacaoEspecial: boolean;
  historicoRecente: HistoricoItem[];
  tutor: TutorResumido;
}

export interface TutorResumido {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
}

export interface HistoricoItem {
  data: Date;
  servico: string;
  profissional: string;
  obs?: string;
}

export interface Agendamento {
  id: number | string; // Support both for backward compatibility
  agenda_id?: number;
  cliente_id?: number | null;
  pet_id?: number | null;
  servico_id?: number | null;
  data_hora_inicio?: string;
  data_hora_fim?: string;
  cliente_nome_snapshot?: string | null;
  cliente_telefone_snapshot?: string | null;
  pet_nome_snapshot?: string | null;
  estabelecimentoId?: number;
  parceiroId?: string; // Legacy
  recursoId?: number;
  criadoPor?: number;
  criado_por?: number; // Backend naming
  clienteNome?: string;
  cliente_nome?: string | null; // Backend naming
  clienteTelefone?: string | null;
  cliente_telefone?: string | null; // Backend naming
  petNome?: string | null;
  pet_nome?: string | null; // Backend naming
  inicio: Date | string;
  fim: Date | string;
  status: AgendaStatus;
  escopoPermissao?: EscopoPermissaoDados | null;
  observacoes?: string | null;
  criado_em?: string;
  updated_at?: string;
  // Campos enriquecidos no front a partir da API (pet / profissional / serviço)
  pet?: PetResumido;
  profissional?: Profissional;
  servico?: Servico;
  recorrente?: boolean;
  recorrenciaInfo?: string;
  checkIn?: Date;
  checkOut?: Date;
  diaria?: boolean;
}

export interface AgendaFiltros {
  profissionalId?: string;
  servicoId?: string;
  status?: AgendaStatus[];
  especie?: string;
  search?: string;
  recursoId?: number;
  dataInicio?: string;
  dataFim?: string;
}

export interface SlotInfo {
  hora: Date;
  profissionalId?: string;
}

/** Payload da sidebar ao concluir o assistente de agendamento (API + UX). */
export interface AgendaSavePayload {
  agendamento: Agendamento;
  /** Incluído quando a API deve notificar o tutor por e-mail (cadastrado vs convidado por e-mail). */
  tutorNotificacao?: {
    enviar: boolean;
    modo?: 'cadastrado' | 'guest';
    emailGuest?: string;
  };
}

export interface Parceiro {
  id: string;
  nome: string;
  tipo: PartnerType;
  logoUrl?: string;
}

export interface SessionColaborador {
  colaborador: Colaborador;
  token: string;
  expiresAt: number;
}

export interface ColaboradorInvite {
  id: number;
  parceiro_id: number;
  email: string;
  nome?: string | null;
  role: RoleColaborador;
  com_vet?: number | boolean;
  status: 'pendente' | 'aceito' | 'cancelado' | 'expirado';
  token_uuid: string;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  accepted_at?: string | null;
}
