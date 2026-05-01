export type ShowcasePasseioStatus = 'agendado' | 'em_andamento' | 'concluido';

export interface ShowcaseWalker {
  id: string;
  nome: string;
  ativo: boolean;
  telefone?: string;
  regiao?: string;
}

export interface ShowcaseWaypoint {
  lat: number;
  lng: number;
}

export interface ShowcasePasseio {
  id: string;
  walkerId: string;
  petNome: string;
  inicioPrevisto: string;
  status: ShowcasePasseioStatus;
  waypoints: ShowcaseWaypoint[];
}

export const MOCK_WALKERS: ShowcaseWalker[] = [
  {
    id: 'w1',
    nome: 'Ana Silva',
    ativo: true,
    telefone: '(11) 98888-1001',
    regiao: 'Pinheiros — SP',
  },
  {
    id: 'w2',
    nome: 'Bruno Costa',
    ativo: true,
    telefone: '(11) 97777-2002',
    regiao: 'Vila Madalena — SP',
  },
  {
    id: 'w3',
    nome: 'Carla Mendes',
    ativo: false,
    telefone: '(11) 96666-3003',
    regiao: 'Perdizes — SP',
  },
];

export const MOCK_PASSEIOS: ShowcasePasseio[] = [
  {
    id: 'p1',
    walkerId: 'w1',
    petNome: 'Rex',
    inicioPrevisto: '2026-05-02T08:30:00',
    status: 'agendado',
    waypoints: [
      { lat: -23.5679, lng: -46.6904 },
      { lat: -23.5688, lng: -46.6889 },
      { lat: -23.5695, lng: -46.6872 },
      { lat: -23.5702, lng: -46.6855 },
    ],
  },
  {
    id: 'p2',
    walkerId: 'w2',
    petNome: 'Mimi',
    inicioPrevisto: '2026-05-02T10:00:00',
    status: 'em_andamento',
    waypoints: [
      { lat: -23.5465, lng: -46.6912 },
      { lat: -23.5472, lng: -46.6895 },
      { lat: -23.548, lng: -46.688 },
    ],
  },
  {
    id: 'p3',
    walkerId: 'w1',
    petNome: 'Thor',
    inicioPrevisto: '2026-05-01T17:00:00',
    status: 'concluido',
    waypoints: [
      { lat: -23.5612, lng: -46.6721 },
      { lat: -23.562, lng: -46.6705 },
    ],
  },
];
