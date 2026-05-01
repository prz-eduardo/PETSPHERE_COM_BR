export interface TutorGestaoRow {
  id: string;
  nome: string;
  email: string;
  telefone: string;
}

export interface PetGestaoRow {
  id: string;
  tutorId: string;
  nome: string;
  especie: string;
}

export type TurmaStatus = 'aberta' | 'encerrada';

export interface TurmaGestaoRow {
  id: string;
  nome: string;
  nivel: string;
  vagas: number;
  inscritos: number;
  status: TurmaStatus;
}

export interface AulaGestaoRow {
  id: string;
  turmaId: string;
  titulo: string;
  inicio: string;
  duracaoMin: number;
}

export const MOCK_TUTORES: TutorGestaoRow[] = [
  { id: 't1', nome: 'Mariana Prado', email: 'mariana.prado@email.mock', telefone: '(11) 98111-1010' },
  { id: 't2', nome: 'Ricardo Vieira', email: 'ricardo.v@email.mock', telefone: '(11) 98222-2020' },
  { id: 't3', nome: 'Juliana Faria', email: 'ju.faria@email.mock', telefone: '(21) 98333-3030' },
];

export const MOCK_PETS_GESTAO: PetGestaoRow[] = [
  { id: 'pet1', tutorId: 't1', nome: 'Paçoca', especie: 'Cão — SRD' },
  { id: 'pet2', tutorId: 't1', nome: 'Churros', especie: 'Gato — Persa' },
  { id: 'pet3', tutorId: 't2', nome: 'Bolt', especie: 'Cão — Beagle' },
  { id: 'pet4', tutorId: 't3', nome: 'Nina', especie: 'Cão — Poodle' },
];

export const MOCK_TURMAS: TurmaGestaoRow[] = [
  {
    id: 'tur1',
    nome: 'Filhotes I — socialização',
    nivel: 'Iniciante',
    vagas: 8,
    inscritos: 5,
    status: 'aberta',
  },
  {
    id: 'tur2',
    nome: 'Obediência básica',
    nivel: 'Intermediário',
    vagas: 6,
    inscritos: 6,
    status: 'aberta',
  },
  {
    id: 'tur3',
    nome: 'Enriquecimento ambiental',
    nivel: 'Todos',
    vagas: 10,
    inscritos: 3,
    status: 'encerrada',
  },
];

export const MOCK_AULAS: AulaGestaoRow[] = [
  { id: 'a1', turmaId: 'tur1', titulo: 'Adestramento positivo e colo', inicio: '2026-05-05T09:00:00', duracaoMin: 60 },
  { id: 'a2', turmaId: 'tur1', titulo: 'Brinquedos e estímulos', inicio: '2026-05-12T09:00:00', duracaoMin: 60 },
  { id: 'a3', turmaId: 'tur2', titulo: 'Comando “senta” e “fica”', inicio: '2026-05-06T18:30:00', duracaoMin: 90 },
  { id: 'a4', turmaId: 'tur2', titulo: 'Caminhada educada na guia', inicio: '2026-05-13T18:30:00', duracaoMin: 90 },
  { id: 'a5', turmaId: 'tur3', titulo: 'Oficina revisão (concluída)', inicio: '2026-04-10T10:00:00', duracaoMin: 45 },
];
