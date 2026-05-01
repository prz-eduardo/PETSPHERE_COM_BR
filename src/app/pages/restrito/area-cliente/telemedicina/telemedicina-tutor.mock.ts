import type { AgendaDiaMock, MockVetCard } from './telemedicina-tutor.types';

/** Alinhado ao mock de preços do parceiro (TELEMEDICINA_MOCK_PRICING.consultaBase). */
export const TELEMEDICINA_EMERGENCIA_PRECO_FIXO = 129;

export const TELEMEDICINA_TEMPO_ESPERA_MEDIO_MIN = 8;

export const TELEMEDICINA_TUTOR_VETS_MOCK: MockVetCard[] = [
  {
    id: 'vet-1',
    nome: 'Dra. Helena Moraes',
    especialidade: 'Clínica geral e dermatologia',
    tempoRespostaMedioMin: 4,
    online: true,
    avaliacao: 4.9,
    precoAgendamento: 110,
  },
  {
    id: 'vet-2',
    nome: 'Dr. Ricardo Alves',
    especialidade: 'Urgência e emergência',
    tempoRespostaMedioMin: 3,
    online: true,
    avaliacao: 4.8,
    precoAgendamento: 145,
  },
  {
    id: 'vet-3',
    nome: 'Dra. Camila Duarte',
    especialidade: 'Comportamento e felinos',
    tempoRespostaMedioMin: 7,
    online: false,
    avaliacao: 4.7,
    precoAgendamento: 95,
  },
  {
    id: 'vet-4',
    nome: 'Dr. Pedro Nogueira',
    especialidade: 'Ortopedia leve',
    tempoRespostaMedioMin: 6,
    online: true,
    avaliacao: null,
    precoAgendamento: 120,
  },
];

/** Próximos dias com slots mock (sem dependência de lib de calendário). */
export function buildAgendaDiasMock(vets: MockVetCard[]): AgendaDiaMock[] {
  const base = new Date();
  const dias: AgendaDiaMock[] = [];
  for (let d = 1; d <= 5; d++) {
    const dt = new Date(base);
    dt.setDate(base.getDate() + d);
    const dateKey = dt.toISOString().slice(0, 10);
    const label = dt.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
    const v0 = vets[0];
    const v1 = vets[1];
    dias.push({
      dateKey,
      label,
      slots: [
        { horario: '09:00', preco: v0.precoAgendamento, vetId: v0.id, vetNome: v0.nome },
        { horario: '10:30', preco: v1.precoAgendamento, vetId: v1.id, vetNome: v1.nome },
        { horario: '14:00', preco: Math.round((v0.precoAgendamento + v1.precoAgendamento) / 2), vetId: null, vetNome: 'Melhor encaixe' },
        { horario: '16:30', preco: v0.precoAgendamento + 15, vetId: v0.id, vetNome: v0.nome },
      ],
    });
  }
  return dias;
}
