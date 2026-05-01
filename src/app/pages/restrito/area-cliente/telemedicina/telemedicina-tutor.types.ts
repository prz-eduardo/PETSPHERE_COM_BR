/** Estados da experiência do tutor (telemedicina mock). */
export type TutorTelemedicinaFlowState =
  | 'idle'
  | 'joining'
  | 'waiting_global'
  | 'waiting_directed'
  | 'called'
  | 'in_consult'
  | 'finished'
  | 'scheduled_future';

export type TutorPlanoMock = 'basico' | 'premium';

export type TutorTelemedicinaTab = 'emergencia' | 'escolher' | 'fila' | 'agendar';

export interface MockVetCard {
  id: string;
  nome: string;
  especialidade: string;
  tempoRespostaMedioMin: number;
  online: boolean;
  avaliacao: number | null;
  /** Preço base consulta agendada (não emergência). */
  precoAgendamento: number;
  crmv?: string | null;
  /** 'mock' | 'api' | 'parceiro_accounts' */
  source?: string;
}

export interface TutorPerfilMock {
  nome: string;
  petNome: string;
  petEspecie: string;
  petRaca: string;
}

export interface TutorQueueMeta {
  requestId: string;
  queueKind: 'global' | 'directed';
  directedVetId: string | null;
  /** Posição 1-based na fila visível ao tutor. */
  position: number;
  etaMinutes: number;
  waitMinutes: number;
  /** Preço fixo emergência (global); direcionada usa preço da plataforma até aceite. */
  precoEmergenciaFixo: number;
}

export interface MockAgendamentoConfirmado {
  id: string;
  dataLabel: string;
  horario: string;
  vetNome: string;
  vetId: string | null;
  preco: number;
  automatico: boolean;
  petNome?: string;
  motivo?: string | null;
  /** Quando registrado no backend (migration aplicada). */
  apiIntencaoId?: number | null;
}

export interface AgendaDiaMock {
  dateKey: string;
  label: string;
  slots: Array<{ horario: string; preco: number; vetId: string | null; vetNome: string }>;
}
