import {
  EmergencyRequest,
  TelemedicinaConfig,
  TelemedicinaDashboardSeed,
  TelemedicinaPricing,
} from './telemedicina-emergencial.types';

export const TELEMEDICINA_MOCK_REQUESTS: EmergencyRequest[] = [
  {
    id: 'EMG-4821',
    prioridade: 'ALTA',
    sintomas: 'Convulsao breve, salivacao intensa e desorientacao.',
    tutor: {
      nome: 'Marina Oliveira',
      petNome: 'Tobias',
      petEspecie: 'Canino',
      petRaca: 'Border Collie',
    },
    distanciaKm: 2.3,
    aguardandoMin: 3,
    faixaHorario: 'Noite',
    status: 'PENDENTE',
  },
  {
    id: 'EMG-4817',
    prioridade: 'MEDIA',
    sintomas: 'Vomito frequente e apatia desde o inicio da tarde.',
    tutor: {
      nome: 'Rafael Souza',
      petNome: 'Nina',
      petEspecie: 'Felino',
      petRaca: 'SRD',
    },
    distanciaKm: 6.9,
    aguardandoMin: 11,
    faixaHorario: 'Tarde',
    status: 'PENDENTE',
  },
  {
    id: 'EMG-4804',
    prioridade: 'BAIXA',
    sintomas: 'Coceira intensa e pele avermelhada apos banho.',
    tutor: {
      nome: 'Ana Luiza Prado',
      petNome: 'Bento',
      petEspecie: 'Canino',
      petRaca: 'Shih Tzu',
    },
    distanciaKm: 1.2,
    aguardandoMin: 19,
    faixaHorario: 'Manha',
    status: 'ACEITA',
  },
  {
    id: 'EMG-4792',
    prioridade: 'MEDIA',
    sintomas: 'Dificuldade para urinar e vocalizacao frequente.',
    tutor: {
      nome: 'Beatriz Martins',
      petNome: 'Thor',
      petEspecie: 'Canino',
      petRaca: 'Labrador',
    },
    distanciaKm: 9.1,
    aguardandoMin: 26,
    faixaHorario: 'Noite',
    status: 'RECUSADA',
  },
];

export const TELEMEDICINA_MOCK_CONFIG: TelemedicinaConfig = {
  disponibilidade24h: false,
  aceitaNoturno: true,
  aceitaFimSemana: true,
  tempoRespostaMaxMin: 8,
  raioAtendimentoKm: 12,
  mensagemAutomatica:
    'Oi! Recebi seu pedido de emergencia. Vou analisar e retornar em ate 8 minutos.',
};

export const TELEMEDICINA_MOCK_PRICING: TelemedicinaPricing = {
  consultaBase: 129,
  adicionalNoturnoPct: 35,
  adicionalFimSemanaPct: 20,
  adicionalFeriadoPct: 45,
  retorno72hGratis: true,
};

export const TELEMEDICINA_MOCK_DASHBOARD: TelemedicinaDashboardSeed = {
  atendimentosHoje: 17,
  taxaAceitePct: 82,
  tempoMedioAceiteMin: 4.7,
  receitaEstimadaHoje: 2540,
  horas: [
    { faixa: '00-03', volume: 2 },
    { faixa: '03-06', volume: 1 },
    { faixa: '06-09', volume: 3 },
    { faixa: '09-12', volume: 5 },
    { faixa: '12-15', volume: 4 },
    { faixa: '15-18', volume: 6 },
    { faixa: '18-21', volume: 9 },
    { faixa: '21-24', volume: 8 },
  ],
};
