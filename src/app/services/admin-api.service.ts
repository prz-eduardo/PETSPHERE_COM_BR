import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SessionService } from './session.service';
import { RastreioDashboardDto } from '../pages/restrito/admin/rastreio/models/rastreio-dashboard.model';
import { BannerPosition } from '../shared/banner/banner-positions';

export type TaxonomyType = 'categorias' | 'tags' | 'dosages' | 'embalagens';

export interface ProdutoVarianteDto {
  id?: number | null;
  nome: string;
  sku?: string | null;
  preco?: number | null;
  preco_de?: number | null;
  estoque?: number | null;
  peso_g?: number | null;
  ativo?: number | boolean;
  posicao?: number | null;
}

export interface ProdutoDocumentoDto {
  id?: number | null;
  nome: string;
  url: string;
  tipo?: 'ficha_tecnica' | 'bula' | 'certificado' | 'outro' | string | null;
  posicao?: number | null;
}

export interface ProdutoDto {
  id?: string | number;
  // Aliases to support newer backend fields
  nome?: string; // alias of name
  preco?: number | string; // alias of price
  name: string;
  description: string;
  price: number;
  image?: string | null;
  category: string;
  customizations: { dosage: string[]; packaging: string[] };
  discount?: number | null;
  rating?: number | null;
  stock?: number | null;
  tags: string[];
  weightValue?: number | null;
  weightUnit?: string | null;
  // Identificação expandida
  sku?: string | null;
  marca?: string | null;
  codigo_barras?: string | null;
  // Conteúdo técnico
  composicao?: string | null;
  modo_uso?: string | null;
  indicacoes?: string | null;
  contraindicacoes?: string | null;
  // Regulatório
  exige_receita?: number | boolean | null;
  validade_meses?: number | null;
  armazenamento?: string | null;
  registro_mapa?: string | null;
  // SEO
  slug?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image_url?: string | null;
  // Preço avançado
  preco_custo?: number | null;
  preco_de?: number | null;
  parcelas_max?: number | null;
  // Mídia extra
  video_url?: string | null;
  // Associação opcional com um ativo (pode ser null ou ausente)
  ativoId?: string | number | null;
  // Se vinculado a um ativo, a associação deve ser feita a um lote do estoque
  estoqueId?: string | number | null;
  // Forma farmacêutica opcional
  formId?: number | null;
  active?: number; // 1 ativo, 0 inativo
  /** Destaque na home (produtos_marketplace.destaque_home) */
  destaque_home?: 0 | 1;
  // Coleções relacionadas (quando vindas do GET completo)
  variantes?: ProdutoVarianteDto[];
  documentos?: ProdutoDocumentoDto[];
  promotions?: any[];
  promo_price?: number | null;
  created_at?: string;
  updated_at?: string;
  /** Layout do card na vitrine pública */
  card_layout?: 'sales' | 'banner';
}

export interface LojaTemaDto {
  id?: number;
  nome: string;
  slug?: string;
  ativo?: boolean;
  is_preset?: boolean;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// Tipos auxiliares para novo modelo
export interface UnitDto {
  code: string;
  name: string;
  kind: 'mass' | 'volume' | 'count' | 'other';
  factor_to_base: number;
}

export interface ProductFormDto { id: number; name: string }

export interface EstoqueAtivoDto {
  id: number;
  ativo_id: number;
  quantity: number;
  unit_code: string;
  lote?: string | null;
  validade?: string | null;
  location?: string | null;
  active?: number;
  created_at?: string;
  // Enriquecimentos
  ativo_nome?: string;
  unit_name?: string;
  kind?: 'mass' | 'volume' | 'count' | 'other';
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
  nota_fiscal?: string | null;
  preco_unit?: number | null;
  preco_por_kg?: number | null;
  // Fatores de conversão opcionalmente retornados no availability
  f_stock?: number | null;
  f_req?: number | null;
  // Suporte a insumos no estoque
  insumo_id?: number | null;
  insumo_nome?: string | null;
  tipo?: 'ativo' | 'insumo';
}

export interface EstoqueMovimentoDto {
  id: number;
  ativo_id: number;
  estoque_id: number | null;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantity: number;
  unit_code: string;
  reason?: string | null;
  created_at: string;
  fornecedor_id?: number | null;
  fornecedor_nome?: string | null;
  preco_unit?: number | null;
  preco_por_kg?: number | null;
}

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Pessoas (Usuários/Clientes/Vets)
export interface PessoaDto {
  id: number | string;
  uid?: string;
  // Unificado: backend usa 'nome', manter alias 'name' para front
  name?: string | null;
  nome?: string | null;
  email?: string | null;
  phone?: string | null;
  telefone?: string | null;
  city?: string | null;
  uf?: string | null;
  cpf?: string | null;
  // Role is flexible (admin, funcionario, super, etc.)
  role?: string;
  // Areas/permissions the admin user can manage (e.g. ['pedidos','produtos'])
  areas?: string[];
  // flag for super user
  is_super?: 0 | 1;
  tipo?: 'cliente' | 'vet' | 'admin';
  active?: 0 | 1;
  ativo?: 0 | 1;
  /** Motivo da inativação (admin), quando ativo = 0 */
  inativacao_motivo?: string | null;
  created_at?: string;
  updated_at?: string;
  // Vet extras
  crmv?: string | null;
  verification_status?: 'pending' | 'approved' | 'rejected' | null;
  approved?: 0 | 1;
}
export interface PessoaDocDto {
  id: number | string;
  tipo: 'rg' | 'cpf' | 'crmv' | 'comprovante' | 'outro';
  url: string;
  mime_type?: string | null;
  uploaded_at?: string;
}

/** Pet na lista admin (moderação galeria). */
export interface AdminPetRow {
  id: number;
  nome: string;
  photoURL?: string | null;
  cliente_id: number;
  exibir_galeria_publica?: number | boolean | null;
  aprovado_por_admin?: number | boolean | null;
  created_at?: string;
  sexo?: string | null;
  idade?: number | null;
  especie?: string | null;
  raca?: string | null;
  tutor_nome?: string | null;
  tutor_email?: string | null;
  /** Quantidade de linhas em pet_imagens (quando migração aplicada). */
  imagens_count?: number | null;
}

export interface FornecedorDto { id: number; nome: string }
export interface InsumoDto {
  id: number;
  nome: string;
  descricao?: string | null;
  unit_code?: string | null;
  active?: 0 | 1;
  created_at?: string;
  updated_at?: string;
}
export interface AdminFornecedorDto {
  id?: number;
  nome: string;
  cnpj?: string | null;
  contato?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  obs?: string | null;
  ativo?: 0 | 1;
  // Optional administrative fields for partners
  tipo_id?: string | number | null;
  tipo_name?: string | null;
  tipo?: string | number | null;
  numero?: string | null; // endereço número
  complemento?: string | null; // endereço complemento
  latitude?: string | number | null;
  longitude?: string | number | null;
  status?: string | null; // e.g. 'pending'|'approved'|'rejected'
  created_at?: string;
  updated_at?: string;
}

export interface PartnerTypeDto { id?: number | string; name: string }

export interface TipoProfissionalDto {
  id: number;
  nome: string;
  slug?: string | null;
  icone?: string | null;
  descricao?: string | null;
}

export interface AdminParceiroDto {
  id?: number;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cpf_cnpj?: string | null;
  descricao?: string | null;
  logo_url?: string | null;
  tipo_id?: number | null;
  tipo_nome?: string | null;
  tipo_slug?: string | null;
  destaque?: boolean;
  status?: 'pending' | 'approved' | 'rejected' | 'suspended';
  criado_em?: string;
  updated_at?: string;
  end_id?: number | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  account_ativo?: 0 | 1 | null;
}

// Fórmulas (manipulados)
export interface FormulaDto {
  id?: number;
  name: string;
  form_id: number;
  form_name?: string; // opcional: nome da forma (ex.: cápsula) vindo do backend
  output_unit_code: string;
  dose_amount?: number | null;
  dose_unit_code?: string | null;
  output_quantity_per_batch?: number | null;
  price?: number | null;
  notes?: string | null;
  active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export type FormulaItemTipo = 'ativo' | 'insumo';
export interface FormulaItemDto {
  tipo: FormulaItemTipo;
  ativo_id?: number; // quando tipo = 'ativo'
  insumo_nome?: string; // quando tipo = 'insumo'
  quantity: number;
  unit_code: string;
}

// Disponibilidade por fórmula
export interface FormulaAvailabilityItem {
  ativo_id: number;
  ativo_nome: string;
  required_per_unit: number; // quantidade requerida por unidade do produto
  unit_code: string; // unidade requerida
  available_converted: number; // soma convertida para a unidade requerida
  producible_units: number; // floor(available_converted / required_per_unit)
}
export interface FormulaAvailabilityResponse {
  formula_id: number;
  items: FormulaAvailabilityItem[];
  missing: Array<{ ativo_id: number; ativo_nome?: string }>;
  lots: Record<string, EstoqueAtivoDto[]>; // chave: ativo_id como string
}

// Marketplace Customizações (GET unificado para formulário de produto: categorias, tags, dosagens, embalagens)
export interface MarketplaceCategoria { id?: number; nome: string; slug?: string | null; icone?: string | null }
export interface MarketplaceTag { id?: number; nome: string }
export interface MarketplaceCustomizacoesList {
  ok?: boolean;
  categorias: MarketplaceCategoria[];
  tags: MarketplaceTag[];
  dosagens?: Array<{ id?: number; nome?: string }>;
  embalagens?: Array<{ id?: number; nome?: string }>;
}

/** Canais externos para publicação omnichannel (admin) */
export interface OmniChannelDefDto {
  id: string;
  label: string;
  docUrl?: string;
  apiCadastro?: boolean;
}

export type OmniPublicacaoStatus = 'draft' | 'queued' | 'syncing' | 'live' | 'error' | 'disabled';

export interface ProdutoOmniPublicacaoDto {
  id: number;
  produto_id: number;
  canal: string;
  status: OmniPublicacaoStatus;
  id_externo: string | null;
  ultimo_erro: string | null;
  sincronizado_em: string | null;
  created_at?: string;
  updated_at?: string | null;
}

// Promoções
export type PromocaoTipo = 'percentual' | 'valor';
export interface PromocaoUiInfo {
  tipo_simbolo: 'R$' | '%';
  valor_label: string; // Ex.: "R$ 10,00" ou "10%"
  status: 'upcoming' | 'active' | 'expired' | 'inactive';
  start?: { iso: string | null; human: string } | null;
  end?: { iso: string | null; human: string } | null;
  active_now?: boolean;
}
export type PromocaoConflictStrategy =
  | 'highest_discount'
  | 'lowest_discount'
  | 'most_recent'
  | 'priority'
  | 'stack';

export interface PromocoesConfigDto {
  id?: number;
  conflict_strategy: PromocaoConflictStrategy;
  /** 0 desativa desconto PIX no checkout; máximo 100. */
  pix_discount_percent?: number;
  updated_at?: string | null;
}

export interface PromocaoDto {
  id?: number;
  nome: string;
  descricao?: string | null;
  tipo?: PromocaoTipo;
  valor?: number;
  inicio?: string | null; // YYYY-MM-DD HH:mm:ss ou YYYY-MM-DDTHH:mm:ss
  fim?: string | null;
  ativo?: boolean | number;
  prioridade?: number;
  created_at?: string;
  updated_at?: string;
  ui?: PromocaoUiInfo; // payload de UI calculado no backend
  produtos?: Array<{ id: number; nome?: string; name?: string; preco?: string | number; price?: string | number }>; // resumo
  categorias?: Array<{ id: number; nome?: string }>;
  tags?: Array<{ id: number; nome?: string }>;
}

export interface BannerDto {
  id?: number;
  nome?: string;
  link?: string | null;
  alt?: string | null;
  posicao?: BannerPosition | string | null;
  ordem?: number | null;
  inicio?: string | null;
  fim?: string | null;
  ativo?: 0 | 1;
  desktop_image_url?: string | null;
  mobile_image_url?: string | null;
  target_blank?: 0 | 1;
  created_at?: string;
  updated_at?: string;
}

// Cupons (admin)
export interface CupomDto {
  id?: number | string;
  codigo: string;
  descricao?: string | null;
  tipo?: 'percentual' | 'valor';
  valor?: number;
  valor_minimo?: number | null;
  desconto_maximo?: number | null;
  primeira_compra?: 0 | 1;
  frete_gratis?: 0 | 1;
  ativo?: 0 | 1;
  validade?: string | null; // YYYY-MM-DD
  max_uso?: number | null;
  limite_por_cliente?: number | null;
  restricoes_json?: string | null;
  usado?: number;
  cumulativo_promo?: 0 | 1 | boolean;
  // Vínculos — povoados pelo GET, persistidos via create/update ou endpoints dedicados
  produto_ids?: Array<number | string>;
  categoria_ids?: Array<number | string>;
  tag_ids?: Array<number | string>;
  pessoa_vinculos?: Array<{ pessoa_tipo: 'cliente' | 'vet' | 'admin'; pessoa_id: number; nome?: string | null }>;
  created_at?: string;
  updated_at?: string;
}

export type CupomPayload = Omit<CupomDto, 'id' | 'created_at' | 'updated_at'>;

export type CupomApplicationOrder = 'percent_first' | 'fixed_first';

export interface CuponsConfigDto {
  id?: number;
  allow_with_promotions?: 0 | 1 | boolean;
  apply_on_promotional_price?: 0 | 1 | boolean;
  coupon_application_order?: CupomApplicationOrder;
  max_discount_percent?: number | null;
  updated_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private baseUrl = `${environment.apiBaseUrl}/admin`;
  private dashboardUrl = `${environment.apiBaseUrl}/dashboard`;

  constructor(private http: HttpClient, private session: SessionService) {}

  /** Normaliza GET /admin/produtos/* ou payloads equivalentes do parceiro (full). */
  normalizeMarketplaceProdutoPayload(raw: any): ProdutoDto {
    return this.normalizeProduto(raw);
  }

  /** Converte itens de taxonomia (string | { nome, name }) em string[] para o formulário. */
  private taxonomyItemsToStrings(arr: unknown): string[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x: any) => {
        if (x == null) return '';
        if (typeof x === 'string') return x;
        if (typeof x === 'number') return String(x);
        return (x.nome ?? x.name ?? x.label ?? '').toString();
      })
      .map((s: string) => s.trim())
      .filter((s: string) => !!s);
  }

  /** 1/0/undefined a partir de ativo/active vindos do MySQL ou JSON. */
  private toActive01(v: any): 0 | 1 | undefined {
    if (v === undefined || v === null) return undefined;
    if (v === 1 || v === '1' || v === true) return 1;
    if (v === 0 || v === '0' || v === false) return 0;
    const n = Number(v);
    if (!Number.isNaN(n)) return n ? 1 : 0;
    return undefined;
  }

  // Normaliza payloads de produto vindos do backend (vários formatos possíveis)
  private normalizeProduto(raw: any): ProdutoDto {
    if (!raw) return { id: undefined, name: '', description: '', price: 0, category: '', customizations: { dosage: [], packaging: [] }, tags: [] } as ProdutoDto;
    const id = raw.id ?? raw.product_id ?? raw.produto_id;
    const name = raw.name ?? raw.nome ?? raw.nome_produto ?? '';
    const description = raw.description ?? raw.descricao ?? '';
    const priceRaw = raw.price ?? raw.preco ?? raw.preco_br ?? raw.valor ?? 0;
    const price = (typeof priceRaw === 'string') ? parseFloat(priceRaw.replace(',', '.')) || 0 : (typeof priceRaw === 'number' ? priceRaw : 0);
    const wv = raw.weightValue ?? raw.peso_valor ?? raw.peso;
    const weightValue =
      wv == null || wv === '' ? null : (typeof wv === 'string' ? (parseFloat(String(wv).replace(',', '.')) || null) : (typeof wv === 'number' ? wv : null));
    const active01 = this.toActive01(raw.ativo) ?? this.toActive01(raw.active);
    const destaqueHome01 = this.toActive01(raw.destaque_home) ?? 0;
    const imagensArr = Array.isArray(raw.imagens) ? raw.imagens : (Array.isArray(raw.images) ? raw.images : []);
    const images = imagensArr.map((it: any) => (typeof it === 'string' ? it : (it?.url ?? it?.data ?? it?.image ?? ''))).filter((u: string) => !!u);
    const image = raw.image ?? raw.imagem_principal ?? images[0] ?? raw.imageUrl ?? null;
    const tags = Array.isArray(raw.tags) ? raw.tags.map((t: any) => (typeof t === 'string' ? t : (t?.nome ?? t?.name ?? ''))).filter((s: string) => !!s) : [];
    const category = raw.category ?? (Array.isArray(raw.categorias) && raw.categorias.length ? (raw.categorias[0].nome ?? raw.categorias[0].name) : (raw.categoria ?? raw.category ?? ''));
    const categoryId = (Array.isArray(raw.categorias) && raw.categorias.length) ? (raw.categorias[0].id ?? null) : (raw.categoria_id ?? raw.categoryId ?? raw.categoria_id ?? null);
    const custBlock = raw.customizations ?? raw.customizacoes;
    const dosageRaw = custBlock
      ? (custBlock.dosage ?? custBlock.dosagem ?? custBlock.dosages ?? [])
      : (raw.dosagens ?? raw.dosages ?? []);
    const packagingRaw = custBlock
      ? (custBlock.packaging ?? custBlock.embalagens ?? custBlock.packagings ?? [])
      : (raw.embalagens ?? raw.packaging ?? []);
    return {
      id,
      // keep original aliases for compatibility
      nome: raw.nome ?? raw.name,
      preco: raw.preco ?? raw.price,
      name,
      description,
      price,
      image,
      category,
      categoryId,
      images,
      customizations: {
        dosage: this.taxonomyItemsToStrings(dosageRaw),
        packaging: this.taxonomyItemsToStrings(packagingRaw),
      },
      discount: raw.discount ?? raw.desconto ?? null,
      rating: raw.rating ?? null,
      stock: raw.stock ?? raw.estoque ?? null,
      tags,
      weightValue,
      weightUnit: raw.weightUnit ?? raw.peso_unidade ?? null,
      ativoId: raw.ativo_id ?? raw.ativoId ?? null,
      estoqueId: raw.estoque_id ?? raw.estoqueId ?? null,
      formId: raw.formula_id ?? raw.formId ?? null,
      active: active01,
      destaque_home: (destaqueHome01 === 1 ? 1 : 0) as 0 | 1,
      // Identificação expandida
      sku: raw.sku ?? null,
      marca: raw.marca ?? raw.brand ?? null,
      codigo_barras: raw.codigo_barras ?? raw.barcode ?? null,
      // Técnico
      composicao: raw.composicao ?? null,
      modo_uso: raw.modo_uso ?? null,
      indicacoes: raw.indicacoes ?? null,
      contraindicacoes: raw.contraindicacoes ?? null,
      // Regulatório
      exige_receita: raw.exige_receita ?? null,
      validade_meses: raw.validade_meses ?? null,
      armazenamento: raw.armazenamento ?? null,
      registro_mapa: raw.registro_mapa ?? null,
      // SEO
      slug: raw.slug ?? null,
      meta_title: raw.meta_title ?? null,
      meta_description: raw.meta_description ?? null,
      og_image_url: raw.og_image_url ?? null,
      // Preço avançado
      preco_custo: raw.preco_custo != null ? Number(raw.preco_custo) : null,
      preco_de: raw.preco_de != null ? Number(raw.preco_de) : null,
      parcelas_max: raw.parcelas_max != null ? Number(raw.parcelas_max) : null,
      // Mídia extra
      video_url: raw.video_url ?? null,
      // Coleções
      variantes: Array.isArray(raw.variantes) ? raw.variantes.map((v: any) => ({
        id: v.id ?? null,
        nome: v.nome ?? v.name ?? '',
        sku: v.sku ?? null,
        preco: v.preco != null ? Number(v.preco) : null,
        preco_de: v.preco_de != null ? Number(v.preco_de) : null,
        estoque: v.estoque != null ? Number(v.estoque) : null,
        peso_g: v.peso_g != null ? Number(v.peso_g) : null,
        ativo: v.ativo != null ? !!v.ativo : true,
        posicao: v.posicao != null ? Number(v.posicao) : null,
      })) : [],
      documentos: Array.isArray(raw.documentos) ? raw.documentos.map((d: any) => ({
        id: d.id ?? null,
        nome: d.nome ?? '',
        url: d.url ?? '',
        tipo: d.tipo ?? null,
        posicao: d.posicao != null ? Number(d.posicao) : null,
      })) : [],
      promotions: Array.isArray(raw.promotions) ? raw.promotions : [],
      promo_price: raw.promo_price != null ? Number(raw.promo_price) : null,
      created_at: raw.created_at ?? raw.createdAt,
      updated_at: raw.updated_at ?? raw.updatedAt,
      card_layout: String(raw.card_layout || raw.cardLayout || 'sales').toLowerCase() === 'banner' ? 'banner' : 'sales',
    } as ProdutoDto;
  }

  private headers(): HttpHeaders {
    const token = this.session.getBackendToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // Configuração para novo cadastro de produto (formas, unidades, ativos)
  getConfigNewProduct(params?: { q?: string }): Observable<{ forms: ProductFormDto[]; units: UnitDto[]; ativos: Array<{ id: number; nome: string }>; insumos?: Array<{ id: number; nome: string }> }> {
    let httpParams = new HttpParams();
    if (params?.q) httpParams = httpParams.set('q', params.q);
    return this.http.get<{ forms: ProductFormDto[]; units: UnitDto[]; ativos: Array<{ id: number; nome: string }>; insumos?: Array<{ id: number; nome: string }> }>(
      `${this.baseUrl}/config-new-product`,
      { headers: this.headers(), params: httpParams }
    );
  }

  /** Lista formas farmacêuticas (`product_forms`). Usar se `getConfigNewProduct` vier sem `forms`. */
  listProductForms(): Observable<{ data: ProductFormDto[] }> {
    return this.http.get<{ data: ProductFormDto[] }>(`${this.baseUrl}/formas`, { headers: this.headers() });
  }

  /**
   * Config de novo produto. As formas vêm de GET /formas (roda `ensure` no backend + SELECT),
   * para não depender de um `/config` antigo com lista incompleta (ex.: falta "Outros").
   * `config-new-product` ainda fornece units/ativos/insumos.
   */
  getConfigNewProductWithForms(params?: { q?: string }): Observable<{
    forms: ProductFormDto[];
    units: UnitDto[];
    ativos: Array<{ id: number; nome: string }>;
    insumos?: Array<{ id: number; nome: string }>;
  }> {
    const cfg$ = this.getConfigNewProduct(params).pipe(
      catchError(() =>
        of({
          forms: [] as ProductFormDto[],
          units: [] as UnitDto[],
          ativos: [] as Array<{ id: number; nome: string }>
        } as { forms: ProductFormDto[]; units: UnitDto[]; ativos: Array<{ id: number; nome: string }>; insumos?: Array<{ id: number; nome: string }> })
      )
    );
    const formas$ = this.listProductForms().pipe(
      catchError(() => of({ data: [] as ProductFormDto[] }))
    );
    return forkJoin({ res: cfg$, lf: formas$ }).pipe(
      map(({ res, lf }) => {
        const fromFormas = Array.isArray(lf.data) ? lf.data : [];
        const forms = fromFormas.length > 0 ? fromFormas : (res.forms || []);
        return { ...res, forms };
      })
    );
  }

  // Produtos
  listProdutos(params?: { q?: string; page?: number; pageSize?: number; category?: string; tag?: string; ativoId?: string | number; active?: 0 | 1; ativo_nome?: string }): Observable<Paged<ProdutoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.tag) httpParams = httpParams.set('tag', params.tag);
      if (params.ativoId != null) httpParams = httpParams.set('ativoId', String(params.ativoId));
      if (params.ativo_nome) httpParams = httpParams.set('ativo_nome', params.ativo_nome);
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
    }
    return this.http.get<any>(`${this.baseUrl}/produtos`, { headers: this.headers(), params: httpParams }).pipe(
      map((res: any) => {
        const data = Array.isArray(res?.data) ? res.data.map((it: any) => this.normalizeProduto(it)) : [];
        return { ...res, data } as Paged<ProdutoDto>;
      })
    );
  }

  getProduto(id: string | number): Observable<ProdutoDto> {
    return this.http.get<any>(`${this.baseUrl}/produtos/${id}`, { headers: this.headers() }).pipe(
      map((p: any) => this.normalizeProduto(p))
    );
  }

  createProduto(body: ProdutoDto): Observable<ProdutoDto> {
    return this.http.post<any>(`${this.baseUrl}/produtos`, body, { headers: this.headers() }).pipe(
      map((p: any) => this.normalizeProduto(p))
    );
  }

  updateProduto(id: string | number, body: Partial<ProdutoDto>): Observable<ProdutoDto> {
    return this.http.put<any>(`${this.baseUrl}/produtos/${id}`, body, { headers: this.headers() }).pipe(
      map((p: any) => this.normalizeProduto(p))
    );
  }

  deleteProduto(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/produtos/${id}`, { headers: this.headers() });
  }

  // Upload de imagem (opcional)
  uploadProdutoImagem(id: string | number, file: File): Observable<{ imageUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.baseUrl}/produtos/${id}/imagem`, form, { headers: this.headers() });
  }

  reativarProduto(id: string | number): Observable<ProdutoDto> {
    return this.http.post<any>(`${this.baseUrl}/produtos/${id}/reativar`, {}, { headers: this.headers() }).pipe(
      map((p: any) => this.normalizeProduto(p))
    );
  }

  produtosPorAtivo(ativoId: string | number): Observable<ProdutoDto[]> {
    return this.http.get<any[]>(`${this.baseUrl}/produtos-por-ativo/${ativoId}`, { headers: this.headers() }).pipe(
      map((arr: any[]) => Array.isArray(arr) ? arr.map(a => this.normalizeProduto(a)) : [])
    );
  }

  produtosMeta(): Observable<{ categorias: Array<{id: string|number; name: string}>; tags: Array<{id: string|number; name: string}>; dosages: Array<{id: string|number; name: string}>; embalagens: Array<{id: string|number; name: string}>; }>{
    return this.http.get<{ categorias: Array<{id: string|number; name: string}>; tags: Array<{id: string|number; name: string}>; dosages: Array<{id: string|number; name: string}>; embalagens: Array<{id: string|number; name: string}>; }>(`${this.baseUrl}/produtos-meta`, { headers: this.headers() });
  }

  // Taxonomias
  listTaxonomia(tipo: TaxonomyType): Observable<{ data: Array<{ id: string | number; name: string }> }> {
    return this.http.get<{ data: Array<{ id: string | number; name: string }> }>(`${this.baseUrl}/taxonomias/${tipo}`, { headers: this.headers() });
  }

  createTaxonomia(tipo: TaxonomyType, name: string): Observable<{ id: string | number; name?: string; nome?: string }> {
    return this.http.post<{ id: string | number; name?: string; nome?: string }>(`${this.baseUrl}/taxonomias/${tipo}`, { name }, { headers: this.headers() });
  }

  updateTaxonomia(tipo: TaxonomyType, id: string | number, name: string): Observable<{ id: string | number; name: string }> {
    return this.http.put<{ id: string | number; name: string }>(`${this.baseUrl}/taxonomias/${tipo}/${id}`, { name }, { headers: this.headers() });
  }

  deleteTaxonomia(tipo: TaxonomyType, id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/taxonomias/${tipo}/${id}`, { headers: this.headers() });
  }

  // Ativos
  listAtivos(params?: { q?: string; page?: number; pageSize?: number }): Observable<Paged<any>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<Paged<any>>(`${this.baseUrl}/ativos`, { headers: this.headers(), params: httpParams });
  }

  // Partner types (fornecedores) - allow admin to manage types/categories of partners
  listPartnerTypes(): Observable<PartnerTypeDto[]> {
    return this.http.get<any>(`${this.baseUrl}/fornecedores/tipos`, { headers: this.headers() }).pipe(
      map((res) => Array.isArray(res) ? res : (res?.data ?? []))
    );
  }

  createPartnerType(name: string): Observable<PartnerTypeDto> {
    return this.http.post<PartnerTypeDto>(`${this.baseUrl}/fornecedores/tipos`, { name }, { headers: this.headers() });
  }

  updatePartnerType(id: string | number, name: string): Observable<PartnerTypeDto> {
    return this.http.put<PartnerTypeDto>(`${this.baseUrl}/fornecedores/tipos/${id}`, { name }, { headers: this.headers() });
  }

  deletePartnerType(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/fornecedores/tipos/${id}`, { headers: this.headers() });
  }

  getAtivo(id: string | number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/ativos/${id}`, { headers: this.headers() });
    }

  createAtivo(body: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/ativos`, body, { headers: this.headers() });
  }

  updateAtivo(id: string | number, body: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/ativos/${id}`, body, { headers: this.headers() });
  }

  deleteAtivo(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/ativos/${id}`, { headers: this.headers() });
  }

  scrapForVets(): Observable<{ imported: number }> {
    return this.http.post<{ imported: number }>(`${this.baseUrl}/ativos/scrap-forvets`, {}, { headers: this.headers() });
  }

  // Insumos
  listInsumos(params?: { q?: string; page?: number; pageSize?: number; active?: 0 | 1 }): Observable<Paged<InsumoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
    }
    return this.http.get<Paged<InsumoDto>>(`${this.baseUrl}/insumos`, { headers: this.headers(), params: httpParams });
  }
  getInsumo(id: string | number): Observable<InsumoDto> {
    return this.http.get<InsumoDto>(`${this.baseUrl}/insumos/${id}`, { headers: this.headers() });
  }
  createInsumo(body: Partial<InsumoDto> & { nome: string }): Observable<InsumoDto> {
    return this.http.post<InsumoDto>(`${this.baseUrl}/insumos`, body, { headers: this.headers() });
  }
  updateInsumo(id: string | number, body: Partial<InsumoDto>): Observable<InsumoDto> {
    return this.http.put<InsumoDto>(`${this.baseUrl}/insumos/${id}`, body, { headers: this.headers() });
  }
  deleteInsumo(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/insumos/${id}`, { headers: this.headers() });
  }

  // Estoque de ativos (lotes)
  listEstoque(params?: { ativo_id?: string | number; insumo_id?: string | number; q?: string; fornecedor_id?: string | number; page?: number; pageSize?: number; active?: 0 | 1 }): Observable<Paged<EstoqueAtivoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.ativo_id != null) httpParams = httpParams.set('ativo_id', String(params.ativo_id));
      if (params.insumo_id != null) httpParams = httpParams.set('insumo_id', String(params.insumo_id));
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.fornecedor_id != null) httpParams = httpParams.set('fornecedor_id', String(params.fornecedor_id));
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
    }
    return this.http.get<Paged<EstoqueAtivoDto>>(`${this.baseUrl}/estoque`, { headers: this.headers(), params: httpParams });
  }

  getEstoque(id: string | number): Observable<EstoqueAtivoDto> {
    return this.http.get<EstoqueAtivoDto>(`${this.baseUrl}/estoque/${id}`, { headers: this.headers() });
  }

  createEstoque(body: { ativo_id?: number | string; insumo_id?: number | string; quantity: number; unit_code: string; lote?: string; validade?: string; location?: string; fornecedor_id?: number | string; nota_fiscal?: string; preco_unit?: number }): Observable<EstoqueAtivoDto> {
    return this.http.post<EstoqueAtivoDto>(`${this.baseUrl}/estoque`, body, { headers: this.headers() });
  }

  updateEstoque(id: string | number, body: Partial<{ ativo_id: number | string; insumo_id?: number | string; quantity: number; unit_code: string; lote?: string; validade?: string; location?: string; active?: 0 | 1; fornecedor_id?: number | string; nota_fiscal?: string; preco_unit?: number }>): Observable<EstoqueAtivoDto> {
    return this.http.put<EstoqueAtivoDto>(`${this.baseUrl}/estoque/${id}`, body, { headers: this.headers() });
  }

  consumirEstoque(id: string | number, body: { quantity: number; unit_code: string; reason?: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}/consumir`, body, { headers: this.headers() });
  }

  entradaEstoque(id: string | number, body: { quantity: number; unit_code: string; reason?: string; fornecedor_id?: number | string; preco_unit?: number }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}/entrada`, body, { headers: this.headers() });
  }

  ajusteEstoque(id: string | number, body: { quantity: number; unit_code: string; reason?: string }): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}/ajuste`, body, { headers: this.headers() });
  }

  deleteEstoque(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/estoque/${id}`, { headers: this.headers() });
  }

  movimentosEstoque(id: string | number): Observable<EstoqueMovimentoDto[]> {
    return this.http.get<EstoqueMovimentoDto[]>(`${this.baseUrl}/estoque/${id}/movimentos`, { headers: this.headers() });
  }

  // Units (opcional, além do config)
  listUnits(): Observable<UnitDto[]> {
    return this.http.get<any>(`${this.baseUrl}/units`, { headers: this.headers() })
      .pipe(
        map((res) => {
          const arr: any[] = Array.isArray(res) ? res : (res?.data ?? []);
          return arr.map((u) => ({
            code: u.code,
            name: u.name,
            kind: u.kind,
            factor_to_base: typeof u.factor_to_base === 'string' ? Number(u.factor_to_base) : (u.factor_to_base ?? 0)
          })) as UnitDto[];
        })
      );
  }

  // Fornecedores (lista para selects)
  listFornecedores(): Observable<FornecedorDto[]> {
    return this.http.get<any>(`${this.baseUrl}/fornecedores`, { headers: this.headers() })
      .pipe(map((res) => Array.isArray(res) ? res : (res?.data ?? [])));
  }

  // Admin - Fornecedores CRUD (/admin/fornecedores)
  listAdminFornecedores(params?: { q?: string; active?: 0 | 1; page?: number; pageSize?: number }): Observable<Paged<AdminFornecedorDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<Paged<AdminFornecedorDto>>(`${this.baseUrl}/fornecedores`, { headers: this.headers(), params: httpParams });
  }
  getAdminFornecedor(id: number | string): Observable<AdminFornecedorDto> {
    return this.http.get<AdminFornecedorDto>(`${this.baseUrl}/fornecedores/${id}`, { headers: this.headers() });
  }
  createAdminFornecedor(body: Partial<AdminFornecedorDto> & { nome: string }): Observable<AdminFornecedorDto> {
    return this.http.post<AdminFornecedorDto>(`${this.baseUrl}/fornecedores`, body, { headers: this.headers() });
  }
  updateAdminFornecedor(id: number | string, body: Partial<AdminFornecedorDto>): Observable<AdminFornecedorDto> {
    return this.http.put<AdminFornecedorDto>(`${this.baseUrl}/fornecedores/${id}`, body, { headers: this.headers() });
  }
  deleteAdminFornecedor(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/fornecedores/${id}`, { headers: this.headers() });
  }

  // Admin - Parceiros CRUD (/admin/parceiros)
  listTiposParceiro(): Observable<TipoProfissionalDto[]> {
    return this.http.get<TipoProfissionalDto[]>(`${this.baseUrl}/parceiros/tipos`, { headers: this.headers() });
  }
  createTipoParceiro(body: { nome: string; slug?: string; icone?: string; descricao?: string }): Observable<TipoProfissionalDto> {
    return this.http.post<TipoProfissionalDto>(`${this.baseUrl}/parceiros/tipos`, body, { headers: this.headers() });
  }
  updateTipoParceiro(id: number | string, body: Partial<TipoProfissionalDto>): Observable<TipoProfissionalDto> {
    return this.http.put<TipoProfissionalDto>(`${this.baseUrl}/parceiros/tipos/${id}`, body, { headers: this.headers() });
  }
  deleteTipoParceiro(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/parceiros/tipos/${id}`, { headers: this.headers() });
  }
  listAdminParceiros(params?: { q?: string; status?: string; page?: number; pageSize?: number }): Observable<Paged<AdminParceiroDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.status && params.status !== 'all') httpParams = httpParams.set('status', params.status);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
    }
    return this.http.get<Paged<AdminParceiroDto>>(`${this.baseUrl}/parceiros`, { headers: this.headers(), params: httpParams });
  }
  getAdminParceiro(id: number | string): Observable<AdminParceiroDto> {
    return this.http.get<AdminParceiroDto>(`${this.baseUrl}/parceiros/${id}`, { headers: this.headers() });
  }
  updateAdminParceiro(id: number | string, body: Partial<AdminParceiroDto>): Observable<AdminParceiroDto> {
    return this.http.put<AdminParceiroDto>(`${this.baseUrl}/parceiros/${id}`, body, { headers: this.headers() });
  }
  approveAdminParceiro(id: number | string): Observable<AdminParceiroDto> {
    return this.http.put<AdminParceiroDto>(`${this.baseUrl}/parceiros/${id}/approve`, {}, { headers: this.headers() });
  }
  rejectAdminParceiro(id: number | string): Observable<AdminParceiroDto> {
    return this.http.put<AdminParceiroDto>(`${this.baseUrl}/parceiros/${id}/reject`, {}, { headers: this.headers() });
  }
  toggleDestaqueAdminParceiro(id: number | string, destaque: boolean): Observable<AdminParceiroDto> {
    return this.http.put<AdminParceiroDto>(`${this.baseUrl}/parceiros/${id}/destaque`, { destaque }, { headers: this.headers() });
  }
  deleteAdminParceiro(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/parceiros/${id}`, { headers: this.headers() });
  }

  // Dashboard
  getDashboard(): Observable<any> {
    return this.http.get<any>(this.dashboardUrl, { headers: this.headers() });
  }

  // Modular Admin Dashboard endpoints
  getAdminDashboardSummary(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/summary`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardSales(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/sales`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardMarketplace(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/marketplace`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardCustomers(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/customers`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardPromotions(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/promotions`, { headers: this.headers(), params: httpParams });
  }
  getAdminDashboardCoupons(params?: { from?: string; to?: string; sortDir?: 'asc'|'desc'; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.sortDir) httpParams = httpParams.set('sortDir', params.sortDir);
      if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    }
    return this.http.get<any>(`${this.baseUrl}/dashboard/coupons`, { headers: this.headers(), params: httpParams });
  }

  // Cupons (admin)
  getCuponsConfig(): Observable<CuponsConfigDto> {
    return this.http.get<CuponsConfigDto>(`${this.baseUrl}/cupons/config`, { headers: this.headers() });
  }
  putCuponsConfig(body: Partial<CuponsConfigDto>): Observable<CuponsConfigDto> {
    return this.http.put<CuponsConfigDto>(`${this.baseUrl}/cupons/config`, body, { headers: this.headers() });
  }

  listCupons(params?: { q?: string; page?: number; pageSize?: number; active?: 0 | 1; expired?: 0 | 1 }): Observable<Paged<CupomDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
      if (typeof params.expired === 'number') httpParams = httpParams.set('expired', String(params.expired));
    }
    return this.http.get<Paged<CupomDto>>(`${this.baseUrl}/cupons`, { headers: this.headers(), params: httpParams });
  }

  getCupom(id: string | number): Observable<CupomDto> {
    return this.http.get<CupomDto>(`${this.baseUrl}/cupons/${id}`, { headers: this.headers() });
  }

  createCupom(body: CupomPayload): Observable<CupomDto> {
    return this.http.post<CupomDto>(`${this.baseUrl}/cupons`, body, { headers: this.headers() });
  }

  updateCupom(id: string | number, body: Partial<CupomPayload>): Observable<CupomDto> {
    return this.http.put<CupomDto>(`${this.baseUrl}/cupons/${id}`, body, { headers: this.headers() });
  }

  deleteCupom(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/cupons/${id}`, { headers: this.headers() });
  }

  validarCupom(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/cupons/validar`, payload, { headers: this.headers() });
  }

  // Fórmulas - cadastro
  createFormula(body: FormulaDto): Observable<FormulaDto> {
    return this.http.post<FormulaDto>(`${this.baseUrl}/formulas`, body, { headers: this.headers() });
  }
  getFormula(id: number | string): Observable<FormulaDto & { items?: FormulaItemDto[] }> {
    return this.http.get<FormulaDto & { items?: FormulaItemDto[] }>(`${this.baseUrl}/formulas/${id}`, { headers: this.headers() });
  }
  updateFormula(id: number | string, body: Partial<FormulaDto>): Observable<FormulaDto> {
    return this.http.put<FormulaDto>(`${this.baseUrl}/formulas/${id}`, body, { headers: this.headers() });
  }
  updateFormulaItems(id: number | string, items: FormulaItemDto[]): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.baseUrl}/formulas/${id}/itens`, { items }, { headers: this.headers() });
  }
  estimateFormula(id: number | string): Observable<{ producible_units: number; limiting?: any }> {
    return this.http.get<{ producible_units: number; limiting?: any }>(`${this.baseUrl}/formulas/${id}/estimate`, { headers: this.headers() });
  }
  listFormulas(params?: { includeEstimates?: 0 | 1; q?: string; page?: number; pageSize?: number; active?: 0 | 1; form_id?: number | null }): Observable<Paged<FormulaDto & { estimate?: { producible_units: number; limiting?: any } }>> {
    let httpParams = new HttpParams();
    if (params) {
      if (typeof params.includeEstimates === 'number') httpParams = httpParams.set('includeEstimates', String(params.includeEstimates));
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
      if (params.form_id != null) httpParams = httpParams.set('form_id', String(params.form_id));
    }
    return this.http.get<Paged<FormulaDto & { estimate?: { producible_units: number; limiting?: any } }>>(`${this.baseUrl}/formulas`, { headers: this.headers(), params: httpParams });
  }
  // Disponibilidade da fórmula (itens, lotes e faltas)
  getFormulaAvailability(id: number): Observable<FormulaAvailabilityResponse> {
    return this.http.get<FormulaAvailabilityResponse>(`${this.baseUrl}/formulas/${id}/availability`, { headers: this.headers() });
  }
  // Estoques sugeridos para uma fórmula (ativos integrantes + lotes disponíveis)
  estoquesPorFormula(formulaId: number): Observable<{ lotes: EstoqueAtivoDto[]; faltando?: Array<{ ativo_id: number; ativo_nome?: string }> }> {
    // Endpoint assumido; ajuste se necessário
    return this.http.get<{ lotes: EstoqueAtivoDto[]; faltando?: Array<{ ativo_id: number; ativo_nome?: string }> }>(`${this.baseUrl}/formulas/${formulaId}/estoques`, { headers: this.headers() });
  }
  // Marketplace - criação full referenciando fórmula
  createMarketplaceProdutoFull(body: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/marketplace/produtos/full`, body, { headers: this.headers() });
  }
  // Marketplace - atualização full (payload unificado em português)
  updateMarketplaceProdutoFull(id: number | string, body: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/marketplace/produtos/${id}/full`, body, { headers: this.headers() });
  }
  // Marketplace - documentos anexos e variantes
  setMarketplaceProdutoDocumentos(id: number | string, documentos: Array<{ nome: string; url: string; tipo?: string }>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/marketplace/produtos/${id}/documentos`, { documentos }, { headers: this.headers() });
  }
  setMarketplaceProdutoVariantes(id: number | string, variantes: Array<Record<string, any>>): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/marketplace/produtos/${id}/variantes`, { variantes }, { headers: this.headers() });
  }
  // Cupons — vínculos (produtos/categorias/tags)
  setCupomProdutos(id: number | string, produto_ids: number[]): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/cupons/${id}/produtos`, { produto_ids }, { headers: this.headers() });
  }
  setCupomCategorias(id: number | string, categoria_ids: number[]): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/cupons/${id}/categorias`, { categoria_ids }, { headers: this.headers() });
  }
  setCupomTags(id: number | string, tag_ids: number[]): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/cupons/${id}/tags`, { tag_ids }, { headers: this.headers() });
  }
  setCupomPessoas(id: number | string, pessoa_vinculos: Array<{ pessoa_tipo: string; pessoa_id: number }>): Observable<CupomDto> {
    return this.http.put<CupomDto>(`${this.baseUrl}/cupons/${id}/pessoas`, { pessoa_vinculos }, { headers: this.headers() });
  }
  previewCupom(payload: { id?: number | string; codigo?: string; itens: Array<{ produto_id: number; preco_unit: number; quantidade: number; promo_aplicada?: boolean }> }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/cupons/preview`, payload, { headers: this.headers() });
  }
  getMarketplaceCustomizacoes(): Observable<MarketplaceCustomizacoesList> {
    return this.http.get<MarketplaceCustomizacoesList>(`${this.baseUrl}/marketplace/customizacoes`, { headers: this.headers() });
  }

  listOmniCanais(): Observable<{ data: OmniChannelDefDto[] }> {
    return this.http.get<{ data: OmniChannelDefDto[] }>(`${this.baseUrl}/marketplace/omni/canais`, { headers: this.headers() });
  }

  getProdutoOmniPublicacoes(produtoId: number | string): Observable<{ data: ProdutoOmniPublicacaoDto[]; meta?: { migrationsPending?: boolean } }> {
    return this.http.get<{ data: ProdutoOmniPublicacaoDto[]; meta?: { migrationsPending?: boolean } }>(
      `${this.baseUrl}/marketplace/produtos/${produtoId}/omni-publicacoes`,
      { headers: this.headers() }
    );
  }

  syncProdutoOmniCanais(produtoId: number | string, canais: string[]): Observable<{ ok: boolean; anySuccess?: boolean; results?: Array<{ canal: string; ok?: boolean; error?: string; externalId?: string | null }> }> {
    return this.http.post<{ ok: boolean; anySuccess?: boolean; results?: Array<{ canal: string; ok?: boolean; error?: string; externalId?: string | null }> }>(
      `${this.baseUrl}/marketplace/produtos/${produtoId}/omni-sincronizar`,
      { canais },
      { headers: this.headers() }
    );
  }

  listMarketplaceCategorias(): Observable<{ data: MarketplaceCategoria[] }> {
    return this.http.get<{ data: MarketplaceCategoria[] }>(`${this.baseUrl}/marketplace/categorias`, { headers: this.headers() });
  }
  createMarketplaceCategoria(body: { nome: string; slug?: string | null; icone?: string | null }): Observable<MarketplaceCategoria> {
    return this.http.post<MarketplaceCategoria>(`${this.baseUrl}/marketplace/categorias`, body, { headers: this.headers() });
  }
  updateMarketplaceCategoria(id: number | string, body: Partial<{ nome: string; slug: string | null; icone: string | null }>): Observable<MarketplaceCategoria> {
    return this.http.put<MarketplaceCategoria>(`${this.baseUrl}/marketplace/categorias/${id}`, body, { headers: this.headers() });
  }
  deleteMarketplaceCategoria(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/marketplace/categorias/${id}`, { headers: this.headers() });
  }

  listMarketplaceTags(): Observable<{ data: MarketplaceTag[] }> {
    return this.http.get<{ data: MarketplaceTag[] }>(`${this.baseUrl}/marketplace/tags`, { headers: this.headers() });
  }
  createMarketplaceTag(body: { nome: string }): Observable<MarketplaceTag> {
    return this.http.post<MarketplaceTag>(`${this.baseUrl}/marketplace/tags`, body, { headers: this.headers() });
  }
  updateMarketplaceTag(id: number | string, body: Partial<{ nome: string }>): Observable<MarketplaceTag> {
    return this.http.put<MarketplaceTag>(`${this.baseUrl}/marketplace/tags/${id}`, body, { headers: this.headers() });
  }
  deleteMarketplaceTag(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/marketplace/tags/${id}`, { headers: this.headers() });
  }

  /** Temas da vitrine (loja) */
  listLojaTemas(): Observable<{ data: LojaTemaDto[]; activeThemeId: number | null }> {
    return this.http.get<{ data: LojaTemaDto[]; activeThemeId: number | null }>(`${this.baseUrl}/loja/temas`, { headers: this.headers() });
  }
  getLojaTema(id: number | string): Observable<LojaTemaDto> {
    return this.http.get<LojaTemaDto>(`${this.baseUrl}/loja/temas/${id}`, { headers: this.headers() });
  }
  createLojaTema(body: Partial<LojaTemaDto> & { nome: string }): Observable<LojaTemaDto> {
    return this.http.post<LojaTemaDto>(`${this.baseUrl}/loja/temas`, body, { headers: this.headers() });
  }
  updateLojaTema(id: number | string, body: Partial<LojaTemaDto>): Observable<LojaTemaDto> {
    return this.http.put<LojaTemaDto>(`${this.baseUrl}/loja/temas/${id}`, body, { headers: this.headers() });
  }
  deleteLojaTema(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/loja/temas/${id}`, { headers: this.headers() });
  }
  activateLojaTema(id: number | string): Observable<{ ok: boolean; activeTheme: LojaTemaDto | null }> {
    return this.http.post<{ ok: boolean; activeTheme: LojaTemaDto | null }>(`${this.baseUrl}/loja/temas/${id}/ativar`, {}, { headers: this.headers() });
  }

  // Admin - Promoções
  listPromocoes(params?: { q?: string; page?: number; pageSize?: number; active?: 0 | 1; ativo_id?: number | string }): Observable<Paged<PromocaoDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
      if (params.ativo_id != null) httpParams = httpParams.set('ativo_id', String(params.ativo_id));
    }
    return this.http.get<Paged<PromocaoDto>>(`${this.baseUrl}/promocoes`, { headers: this.headers(), params: httpParams });
  }
  getPromocao(id: number | string): Observable<PromocaoDto> {
    return this.http.get<PromocaoDto>(`${this.baseUrl}/promocoes/${id}`, { headers: this.headers() });
  }
  createPromocao(body: PromocaoDto): Observable<PromocaoDto> {
    return this.http.post<PromocaoDto>(`${this.baseUrl}/promocoes`, body, { headers: this.headers() });
  }
  updatePromocao(id: number | string, body: Partial<PromocaoDto>): Observable<PromocaoDto> {
    return this.http.put<PromocaoDto>(`${this.baseUrl}/promocoes/${id}`, body, { headers: this.headers() });
  }
  deletePromocao(id: number | string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/promocoes/${id}`, { headers: this.headers() });
  }
  setPromocaoProdutos(id: number | string, produto_ids: number[]): Observable<PromocaoDto> {
    return this.http.put<PromocaoDto>(`${this.baseUrl}/promocoes/${id}/produtos`, { produto_ids }, { headers: this.headers() });
  }
  setPromocaoTags(id: number | string, tag_ids: number[]): Observable<PromocaoDto> {
    return this.http.put<PromocaoDto>(`${this.baseUrl}/promocoes/${id}/tags`, { tag_ids }, { headers: this.headers() });
  }
  setPromocaoCategorias(id: number | string, categoria_ids: number[]): Observable<PromocaoDto> {
    return this.http.put<PromocaoDto>(`${this.baseUrl}/promocoes/${id}/categorias`, { categoria_ids }, { headers: this.headers() });
  }
  getPromocoesConfig(): Observable<PromocoesConfigDto> {
    return this.http.get<PromocoesConfigDto>(`${this.baseUrl}/promocoes/config`, { headers: this.headers() });
  }
  putPromocoesConfig(body: {
    conflict_strategy: PromocaoConflictStrategy;
    pix_discount_percent?: number;
  }): Observable<PromocoesConfigDto> {
    return this.http.put<PromocoesConfigDto>(`${this.baseUrl}/promocoes/config`, body, { headers: this.headers() });
  }

  // Usuários
  listUsuarios(params?: { q?: string; page?: number; pageSize?: number; tipo?: 'cliente' | 'vet' | 'admin'; status?: 0 | 1; verification?: 'pending' | 'approved' | 'rejected'; city?: string; uf?: string; from?: string; to?: string }): Observable<Paged<PessoaDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
      if (typeof params.status === 'number') httpParams = httpParams.set('status', String(params.status));
      if (params.verification) httpParams = httpParams.set('verification', params.verification);
      if (params.city) httpParams = httpParams.set('city', params.city);
      if (params.uf) httpParams = httpParams.set('uf', params.uf);
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<Paged<PessoaDto>>(`${this.baseUrl}/usuarios`, { headers: this.headers(), params: httpParams });
  }
  getUsuario(id: string | number): Observable<PessoaDto> {
    return this.http.get<PessoaDto>(`${this.baseUrl}/usuarios/${id}`, { headers: this.headers() });
  }
  updateUsuario(id: string | number, body: Partial<PessoaDto>): Observable<PessoaDto> {
    return this.http.put<PessoaDto>(`${this.baseUrl}/usuarios/${id}`, body, { headers: this.headers() });
  }

  // Pessoas unificado (/admin/people)
  listPeople(params?: { q?: string; page?: number; pageSize?: number; tipo?: 'cliente' | 'vet' | 'admin' }): Observable<Paged<PessoaDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
    }
    return this.http.get<Paged<PessoaDto>>(`${this.baseUrl.replace('/admin','')}/admin/people`, { headers: this.headers(), params: httpParams });
  }
  getPerson(id: string | number, tipo?: 'cliente' | 'vet' | 'admin'): Observable<PessoaDto> {
    let httpParams = new HttpParams();
    if (tipo) httpParams = httpParams.set('tipo', tipo);
    return this.http.get<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/${id}`, { headers: this.headers(), params: httpParams });
  }
  createPerson(body: { tipo: 'cliente' | 'vet' | 'admin' } & Record<string, any>): Observable<PessoaDto> {
    return this.http.post<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people`, body, { headers: this.headers() });
  }
  updatePerson(id: string | number, tipo: 'cliente' | 'vet' | 'admin', body: Record<string, any>): Observable<PessoaDto> {
    // Backend exige tipo no body
    return this.http.put<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/${id}`, { tipo, ...body }, { headers: this.headers() });
  }
  deletePerson(id: string | number, tipo?: 'cliente' | 'vet' | 'admin'): Observable<{ ok: boolean }> {
    let httpParams = new HttpParams();
    if (tipo) httpParams = httpParams.set('tipo', tipo);
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl.replace('/admin','')}/admin/people/${id}`, { headers: this.headers(), params: httpParams });
  }

  // Documentos por usuário
  listUsuarioDocs(id: string | number): Observable<PessoaDocDto[]> {
    return this.http.get<PessoaDocDto[]>(`${this.baseUrl}/usuarios/${id}/docs`, { headers: this.headers() });
  }
  uploadUsuarioDoc(id: string | number, file: File, tipo: PessoaDocDto['tipo']): Observable<PessoaDocDto> {
    const form = new FormData();
    form.append('file', file);
    form.append('tipo', tipo);
    return this.http.post<PessoaDocDto>(`${this.baseUrl}/usuarios/${id}/docs`, form, { headers: this.headers() });
  }
  deleteUsuarioDoc(id: string | number, docId: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/usuarios/${id}/docs/${docId}`, { headers: this.headers() });
  }

  // Vet - aprovação e auditoria
  approveVet(id: string | number, body?: { reason?: string }): Observable<PessoaDto> {
    return this.http.post<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/vets/${id}/approve`, body || {}, { headers: this.headers() });
  }
  rejectVet(id: string | number, body: { reason?: string }): Observable<PessoaDto> {
    return this.http.post<PessoaDto>(`${this.baseUrl.replace('/admin','')}/admin/people/vets/${id}/reject`, body || {}, { headers: this.headers() });
  }
  listVetApprovals(id: string | number): Observable<Array<{ id: number; vet_id: number; admin_id: number; admin_email: string; admin_nome?: string; approved: 0|1; reason?: string; ip?: string; created_at: string }>> {
    return this.http.get<Array<{ id: number; vet_id: number; admin_id: number; admin_email: string; admin_nome?: string; approved: 0|1; reason?: string; ip?: string; created_at: string }>>(`${this.baseUrl.replace('/admin','')}/admin/people/vets/${id}/approvals`, { headers: this.headers() });
  }
  vetAuditLogs(id: string | number): Observable<Array<{ id: number; action: string; reason?: string; created_at: string; admin_id?: number }>> {
    return this.http.get<Array<{ id: number; action: string; reason?: string; created_at: string; admin_id?: number }>>(`${this.baseUrl}/vets/${id}/audit-logs`, { headers: this.headers() });
  }

  /** Rastreio de atividade da loja (/admin/rastreio) */
  rastreioDashboard(params?: { from?: string; to?: string }): Observable<RastreioDashboardDto> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    return this.http.get<RastreioDashboardDto>(`${this.baseUrl}/rastreio/dashboard`, {
      headers: this.headers(),
      params: httpParams,
    });
  }

  rastreioTimeline(
    clienteId: string | number,
    params?: { cursor?: string | number; limit?: number; tipos?: string }
  ): Observable<{
    items: Array<{
      id: number;
      visitante_id: string | null;
      cliente_id: number | null;
      tipo: string;
      path: string | null;
      route_id: string | null;
      meta: unknown;
      user_agent: string | null;
      session_id: string | null;
      created_at: string;
    }>;
    nextCursor: number | null;
  }> {
    let httpParams = new HttpParams();
    if (params?.cursor != null) httpParams = httpParams.set('cursor', String(params.cursor));
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.tipos) httpParams = httpParams.set('tipos', params.tipos);
    return this.http.get(`${this.baseUrl}/rastreio/clientes/${clienteId}/timeline`, {
      headers: this.headers(),
      params: httpParams,
    }) as any;
  }

  rastreioFeed(params?: {
    from?: string;
    to?: string;
    q?: string;
    page?: number;
    pageSize?: number;
    tipo?: string;
  }): Observable<{ items: any[]; total: number; page: number; pageSize: number }> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.from) httpParams = httpParams.set('from', params.from);
      if (params.to) httpParams = httpParams.set('to', params.to);
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (params.tipo) httpParams = httpParams.set('tipo', params.tipo);
    }
    return this.http.get<{ items: any[]; total: number; page: number; pageSize: number }>(
      `${this.baseUrl}/rastreio/feed`,
      { headers: this.headers(), params: httpParams }
    );
  }

  rastreioResumo(visitanteId: string): Observable<{
    visitante: Record<string, unknown>;
    eventos: Array<{ id: number; tipo: string; path: string | null; route_id: string | null; meta: unknown; created_at: string }>;
  }> {
    return this.http.get(`${this.baseUrl}/rastreio/resumo/${encodeURIComponent(visitanteId)}`, { headers: this.headers() }) as any;
  }

  // Banners (admin)
  listBanners(params?: { q?: string; page?: number; pageSize?: number; active?: 0 | 1; posicao?: string }): Observable<Paged<BannerDto>> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.q) httpParams = httpParams.set('q', params.q);
      if (params.page) httpParams = httpParams.set('page', String(params.page));
      if (params.pageSize) httpParams = httpParams.set('pageSize', String(params.pageSize));
      if (typeof params.active === 'number') httpParams = httpParams.set('active', String(params.active));
      if (params.posicao) httpParams = httpParams.set('posicao', params.posicao);
    }
    return this.http.get<Paged<BannerDto>>(`${this.baseUrl}/banners`, { headers: this.headers(), params: httpParams });
  }

  getBanner(id: string | number): Observable<BannerDto> {
    return this.http.get<BannerDto>(`${this.baseUrl}/banners/${id}`, { headers: this.headers() });
  }

  createBanner(body: Partial<BannerDto> | FormData): Observable<BannerDto> {
    // Accept either a JSON payload or a FormData (multipart) with image files
    return this.http.post<BannerDto>(`${this.baseUrl}/banners`, body as any, { headers: this.headers() });
  }

  updateBanner(id: string | number, body: Partial<BannerDto> | FormData): Observable<BannerDto> {
    // Accept either a JSON payload or a FormData (multipart) with image files
    return this.http.put<BannerDto>(`${this.baseUrl}/banners/${id}`, body as any, { headers: this.headers() });
  }

  deleteBanner(id: string | number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.baseUrl}/banners/${id}`, { headers: this.headers() });
  }

  uploadBannerImage(id: string | number, file: File, tipo: 'desktop'|'mobile'): Observable<{ imageUrl: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('type', tipo);
    return this.http.post<{ imageUrl: string }>(`${this.baseUrl}/banners/${id}/imagem`, form, { headers: this.headers() });
  }

  /** Lista pets para moderação da galeria pública. */
  listAdminPets(params?: {
    page?: number;
    pageSize?: number;
    q?: string;
    aprovado?: 'all' | 'pending' | 'approved';
    galeria?: 'all' | 'yes' | 'no';
  }): Observable<Paged<AdminPetRow>> {
    let httpParams = new HttpParams();
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.pageSize != null) httpParams = httpParams.set('pageSize', String(params.pageSize));
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.aprovado && params.aprovado !== 'all') httpParams = httpParams.set('aprovado', params.aprovado);
    if (params?.galeria && params.galeria !== 'all') httpParams = httpParams.set('galeria', params.galeria);
    return this.http.get<Paged<AdminPetRow>>(`${this.baseUrl}/pets`, { headers: this.headers(), params: httpParams });
  }

  patchAdminPet(
    id: string | number,
    body: { aprovado_por_admin?: boolean | number; exibir_galeria_publica?: boolean | number }
  ): Observable<AdminPetRow> {
    return this.http.patch<AdminPetRow>(`${this.baseUrl}/pets/${encodeURIComponent(String(id))}`, body, {
      headers: this.headers(),
    });
  }

  /**
   * Teste de envio via Resend (backend). Requer token de admin.
   * POST /admin/email/test
   */
  sendTestEmail(body: {
    para: string | string[] | Array<{ email: string; nome?: string; name?: string }>;
    assunto: string;
    texto?: string;
    html?: string;
    cc?: string | string[] | Array<{ email: string; nome?: string }>;
    bcc?: string | string[] | Array<{ email: string; nome?: string }>;
    replyTo?: string | string[] | Array<{ email: string; nome?: string }>;
  }): Observable<{ ok: boolean; envio_id: number; id_provedor: string; requestId?: string | null }> {
    return this.http.post<{ ok: boolean; envio_id: number; id_provedor: string; requestId?: string | null }>(
      `${this.baseUrl}/email/test`,
      body,
      { headers: this.headers() }
    );
  }
}
