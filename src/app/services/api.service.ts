import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, throwError } from 'rxjs';
import type { ClinicalResponseV2 } from '../pages/restrito/area-vet/gerar-receita/clinical-response-v2.model';

export interface Ativo {
  id: string;
  nome: string;
  descricao: string;
  doseCaes: string;
  doseGatos: string;
  open?: boolean; // adiciona aqui para controlar o acordeon
}

export interface Veterinario {
  id: string;
  nome: string;
  cpf: string;
  crmv: string;
  email: string;
  telefone?: string;
  tipo: string;
  approved: boolean;
}


export interface Vet {
  id: string;
  nome: string;
  approved: boolean;
  tipo: string;
  token?: string;
}

export interface AuthResponse {
  tipo: string;
  token: string;
  user?: Vet;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone?: string;
  tipo: string;
  created_at?: string;
  preferencias?: Record<string, unknown> | string | null;
}

/** Registro de vacina (carteira do pet). */
export interface PetVacinaRow {
  id: number;
  pet_id: number;
  nome: string;
  catalogo_id?: number | null;
  catalogo_nome?: string | null;
  catalogo_especie?: string | null;
  data_aplicacao: string;
  proxima_reforco?: string | null;
  lote?: string | null;
  aplicado_por?: string | null;
  observacoes?: string | null;
  comprovante_url?: string | null;
  lembrete_ativo?: number | boolean;
  origem_registro?: 'tutor' | 'vet' | 'admin' | string;
  status_validacao?: 'pendente' | 'validada' | 'rejeitada' | string;
  validado_por_vet_id?: number | null;
  validado_em?: string | null;
  motivo_rejeicao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PetVacinaCatalogoItem {
  id: number;
  nome: string;
  especie: 'cao' | 'gato' | 'ambos' | string;
  tipo: 'essencial' | 'opcional' | string;
  intervalo_reforco_dias?: number | null;
  idade_min_semanas?: number | null;
  ativo?: number | boolean;
}

export interface PetVacinaCronogramaItem {
  catalogo_id: number;
  nome: string;
  especie: string;
  tipo: string;
  idade_min_semanas?: number | null;
  intervalo_reforco_dias?: number | null;
  status: 'sugerida' | 'proxima' | 'atrasada' | 'em_dia' | string;
  dias_para_proxima?: number | null;
  ultima_aplicacao?: string | null;
  proxima_reforco?: string | null;
  status_validacao_ultima?: 'pendente' | 'validada' | 'rejeitada' | string | null;
}

export interface PetVacinaCronogramaResponse {
  pet: {
    id: number;
    nome?: string | null;
    especie?: string | null;
    idade?: number | null;
    data_nascimento?: string | null;
  } | null;
  itens: PetVacinaCronogramaItem[];
}

/** Resumo agregado para cards em Meus pets. */
export interface PetVacinasResumo {
  vacinas_count: number;
  proxima_reforco: string | null;
  status: 'sem_registros' | 'ok' | 'proxima' | 'atrasada';
}

export interface ClienteMeResponse {
  user: Cliente;
  tokenExp?: number;
}

export interface ClientePermissaoDadosParceiroRow {
  id: number;
  cliente_id: number;
  parceiro_id: number;
  status: string;
  escopo: string;
  parceiro_nome?: string | null;
}

export interface ClienteConviteDadosParceiroRow {
  id: number;
  parceiro_id: number;
  parceiro_nome?: string | null;
  cliente_email: string;
  escopo: string;
  token: string;
  status: string;
  data_expiracao?: string | null;
  created_at?: string;
}

export interface TelemedicinaConsulta {
  id: number;
  cliente_id?: number | null;
  veterinario_id?: number | null;
  status: string;
  telemedicina_habilitada: number | boolean;
  janela_inicio: string;
  janela_fim: string;
  video_chamada_id?: number | null;
  sala_codigo?: string | null;
  video_status?: string | null;
}

/** Resposta de GET /public/telemedicina/catalogo */
export interface TelemedicinaCatalogoVet {
  id: string;
  parceiro_account_id?: number;
  nome: string;
  especialidade?: string | null;
  crmv?: string | null;
  online?: boolean | null;
  tempo_resposta_medio_min?: number;
  preco_agendamento_centavos?: number | null;
  source?: string;
}

export interface TelemedicinaCatalogoResponse {
  loja_slug: string | null;
  parceiro_id: number | null;
  parceiro_nome?: string | null;
  vets: TelemedicinaCatalogoVet[];
  source: string;
}

/** GET /clientes/me/agendamentos-timeline — agenda parceiro, telemedicina, hotel (unificado). */
export type ClienteAgendamentoTimelineKind = 'agenda' | 'telemedicina' | 'hotel';

export interface ClienteAgendamentoTimelineItem {
  kind: ClienteAgendamentoTimelineKind;
  id: number;
  inicio: string | null;
  fim: string | null;
  status: string;
  status_label: string;
  titulo: string;
  parceiro_id: number;
  parceiro_nome: string | null;
  pet_id: number | null;
  pet_nome: string | null;
  pet_especie: string | null;
  especie_id: number | null;
  observacoes?: string | null;
}

export interface ClienteAgendamentoTimelineQuery {
  data_inicio?: string;
  data_fim?: string;
  pet_id?: number;
  parceiro_id?: number;
  especie_id?: number;
  kind?: ClienteAgendamentoTimelineKind;
}

export type PlaceSource = 'google' | 'petsphere';

export interface MapLayerType {
  id: string | number;
  nome: string;
  slug?: string | null;
  icone?: string | null;
}

export interface UnifiedMapPlace {
  source: PlaceSource;
  sourceLabel: string;
  id: string | number | null;
  nome: string;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  telefone?: string | null;
  rating?: number | null;
  totalAvaliacoes?: number | null;
  websiteUrl?: string | null;
  googleMapsUrl?: string | null;
  tipoPrimario?: string | null;
  tipos?: MapLayerType[];
  partner_type?: string | null;
  descricao?: string | null;
  logo_url?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  [key: string]: any;
}

export interface PetsphereMapLayerResponse {
  source: 'petsphere';
  sourceLabel: string;
  disclaimer: string;
  items: UnifiedMapPlace[];
  tipos: MapLayerType[];
}

export interface GooglePlacesResponse {
  source: 'google';
  sourceLabel: string;
  disclaimer: string;
  items: UnifiedMapPlace[];
}

export interface GooglePlaceDetailsResponse {
  source: 'google';
  sourceLabel: string;
  disclaimer: string;
  item: UnifiedMapPlace & { horarioFuncionamento?: string[] };
}

export interface GoogleClaimIntentResponse {
  ok: boolean;
  source: 'google';
  sourceLabel: string;
  disclaimer: string;
  redirectTo: string;
  claimContext: {
    source: 'google';
    placeId: string;
    suggestedType?: string | null;
  };
  prefill: {
    nome: string;
    telefone?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    websiteUrl?: string | null;
    tipoPrimario?: string | null;
  };
}

export interface PostImagem {
  id: number;
  url: string;
  ordem?: number | null;
}

export interface PostEngagement {
  love?: number;
  haha?: number;
  sad?: number;
  angry?: number;
  total?: number;
  comentarios?: number;
  minha_reacao?: { id?: number; tipo: string } | null;
}

export interface PostPetResumo {
  id: number;
  nome?: string | null;
  especie?: string | null;
  raca?: string | null;
  foto?: string | null;
}

export interface PostDto {
  id: number;
  pet_id: number;
  pet?: PostPetResumo | null;
  pets?: PostPetResumo[];
  caption?: string | null;
  cover_imagem_id?: number | null;
  galeria_publica?: number | boolean;
  ativo?: number | boolean;
  created_at?: string;
  imagens: PostImagem[];
  engagement?: PostEngagement;
  type?: 'post';
}

export interface PostPatchPayload {
  caption?: string | null;
  galeria_publica?: boolean | number;
  cover_imagem_id?: number | null;
}

export interface PostListResponse {
  items: PostDto[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  ad?: any | null;
}

export interface AlergiaLookup {
  alergia_id: string | number;
  ativo_id?: string | number;
  nome: string;
}

/** Traços / comportamentos (catálogo `pet_trait_catalogo`). */
export interface PetTraitLookup {
  catalogo_id: number;
  nome: string;
  categoria?: string;
  ordem?: number;
}

export interface ReceitaItem {
  id: number;
  ativo_id: number;
  nome_ativo: string;
  ordem: number;
  created_at?: string;
}

export interface Receita {
  id: number;
  vet_id?: number;
  cliente_id: number;
  pet_id: number;
  // Names and display helpers
  pet_nome?: string;
  nome_pet?: string; // sometimes API returns this alias
  cliente_nome?: string;
  endereco_text?: string;
  observacoes?: string;
  alerta_alergia?: boolean | 0 | 1;
  created_at?: string;
  itens?: ReceitaItem[];
  // Signature variants and thumbnail
  assinatura_imagem?: string | null;
  assinatura_manual?: string | null;
  assinatura_cursiva?: string | null;
  assinatura_icp?: string | null;
  // Pet details snapshot
  especie?: string;
  raca?: string;
  sexo?: string;
  idade?: number;
  peso?: string | number;
  // Allergies snapshot
  alergias?: string[];
  // Full raw payload (for debugging/auditing)
  dados_raw?: any;
}

export interface PagedReceitasResponse {
  data: Receita[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AtendimentoExamePayload {
  nome: string;
  status?: string;
  observacoes?: string;
}

export interface AtendimentoFotoPayload {
  descricao?: string;
  url?: string;
  base64?: string;
}

export interface CriarAtendimentoPayload {
  tutor: {
    nome?: string;
    cpf?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
  };
  pet: {
    id?: string | number;
    nome?: string;
    especie?: string;
    raca?: string;
    sexo?: string;
    idade?: number;
    peso?: number;
    alergias?: string[];
  };
  atendimento: {
    queixaPrincipal?: string;
    anamnese?: string;
    /** Texto livre legado ou JSON `petsphere_exame_fisico_v1` (stringify) com sinais vitais e sistemas. */
    exameFisico?: string | Record<string, unknown>;
    diagnostico?: string;
    planoTerapeutico?: string;
    observacoes?: string;
    examesSolicitados?: AtendimentoExamePayload[];
    fotos?: AtendimentoFotoPayload[];
    /** Retorno: ao salvar, o backend notifica o tutor (conta + e-mail). */
    retorno?: {
      notificarCliente?: boolean;
      data?: string;
      observacao?: string;
    };
    status_fluxo?: 'aberto' | 'em_andamento' | 'pausado' | 'aguardando_pagamento' | 'finalizado';
    tipo_execucao?: 'presencial' | 'domiciliar' | 'telemedicina' | 'encaminhamento';
    precisa_logistica?: boolean;
    precisa_orcamento?: boolean;
    financeiro_status?: 'nao_iniciado' | 'pendente' | 'aguardando_pagamento' | 'pago' | 'cancelado';
  };
  receita?: {
    ativosSelecionados?: Array<string | number | { id?: number | string; ativo_id?: number | string; nome?: string }>;
    alerta_alergia?: boolean;
    observacoes?: string;
    assinatura?: {
      manual?: string;
      cursiva?: string;
      imagem?: string | null;
      icp?: string;
    };
    alergias?: string[];
  };
  fluxo?: {
    /** Quando `clinica_concluida`, backend define status_fluxo pausado sem receita. */
    fase?: 'clinica_concluida';
    status_fluxo?: 'aberto' | 'em_andamento' | 'pausado' | 'aguardando_pagamento' | 'finalizado';
    tipo_execucao?: 'presencial' | 'domiciliar' | 'telemedicina' | 'encaminhamento';
    precisa_logistica?: boolean;
    precisa_orcamento?: boolean;
    financeiro_status?: 'nao_iniciado' | 'pendente' | 'aguardando_pagamento' | 'pago' | 'cancelado';
  };
}

// Pacientes (pets atendidos)
export interface TopAtivoUso { nome: string; usos: number; ativo_id?: number; }

export interface PacienteSummary {
  pet_id: number;
  pet_nome: string;
  especie?: string;
  raca?: string;
  sexo?: string;
  cliente_id: number;
  cliente_nome: string;
  cliente_cpf?: string;
  total_atendimentos: number;
  primeiro_atendimento?: string;
  ultimo_atendimento?: string;
  top_ativos?: TopAtivoUso[]; // até 5
}

export interface PagedPacientesResponse {
  data: PacienteSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PacienteTrait {
  catalogo_id: number;
  nome: string;
  categoria?: string;
}

export interface PacienteTimelineEvento {
  tipo: 'receita' | 'vacina' | 'observacao' | string;
  data_evento: string;
  titulo: string;
  descricao?: string | null;
  badge?: string | null;
  ref_id?: number;
}

export interface PacienteDetail {
  pet: {
    id: number;
    nome: string;
    especie?: string;
    raca?: string;
    sexo?: string;
    // Campos extras que podem vir no payload real
    cliente_id?: number;
    cliente_nome?: string;
    cliente_cpf?: string;
    tipo?: string | null;
    photoURL?: string | null;
    created_at?: string;
    pesoKg?: string | number | null;
    idade?: number | null;
    aceito_tutor?: number | boolean | null;
    salvo_vet_id?: number | null;
    observacoes?: string | null;
      alergias?: string[] | null;
      alergias_predefinidas?: Array<{
        nome: string;
        alergia_id?: number | null;
        ativo_id?: number | null;
      }> | null;
  };
  cliente?: {
    id: number;
    nome: string;
    cpf?: string;
    email?: string;
    telefone?: string;
  };
  resumo: {
    total_atendimentos: number;
    primeiro_atendimento?: string;
    ultimo_atendimento?: string;
  };
  pet_traits?: PacienteTrait[];
  ativos_mais_usados: TopAtivoUso[]; // top 10
  ultimas_receitas: Receita[]; // até 5 últimas com itens
  vacinas_registros?: PetVacinaRow[];
  vacinas_cronograma?: PetVacinaCronogramaItem[];
  timeline_eventos?: PacienteTimelineEvento[];
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = `${environment.apiBaseUrl}`;

  constructor(private http: HttpClient) {}

  resolveMediaUrl(raw: string | null | undefined, fallback = '/imagens/image.png'): string {
    if (typeof raw !== 'string') return fallback;

    const trimmed = raw.trim();
    if (!trimmed) return fallback;

    const normalized = trimmed.replace(/\\/g, '/');
    if (/^(data:image\/|blob:)/i.test(normalized)) return normalized;

    if (normalized.startsWith('//')) {
      const protocol = typeof window !== 'undefined' && window.location?.protocol ? window.location.protocol : 'https:';
      return `${protocol}${normalized}`;
    }

    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(normalized) && !normalized.startsWith('/')) {
      return `https://${normalized}`;
    }

    const mediaBase = this.getMediaBaseOrigin();
    const relativePath = normalized.replace(/^\.?\//, '');

    if (!mediaBase) {
      return normalized.startsWith('/') ? normalized : `/${relativePath}`;
    }

    try {
      return new URL(normalized.startsWith('/') ? normalized : `/${relativePath}`, mediaBase).toString();
    } catch {
      return fallback;
    }
  }

  private getMediaBaseOrigin(): string | null {
    try {
      return new URL(this.baseUrl).origin;
    } catch {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
      }
      return null;
    }
  }

  // Ativos
  getAtivos(): Observable<Ativo[]> {
    return this.http.get<Ativo[]>(`${this.baseUrl}/ativos`);
  }

  // Loja - listagem pública de produtos com paginação e filtros
    listStoreProducts(
      params?: {
        page?: number; pageSize?: number; q?: string; tipo?: 'manipulado'|'pronto';
        category?: string; categoryId?: string|number; categories?: string[]; tag?: string; tags?: (string|number)[];
        minPrice?: number; maxPrice?: number; myFavorites?: boolean; promoOnly?: boolean;
        sort?: 'relevance'|'newest'|'price_asc'|'price_desc'|'popularity'|'rating'|'my_favorites';
        parceiro_slug?: string | null;
      },
      token?: string
    ): Observable<{
      data: any[];
      page: number; pageSize: number; total: number; totalPages: number;
      meta?: {
        loggedIn?: boolean;
        userType?: string;
        favoritesPersonalization?: boolean;
        supports?: { images?: boolean; favorites?: boolean; ratings?: boolean; categories?: boolean; tags?: boolean };
        categories?: Array<{ id: number; nome: string; produtos: number }>;
        tags?: Array<{ id: number; nome: string; produtos: number }>;
        activeTheme?: { id: number; nome: string; slug: string; config: Record<string, unknown> } | null;
      };
    }> {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.q) search.set('q', params.q);
    if (params?.tipo) search.set('tipo', params.tipo);
    if (params?.category) search.set('category', params.category);
  if (params?.categoryId != null) search.set('category_id', String(params.categoryId));
    if (params?.categories && params.categories.length) search.set('categories', params.categories.join(','));
    if (params?.tag) search.set('tag', params.tag);
    if (params?.tags && params.tags.length) search.set('tags', params.tags.join(','));
    if (typeof params?.minPrice === 'number') search.set('minPrice', String(params.minPrice));
    if (typeof params?.maxPrice === 'number') search.set('maxPrice', String(params.maxPrice));
    if (params?.myFavorites) search.set('myFavorites', 'true');
  if (params?.sort) search.set('sort', params.sort);
  if (params?.promoOnly) search.set('promo', '1');
    if (params?.parceiro_slug) search.set('parceiro_slug', String(params.parceiro_slug));
    const qp = search.toString();
      const url = `${this.baseUrl}/produtos${qp ? `?${qp}` : ''}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
      return this.http.get<{
        data: any[];
        page: number; pageSize: number; total: number; totalPages: number;
        meta?: {
          loggedIn?: boolean;
          userType?: string;
          favoritesPersonalization?: boolean;
          supports?: { images?: boolean; favorites?: boolean; ratings?: boolean; categories?: boolean; tags?: boolean };
          categories?: Array<{ id: number; nome: string; produtos: number }>;
          tags?: Array<{ id: number; nome: string; produtos: number }>;
          activeTheme?: { id: number; nome: string; slug: string; config: Record<string, unknown> } | null;
        };
      }>(url, { headers });
  }

  // Home - destaques
  getHomeHighlights(token?: string, opts?: { parceiro_slug?: string | null }): Observable<any> {
    const search = new URLSearchParams();
    if (opts?.parceiro_slug) search.set('parceiro_slug', String(opts.parceiro_slug));
    const qp = search.toString();
    const url = `${this.baseUrl}/destaques-home${qp ? `?${qp}` : ''}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers });
  }

  // Produto - detalhes completos por ID (novo endpoint)
  getProductById(id: number | string, token?: string, opts?: { parceiro_slug?: string | null }): Observable<any> {
    const qs = new URLSearchParams();
    if (opts?.parceiro_slug) qs.set('parceiro_slug', String(opts.parceiro_slug));
    const q = qs.toString();
    const url = `${this.baseUrl}/products/${encodeURIComponent(String(id))}${q ? `?${q}` : ''}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers });
  }

  // Ativos (busca por termo, se o backend suportar ?q=)
  searchAtivos(q: string): Observable<Ativo[]> {
    const term = (q || '').trim();
    const url = `${this.baseUrl}/ativos${term ? `?q=${encodeURIComponent(term)}` : ''}`;
    return this.http.get<Ativo[]>(url);
  }

  // Receitas
  criarReceita(receita: any, token?: string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post(`${this.baseUrl}/receitas`, receita, { headers });
  }

  criarAtendimento(payload: CriarAtendimentoPayload, token?: string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post(`${this.baseUrl}/atendimentos`, payload, { headers });
  }

  getAtendimentoDetalhe(atendimentoId: number | string, token?: string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get(`${this.baseUrl}/atendimentos/${encodeURIComponent(String(atendimentoId))}`, { headers });
  }

  /** IA — motor de decisão clínica assistida v2 (JSON; créditos ia_analise_clinica_assistida). */
  postAnaliseClinicaAssistida(
    body: {
      casePayload: Record<string, unknown>;
      refId?: number | string | null;
      atendimentoId?: number | string | null;
      idempotencyKey?: string;
    },
    token?: string
  ): Observable<{
    ok: boolean;
    analysisStructured: ClinicalResponseV2;
    charge?: unknown;
    audit?: { eventId: string; timestamp: string };
  }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post<{
      ok: boolean;
      analysisStructured: ClinicalResponseV2;
      charge?: unknown;
      audit?: { eventId: string; timestamp: string };
    }>(`${this.baseUrl}/atendimentos/ia/analise-clinica-assistida`, body, { headers });
  }

  /**
   * Auditoria Clinical Copilot — eventos explícitos (clinical_action | vet_intent).
   * ai_event e system_action são só servidor.
   */
  postClinicalCopilotEvent(
    atendimentoId: number | string,
    body: {
      eventType: 'clinical_action' | 'vet_intent';
      payload: Record<string, unknown>;
    },
    token?: string
  ): Observable<{ ok: boolean; eventId: string; timestamp: string }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post<{ ok: boolean; eventId: string; timestamp: string }>(
      `${this.baseUrl}/atendimentos/${encodeURIComponent(String(atendimentoId))}/clinical-copilot-events`,
      body,
      { headers }
    );
  }

  patchAtendimento(atendimentoId: number | string, body: Record<string, unknown>, token?: string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.patch(
      `${this.baseUrl}/atendimentos/${encodeURIComponent(String(atendimentoId))}`,
      body,
      { headers }
    );
  }

  anexarReceitaAoAtendimento(atendimentoId: number | string, body: Record<string, unknown>, token?: string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post(
      `${this.baseUrl}/atendimentos/${encodeURIComponent(String(atendimentoId))}/receita`,
      body,
      { headers }
    );
  }

  decidirExecucaoAtendimento(
    atendimentoId: number | string,
    payload: {
      acao:
        | 'finalizar_sem_cobranca'
        | 'gerar_cobranca_agora'
        | 'enviar_financeiro'
        | 'solicitar_deslocamento'
        | 'preparar_telemedicina';
      tipo_execucao?: 'presencial' | 'domiciliar' | 'telemedicina' | 'encaminhamento';
      status_fluxo?: 'aberto' | 'em_andamento' | 'pausado' | 'aguardando_pagamento' | 'finalizado';
      financeiro_status?: 'nao_iniciado' | 'pendente' | 'aguardando_pagamento' | 'pago' | 'cancelado';
      precisa_logistica?: boolean;
      precisa_orcamento?: boolean;
    },
    token?: string
  ): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post(`${this.baseUrl}/atendimentos/${encodeURIComponent(String(atendimentoId))}/decisao-execucao`, payload, { headers });
  }

  getVet(id: string, token?: string): Observable<Vet> {
    return this.http.get<Vet>(`${this.baseUrl}/vets/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }



  // Cadastro de veterinário
  cadastrarVet(vet: {
    nome: string;
    email: string;
    senha?: string;   // opcional no caso do Google
    cpf: string;
    crmv: string;
    telefone: string;
    tipo: string;
    idToken?: string; // se vier do Google, usa token
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/vets`, vet);
  }

  // Cadastro de cliente
  checkLojaSlugDisponivel(slug: string, exceptParceiroId?: number): Observable<{
    disponivel: boolean;
    slugNormalizado?: string;
    motivo?: string;
    code?: string;
  }> {
    const qs = new URLSearchParams();
    qs.set('slug', slug);
    if (exceptParceiroId != null) qs.set('except_parceiro_id', String(exceptParceiroId));
    return this.http.get<any>(`${this.baseUrl}/anunciantes/loja-slug/disponivel?${qs.toString()}`);
  }

  getParceiroPorSlugPublico(slug: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/anunciantes/por-slug/${encodeURIComponent(slug)}`);
  }

  cadastrarCliente(cliente: {
    nome: string;
    email: string;
    senha?: string;
    cpf: string;
    telefone: string;
    tipo: string;
    idToken?: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/clientes`, cliente);
  }

  // Cadastro público de anunciantes/parceiros
  registerAnunciante(payload: any): Observable<any> {
    const url = `${this.baseUrl}/anunciantes/register`;
    return this.http.post<any>(url, payload).pipe(
      catchError((err) => {
        // Keep backend validation errors/status codes visible to the UI.
        // Fallback is only for connectivity issues (status 0).
        if (err && err.status && err.status !== 0) {
          return throwError(() => err);
        }

        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/anunciantes/register`;
            return this.http.post<any>(fallback, payload).pipe(
              catchError(() => throwError(() => err))
            );
          } catch (e) {
            return throwError(() => err);
          }
        }
        return throwError(() => err);
      }) as any
    );
  }

  sendParceiroEmailVerificacao(email: string): Observable<any> {
    const url = `${this.baseUrl}/anunciantes/email/send-code`;
    return this.http.post<any>(url, { email });
  }

  verifyParceiroEmailCode(email: string, codigo: string): Observable<any> {
    const url = `${this.baseUrl}/anunciantes/email/verify-code`;
    return this.http.post<any>(url, { email, codigo });
  }

  // front
  loginVet(payload: { email?: string; senha?: string; idToken?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/vets/login-vet`, payload);
  }

  // Login cliente
  loginCliente(payload: { email?: string; senha?: string; idToken?: string; visitanteId?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/clientes/login-cliente`, payload);
  }

  // Pega perfil do cliente autenticado
  getClienteMe(token: string) {
    return this.http.get<ClienteMeResponse>(`${this.baseUrl}/clientes/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  /** Tutor: consentimentos com parceiros (LGPD). */
  listClientePermissoesDadosParceiros(token: string) {
    return this.http.get<{ permissoes: ClientePermissaoDadosParceiroRow[] }>(
      `${this.baseUrl}/clientes/me/permissoes-dados-parceiros`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Tutor: revoga compartilhamento com um parceiro. */
  revokeClientePermissaoParceiro(token: string, parceiroId: number) {
    return this.http.patch<{ permissao: unknown }>(
      `${this.baseUrl}/clientes/me/permissoes-dados-parceiros/${encodeURIComponent(String(parceiroId))}/revogar`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Tutor: lista convites pendentes de parceiros para compartilhamento de dados. */
  listClienteConvitesDadosPendentes(token: string) {
    return this.http.get<{ convites: ClienteConviteDadosParceiroRow[] }>(
      `${this.baseUrl}/clientes/me/convites-dados-parceiros/pendentes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  acceptConviteDadosParceiro(conviteToken: string, clienteId: number) {
    return this.http.post<{ permissao?: unknown }>(
      `${this.baseUrl}/convites/accept`,
      { token: conviteToken, cliente_id: clienteId }
    );
  }

  rejectConviteDadosParceiro(conviteToken: string, clienteId: number) {
    return this.http.post<{ ok?: boolean }>(
      `${this.baseUrl}/convites/reject`,
      { token: conviteToken, cliente_id: clienteId }
    );
  }

  /**
   * Lista os posts do cliente autenticado (galeria pessoal).
   * Substitui o antigo `getMinhaGaleriaFotos`.
   */
  getMyPosts(token: string, params?: { page?: number; pageSize?: number; petId?: number | string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.petId) search.set('pet_id', String(params.petId));
    const qp = search.toString();
    return this.http.get<PostListResponse>(
      `${this.baseUrl}/clientes/me/posts${qp ? `?${qp}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  listMyTelemedicina(token: string) {
    return this.http.get<{ consultas: TelemedicinaConsulta[] }>(
      `${this.baseUrl}/clientes/me/telemedicina`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Tutor: timeline unificada (agenda profissional, telemedicina, hospedagem). */
  listClienteAgendamentosTimeline(token: string, query?: ClienteAgendamentoTimelineQuery) {
    const params: Record<string, string> = {};
    if (query?.data_inicio) params['data_inicio'] = query.data_inicio;
    if (query?.data_fim) params['data_fim'] = query.data_fim;
    if (query?.pet_id != null) params['pet_id'] = String(query.pet_id);
    if (query?.parceiro_id != null) params['parceiro_id'] = String(query.parceiro_id);
    if (query?.especie_id != null) params['especie_id'] = String(query.especie_id);
    if (query?.kind) params['kind'] = query.kind;
    return this.http.get<{ itens: ClienteAgendamentoTimelineItem[] }>(
      `${this.baseUrl}/clientes/me/agendamentos-timeline`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: Object.keys(params).length ? params : undefined,
      },
    );
  }

  joinMyTelemedicina(token: string, consultaId: number | string) {
    return this.http.post<{
      consulta_id: number;
      sala_codigo: string;
      signaling_event: string;
      signaling_channel: string;
    }>(
      `${this.baseUrl}/clientes/me/telemedicina/consultas/${encodeURIComponent(String(consultaId))}/entrar`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Catálogo público de profissionais para telemedicina (contexto da loja). */
  getPublicTelemedicinaCatalogo(lojaSlug: string) {
    return this.http.get<TelemedicinaCatalogoResponse>(`${this.baseUrl}/public/telemedicina/catalogo`, {
      params: { loja_slug: lojaSlug },
    });
  }

  createTelemedicinaIntencaoAgendamento(
    token: string,
    body: {
      loja_slug: string;
      pet_id: number;
      vet_ref?: string | null;
      automatico?: boolean;
      slot_inicio: string;
      slot_fim: string;
      motivo?: string | null;
      preco_centavos?: number | null;
    },
  ) {
    return this.http.post<{ id: number; ok: boolean; message?: string }>(
      `${this.baseUrl}/clientes/me/telemedicina/intencoes-agendamento`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  cancelTelemedicinaIntencaoAgendamento(token: string, intencaoId: number) {
    return this.http.patch<{ ok: boolean }>(
      `${this.baseUrl}/clientes/me/telemedicina/intencoes-agendamento/${encodeURIComponent(String(intencaoId))}/cancelar`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  /** Cotação pública Transporte Pet (requer loja_slug; `operacao` = intenção marketplace|estabelecimento). */
  publicTransportePetQuote(lojaSlug: string, params: Record<string, string | number | undefined>) {
    const q: Record<string, string> = { loja_slug: lojaSlug };
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q[k] = String(v);
    }
    return this.http.get<{
      distancia_km: number;
      duracao_min: number;
      pickup_eta_min: number | null;
      online_driver_count: number;
      nearest_driver_distance_km: number | null;
      preco_centavos: number;
      surge_multiplier: number;
      pct_plataforma: number;
      pct_motorista: number;
      breakdown: Record<string, unknown>;
    }>(`${this.baseUrl}/public/transporte-pet/quote`, { params: q });
  }

  /** Posições de motoristas da rede global (mapa público — sem frota privada). */
  getPublicTransportePetGlobalMotoristasMap() {
    return this.http.get<{
      motoristas: Array<{ id: number; lat: number; lng: number; ultima_posicao_em?: string }>;
    }>(`${this.baseUrl}/public/transporte-pet/global-motoristas/map`);
  }

  listClientePets(token: string) {
    return this.http.get<{
      pets: Array<{ id: number; nome: string; apelido?: string; photoURL?: string; porte?: string }>;
    }>(`${this.baseUrl}/clientes/me/pets`, { headers: { Authorization: `Bearer ${token}` } });
  }

  createClienteTransportePetCorrida(
    token: string,
    body: Record<string, unknown> & { loja_slug: string }
  ) {
    return this.http.post<{
      corrida: Record<string, unknown>;
      logistica_request_id?: number;
      logistica_request?: Record<string, unknown>;
    }>(`${this.baseUrl}/clientes/me/transporte-pet/corridas`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  createParceiroTransportePetLogisticaRequest(
    headers: { Authorization: string },
    body: Record<string, unknown>
  ) {
    return this.http.post<{
      corrida: Record<string, unknown>;
      logistica_request?: Record<string, unknown>;
      logistica_request_id?: number;
    }>(`${this.baseUrl}/parceiro/transporte-pet/logistica-requests`, body, { headers });
  }

  checkoutClienteTransportePetCorrida(
    token: string,
    corridaId: number,
    lojaSlug: string,
    operacao: 'marketplace' | 'estabelecimento'
  ) {
    return this.http.post<{ preference_id?: string; payment_url?: string | null; amount?: number }>(
      `${this.baseUrl}/clientes/me/transporte-pet/corridas/${encodeURIComponent(String(corridaId))}/checkout`,
      { loja_slug: lojaSlug, operacao },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Sem `loja_slug` retorna todas as corridas de transporte do tutor (útil para acompanhar marketplace + loja). */
  listClienteTransportePetCorridas(
    token: string,
    lojaSlug?: string,
    operacao?: 'marketplace' | 'estabelecimento'
  ) {
    const params: Record<string, string> = {};
    if (lojaSlug != null && String(lojaSlug).trim() !== '') params['loja_slug'] = String(lojaSlug).trim();
    if (operacao) params['operacao'] = operacao;
    return this.http.get<{ corridas: unknown[] }>(`${this.baseUrl}/clientes/me/transporte-pet/corridas`, {
      ...(Object.keys(params).length ? { params } : {}),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** Painel motorista rede global (PF): cadastro + fila + corridas aceitas. */
  getClienteTransportePetGlobalMotoristaPainel(token: string) {
    return this.http.get<{
      motorista_global: Record<string, unknown> | null;
      corridas_abertas: Record<string, unknown>[];
      corridas_ativas: Record<string, unknown>[];
    }>(`${this.baseUrl}/clientes/me/transporte-pet/global-motorista/painel`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  enrollClienteTransportePetGlobalMotorista(
    token: string,
    body?: { tier?: string; documento_cnh_url?: string }
  ) {
    return this.http.post<{ motorista_global: Record<string, unknown> }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/enroll`,
      body || {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  getClienteTransportePetGlobalMotoristaMe(token: string) {
    return this.http.get<{ motorista_global: Record<string, unknown> }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/me`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** multipart: campos selfie e cnh */
  submitClienteTransportePetGlobalMotoristaKyc(token: string, formData: FormData) {
    return this.http.post<{ motorista_global: Record<string, unknown> }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/kyc-upload`,
      formData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  setClienteTransportePetGlobalMotoristaOnline(token: string, online: boolean) {
    return this.http.post<{ motorista_global: Record<string, unknown> }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/me/online`,
      { online },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  setClienteTransportePetGlobalMotoristaLocation(token: string, lat: number, lng: number) {
    return this.http.post<{ ok: boolean }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/me/location`,
      { lat, lng },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  listClienteTransportePetGlobalMotoristaCorridasAbertas(token: string, limit?: number) {
    const params: Record<string, string> = {};
    if (limit != null) params['limit'] = String(limit);
    return this.http.get<{ corridas: unknown[] }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/corridas/abertas`,
      { params, headers: { Authorization: `Bearer ${token}` } }
    );
  }

  acceptClienteTransportePetGlobalCorrida(token: string, corridaId: number) {
    return this.http.post<{ corrida: unknown }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/corridas/${encodeURIComponent(String(corridaId))}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  advanceClienteTransportePetGlobalCorridaStatus(
    token: string,
    corridaId: number,
    action: 'start_pickup' | 'picked_up' | 'complete'
  ) {
    return this.http.post<{ corrida: unknown }>(
      `${this.baseUrl}/clientes/me/transporte-pet/global-motorista/corridas/${encodeURIComponent(String(corridaId))}/status`,
      { action },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  listParceiroTransportePetCorridas(headers: { Authorization: string }, status?: string) {
    let params: Record<string, string> | undefined;
    if (status) params = { status };
    return this.http.get<{ corridas: any[] }>(`${this.baseUrl}/parceiro/transporte-pet/corridas`, {
      headers,
      params,
    });
  }

  listParceiroTransportePetCorridasAbertas(headers: { Authorization: string }) {
    return this.http.get<{ corridas: any[] }>(`${this.baseUrl}/parceiro/transporte-pet/corridas/abertas`, {
      headers,
    });
  }

  acceptParceiroTransportePetCorrida(headers: { Authorization: string }, corridaId: number) {
    return this.http.post<{ corrida: any }>(
      `${this.baseUrl}/parceiro/transporte-pet/corridas/${encodeURIComponent(String(corridaId))}/accept`,
      {},
      { headers }
    );
  }

  advanceParceiroTransportePetStatus(
    headers: { Authorization: string },
    corridaId: number,
    action: 'start_pickup' | 'picked_up' | 'complete'
  ) {
    return this.http.post<{ corrida: any }>(
      `${this.baseUrl}/parceiro/transporte-pet/corridas/${encodeURIComponent(String(corridaId))}/status`,
      { action },
      { headers }
    );
  }

  setParceiroTransportePetMotoristaOnline(headers: { Authorization: string }, online: boolean) {
    return this.http.post<{ motorista: any }>(
      `${this.baseUrl}/parceiro/transporte-pet/motoristas/me/online`,
      { online },
      { headers }
    );
  }

  setParceiroTransportePetMotoristaLocation(headers: { Authorization: string }, lat: number, lng: number) {
    return this.http.post<{ ok?: boolean }>(
      `${this.baseUrl}/parceiro/transporte-pet/motoristas/me/location`,
      { lat, lng },
      { headers }
    );
  }

  listParceiroTransportePetMotoristas(headers: { Authorization: string }) {
    return this.http.get<{ motoristas: any[] }>(`${this.baseUrl}/parceiro/transporte-pet/motoristas`, { headers });
  }

  listParceiroColaboradores(headers: { Authorization: string }) {
    return this.http.get<{ colaboradores: any[] }>(`${this.baseUrl}/parceiro/colaboradores`, { headers });
  }

  getParceiroTransportePetTarifas(headers: { Authorization: string }) {
    return this.http.get<{ tarifas: Record<string, unknown> }>(`${this.baseUrl}/parceiro/transporte-pet/tarifas`, {
      headers,
    });
  }

  putParceiroTransportePetTarifas(headers: { Authorization: string }, body: Record<string, unknown>) {
    return this.http.put<{ tarifas: Record<string, unknown> }>(`${this.baseUrl}/parceiro/transporte-pet/tarifas`, body, {
      headers,
    });
  }

  createParceiroTransportePetMotorista(
    headers: { Authorization: string },
    body: { parceiro_account_id: number; tier?: string }
  ) {
    return this.http.post<{ motorista: any }>(`${this.baseUrl}/parceiro/transporte-pet/motoristas`, body, { headers });
  }

  getAdminTransportePetStats(token: string) {
    return this.http.get<{
      corridas_ativas: number;
      hoje_completas: number;
      hoje_receita_centavos: number;
      hoje_plataforma_centavos_estimado: number;
      funnel: Record<string, number>;
      sla_7d: { avg_wait_to_accept_min: number | null; n_amostras: number };
      cancelamentos_7d: { total: number; auto_sem_motorista: number };
    }>(`${this.baseUrl}/admin/transporte-pet/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  listAdminTransportePetCorridas(
    token: string,
    opts?: { parceiro_id?: number; limit?: number; status?: string; date_from?: string; date_to?: string }
  ) {
    const params: Record<string, string> = {};
    if (opts?.parceiro_id != null) params['parceiro_id'] = String(opts.parceiro_id);
    if (opts?.limit != null) params['limit'] = String(opts.limit);
    if (opts?.status) params['status'] = opts.status;
    if (opts?.date_from) params['date_from'] = opts.date_from;
    if (opts?.date_to) params['date_to'] = opts.date_to;
    return this.http.get<{ corridas: any[] }>(`${this.baseUrl}/admin/transporte-pet/corridas`, {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
  }

  getPetsByCliente(id: number, token: string) {
    return this.http.get<any[]>(`${this.baseUrl}/clientes/${id}/pets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getVeterinario(id: string, token: string) {
    return this.http.get<Veterinario>(`${this.baseUrl}/vets/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  consultarPedido(codigo: string, token?: string) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(`${this.baseUrl}/pedidos/${encodeURIComponent(codigo)}`, { headers });
  }

  // Pedidos e Pagamentos (checkout)
  criarPedido(token: string, body: any) {
    return this.http.post<any>(`${this.baseUrl}/pedidos`, body, { headers: { Authorization: `Bearer ${token}` } });
  }
  atualizarPedido(
    token: string | null | undefined,
    codigoOuId: string | number,
    body: any,
    opts?: { parceiro_slug?: string | null }
  ) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const search = new URLSearchParams();
    if (opts?.parceiro_slug) search.set('parceiro_slug', String(opts.parceiro_slug));
    const qp = search.toString();
    return this.http.put<any>(`${this.baseUrl}/pedidos/${encodeURIComponent(String(codigoOuId))}${qp ? `?${qp}` : ''}`, body, { headers });
  }

  /** Inicia cobrança no gateway (Preference ou PIX). */
  iniciarPagamentoCheckout(
    token: string | null | undefined,
    pedidoId: string | number,
    body?: { flow?: 'pix' | 'preference'; metodo?: string },
    opts?: { parceiro_slug?: string | null }
  ) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const search = new URLSearchParams();
    if (opts?.parceiro_slug) search.set('parceiro_slug', String(opts.parceiro_slug));
    const qp = search.toString();
    return this.http.post<any>(
      `${this.baseUrl}/pedidos/${encodeURIComponent(String(pedidoId))}/pagamento/iniciar${qp ? `?${qp}` : ''}`,
      body || {},
      { headers }
    );
  }

  criarPagamento(token: string, pedidoCodigo: string | number, body: any) {
    return this.http.post<any>(`${this.baseUrl}/pedidos/${encodeURIComponent(String(pedidoCodigo))}/pagamentos`, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Admin: set order status (admin namespace)
  adminSetOrderStatus(token: string | null | undefined, orderId: string | number, status: string) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post<any>(`${this.baseUrl}/admin/orders/${encodeURIComponent(String(orderId))}/status`, { status }, { headers });
  }

  // Admin: cancel an order with optional reason
  adminCancelOrder(token: string | null | undefined, orderId: string | number, motivo?: string) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post<any>(`${this.baseUrl}/admin/orders/${encodeURIComponent(String(orderId))}/cancelar`, { motivo: motivo || '' }, { headers });
  }

  // Validação de carrinho (preços/estoque) — ajuste a rota conforme seu backend
  validarCarrinho(
    token: string | undefined,
    body: { itens: Array<{ id: number; quantidade: number; item_type?: 'produto' | 'servico' }> },
    opts?: { parceiro_slug?: string | null }
  ) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const search = new URLSearchParams();
    if (opts?.parceiro_slug) search.set('parceiro_slug', String(opts.parceiro_slug));
    const qp = search.toString();
    return this.http.post<any>(`${this.baseUrl}/carrinho/validar${qp ? `?${qp}` : ''}`, body, { headers });
  }

  // Favoritar/Desfavoritar produto (toggle). Backend deve reconhecer o token do cliente.
  // Resposta esperada genérica: { is_favorited?: boolean, favorited?: boolean, favoritos?: number }
  toggleFavorite(productId: number, token: string) {
    return this.http.post<any>(`${this.baseUrl}/produtos/${productId}/favorite`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Criar Pet para um cliente
  createPet(clienteId: number, data: FormData, token: string) {
    return this.http.post<any>(`${this.baseUrl}/clientes/${clienteId}/pets`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Atualizar Pet (PUT)
  updatePet(clienteId: number, petId: string | number, data: FormData, token: string) {
    return this.http.put<any>(`${this.baseUrl}/clientes/${clienteId}/pets/${petId}`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  /**
   * Cria um post na galeria. `formData` aceita múltiplos arquivos no campo `foto`
   * e os campos opcionais `caption`, `pet_ids` (JSON, primeiro id é o pet principal),
   * e `galeria_publica` ('1'|'0').
   */
  createPost(clienteId: number, formData: FormData, token: string) {
    return this.http.post<PostDto>(`${this.baseUrl}/clientes/${clienteId}/posts`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** Excluir pet do cliente. Query opcional para fluxo vet (salvamento_pet_pelo_vet). */
  deletePet(
    clienteId: number,
    petId: string | number,
    token: string,
    query?: { salvamento_pet_pelo_vet?: boolean }
  ) {
    let url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}`;
    if (query?.salvamento_pet_pelo_vet) {
      url += '?salvamento_pet_pelo_vet=true';
    }
    return this.http.delete<{ ok: boolean; id: number }>(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  listPetVacinas(clienteId: number, petId: string | number, token: string) {
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas`;
    return this.http.get<PetVacinaRow[]>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  listPetVacinasCatalogo(
    clienteId: number,
    petId: string | number,
    token: string,
    especie?: string | null
  ) {
    const qp = especie ? `?especie=${encodeURIComponent(String(especie))}` : '';
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas/catalogo${qp}`;
    return this.http.get<PetVacinaCatalogoItem[]>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  getPetVacinasCronograma(
    clienteId: number,
    petId: string | number,
    token: string,
    especie?: string | null
  ) {
    const qp = especie ? `?especie=${encodeURIComponent(String(especie))}` : '';
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas/cronograma${qp}`;
    return this.http.get<PetVacinaCronogramaResponse>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  createPetVacina(clienteId: number, petId: string | number, formData: FormData, token: string) {
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas`;
    return this.http.post<PetVacinaRow>(url, formData, { headers: { Authorization: `Bearer ${token}` } });
  }

  updatePetVacina(
    clienteId: number,
    petId: string | number,
    vacinaId: string | number,
    formData: FormData,
    token: string
  ) {
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas/${encodeURIComponent(String(vacinaId))}`;
    return this.http.put<PetVacinaRow>(url, formData, { headers: { Authorization: `Bearer ${token}` } });
  }

  deletePetVacina(clienteId: number, petId: string | number, vacinaId: string | number, token: string) {
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas/${encodeURIComponent(String(vacinaId))}`;
    return this.http.delete<{ ok: boolean; id: number }>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  validarPetVacina(
    clienteId: number,
    petId: string | number,
    vacinaId: string | number,
    body: { status: 'pendente' | 'validada' | 'rejeitada'; motivo_rejeicao?: string },
    token: string
  ) {
    const url = `${this.baseUrl}/clientes/${clienteId}/pets/${encodeURIComponent(String(petId))}/vacinas/${encodeURIComponent(String(vacinaId))}/validacao`;
    return this.http.post<PetVacinaRow>(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Atualizar Cliente (PUT)
  updateCliente(clienteId: number, body: any, token: string) {
    return this.http.put<any>(`${this.baseUrl}/clientes/${clienteId}`, body, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Deletar cliente (excluir conta)
  deleteCliente(clienteId: number, token: string) {
    return this.http.delete<any>(`${this.baseUrl}/clientes/${clienteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Buscar cliente por CPF (para veterinários)
  buscarClientePorCpf(cpf: string, token: string): Observable<any> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<any>(`${this.baseUrl}/clientes/cpf/${cpfLimpo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  /** Feed público (paginação). Resposta: `{ items, page, pageSize, hasMore, ad? }`. */
  getGaleriaPublica(
    params?: { page?: number; pageSize?: number; parceiro_slug?: string | null },
    token?: string
  ) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.parceiro_slug) search.set('parceiro_slug', String(params.parceiro_slug));
    const qp = search.toString();
    const url = `${this.baseUrl}/pets/galeria-publica${qp ? `?${qp}` : ''}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : (undefined as any);
    return this.http.get<PostListResponse>(url, { headers });
  }

  getPetPerfilPublico(petId: string | number, token?: string) {
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/perfil-publico`;
    const h = token ? { Authorization: `Bearer ${token}` } : (undefined as any);
    return this.http.get<any>(url, { headers: h });
  }

  // ---------------------------------------------------------------------------
  // Posts API (substitui fotos/coleções/imagens individuais)
  // ---------------------------------------------------------------------------

  /** Lista posts de um pet específico (paginado). */
  listPostsByPet(petId: string | number, params?: { page?: number; pageSize?: number }, token?: string) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const qp = search.toString();
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/posts${qp ? `?${qp}` : ''}`;
    const h = token ? { Authorization: `Bearer ${token}` } : (undefined as any);
    return this.http.get<PostListResponse>(url, { headers: h });
  }

  /** Atualiza caption / visibilidade / cover de um post. */
  patchPost(petId: string | number, postId: string | number, body: PostPatchPayload, token: string) {
    return this.http.patch<PostDto>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/posts/${encodeURIComponent(String(postId))}`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Soft-delete do post inteiro. */
  deletePost(petId: string | number, postId: string | number, token: string) {
    return this.http.delete<{ ok: boolean; id: number }>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/posts/${encodeURIComponent(String(postId))}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Remove uma imagem específica do carrossel do post. */
  removePostImage(
    petId: string | number,
    postId: string | number,
    imagemId: string | number,
    token: string
  ) {
    return this.http.delete<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/posts/${encodeURIComponent(
        String(postId)
      )}/imagens/${encodeURIComponent(String(imagemId))}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Define uma imagem do post como capa do pet (atualiza pets.photoURL). */
  setPostImageAsPetCover(
    petId: string | number,
    postId: string | number,
    body: { imagem_id: number },
    token: string
  ) {
    return this.http.post<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/posts/${encodeURIComponent(
        String(postId)
      )}/cover-pet`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  /** Reordena imagens do post (`ordem` = array de imagem IDs na nova ordem). */
  reorderPostImages(
    petId: string | number,
    postId: string | number,
    body: { ordem: number[] },
    token: string
  ) {
    return this.http.post<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/posts/${encodeURIComponent(
        String(postId)
      )}/reorder`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  // Engajamento por POST -------------------------------------------------------

  getPostEngajamento(postId: string | number, token?: string) {
    const url = `${this.baseUrl}/posts/${encodeURIComponent(String(postId))}/engajamento`;
    const h = token ? { Authorization: `Bearer ${token}` } : (undefined as any);
    return this.http.get<PostEngagement>(url, { headers: h });
  }

  postPostReacao(postId: string | number, body: { tipo?: string }, token: string) {
    return this.http.post<any>(
      `${this.baseUrl}/posts/${encodeURIComponent(String(postId))}/reacoes`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  deletePostReacao(postId: string | number, token: string) {
    return this.http.delete<any>(
      `${this.baseUrl}/posts/${encodeURIComponent(String(postId))}/reacoes`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  getPostComentarios(postId: string | number, params?: { page?: number; pageSize?: number }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const qp = search.toString();
    return this.http.get<any>(
      `${this.baseUrl}/posts/${encodeURIComponent(String(postId))}/comentarios${qp ? `?${qp}` : ''}`
    );
  }

  postPostComentario(postId: string | number, comentario: string, token: string) {
    return this.http.post<any>(
      `${this.baseUrl}/posts/${encodeURIComponent(String(postId))}/comentarios`,
      { comentario },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  deletePostComentario(postId: string | number, commentId: string | number, token: string) {
    return this.http.delete<any>(
      `${this.baseUrl}/posts/${encodeURIComponent(String(postId))}/comentarios/${encodeURIComponent(
        String(commentId)
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  // Reações em pets
  postPetReaction(petId: string | number, body: { tipo?: string; comentario?: string }, token?: string) {
    // Defensive: do not attempt to send reactions without an auth token
    if (!token) {
      return throwError(() => new Error('Missing auth token'));
    }
    const headers = { Authorization: `Bearer ${token}` } as any;
    return this.http.post<any>(`${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/reacoes`, body, { headers });
  }

  deletePetReaction(petId: string | number, body?: { tipo?: string }, token?: string) {
    // Defensive: require token for deleting reactions as well
    if (!token) {
      return throwError(() => new Error('Missing auth token'));
    }
    const headers = { Authorization: `Bearer ${token}` } as any;
    // some backends accept body on DELETE; HttpClient allows it via options.body
    return this.http.request<any>('delete', `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/reacoes`, { headers, body: body || undefined });
  }

  // Comentários públicos de pets
  getPetComentarios(petId: string | number, params?: { page?: number; pageSize?: number }, token?: string) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const qp = search.toString();
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/comentarios${qp ? `?${qp}` : ''}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers });
  }

  postPetComentario(petId: string | number, comentario: string, token: string) {
    if (!token) {
      return throwError(() => new Error('Missing auth token'));
    }
    const headers = { Authorization: `Bearer ${token}` } as any;
    return this.http.post<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/comentarios`,
      { comentario },
      { headers }
    );
  }

  deletePetComentario(petId: string | number, commentId: string | number, token: string) {
    if (!token) {
      return throwError(() => new Error('Missing auth token'));
    }
    const headers = { Authorization: `Bearer ${token}` } as any;
    return this.http.delete<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/comentarios/${encodeURIComponent(String(commentId))}`,
      { headers }
    );
  }

  // Buscar cliente com pets incluídos
  buscarClienteComPets(cpf: string, token: string): Observable<any> {
    const cpfLimpo = cpf.replace(/\D/g, '');
    return this.http.get<any>(`${this.baseUrl}/clientes/cpf/${cpfLimpo}?include=pets`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Meus pedidos (cliente autenticado) — com filtros, paginação e include=details
  listMyOrders(
    token: string,
    params?: {
      page?: number; pageSize?: number;
      status?: string; pagamento_status?: string; pagamento_forma?: string;
      from?: string; to?: string; q?: string; include?: 'details' | 'all';
    }
  ): Observable<{
    data: any[];
    page: number; pageSize: number; total: number; totalPages: number;
  }> {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.status) search.set('status', params.status);
    if (params?.pagamento_status) search.set('pagamento_status', params.pagamento_status);
    if (params?.pagamento_forma) search.set('pagamento_forma', params.pagamento_forma);
    if (params?.from) search.set('from', params.from);
    if (params?.to) search.set('to', params.to);
    if (params?.q) search.set('q', params.q);
    if (params?.include) search.set('include', params.include);
    const qp = search.toString();
    const url = `${this.baseUrl}/clientes/me/pedidos${qp ? `?${qp}` : ''}`;
    return this.http.get<{ data: any[]; page: number; pageSize: number; total: number; totalPages: number }>(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  listMyOrderSolicitacoes(token: string, pedidoId: number | string): Observable<any[]> {
    const headers = { Authorization: `Bearer ${token}` } as any;
    return this.http.get<any[]>(
      `${this.baseUrl}/clientes/me/pedidos/${encodeURIComponent(String(pedidoId))}/solicitacoes`,
      { headers }
    );
  }

  createMyOrderSolicitacao(
    token: string,
    pedidoId: number | string,
    body: { tipo: string; mensagem: string }
  ): Observable<any> {
    const headers = { Authorization: `Bearer ${token}` } as any;
    return this.http.post<any>(
      `${this.baseUrl}/clientes/me/pedidos/${encodeURIComponent(String(pedidoId))}/solicitacoes`,
      body,
      { headers }
    );
  }

  getAdminPedidoSolicitacoes(
    token: string | null | undefined,
    params?: { page?: number; pageSize?: number; status?: string; tipo?: string }
  ): Observable<{ data: any[]; page: number; pageSize: number; total: number; totalPages: number }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.status) search.set('status', params.status);
    if (params?.tipo) search.set('tipo', params.tipo);
    const qp = search.toString();
    const url = `${this.baseUrl}/admin/pedidos/solicitacoes${qp ? `?${qp}` : ''}`;
    return this.http.get<any>(url, { headers });
  }

  patchAdminPedidoSolicitacao(
    token: string | null | undefined,
    id: number | string,
    body: { status?: string; admin_notas?: string | null }
  ): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.patch<any>(
      `${this.baseUrl}/admin/pedidos/solicitacoes/${encodeURIComponent(String(id))}`,
      body,
      { headers }
    );
  }

  // Lista predefinida de alergias
  getListaAlergias(token: string, q?: string): Observable<AlergiaLookup[]> {
    const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    return this.http.get<AlergiaLookup[]>(`${this.baseUrl}/get_lista_alergias${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  getListaPetTraits(token: string, q?: string, categoria?: string): Observable<PetTraitLookup[]> {
    const search = new URLSearchParams();
    if (q && q.trim()) search.set('q', q.trim());
    if (categoria && String(categoria).trim()) search.set('categoria', String(categoria).trim());
    const qs = search.toString();
    return this.http.get<PetTraitLookup[]>(`${this.baseUrl}/get_lista_pet_traits${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  // Checa alergias de um pet em relação a uma lista de produtos do carrinho
  // Endpoint sugerido: POST /pets/:petId/alergias/check  -> body: { produto_ids: number[] }
  checarAlergiasPet(petId: string | number, produtoIds: number[], token?: string) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/alergias/check`;
    return this.http.post<any>(url, { produto_ids: produtoIds }, { headers });
  }

  // Receitas - histórico do vet autenticado
  getReceitas(token: string, params?: {
    page?: number;
    pageSize?: number;
    pet_id?: number | string;
    cliente_id?: number | string;
    ativo_id?: number | string;
    from?: string;
    to?: string;
    q?: string;
    availableOnly?: boolean; // somente receitas não usadas (ex.: carrinho)
    context?: string;        // contexto do uso (ex.: 'carrinho')
  }): Observable<PagedReceitasResponse> {
    const search = new URLSearchParams();
    if (params) {
      if (params.page) search.set('page', String(params.page));
      if (params.pageSize) search.set('pageSize', String(params.pageSize));
      if (params.pet_id) search.set('pet_id', String(params.pet_id));
      if (params.cliente_id) search.set('cliente_id', String(params.cliente_id));
      if (params.ativo_id) search.set('ativo_id', String(params.ativo_id));
      if (params.from) search.set('from', params.from);
      if (params.to) search.set('to', params.to);
      if (params.q) search.set('q', params.q);
      if (params.availableOnly) search.set('availableOnly', '1');
      if (params.context) search.set('context', params.context);
    }
    const qp = search.toString();
    const url = `${this.baseUrl}/receitas${qp ? `?${qp}` : ''}`;
    return this.http.get<PagedReceitasResponse>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  getReceitaById(token: string, id: number | string): Observable<Receita> {
    return this.http.get<Receita>(`${this.baseUrl}/receitas/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Pacientes
  getPacientes(token: string, params?: { page?: number; pageSize?: number; q?: string }): Observable<PagedPacientesResponse> {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.q) search.set('q', params.q);
    const qp = search.toString();
    const url = `${this.baseUrl}/pacientes${qp ? `?${qp}` : ''}`;
    return this.http.get<PagedPacientesResponse>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  getPacienteById(token: string, petId: number | string): Observable<PacienteDetail> {
    return this.http.get<PacienteDetail>(`${this.baseUrl}/pacientes/${petId}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Endereços do cliente (suportado por backend; se indisponível, o caller deve tratar gracefully)
  listEnderecosCliente(token: string): Observable<any[]> {
    const url = `${this.baseUrl}/clientes/me/enderecos`;
    return this.http.get<any[]>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  createEnderecoCliente(token: string, body: {
    cep: string; logradouro: string; numero: string; complemento?: string;
    bairro: string; cidade: string; estado: string; nome?: string; tipo?: string;
  }): Observable<any> {
    const url = `${this.baseUrl}/clientes/me/enderecos`;
    return this.http.post<any>(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  updateEnderecoCliente(token: string, id: string | number, body: {
    cep?: string; logradouro?: string; numero?: string; complemento?: string;
    bairro?: string; cidade?: string; estado?: string; nome?: string; tipo?: string;
  }): Observable<any> {
    const url = `${this.baseUrl}/clientes/me/enderecos/${id}`;
    return this.http.put<any>(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  deleteEnderecoCliente(token: string, id: string | number): Observable<any> {
    const url = `${this.baseUrl}/clientes/me/enderecos/${id}`;
    return this.http.delete<any>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Payment methods (cards) - cliente tokenized card management
  listMyCards(token: string): Observable<any[]> {
    const url = `${this.baseUrl}/clientes/me/cartoes`;
    return this.http.get<any[]>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  createCard(token: string, body: any) {
    const url = `${this.baseUrl}/clientes/me/cartoes`;
    return this.http.post<any>(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  updateCard(token: string, id: string | number, body: any) {
    const url = `${this.baseUrl}/clientes/me/cartoes/${encodeURIComponent(String(id))}`;
    return this.http.put<any>(url, body, { headers: { Authorization: `Bearer ${token}` } });
  }

  deleteCard(token: string, id: string | number) {
    const url = `${this.baseUrl}/clientes/me/cartoes/${encodeURIComponent(String(id))}`;
    return this.http.delete<any>(url, { headers: { Authorization: `Bearer ${token}` } });
  }

  // Cálculo de frete (caso o backend exista)
  cotarFrete(
    token: string | undefined,
    payload: { cep: string; itens: Array<{ id: number; qtd: number; preco?: number; item_type?: 'produto' | 'servico' }> },
    opts?: { parceiro_slug?: string | null }
  ): Observable<{ valor: number; prazo?: string }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const search = new URLSearchParams();
    if (opts?.parceiro_slug) search.set('parceiro_slug', String(opts.parceiro_slug));
    const qp = search.toString();
    const url = `${this.baseUrl}/frete/cotar${qp ? `?${qp}` : ''}`;
    return this.http.post<{ valor: number; prazo?: string }>(url, payload, { headers });
  }

  // CEP lookups em APIs públicas gratuitas
  buscarCepViaCep(cep: string): Observable<any> {
    const clean = (cep || '').replace(/\D/g, '');
    return this.http.get(`https://viacep.com.br/ws/${clean}/json/`);
  }

  buscarCepBrasilAPI(cep: string): Observable<any> {
    const clean = (cep || '').replace(/\D/g, '');
    return this.http.get(`https://brasilapi.com.br/api/cep/v1/${clean}`);
  }

  // Geocode an address using Nominatim (OpenStreetMap) — returns an array of results
  geocodeAddress(address: string): Observable<any[]> {
    try {
      const q = encodeURIComponent((address || '').trim() + ' Brasil');
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
      return this.http.get<any[]>(url).pipe(catchError(() => of([])));
    } catch (e) {
      return of([]);
    }
  }

  // Public maps endpoint: returns partners, professional types, and mapsApiKey
  getMaps(): Observable<{ partners: any[]; tipos?: any[]; mapsApiKey?: string | null }> {
    const url = `${this.baseUrl}/maps`;
    return this.http.get<{ partners: any[]; tipos?: any[]; mapsApiKey?: string | null }>(url).pipe(
      catchError((err) => {
        // If the call to configured baseUrl fails (common in local dev when
        // backend runs on another port), try a same-host fallback to port 4000.
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/maps`;
            return this.http.get<{ partners: any[]; tipos?: any[]; mapsApiKey?: string | null }>(fallback).pipe(
              catchError(() => of({ partners: [], mapsApiKey: null }))
            );
          } catch (e) {
            return of({ partners: [], mapsApiKey: null });
          }
        }
        return of({ partners: [], mapsApiKey: null });
      }) as any
    );
  }

  getPetsphereMapLayer(tipo?: string | number): Observable<PetsphereMapLayerResponse> {
    const search = new URLSearchParams();
    if (tipo != null) search.set('tipo', String(tipo));
    const qp = search.toString();
    const url = `${this.baseUrl}/maps/layers/petsphere${qp ? `?${qp}` : ''}`;
    return this.http.get<PetsphereMapLayerResponse>(url).pipe(
      catchError(() => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/maps/layers/petsphere${qp ? `?${qp}` : ''}`;
            return this.http.get<PetsphereMapLayerResponse>(fallback).pipe(
              catchError(() => of({ source: 'petsphere', sourceLabel: 'PetSphere', disclaimer: '', items: [], tipos: [] }))
            );
          } catch (e) {
            return of({ source: 'petsphere', sourceLabel: 'PetSphere', disclaimer: '', items: [], tipos: [] });
          }
        }
        return of({ source: 'petsphere', sourceLabel: 'PetSphere', disclaimer: '', items: [], tipos: [] });
      }) as any
    );
  }

  /** Geocodificação via Nominatim (proxy no backend — OpenStreetMap). */
  osmGeocodeAddress(q: string): Observable<{
    results: Array<{ lat: number | null; lon: number | null; display_name: string | null }>;
  }> {
    return this.http.get<{
      results: Array<{ lat: number | null; lon: number | null; display_name: string | null }>;
    }>(`${this.baseUrl}/maps/osm-geocode`, { params: { q } });
  }

  searchGoogleMapPlaces(params: {
    q: string;
    lat?: number | null;
    lng?: number | null;
    radiusMeters?: number;
    pageSize?: number;
  }): Observable<GooglePlacesResponse> {
    const search = new URLSearchParams();
    search.set('q', params.q);
    if (typeof params.lat === 'number') search.set('lat', String(params.lat));
    if (typeof params.lng === 'number') search.set('lng', String(params.lng));
    if (typeof params.radiusMeters === 'number') search.set('radiusMeters', String(params.radiusMeters));
    if (typeof params.pageSize === 'number') search.set('pageSize', String(params.pageSize));
    const qp = search.toString();
    const url = `${this.baseUrl}/maps/google/search?${qp}`;
    return this.http.get<GooglePlacesResponse>(url).pipe(
      catchError(() => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/maps/google/search?${qp}`;
            return this.http.get<GooglePlacesResponse>(fallback).pipe(
              catchError(() => of({ source: 'google', sourceLabel: 'Google Maps', disclaimer: '', items: [] }))
            );
          } catch (e) {
            return of({ source: 'google', sourceLabel: 'Google Maps', disclaimer: '', items: [] });
          }
        }
        return of({ source: 'google', sourceLabel: 'Google Maps', disclaimer: '', items: [] });
      }) as any
    );
  }

  getGoogleMapPlaceDetails(placeId: string): Observable<GooglePlaceDetailsResponse | null> {
    const safePlaceId = encodeURIComponent(String(placeId || '').trim());
    const url = `${this.baseUrl}/maps/google/details/${safePlaceId}`;
    return this.http.get<GooglePlaceDetailsResponse>(url).pipe(
      catchError(() => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/maps/google/details/${safePlaceId}`;
            return this.http.get<GooglePlaceDetailsResponse>(fallback).pipe(catchError(() => of(null)));
          } catch (e) {
            return of(null);
          }
        }
        return of(null);
      }) as any
    );
  }

  createGooglePlaceClaimIntent(payload: {
    placeId: string;
    nome: string;
    endereco?: string | null;
    telefone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    websiteUrl?: string | null;
    tipoPrimario?: string | null;
  }): Observable<GoogleClaimIntentResponse | null> {
    const url = `${this.baseUrl}/maps/google/claim-intent`;
    return this.http.post<GoogleClaimIntentResponse>(url, payload).pipe(
      catchError(() => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/maps/google/claim-intent`;
            return this.http.post<GoogleClaimIntentResponse>(fallback, payload).pipe(catchError(() => of(null)));
          } catch (e) {
            return of(null);
          }
        }
        return of(null);
      }) as any
    );
  }

  // Fetch registered professional types used by the mapa page to build tabs
  getProfessionalTypes(): Observable<{ types: Array<{ id: string; nome?: string; label?: string }> }> {
    const url = `${this.baseUrl}/tipos-profissionais`;
    return this.http.get<{ types: Array<{ id: string; nome?: string; label?: string }> }>(url).pipe(
      catchError((err) => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/tipos-profissionais`;
            return this.http.get<{ types: Array<{ id: string; nome?: string; label?: string }> }>(fallback).pipe(
              catchError(() => of({ types: [] }))
            );
          } catch (e) {
            return of({ types: [] });
          }
        }
        return of({ types: [] });
      }) as any
    );
  }

  // Anunciantes (public listing). Optional `tipo` filters by professional type id.
  getAnunciantes(tipo?: string | number): Observable<any[]> {
    const search = new URLSearchParams();
    if (tipo != null) search.set('tipo', String(tipo));
    const qp = search.toString();
    const url = `${this.baseUrl}/anunciantes${qp ? `?${qp}` : ''}`;
    return this.http.get<any[]>(url).pipe(
      catchError((err) => {
        // same-host fallback for local dev
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/anunciantes${qp ? `?${qp}` : ''}`;
            return this.http.get<any[]>(fallback).pipe(catchError(() => of([])));
          } catch (e) {
            return of([]);
          }
        }
        return of([]);
      }) as any
    );
  }

  // Get single anunciante with atributos+valores
  getAnuncianteById(id: string | number): Observable<any> {
    const url = `${this.baseUrl}/anunciantes/${encodeURIComponent(String(id))}`;
    return this.http.get<any>(url).pipe(
      catchError(() => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/anunciantes/${encodeURIComponent(String(id))}`;
            return this.http.get<any>(fallback).pipe(catchError(() => of(null)));
          } catch (e) {
            return of(null);
          }
        }
        return of(null);
      }) as any
    );
  }

  // Get only atributos+valores array for an anunciante
  getAnuncianteValores(id: string | number): Observable<any[]> {
    const url = `${this.baseUrl}/anunciantes/${encodeURIComponent(String(id))}/valores`;
    return this.http.get<any[]>(url).pipe(
      catchError(() => {
        if (typeof window !== 'undefined') {
          try {
            const fallback = `${window.location.protocol}//${window.location.hostname}:4000/anunciantes/${encodeURIComponent(String(id))}/valores`;
            return this.http.get<any[]>(fallback).pipe(catchError(() => of([])));
          } catch (e) {
            return of([]);
          }
        }
        return of([]);
      }) as any
    );
  }

  // =========================
  // Notifications
  // =========================
  listNotifications(token: string | null | undefined, params?: { page?: number; pageSize?: number; unread?: boolean; tipo?: string }): Observable<{ data: any[]; page: number; pageSize: number; total: number; totalPages: number; unread: number }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.unread) search.set('unread', '1');
    if (params?.tipo) search.set('tipo', params.tipo);
    const qp = search.toString();
    const url = `${this.baseUrl}/notificacoes${qp ? `?${qp}` : ''}`;
    return this.http.get<any>(url, { headers });
  }

  getUnreadCount(token: string | null | undefined): Observable<{ unread: number }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<{ unread: number }>(`${this.baseUrl}/notificacoes/unread-count`, { headers });
  }

  markNotificationRead(token: string | null | undefined, id: number | string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post<any>(`${this.baseUrl}/notificacoes/${encodeURIComponent(String(id))}/lida`, {}, { headers });
  }

  markAllNotificationsRead(token: string | null | undefined): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.post<any>(`${this.baseUrl}/notificacoes/marcar-todas-lidas`, {}, { headers });
  }

  deleteNotification(token: string | null | undefined, id: number | string): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.delete<any>(`${this.baseUrl}/notificacoes/${encodeURIComponent(String(id))}`, { headers });
  }

  // =========================
  // Admin Home Overview
  // =========================
  getAdminHomeOverview(token: string | null | undefined): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(`${this.baseUrl}/admin/home-overview`, { headers });
  }

  /** Resumo da vitrine do parceiro (fila de pedidos + KPIs + vendas 7d), escopo parceiro_id. */
  getParceiroHomeOverview(token: string | null | undefined): Observable<any> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(`${this.baseUrl}/parceiro/home-overview`, { headers });
  }

  /** Agregados de GMV / taxa prevista / líquido previsto (pedidos pagos do parceiro). */
  getParceiroFinanceiroResumo(
    token: string | null | undefined,
    params?: { desde?: string; ate?: string }
  ): Observable<{
    periodo: { desde: string | null; ate: string | null };
    total_vendido: number;
    taxa_plataforma_prevista: number;
    liquido_parceiro_previsto: number;
    pedidos_pagos: number;
  }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : (undefined as any);
    let url = `${this.baseUrl}/parceiro/financeiro-resumo`;
    if (params?.desde || params?.ate) {
      const q = new URLSearchParams();
      if (params.desde) q.set('desde', params.desde);
      if (params.ate) q.set('ate', params.ate);
      url += `?${q.toString()}`;
    }
    return this.http.get<any>(url, { headers });
  }

  /** Endereço principal do parceiro logado (panorama / mapa). */
  getMeuEnderecoParceiro(token: string | null | undefined): Observable<{
    endereco_texto: string | null;
    latitude: number | null;
    longitude: number | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
  }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(`${this.baseUrl}/parceiro/perfil/endereco`, { headers });
  }

  /** Preferências do panorama (valores padrão por parceiro). */
  getPanoramaPreferencias(token: string | null | undefined): Observable<{
    saved?: boolean;
    valor_por_km: number;
    valor_consulta: number;
    taxa_adicional: number;
    desconto_percent: number;
    forma_pagamento: string | null;
  }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(`${this.baseUrl}/parceiro/panorama/preferencias`, { headers });
  }

  putPanoramaPreferencias(
    token: string | null | undefined,
    body: {
      valor_por_km?: number;
      valor_consulta?: number;
      taxa_adicional?: number;
      desconto_percent?: number;
      forma_pagamento?: string | null;
    }
  ): Observable<{ ok: boolean }> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.put<any>(`${this.baseUrl}/parceiro/panorama/preferencias`, body, { headers });
  }
}
