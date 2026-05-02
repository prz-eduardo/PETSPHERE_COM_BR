import {
  AgendaStatus,
  Agendamento,
  PetResumido,
  Profissional,
  Servico,
} from '../../../../types/agenda.types';

/** Linha retornada por GET /parceiro/agendamentos (v2 ou legado). */
export type ParceiroAgendamentoApiRow = Record<string, unknown> & {
  id?: number | string;
  recurso_id?: number | null;
  data_hora_inicio?: string;
  data_hora_fim?: string;
  inicio?: string | Date;
  fim?: string | Date;
  status?: string;
  observacoes?: string | null;
  cliente_id?: number | null;
  pet_id?: number | null;
  cliente_nome?: string | null;
  cliente_nome_snapshot?: string | null;
  cliente_telefone?: string | null;
  cliente_telefone_snapshot?: string | null;
  pet_nome?: string | null;
  pet_nome_snapshot?: string | null;
  tutor_notificacao_email_enviado_em?: string | null;
};

function pickClienteNome(row: ParceiroAgendamentoApiRow): string {
  const v =
    row.cliente_nome_snapshot ??
    row.cliente_nome ??
    '';
  return String(v || '').trim();
}

function pickClienteTel(row: ParceiroAgendamentoApiRow): string | null {
  const v = row.cliente_telefone_snapshot ?? row.cliente_telefone;
  if (v == null || v === '') return null;
  return String(v);
}

function pickPetNome(row: ParceiroAgendamentoApiRow): string | null {
  const v = row.pet_nome_snapshot ?? row.pet_nome;
  if (v == null || v === '') return null;
  return String(v);
}

/**
 * Converte resposta da API para o modelo de UI da agenda (sem inferir permissão).
 */
export function mapParceiroAgendamentoRow(
  row: ParceiroAgendamentoApiRow,
  recursoById: Map<number, { nome: string }>,
  defaultServico: Servico
): Agendamento {
  const inicioRaw = row.data_hora_inicio ?? row.inicio;
  const fimRaw = row.data_hora_fim ?? row.fim;
  const inicio = inicioRaw instanceof Date ? inicioRaw.toISOString() : String(inicioRaw ?? '');
  const fim = fimRaw instanceof Date ? fimRaw.toISOString() : String(fimRaw ?? '');

  const recursoId =
    row.recurso_id != null && String(row.recurso_id).trim() !== ''
      ? Number(row.recurso_id)
      : undefined;
  const recursoNome =
    recursoId != null && Number.isFinite(recursoId)
      ? recursoById.get(recursoId)?.nome ?? 'Recurso'
      : 'Recurso';

  const clienteNome = pickClienteNome(row);
  const clienteTel = pickClienteTel(row);
  const petNome = pickPetNome(row);

  const cid =
    row.cliente_id != null && String(row.cliente_id).trim() !== ''
      ? String(row.cliente_id)
      : `row-${row.id}`;
  const pid =
    row.pet_id != null && String(row.pet_id).trim() !== ''
      ? String(row.pet_id)
      : `row-${row.id}-pet`;

  let pet: PetResumido | undefined;
  if (petNome) {
    pet = {
      id: pid,
      nome: petNome,
      especie: 'Outro',
      alergias: [],
      temMedicacao: false,
      temRestricao: false,
      temAlimentacaoEspecial: false,
      historicoRecente: [],
      tutor: {
        id: cid,
        nome: clienteNome || '—',
        telefone: clienteTel ?? '',
      },
    };
  } else if (clienteNome) {
    pet = {
      id: pid,
      nome: '—',
      especie: 'Outro',
      alergias: [],
      temMedicacao: false,
      temRestricao: false,
      temAlimentacaoEspecial: false,
      historicoRecente: [],
      tutor: {
        id: cid,
        nome: clienteNome,
        telefone: clienteTel ?? '',
      },
    };
  }

  const t0 = new Date(inicio).getTime();
  const t1 = new Date(fim).getTime();
  const durMin =
    Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0
      ? Math.max(15, Math.round((t1 - t0) / 60000))
      : defaultServico.duracaoMin;

  const profissional: Profissional = {
    id: String(recursoId ?? ''),
    nome: recursoNome,
    ativo: true,
  };

  const servico: Servico = {
    ...defaultServico,
    duracaoMin: durMin,
  };

  const tutorEmailEm =
    row.tutor_notificacao_email_enviado_em != null && String(row.tutor_notificacao_email_enviado_em).trim() !== ''
      ? String(row.tutor_notificacao_email_enviado_em)
      : null;

  return {
    id: Number(row.id),
    recursoId,
    inicio,
    fim,
    status: (row.status as AgendaStatus) || 'AGENDADO',
    observacoes: row.observacoes != null ? String(row.observacoes) : null,
    tutorNotificacaoEmailEnviadoEm: tutorEmailEm,
    pet,
    profissional,
    servico,
  };
}

export function catalogPetsFromAgendamentos(list: Agendamento[]): PetResumido[] {
  const seen = new Set<string>();
  const out: PetResumido[] = [];
  for (const a of list) {
    if (!a.pet?.nome || a.pet.nome === '—') continue;
    const key = `${a.pet.id}|${a.pet.nome}|${a.pet.tutor?.nome ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a.pet);
  }
  return out;
}
