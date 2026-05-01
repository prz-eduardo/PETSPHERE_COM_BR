/** Conteúdo versionado gravado em `atendimentos.exame_fisico` (JSON) ou texto legado. */
export const EXAME_FISICO_KIND = 'petsphere_exame_fisico_v1' as const;
export const EXAME_FISICO_VERSION = 1 as const;

export type ExameFisicoToggle = 'normal' | 'alterado' | 'nao_avaliado' | '';

export type ExameFisicoToggleKey =
  | 'mucosas'
  | 'hidratacao'
  | 'linfonodos'
  | 'dor'
  | 'estado_mental'
  | 'respiratorio'
  | 'cardiovascular'
  | 'abdome'
  | 'pele_pelagem'
  | 'locomotor'
  | 'neurologico'
  | 'oral';

export interface ExameFisicoCustomLinha {
  id: string;
  titulo: string;
  texto: string;
}

export interface ExameFisicoEstruturadoV1 {
  kind: typeof EXAME_FISICO_KIND;
  v: typeof EXAME_FISICO_VERSION;
  temperatura: string;
  fc: string;
  fr: string;
  tpcSeg: string;
  pas: string;
  pesoDia: string;
  mucosas: ExameFisicoToggle;
  hidratacao: ExameFisicoToggle;
  linfonodos: ExameFisicoToggle;
  dor: ExameFisicoToggle;
  estado_mental: ExameFisicoToggle;
  respiratorio: ExameFisicoToggle;
  cardiovascular: ExameFisicoToggle;
  abdome: ExameFisicoToggle;
  pele_pelagem: ExameFisicoToggle;
  locomotor: ExameFisicoToggle;
  neurologico: ExameFisicoToggle;
  oral: ExameFisicoToggle;
  complemento: string;
  custom: ExameFisicoCustomLinha[];
  /** Resumo em texto para leitura humana / listagens */
  resumo: string;
}

export const EXAME_FISICO_TOGGLE_KEYS: ExameFisicoToggleKey[] = [
  'mucosas',
  'hidratacao',
  'linfonodos',
  'dor',
  'estado_mental',
  'respiratorio',
  'cardiovascular',
  'abdome',
  'pele_pelagem',
  'locomotor',
  'neurologico',
  'oral',
];

export const EXAME_FISICO_SISTEMA_LABELS: Record<ExameFisicoToggleKey, string> = {
  mucosas: 'Mucosas',
  hidratacao: 'Hidratação',
  linfonodos: 'Linfonodos',
  dor: 'Dor / desconforto',
  estado_mental: 'Estado mental',
  respiratorio: 'Respiratório',
  cardiovascular: 'Cardiovascular',
  abdome: 'Abdome',
  pele_pelagem: 'Pele e pelagem',
  locomotor: 'Locomotor',
  neurologico: 'Neurológico',
  oral: 'Cavidade oral / dentes',
};

function novoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyExameFisico(): ExameFisicoEstruturadoV1 {
  const emptyToggle: ExameFisicoToggle = '';
  return {
    kind: EXAME_FISICO_KIND,
    v: EXAME_FISICO_VERSION,
    temperatura: '',
    fc: '',
    fr: '',
    tpcSeg: '',
    pas: '',
    pesoDia: '',
    mucosas: emptyToggle,
    hidratacao: emptyToggle,
    linfonodos: emptyToggle,
    dor: emptyToggle,
    estado_mental: emptyToggle,
    respiratorio: emptyToggle,
    cardiovascular: emptyToggle,
    abdome: emptyToggle,
    pele_pelagem: emptyToggle,
    locomotor: emptyToggle,
    neurologico: emptyToggle,
    oral: emptyToggle,
    complemento: '',
    custom: [],
    resumo: '',
  };
}

const TOGGLE_LABEL: Record<Exclude<ExameFisicoToggle, ''>, string> = {
  normal: 'normal',
  alterado: 'alterado',
  nao_avaliado: 'não avaliado',
};

function toggleContaParaProgresso(t: ExameFisicoToggle): boolean {
  return t === 'normal' || t === 'alterado';
}

export function exameFisicoTemConteudo(o: ExameFisicoEstruturadoV1): boolean {
  if ((o.complemento || '').trim()) return true;
  if (
    (o.temperatura || '').trim() ||
    (o.fc || '').trim() ||
    (o.fr || '').trim() ||
    (o.tpcSeg || '').trim() ||
    (o.pas || '').trim() ||
    (o.pesoDia || '').trim()
  ) {
    return true;
  }
  for (const k of EXAME_FISICO_TOGGLE_KEYS) {
    if (toggleContaParaProgresso(o[k])) return true;
  }
  if (
    o.custom?.some((l) => (l.titulo || '').trim() || (l.texto || '').trim())
  ) {
    return true;
  }
  return false;
}

function buildResumo(o: ExameFisicoEstruturadoV1): string {
  const linhas: string[] = [];
  if ((o.temperatura || '').trim()) linhas.push(`Temperatura: ${o.temperatura.trim()} °C`);
  if ((o.fc || '').trim()) linhas.push(`FC: ${o.fc.trim()} bpm`);
  if ((o.fr || '').trim()) linhas.push(`FR: ${o.fr.trim()} mrm`);
  if ((o.tpcSeg || '').trim()) linhas.push(`TPC: ${o.tpcSeg.trim()} s`);
  if ((o.pas || '').trim()) linhas.push(`PA: ${o.pas.trim()}`);
  if ((o.pesoDia || '').trim()) linhas.push(`Peso (atendimento): ${o.pesoDia.trim()} kg`);

  for (const k of EXAME_FISICO_TOGGLE_KEYS) {
    const t = o[k];
    if (t !== '') {
      const sys = EXAME_FISICO_SISTEMA_LABELS[k];
      linhas.push(`${sys}: ${TOGGLE_LABEL[t]}`);
    }
  }

  for (const c of o.custom || []) {
    const ti = (c.titulo || '').trim();
    const tx = (c.texto || '').trim();
    if (ti || tx) linhas.push(ti ? `${ti}: ${tx}`.trim() : tx);
  }

  if ((o.complemento || '').trim()) linhas.push(o.complemento.trim());

  return linhas.join('\n');
}

export function serializeExameFisico(form: ExameFisicoEstruturadoV1): string {
  const resumo = buildResumo(form);
  const payload: ExameFisicoEstruturadoV1 = {
    ...form,
    resumo,
  };
  return JSON.stringify(payload);
}

function asToggle(v: unknown): ExameFisicoToggle {
  if (v === 'normal' || v === 'alterado' || v === 'nao_avaliado' || v === '') return v;
  return '';
}

export function mergeExameFisicoPatch(
  base: ExameFisicoEstruturadoV1,
  raw: Record<string, unknown>
): ExameFisicoEstruturadoV1 {
  const o = createEmptyExameFisico();
  o.temperatura = typeof raw['temperatura'] === 'string' ? raw['temperatura'] : base.temperatura;
  o.fc = typeof raw['fc'] === 'string' ? raw['fc'] : base.fc;
  o.fr = typeof raw['fr'] === 'string' ? raw['fr'] : base.fr;
  o.tpcSeg = typeof raw['tpcSeg'] === 'string' ? raw['tpcSeg'] : base.tpcSeg;
  o.pas = typeof raw['pas'] === 'string' ? raw['pas'] : base.pas;
  o.pesoDia = typeof raw['pesoDia'] === 'string' ? raw['pesoDia'] : base.pesoDia;
  o.complemento = typeof raw['complemento'] === 'string' ? raw['complemento'] : base.complemento;
  for (const k of EXAME_FISICO_TOGGLE_KEYS) {
    o[k] = asToggle(raw[k] !== undefined ? raw[k] : base[k]);
  }
  if (Array.isArray(raw['custom'])) {
    o.custom = raw['custom']
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        return {
          id: typeof r['id'] === 'string' ? r['id'] : novoId(),
          titulo: typeof r['titulo'] === 'string' ? r['titulo'] : '',
          texto: typeof r['texto'] === 'string' ? r['texto'] : '',
        };
      })
      .filter(Boolean) as ExameFisicoCustomLinha[];
  } else {
    o.custom = base.custom?.length ? [...base.custom] : [];
  }
  o.resumo = typeof raw['resumo'] === 'string' ? raw['resumo'] : '';
  return o;
}

/** Interpreta valor salvo no banco: JSON estruturado ou texto livre legado. */
export function parseExameFisicoStored(raw: string | null | undefined): ExameFisicoEstruturadoV1 {
  const empty = createEmptyExameFisico();
  if (raw == null) return empty;
  const s = String(raw).trim();
  if (!s) return empty;
  if (s.startsWith('{')) {
    try {
      const parsed = JSON.parse(s) as Record<string, unknown>;
      if (parsed['kind'] === EXAME_FISICO_KIND && parsed['v'] === EXAME_FISICO_VERSION) {
        return mergeExameFisicoPatch(empty, parsed);
      }
    } catch {
      /* legado */
    }
  }
  empty.complemento = s;
  return empty;
}

export function novaLinhaCustomExameFisico(): ExameFisicoCustomLinha {
  return { id: novoId(), titulo: '', texto: '' };
}
