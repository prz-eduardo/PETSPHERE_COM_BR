import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, switchMap, throwError } from 'rxjs';

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

export interface ClienteGaleriaFoto {
  id: number;
  pet_imagem_id: number;
  pet_id?: number;
  url: string;
  ativo?: number | boolean;
  created_at?: string;
  pet_ids?: number[];
  pets?: Array<{ id: number; nome: string; especie?: string; raca?: string }>;
}

export interface PetImagemPatchPayload {
  colecao_id?: number | null;
  ordem?: number;
  legenda?: string | null;
  galeria_publica?: boolean | number;
}

export interface AlergiaLookup {
  alergia_id: string | number;
  ativo_id?: string | number;
  nome: string;
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
    exameFisico?: string;
    diagnostico?: string;
    planoTerapeutico?: string;
    observacoes?: string;
    examesSolicitados?: AtendimentoExamePayload[];
    fotos?: AtendimentoFotoPayload[];
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
  ativos_mais_usados: TopAtivoUso[]; // top 10
  ultimas_receitas: Receita[]; // até 5 últimas com itens
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

  getMinhaGaleriaFotos(token: string) {
    return this.http.get<ClienteGaleriaFoto[]>(`${this.baseUrl}/clientes/me/galeria-fotos`, {
      headers: { Authorization: `Bearer ${token}` }
    }).pipe(
      catchError((err) => {
        if (err?.status !== 404) return throwError(() => err);
        return this.getClienteMe(token).pipe(
          switchMap((me) => {
            const clienteId = Number(me?.user?.id ?? 0);
            if (!clienteId) return of([] as ClienteGaleriaFoto[]);
            return this.getPetsByCliente(clienteId, token).pipe(
              map((pets: any[] | null | undefined) => this.mapMinhaGaleriaFotosFromPets(pets))
            );
          })
        );
      })
    );
  }

  listMyTelemedicina(token: string) {
    return this.http.get<{ consultas: TelemedicinaConsulta[] }>(
      `${this.baseUrl}/clientes/me/telemedicina`,
      { headers: { Authorization: `Bearer ${token}` } }
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

  private mapMinhaGaleriaFotosFromPets(pets: any[] | null | undefined): ClienteGaleriaFoto[] {
    const fotos = new Map<number, ClienteGaleriaFoto>();

    for (const pet of Array.isArray(pets) ? pets : []) {
      const petId = Number(pet?.id);
      const petResumo = {
        id: petId,
        nome: pet?.nome || '',
        especie: pet?.especie,
        raca: pet?.raca,
      };

      for (const imagem of Array.isArray(pet?.galeria_imagens) ? pet.galeria_imagens : []) {
        const imagemId = Number(imagem?.id ?? imagem?.pet_imagem_id);
        const url = typeof imagem?.url === 'string' ? imagem.url.trim() : '';
        if (!imagemId || !url) continue;

        const existente = fotos.get(imagemId);
        if (existente) {
          const petIds = new Set<number>([...(existente.pet_ids || []), petId].filter((id) => !isNaN(id) && id > 0));
          const petsLista = [...(existente.pets || [])];
          if (petId > 0 && !petsLista.some((item) => Number(item?.id) === petId)) {
            petsLista.push(petResumo);
          }
          existente.pet_ids = [...petIds];
          existente.pets = petsLista;
          if (!existente.pet_id && petId > 0) existente.pet_id = petId;
          continue;
        }

        fotos.set(imagemId, {
          id: imagemId,
          pet_imagem_id: imagemId,
          pet_id: petId > 0 ? petId : undefined,
          url,
          ativo: imagem?.ativo,
          created_at: imagem?.created_at,
          pet_ids: petId > 0 ? [petId] : [],
          pets: petId > 0 ? [petResumo] : [],
        });
      }
    }

    return [...fotos.values()].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (b.id || 0) - (a.id || 0);
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

  /** Posta uma foto na galeria com um ou mais pets (campo `foto` + `pet_ids` JSON no FormData). */
  postGaleriaFoto(clienteId: number, formData: FormData, token: string) {
    return this.http.post<any>(`${this.baseUrl}/clientes/${clienteId}/galeria-fotos`, formData, {
      headers: { Authorization: `Bearer ${token}` }
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

  // Galeria pública de pets (paginação)
  // Accepts optional token so callers can request the gallery as an authenticated user
  getGaleriaPublica(params?: { page?: number; pageSize?: number; parceiro_slug?: string | null }, token?: string) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    if (params?.parceiro_slug) search.set('parceiro_slug', String(params.parceiro_slug));
    const qp = search.toString();
    const url = `${this.baseUrl}/pets/galeria-publica${qp ? `?${qp}` : ''}`;
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers });
  }

  getPetPerfilPublico(petId: string | number, token?: string) {
    const url = `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/perfil-publico`;
    const h = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers: h });
  }

  getFotoEngajamento(imagemId: string | number, token?: string) {
    const url = `${this.baseUrl}/pets/fotos/${encodeURIComponent(String(imagemId))}/engajamento`;
    const h = token ? { Authorization: `Bearer ${token}` } : undefined as any;
    return this.http.get<any>(url, { headers: h });
  }

  postFotoReacao(imagemId: string | number, body: { tipo?: string; comentario?: string }, token: string) {
    return this.http.post<any>(`${this.baseUrl}/pets/fotos/${encodeURIComponent(String(imagemId))}/reacoes`, body, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  deleteFotoReacao(imagemId: string | number, body: { tipo?: string } | undefined, token: string) {
    return this.http.request<any>(
      'delete',
      `${this.baseUrl}/pets/fotos/${encodeURIComponent(String(imagemId))}/reacoes`,
      { headers: { Authorization: `Bearer ${token}` }, body: body || undefined }
    );
  }

  getFotoComentarios(imagemId: string | number, params?: { page?: number; pageSize?: number }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const qp = search.toString();
    return this.http.get<any>(`${this.baseUrl}/pets/fotos/${encodeURIComponent(String(imagemId))}/comentarios${qp ? `?${qp}` : ''}`);
  }

  postFotoComentario(imagemId: string | number, comentario: string, token: string) {
    return this.http.post<any>(
      `${this.baseUrl}/pets/fotos/${encodeURIComponent(String(imagemId))}/comentarios`,
      { comentario },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  deleteFotoComentario(imagemId: string | number, commentId: string | number, token: string) {
    return this.http.delete<any>(
      `${this.baseUrl}/pets/fotos/${encodeURIComponent(String(imagemId))}/comentarios/${encodeURIComponent(String(commentId))}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  listPetColecoes(petId: string | number, token: string) {
    return this.http.get<any[]>(`${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/colecoes`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  createPetColecao(petId: string | number, body: { titulo: string }, token: string) {
    return this.http.post<any>(`${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/colecoes`, body, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  deletePetColecao(petId: string | number, colecaoId: string | number, token: string) {
    return this.http.delete<any>(`${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/colecoes/${encodeURIComponent(String(colecaoId))}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  patchPetColecao(petId: string | number, colecaoId: string | number, body: { titulo: string }, token: string) {
    return this.http.patch<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/colecoes/${encodeURIComponent(String(colecaoId))}`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }

  patchPetImagem(petId: string | number, imagemId: string | number, body: PetImagemPatchPayload, token: string) {
    return this.http.patch<any>(
      `${this.baseUrl}/pets/${encodeURIComponent(String(petId))}/imagens/${encodeURIComponent(String(imagemId))}`,
      body,
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
}
