export type TelemedicinaTab = 'prontidao' | 'fila' | 'config' | 'dashboard' | 'agenda';

export type EmergencyRequestStatus = 'PENDENTE' | 'ACEITA' | 'RECUSADA' | 'EXPIRADA';

export interface EmergencyTutor {
  nome: string;
  petNome: string;
  petEspecie: string;
  petRaca: string;
}

export interface EmergencyRequest {
  id: string;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  sintomas: string;
  tutor: EmergencyTutor;
  distanciaKm: number;
  aguardandoMin: number;
  faixaHorario: string;
  status: EmergencyRequestStatus;
}

export interface TelemedicinaConfig {
  disponibilidade24h: boolean;
  aceitaNoturno: boolean;
  aceitaFimSemana: boolean;
  tempoRespostaMaxMin: number;
  raioAtendimentoKm: number;
  mensagemAutomatica: string;
}

export interface TelemedicinaPricing {
  consultaBase: number;
  adicionalNoturnoPct: number;
  adicionalFimSemanaPct: number;
  adicionalFeriadoPct: number;
  retorno72hGratis: boolean;
}

export interface DashboardHourLoad {
  faixa: string;
  volume: number;
}

export interface TelemedicinaDashboardSeed {
  atendimentosHoje: number;
  taxaAceitePct: number;
  tempoMedioAceiteMin: number;
  receitaEstimadaHoje: number;
  horas: DashboardHourLoad[];
}
