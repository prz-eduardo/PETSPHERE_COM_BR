import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { StoreThemeService, LojaThemeActive } from './store-theme.service';
import { TenantLojaService } from './tenant-loja.service';
import { normalizeThemeConfig } from '../constants/loja-tema-card.config';

/** Alinhado a cards e admin: dosagem, embalagem, opcionais de vitrine. */
export interface ShopProductCustomizations {
  dosage?: string[];
  packaging?: string[];
  size?: string[];
  scent?: string[];
}

export interface ShopProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  tipo?: 'manipulado'|'pronto';
  customizations?: ShopProductCustomizations;
  discount?: number;
  rating?: number; // média 0-5
  ratingsCount?: number;
  stock?: number;
  tags?: string[];
  weight?: string;
  requiresPrescription?: boolean;
  isFavorited?: boolean;
  favoritesCount?: number;
  /** Marcado como destaque pelo backend (ou inferido por tag). */
  featured?: boolean;
  /**
   * Quando false, o produto é uma "demonstração SaaS" (vitrine institucional):
   * NÃO entra em carrinho/checkout; o CTA leva para cadastro/planos.
   * Vem do backend como `permite_checkout` (snake_case) ou `permiteCheckout` (alias).
   */
  permiteCheckout?: boolean;
  /** Na vitrine de um parceiro: produto de outro parceiro (catálogo compartilhado). */
  vendidoParceiroExterno?: boolean;
  // Details
  promoPrice?: number | null;
  inStock?: boolean | number | null;
  imageUrl?: string | null;
  images?: Array<{ id: number; url: string; posicao?: number | null }>;
  // Campos expandidos (Fase 2)
  sku?: string | null;
  marca?: string | null;
  composicao?: string | null;
  modo_uso?: string | null;
  indicacoes?: string | null;
  contraindicacoes?: string | null;
  exige_receita?: boolean | number | null;
  validade_meses?: number | null;
  armazenamento?: string | null;
  video_url?: string | null;
  variantes?: Array<{
    id?: number;
    nome: string;
    sku?: string | null;
    preco?: number | null;
    preco_de?: number | null;
    estoque?: number | null;
    peso_g?: number | null;
    ativo?: boolean | number;
  }>;
  documentos?: Array<{ id?: number; nome: string; url: string; tipo?: string | null }>;
  cupons_aplicaveis?: Array<{ id: number; codigo: string; descricao?: string; tipo?: string; valor?: number; cumulativo_promo?: boolean | number }>;
  created_at?: string | Date;
  /** Layout na vitrine: card de vendas ou faixa grande (2 colunas no grid). */
  cardLayout?: 'sales' | 'banner';
  /** Preço a exibir riscado (promo ou preco_de), quando aplicável. */
  strikePrice?: number | null;
  precoDe?: number | null;
  slug?: string | null;
  codigo_barras?: string | null;
  registro_mapa?: string | null;
  parcelas_max?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  peso_valor?: number | null;
  peso_unidade?: string | null;
  /** Categorias como no API (id + nome) quando o detalhe as envia. */
  categoriasList?: Array<{ id: number; nome: string; slug?: string }>;
  /** Resumo curto (API pública). */
  shortDescription?: string | null;
  priceOriginal?: number | null;
  priceFinal?: number | null;
  /** Objeto de desconto agregado da API (listagem e detalhe). */
  apiDiscount?: {
    value: number;
    percent: number;
    promotionId: number | null;
    promotion?: { id: number; nome?: string; descricao?: string; tipo?: string; valor?: number | null; inicio?: string | null; fim?: string | null } | null;
  } | null;
  /** Melhor promoção ativa retornada pela API. */
  activePromotion?: {
    id: number;
    nome?: string;
    descricao?: string;
    tipo?: string;
    valor?: number;
    inicio?: string | null;
    fim?: string | null;
    ativo?: boolean;
  } | null;
  productCreatedAt?: string | Date | null;
  productUpdatedAt?: string | Date | null;
  /** Linhas de dosagem/embalagem (paridade com admin). */
  dosagens?: Array<{ id: number; nome: string }>;
  embalagens?: Array<{ id: number; nome: string }>;
  /** Itens da fórmula associada (só rótulos; API: compostos_ativos). */
  compostosAtivos?: Array<{ label: string }>;
  og_image_url?: string | null;
}

export type ProductDetailsLoadError = 'not_found' | 'server' | 'unknown';

export interface LoadProductDetailsResult {
  product: ShopProduct | null;
  error?: ProductDetailsLoadError;
}

export interface StoreCategory { id: number; nome: string; produtos: number; }
export interface StoreTag { id: number; nome: string; produtos: number; }
export interface StoreMeta {
  loggedIn?: boolean;
  userType?: string;
  favoritesPersonalization?: boolean;
  supports?: { images?: boolean; favorites?: boolean; ratings?: boolean; categories?: boolean; tags?: boolean };
  categories?: StoreCategory[];
  tags?: StoreTag[];
  activeTheme?: LojaThemeActive | null;
}

export interface CartItem {
  product: ShopProduct;
  quantity: number;
  // If the product requires prescription, these fields help enforce the flow
  prescriptionId?: string; // ID of a generated prescription from the system
  prescriptionFileName?: string; // Uploaded PDF name
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private productsSubject = new BehaviorSubject<ShopProduct[]>([]);
  products$ = this.productsSubject.asObservable();

  private categoriesSubject = new BehaviorSubject<StoreCategory[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  private metaSubject = new BehaviorSubject<StoreMeta | null>(null);
  meta$ = this.metaSubject.asObservable();

  private favoritesSubject = new BehaviorSubject<number[]>(this.readFavorites());
  favorites$ = this.favoritesSubject.asObservable();

  private cartSubject = new BehaviorSubject<CartItem[]>(this.readCart());
  cart$ = this.cartSubject.asObservable();

  private clienteChecked = false;
  private isCliente = false;

  // Simple checkout context to bridge cart -> checkout
  private checkoutContextSubject = new BehaviorSubject<any | null>(null);
  checkoutContext$ = this.checkoutContextSubject.asObservable();

  // Created order snapshot (for checkout page)
  private createdOrderSubject = new BehaviorSubject<any | null>(null);
  createdOrder$ = this.createdOrderSubject.asObservable();

  constructor(
    private http: HttpClient,
    private api: ApiService,
    private toast: ToastService,
    private router: Router,
    private storeTheme: StoreThemeService,
    private tenantLoja: TenantLojaService
  ) {}
    // --- Cliente me caching ---
    // Cache the last successful response and also dedupe in-flight requests so
    // multiple callers (components) don't trigger duplicate network calls.
    private clienteMeCache: any = null;
    private clienteMePromise: Promise<any> | null = null;

    /** Busca dados do cliente logado (GET /clientes/me) with caching and dedupe
     *  Pass forceRefresh=true to bypass cache and re-fetch from server.
     */
    async getClienteMe(forceRefresh: boolean = false): Promise<any> {
        // Avoid performing external requests during server-side rendering.
        if (!this.isBrowser()) {
          return this.clienteMeCache || null;
        }
        const token = this.getStoredJwt();
        if (!token) {
          return null;
        }
      // Return cached value when available and not forcing refresh
      if (!forceRefresh && this.clienteMeCache) {
        return this.clienteMeCache;
      }
      // If there's already an in-flight request, return the same promise
      if (!forceRefresh && this.clienteMePromise) {
        try {
          return await this.clienteMePromise;
        } catch {
          return null;
        }
      }

      // Start a new request and store the promise
      this.clienteMePromise = (async () => {
        try {
          // Prefer ApiService wrapper (adds baseUrl/headers consistently)
          const res = await this.api.getClienteMe(token || '').toPromise();
          this.clienteMeCache = res;
          // also persist to localStorage for quick load elsewhere
          if (this.isBrowser() && typeof window !== 'undefined' && res) {
            try { localStorage.setItem('cliente_me', JSON.stringify(res)); } catch {}
          }
          return res;
        } catch (err: unknown) {
          const inAdminRoute = !!(this.router && typeof this.router.url === 'string' && this.router.url.includes('/restrito'));
          const status = err instanceof HttpErrorResponse ? err.status : (err as { status?: number })?.status;
          // 401 token inválido/expirado; 404 JWT de outro perfil (ex. vet) ou cliente inexistente; 403 conta inativa etc.
          const sessionNotCliente = status === 401 || status === 404 || status === 403;
          if (sessionNotCliente) {
            try {
              if (this.isBrowser() && typeof localStorage !== 'undefined') {
                localStorage.removeItem('cliente_me');
              }
            } catch { /* */ }
            this.invalidateClienteSession();
          } else if (this.toast?.error && !inAdminRoute) {
            this.toast.error('Não foi possível carregar os dados do cliente.', 'Erro');
          }
          return null;
        } finally {
          // clear the in-flight marker so subsequent forceRefresh calls work
          this.clienteMePromise = null;
        }
      })();

      try {
        return await this.clienteMePromise;
      } catch {
        return null;
      }
    }

  private isBrowser(): boolean {
    try { return typeof window !== 'undefined' && typeof localStorage !== 'undefined'; } catch { return false; }
  }

  /** Mesma regra que AuthService.getToken: localStorage ou sessionStorage. */
  private getStoredJwt(): string | undefined {
    if (!this.isBrowser() || typeof sessionStorage === 'undefined') return undefined;
    try {
      const fromLocal = localStorage.getItem('token');
      const fromSession = sessionStorage.getItem('token');
      const pick = fromLocal || fromSession || '';
      if (!pick || pick === 'undefined' || pick === 'null') return undefined;
      return pick;
    } catch {
      return undefined;
    }
  }

  /** Após login/logout: libera cache e permite isClienteLoggedSilent / navbar revalidarem. */
  invalidateClienteSession(): void {
    this.resetClienteGate();
    this.clienteMeCache = null;
    this.clienteMePromise = null;
  }

  // Home highlights
  async loadHomeHighlights(): Promise<ShopProduct[]> {
    try {
      await this.tenantLoja.ensureHostResolved();
      const token = this.getStoredJwt();
      const slug = this.tenantLoja.lojaSlug();
      const res = await this.api.getHomeHighlights(token, slug ? { parceiro_slug: slug } : undefined).toPromise();
      const arr = Array.isArray(res) ? res : (res?.data || res?.items || []);
      const items = (arr || []).map((it: any) => ({
        id: it.id,
        name: it.nome || it.name,
        description: it.descricao || it.description || it.shortDescription || '',
        price: Number(it.preco ?? it.price ?? (typeof it.price === 'string' ? parseFloat(it.price) : 0)),
        image: it.imagem_url || it.image || it.imageUrl || '',
        category: it.categoria || it.category || '',
        discount: it.desconto || 0,
        rating: typeof it.rating_media === 'number' ? it.rating_media : (typeof it.rating_media === 'string' ? parseFloat(it.rating_media) : undefined),
        ratingsCount: typeof it.rating_total === 'number' ? it.rating_total : undefined,
        isFavorited: typeof it.is_favorited === 'boolean' ? it.is_favorited : undefined,
        favoritesCount: typeof it.favoritos === 'number' ? it.favoritos : undefined,
        permiteCheckout: this.parsePermiteCheckout(it),
        vendidoParceiroExterno: this.parseVendidoParceiroExterno(it),
      })) as ShopProduct[];
      return items;
    } catch {
      this.toast.error('Não foi possível carregar os destaques da Home.', 'Erro');
      return [];
    }
  }

  // Products - server-first with local fallback
  async loadProducts(params?: { page?: number; pageSize?: number; q?: string; tipo?: 'manipulado'|'pronto'; category?: string; categoryId?: string|number; categories?: string[]; tag?: string; tags?: (string|number)[]; minPrice?: number; maxPrice?: number; myFavorites?: boolean; promoOnly?: boolean; sort?: 'relevance'|'newest'|'price_asc'|'price_desc'|'popularity'|'rating'|'my_favorites' }): Promise<{ total: number; totalPages: number; page: number; pageSize: number; meta?: StoreMeta }> {
    // Try server endpoint if available
    try {
      await this.tenantLoja.ensureHostResolved();
      const token = this.getStoredJwt();
      const slug = this.tenantLoja.lojaSlug();
      const merged = { ...(params || {}), ...(slug ? { parceiro_slug: slug } : {}) };
  const res = await this.api.listStoreProducts(merged, token).toPromise();
      const raw = Array.isArray(res) ? res : ((res as any)?.data || (res as any)?.items || []);
      const list: ShopProduct[] = (raw || []).map((it: any) => {
        const price = Number(it.priceOriginal ?? it.preco ?? it.price ?? (typeof it.price === 'string' ? parseFloat(it.price) : 0));
        const finalFromApi = it.priceFinal != null ? Number(it.priceFinal) : null;
        const rawPromo = it.promo_price != null ? Number(it.promo_price) : (it.promoPrice != null ? Number(it.promoPrice) : null);
        const promoCandidate =
          rawPromo != null && Number.isFinite(rawPromo) && rawPromo < price - 0.009
            ? rawPromo
            : (finalFromApi != null && Number.isFinite(finalFromApi) && finalFromApi < price - 0.009 ? finalFromApi : null);
        const promoPrice = promoCandidate;
        const discountFromPromo = (promoPrice != null && price > 0) ? Math.max(0, (1 - promoPrice / price) * 100) : 0;
        const discountPercent = (it.discount && typeof it.discount.percent === 'number') ? Number(it.discount.percent)
          : (typeof it.desconto === 'number' ? Number(it.desconto) : 0);
        const desconto = discountPercent || discountFromPromo;
        const flagDestaque = (it.destaque ?? it.featured ?? it.highlight ?? it.destaque_home ?? it.destacado);
        const hasTagDestaque = Array.isArray(it.tags) && it.tags.some((t: any) => {
          const s = (typeof t === 'object' && t != null) ? (t.nome || t.name || '') : (t || '');
          return s.toString().toLowerCase().includes('destaque') || s.toString().toLowerCase().includes('featured') || s.toString().toLowerCase().includes('highlight');
        });
        const layoutRaw = (it.card_layout || 'sales').toString().toLowerCase();
        const cardLayout: 'sales' | 'banner' = layoutRaw === 'banner' ? 'banner' : 'sales';
        const strikePrice = it.strikePrice != null ? Number(it.strikePrice) : null;
        const shortD = it.shortDescription != null && String(it.shortDescription).trim() !== '' ? String(it.shortDescription) : null;
        const longD = (it.descricao != null && String(it.descricao) !== '') ? String(it.descricao) : (it.description != null ? String(it.description) : '');
        const lineDesc = shortD != null ? shortD : longD;

        const tagStrings = Array.isArray(it.tags)
          ? (it.tags as any[]).map((t) => {
            if (t == null) return '';
            if (typeof t === 'object' && (t as any).nome) return String((t as any).nome);
            if (typeof t === 'object' && (t as any).name) return String((t as any).name);
            return String(t);
          }).filter((s) => s.length > 0)
          : undefined;

        const catFromApi: Array<{ id: number; nome: string; slug?: string }> = Array.isArray(it.categorias)
          ? (it.categorias as any[]).map((c) => ({
            id: Number(c.id),
            nome: String(c.nome || ''),
            slug: c.slug != null ? String(c.slug) : undefined,
          })).filter((c) => Number.isFinite(c.id) && c.nome)
          : [];
        const category =
          (catFromApi[0]?.nome) ||
          (it.categoria_nome != null ? String(it.categoria_nome) : '') ||
          (it.categoria != null ? String(it.categoria) : '') ||
          (it.category != null ? String(it.category) : '');

        const gallery = Array.isArray(it.images)
          ? (it.images as any[]).map((im) => ({
            id: Number(im.id),
            url: String(im.url || ''),
            posicao: im.posicao != null ? Number(im.posicao) : (im.ordem != null ? Number(im.ordem) : null),
          })).filter((im) => Number.isFinite(im.id) && im.url.length > 0)
          : [];
        const primaryImg = (it.imageUrl || it.imagem_url || it.image || gallery[0]?.url || '').toString().trim();

        const disc = it.discount;
        const pro = disc && typeof disc === 'object' && disc.promotion && typeof disc.promotion === 'object' ? disc.promotion as Record<string, unknown> : null;
        const apiDiscount = disc && typeof disc === 'object' ? {
          value: Number(disc.value ?? 0),
          percent: Number(disc.percent ?? 0),
          promotionId: disc.promotionId != null ? (disc.promotionId as number) : (disc.promotion_id != null ? (disc.promotion_id as number) : null),
          promotion: pro && pro['id'] != null ? {
            id: Number(pro['id']),
            nome: pro['nome'] as string | undefined,
            descricao: pro['descricao'] as string | undefined,
            tipo: pro['tipo'] as string | undefined,
            valor: pro['valor'] != null ? Number(pro['valor']) : null,
            inicio: pro['inicio'] as string | null | undefined,
            fim: pro['fim'] as string | null | undefined,
          } : null,
        } : null;

        const estoqueVal = it.estoque != null ? Number(it.estoque) : null;
        let inStock: boolean | number | null | undefined;
        if (typeof it.in_stock === 'boolean') inStock = it.in_stock;
        else if (estoqueVal != null && Number.isFinite(estoqueVal)) inStock = estoqueVal > 0;
        else inStock = it.inStock;

        return {
          id: Number(it.id),
          name: it.nome || it.name,
          description: lineDesc,
          shortDescription: shortD,
          price,
          priceOriginal: price,
          priceFinal: finalFromApi != null && Number.isFinite(finalFromApi) ? finalFromApi : null,
          promoPrice,
          image: primaryImg,
          imageUrl: primaryImg || null,
          images: gallery.length ? gallery : undefined,
          category,
          categoriasList: catFromApi.length ? catFromApi : undefined,
          tipo: it.tipo === 'manipulado' || it.tipo === 'pronto' ? it.tipo : undefined,
          discount: Math.max(0, Math.round(desconto * 100) / 100),
          apiDiscount,
          rating: (typeof it.rating_media === 'number') ? it.rating_media : (typeof it.rating_media === 'string' ? parseFloat(it.rating_media) : (it.rating?.media ?? undefined)),
          ratingsCount: (typeof it.rating_total === 'number') ? it.rating_total : (it.rating?.total ?? undefined),
          isFavorited: typeof it.is_favorited === 'boolean' ? it.is_favorited : (it.is_favorited === 1 ? true : (it.is_favorited === 0 ? false : undefined)),
          favoritesCount: typeof it.favoritos === 'number' ? it.favoritos : undefined,
          tags: tagStrings,
          featured: typeof flagDestaque === 'boolean' ? flagDestaque
            : (flagDestaque === 1 || flagDestaque === '1' ? true : (hasTagDestaque || false)),
          cardLayout,
          strikePrice: Number.isFinite(strikePrice as number) ? strikePrice : null,
          precoDe: it.preco_de != null ? Number(it.preco_de) : undefined,
          marca: it.marca ?? undefined,
          sku: it.sku ?? undefined,
          slug: it.slug ?? undefined,
          stock: estoqueVal != null && Number.isFinite(estoqueVal) ? estoqueVal : undefined,
          inStock,
          parcelas_max: it.parcelas_max != null ? Number(it.parcelas_max) : undefined,
          peso_valor: it.peso_valor != null ? Number(it.peso_valor) : undefined,
          peso_unidade: it.peso_unidade != null ? String(it.peso_unidade) : undefined,
          productCreatedAt: it.created_at ?? null,
          productUpdatedAt: it.updated_at ?? null,
          permiteCheckout: this.parsePermiteCheckout(it),
          vendidoParceiroExterno: this.parseVendidoParceiroExterno(it),
        } as ShopProduct;
      });

      this.productsSubject.next(list);
      // Keep favorites list in sync with server flags; merge across paginated loads
      const serverFavIds = list.filter(p => p.isFavorited === true).map(p => p.id);
      const isFavMode = !!params?.myFavorites;
      // If listing only favorites, replace entirely; otherwise, merge union with current
      const currentFavs = new Set(this.favoritesSubject.value);
      if (isFavMode) {
        const derivedFavIds = serverFavIds.length === 0 ? list.map(p => p.id) : serverFavIds;
        this.favoritesSubject.next(derivedFavIds);
        if (this.isBrowser()) localStorage.setItem('favorites', JSON.stringify(derivedFavIds));
      } else {
        for (const id of serverFavIds) currentFavs.add(id);
        const merged = Array.from(currentFavs);
        this.favoritesSubject.next(merged);
        if (this.isBrowser()) localStorage.setItem('favorites', JSON.stringify(merged));
      }

      // Align current products snapshot isFavorited flags to favorites set, so icons render correctly
      {
        const favSet = new Set(this.favoritesSubject.value);
        const aligned = this.productsSubject.value.map(p => ({ ...p, isFavorited: favSet.has(p.id) }));
        this.productsSubject.next(aligned);
      }

      // Meta and categories/tags support
      const rawActiveTheme = (res && !Array.isArray(res) && res.meta?.activeTheme)
        ? (res.meta.activeTheme as LojaThemeActive)
        : null;
      const activeTheme: LojaThemeActive | null = rawActiveTheme
        ? { ...rawActiveTheme, config: normalizeThemeConfig(rawActiveTheme.config) as unknown as Record<string, unknown> }
        : null;

      const meta: StoreMeta | undefined = (res && !Array.isArray(res) && res.meta) ? {
        loggedIn: res.meta.loggedIn,
        userType: res.meta.userType,
        favoritesPersonalization: res.meta.favoritesPersonalization,
        supports: res.meta.supports,
        categories: res.meta.categories,
        tags: res.meta.tags,
        activeTheme,
      } : undefined;
      this.metaSubject.next(meta || null);
      try {
        this.storeTheme.applyTheme(meta?.activeTheme ?? null);
      } catch { /* SSR */ }
      const cats = meta?.categories || [];
      this.categoriesSubject.next(cats);
      return { total: (!Array.isArray(res) ? (res?.total || list.length) : list.length), totalPages: (!Array.isArray(res) ? (res?.totalPages || 1) : 1), page: (!Array.isArray(res) ? (res?.page || (params?.page || 1)) : (params?.page || 1)), pageSize: (!Array.isArray(res) ? (res?.pageSize || (params?.pageSize || 20)) : (params?.pageSize || 20)), meta };
    } catch {
      this.toast.error('Não foi possível carregar os produtos.', 'Erro');
      this.productsSubject.next([]);
      this.categoriesSubject.next([]);
      this.metaSubject.next(null);
      return { total: 0, totalPages: 1, page: params?.page || 1, pageSize: params?.pageSize || 20 };
    }
  }

  // Favorites
  /**
   * Optimistically set favorite state locally and update counts/icons immediately.
   * Call this before hitting the server; if the server fails, revert by calling again with previous state.
   */
  optimisticFavorite(productId: number, favorited: boolean): void {
    // Update favorites set
    const fav = new Set(this.favoritesSubject.value);
    if (favorited) fav.add(productId); else fav.delete(productId);
    const arr = Array.from(fav);
    this.favoritesSubject.next(arr);
    if (this.isBrowser()) localStorage.setItem('favorites', JSON.stringify(arr));

    // Update products snapshot (isFavorited + count)
    const list = this.productsSubject.value.map(p => {
      if (p.id !== productId) return p;
      const updated: ShopProduct = { ...p, isFavorited: favorited };
      const base = typeof p.favoritesCount === 'number' ? p.favoritesCount : 0;
      const delta = favorited ? 1 : -1;
      updated.favoritesCount = Math.max(0, base + delta);
      return updated;
    });
    this.productsSubject.next(list);
  }

  async toggleFavorite(productId: number): Promise<boolean> {
    const ok = await this.ensureClienteSession();
    if (!ok) return false;
    try {
      const token = this.getStoredJwt() || '';
      // Call backend toggle
      const resp = await this.api.toggleFavorite(productId, token).toPromise();
      const serverFavorited = typeof resp?.is_favorited === 'boolean'
        ? resp.is_favorited
        : (typeof resp?.favorited === 'boolean' ? resp.favorited : undefined);
      // Update local favorites set and product snapshot aligned to server
      const fav = new Set(this.favoritesSubject.value);
      const shouldBeFav = serverFavorited != null ? serverFavorited : !fav.has(productId);
      if (shouldBeFav) {
        fav.add(productId);
        this.toast.success('Adicionado aos favoritos');
      } else {
        fav.delete(productId);
        this.toast.info('Removido dos favoritos');
      }
      const arr = Array.from(fav);
      this.favoritesSubject.next(arr);
      if (this.isBrowser()) {
        localStorage.setItem('favorites', JSON.stringify(arr));
      }
      // Sync product snapshot with favoritesCount and isFavorited
      const list = this.productsSubject.value.map(p => {
        if (p.id !== productId) return p;
        const updated: ShopProduct = { ...p };
        if (typeof resp?.favoritos === 'number') {
          updated.favoritesCount = resp.favoritos;
        } else if (serverFavorited != null) {
          // Fallback: infer delta from previous state when server doesn't send count
          const prev = !!p.isFavorited;
          if (prev !== serverFavorited) {
            const delta = serverFavorited ? 1 : -1;
            const base = typeof p.favoritesCount === 'number' ? p.favoritesCount : 0;
            updated.favoritesCount = Math.max(0, base + delta);
          }
        }
        if (serverFavorited != null) updated.isFavorited = serverFavorited;
        return updated;
      });
      this.productsSubject.next(list);
      return true;
    } catch (e) {
      this.toast.error('Não foi possível atualizar favoritos no servidor.');
      return false;
    }
  }

  isFavorite(productId: number): boolean {
    return this.favoritesSubject.value.includes(productId);
  }

  /**
   * Refresh favorites list from server without replacing current products grid.
   * Useful right after login or when opening the favorites route directly.
   */
  async refreshFavorites(): Promise<void> {
    try {
      await this.tenantLoja.ensureHostResolved();
      const token = this.getStoredJwt();
      if (!token) return;
      const slug = this.tenantLoja.lojaSlug();
      const res: any = await this.api.listStoreProducts({ myFavorites: true, page: 1, pageSize: 9999, ...(slug ? { parceiro_slug: slug } : {}) }, token).toPromise();
      const list = (res?.data || []) as any[];
      const favIds = list.map((it: any) => Number(it.id)).filter((n: any) => Number.isFinite(n));
      this.favoritesSubject.next(favIds);
      if (this.isBrowser()) localStorage.setItem('favorites', JSON.stringify(favIds));
      // Align product flags with refreshed favorites
      const favSet = new Set(this.favoritesSubject.value);
      const aligned = this.productsSubject.value.map(p => ({ ...p, isFavorited: favSet.has(p.id) }));
      this.productsSubject.next(aligned);
    } catch {
      // ignore; keep local favorites
    }
  }

  // Cart
  get cartSnapshot() { return this.cartSubject.value; }

  async addToCart(product: ShopProduct, quantity: number = 1): Promise<boolean> {
    if (quantity <= 0) return false;
    if (product.permiteCheckout === false) {
      this.toast.info('Esta é uma solução PetSphere — siga para conhecer e contratar.');
      return false;
    }
    const ok = await this.ensureClienteSession();
    if (!ok) return false;
    const cart = [...this.cartSubject.value];
    const idx = cart.findIndex(ci => ci.product.id === product.id);
    if (idx >= 0) cart[idx] = { ...cart[idx], quantity: cart[idx].quantity + quantity };
    else cart.push({ product, quantity });
    this.cartSubject.next(cart);
    this.persistCart(cart);
    this.toast.success('Produto adicionado ao carrinho');
    return true;
  }

  /** Lê permite_checkout / permiteCheckout do payload da API; default = true. */
  private parsePermiteCheckout(it: any): boolean {
    const raw = it?.permite_checkout ?? it?.permiteCheckout;
    if (raw == null) return true;
    if (typeof raw === 'boolean') return raw;
    return Number(raw) !== 0;
  }

  private parseVendidoParceiroExterno(it: any): boolean {
    const raw = it?.vendido_parceiro_externo ?? it?.vendidoParceiroExterno;
    if (raw == null) return false;
    if (typeof raw === 'boolean') return raw;
    return Number(raw) === 1;
  }

  removeFromCart(productId: number) {
    const cart = this.cartSubject.value.filter(ci => ci.product.id !== productId);
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  updateQuantity(productId: number, quantity: number) {
    if (quantity <= 0) return this.removeFromCart(productId);
    const cart = this.cartSubject.value.map(ci =>
      ci.product.id === productId ? { ...ci, quantity } : ci
    );
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  clearCart() {
    this.cartSubject.next([]);
    this.persistCart([]);
  }

  getCartTotals() {
    const items = this.cartSubject.value;
    const subtotal = items.reduce((sum, it) => sum + this.getPriceWithDiscount(it.product) * it.quantity, 0);
    const total = subtotal; // frete/impostos no futuro
    const count = items.reduce((n, it) => n + it.quantity, 0);
    return { count, subtotal, total };
  }

  getPriceWithDiscount(p: ShopProduct) {
    if (p.promoPrice != null) return p.promoPrice;
    const price = p.price || 0;
    const disc = p.discount || 0;
    return Math.max(0, price - price * disc / 100);
  }

  // Load full product details by ID
  async loadProductDetails(id: number | string): Promise<LoadProductDetailsResult> {
    try {
      await this.tenantLoja.ensureHostResolved();
      const token = this.getStoredJwt();
      const slug = this.tenantLoja.lojaSlug();
      const it = await this.api.getProductById(id, token, slug ? { parceiro_slug: slug } : undefined).toPromise();
      if (!it) return { product: null, error: 'unknown' };
      const basePrice = Number(it.preco ?? it.price ?? 0);
      const promoP = it.promoPrice != null ? Number(it.promoPrice) : (it.promo_price != null ? Number(it.promo_price) : null);
      const imRaw = Array.isArray(it.images) ? it.images : (Array.isArray(it.imagens) ? it.imagens : []);
      const descFull = it.descricao != null && String(it.descricao) !== '' ? String(it.descricao) : (it.description || it.shortDescription || '');
      const catRow0: { nome?: string } | undefined = Array.isArray(it.categorias) && it.categorias.length
        ? (it.categorias[0] as { nome?: string })
        : undefined;
      const catFirst = it.categoria != null && String(it.categoria) !== '' ? String(it.categoria) : (catRow0?.nome ? String(catRow0.nome) : '');
      const discPct = typeof it.discount === 'object' && it.discount != null && (it.discount as any).percent != null
        ? Number((it.discount as any).percent)
        : (it.desconto != null
          ? Number(it.desconto)
          : (promoP != null && basePrice > 0 ? Math.max(0, ((basePrice - promoP) / basePrice) * 100) : 0));
      const strk = it.strikePrice != null && Number.isFinite(Number(it.strikePrice)) ? Number(it.strikePrice) : null;
      const pDe = it.precoDe != null ? Number(it.precoDe) : (it.preco_de != null ? Number(it.preco_de) : null);
      const cLayout = (it.card_layout || it.cardLayout || 'sales') as string;
      const dosagensArr = Array.isArray(it.dosagens)
        ? (it.dosagens as Array<{ id?: number; nome?: string }>)
          .map((d) => ({ id: Number(d.id), nome: String(d.nome || '') }))
          .filter((d) => d.nome)
        : [];
      const embalagensArr = Array.isArray(it.embalagens)
        ? (it.embalagens as Array<{ id?: number; nome?: string }>)
          .map((e) => ({ id: Number(e.id), nome: String(e.nome || '') }))
          .filter((e) => e.nome)
        : [];
      const customFromApi = it.customizations && typeof it.customizations === 'object' ? it.customizations as { dosage?: unknown; packaging?: unknown } : null;
      const customizationsMerged: ShopProductCustomizations = {
        dosage: Array.isArray(customFromApi?.dosage)
          ? (customFromApi.dosage as string[]).map(String)
          : dosagensArr.map((d) => d.nome),
        packaging: Array.isArray(customFromApi?.packaging)
          ? (customFromApi.packaging as string[]).map(String)
          : embalagensArr.map((e) => e.nome),
      };
      const compostosAtivos: Array<{ label: string }> = Array.isArray((it as { compostos_ativos?: unknown }).compostos_ativos)
        ? ((it as { compostos_ativos: Array<{ label?: string }> }).compostos_ativos || [])
          .map((c) => (c && c.label != null && String(c.label).trim() !== '' ? { label: String(c.label).trim() } : null))
          .filter((c): c is { label: string } => c != null)
        : [];
      const p: ShopProduct = {
        id: Number(it.id),
        name: it.nome || it.name,
        description: descFull,
        price: basePrice,
        promoPrice: promoP,
        image: it.imagem_url || it.image || it.imageUrl || '',
        imageUrl: it.imageUrl ?? (it.imagem_url || it.image || null),
        images: imRaw.map((im: any) => ({ id: Number(im.id), url: im.url, posicao: im.posicao ?? null })),
        category: it.categoria || it.category || catFirst,
        tipo: it.tipo === 'manipulado' || it.tipo === 'pronto' ? it.tipo : undefined,
        customizations: customizationsMerged,
        dosagens: dosagensArr.length ? dosagensArr : undefined,
        embalagens: embalagensArr.length ? embalagensArr : undefined,
        compostosAtivos: compostosAtivos.length ? compostosAtivos : undefined,
        og_image_url: it.og_image_url != null && String(it.og_image_url).trim() !== '' ? String(it.og_image_url) : null,
        discount: discPct,
        rating: it.rating?.media ?? it.rating_media ?? undefined,
        ratingsCount: it.rating?.total ?? it.rating_total ?? undefined,
        isFavorited: typeof it.is_favorited === 'boolean' ? it.is_favorited : undefined,
        favoritesCount: typeof it.favoritos === 'number' ? it.favoritos : undefined,
        stock: (() => {
          const v = it.inStock !== undefined && it.inStock !== null ? it.inStock : it.in_stock;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (v === null || v === undefined) return undefined;
          return Number(v);
        })(),
        inStock: it.inStock !== undefined ? it.inStock : it.in_stock,
        tags: Array.isArray(it.tags) ? it.tags.map((t: any) => t.nome || t.name || String(t)) : undefined,
        requiresPrescription: it.requiresPrescription ?? (it.exige_receita ? !!it.exige_receita : undefined),
        sku: it.sku ?? null,
        marca: it.marca ?? null,
        composicao: it.composicao ?? null,
        modo_uso: it.modo_uso ?? null,
        indicacoes: it.indicacoes ?? null,
        contraindicacoes: it.contraindicacoes ?? null,
        exige_receita: it.exige_receita ?? null,
        validade_meses: it.validade_meses != null ? Number(it.validade_meses) : null,
        armazenamento: it.armazenamento ?? null,
        video_url: it.video_url ?? null,
        variantes: Array.isArray(it.variantes) ? it.variantes.map((v: any) => ({
          id: v.id ?? undefined,
          nome: v.nome,
          sku: v.sku ?? null,
          preco: v.preco != null ? Number(v.preco) : null,
          preco_de: v.preco_de != null ? Number(v.preco_de) : null,
          estoque: v.estoque != null ? Number(v.estoque) : null,
          peso_g: v.peso_g != null ? Number(v.peso_g) : null,
          ativo: !!v.ativo,
        })) : [],
        documentos: Array.isArray(it.documentos) ? it.documentos.map((d: any) => ({
          id: d.id ?? undefined,
          nome: d.nome,
          url: d.url,
          tipo: d.tipo ?? null,
        })) : [],
        cupons_aplicaveis: Array.isArray(it.cupons_aplicaveis) ? it.cupons_aplicaveis : [],
        strikePrice: strk,
        precoDe: pDe,
        slug: it.slug ?? null,
        cardLayout: cLayout.toLowerCase() === 'banner' ? 'banner' : 'sales',
        codigo_barras: it.codigo_barras ?? null,
        registro_mapa: it.registro_mapa ?? null,
        parcelas_max: it.parcelas_max != null ? Number(it.parcelas_max) : null,
        meta_title: it.meta_title ?? null,
        meta_description: it.meta_description ?? null,
        peso_valor: it.peso_valor != null ? Number(it.peso_valor) : null,
        peso_unidade: it.peso_unidade ?? null,
        categoriasList: Array.isArray(it.categorias)
          ? (it.categorias as Array<{ id?: number; nome?: string; slug?: string }>)
            .map((c) => ({ id: Number(c.id), nome: String(c.nome), slug: c.slug }))
            .filter((c) => c.nome)
          : undefined,
        shortDescription: it.shortDescription != null ? String(it.shortDescription) : null,
        priceOriginal: it.priceOriginal != null ? Number(it.priceOriginal) : null,
        priceFinal: it.priceFinal != null ? Number(it.priceFinal) : null,
        apiDiscount: typeof it.discount === 'object' && it.discount != null && 'percent' in (it.discount as object)
          ? {
              value: Number((it.discount as { value?: number }).value ?? 0),
              percent: Number((it.discount as { percent?: number }).percent ?? 0),
              promotionId: (it.discount as { promotionId?: number | null }).promotionId != null
                ? Number((it.discount as { promotionId?: number | null }).promotionId)
                : null
            }
          : null,
        activePromotion: it.promotion && (it.promotion as { id?: number }).id != null
          ? {
              id: Number((it.promotion as { id: number }).id),
              nome: (it.promotion as { nome?: string }).nome,
              descricao: (it.promotion as { descricao?: string }).descricao,
              tipo: (it.promotion as { tipo?: string }).tipo,
              valor: (it.promotion as { valor?: number }).valor != null ? Number((it.promotion as { valor: number }).valor) : undefined,
              inicio: (it.promotion as { inicio?: string | null }).inicio ?? null,
              fim: (it.promotion as { fim?: string | null }).fim ?? null,
              ativo: !!(it.promotion as { ativo?: boolean }).ativo
            }
          : null,
        productCreatedAt: it.created_at ?? it.createdAt ?? null,
        productUpdatedAt: it.updated_at ?? it.updatedAt ?? null,
        permiteCheckout: this.parsePermiteCheckout(it),
        vendidoParceiroExterno: this.parseVendidoParceiroExterno(it),
      };
      return { product: p };
    } catch (e: unknown) {
      const status = e instanceof HttpErrorResponse ? e.status : (e as { status?: number })?.status;
      if (status === 404) {
        return { product: null, error: 'not_found' };
      }
      if (status != null && status >= 500) {
        return { product: null, error: 'server' };
      }
      if (status == null || status === 0) {
        return { product: null, error: 'server' };
      }
      return { product: null, error: 'unknown' };
    }
  }

  // Session helpers
  async isClienteLoggedSilent(): Promise<boolean> {
    // During SSR we should not attempt network calls; assume not logged.
    if (!this.isBrowser()) {
      this.clienteChecked = true;
      this.isCliente = false;
      return false;
    }
    if (this.clienteChecked) return this.isCliente;
    try {
      const resp = await this.getClienteMe();
      if (resp && resp.user && resp.user.tipo === 'cliente') {
        this.clienteChecked = true;
        this.isCliente = true;
        return true;
      }
      this.clienteChecked = true;
      this.isCliente = false;
      return false;
    } catch {
      this.clienteChecked = true;
      this.isCliente = false;
      return false;
    }
  }

  resetClienteGate() {
    this.clienteChecked = false;
    this.isCliente = false;
  }

  private async ensureClienteSession(): Promise<boolean> {
    if (this.clienteChecked) return this.isCliente;
    // Tenta validar via backend (clientes/me). Se falhar, redireciona para login de cliente.
    try {
      const resp = await this.getClienteMe();
      if (resp && resp.user && resp.user.tipo === 'cliente') {
        this.clienteChecked = true;
        this.isCliente = true;
        return true;
      }
      throw new Error('Não é cliente');
    } catch {
      this.clienteChecked = true;
      this.isCliente = false;
      this.toast.info('Faça login de cliente para usar favoritos e carrinho.', 'Login necessário');
      return false;
    }
  }

  // Persistence
  private readFavorites(): number[] {
    if (!this.isBrowser()) return [];
    try { return JSON.parse(localStorage.getItem('favorites') || '[]'); } catch { return []; }
  }

  private readCart(): CartItem[] {
    if (!this.isBrowser()) return [];
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  }

  private persistCart(cart: CartItem[]) {
    if (!this.isBrowser()) return;
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  // Prescription helpers
  setItemPrescriptionById(productId: number, data: { prescriptionId?: string; prescriptionFileName?: string }) {
    const cart = this.cartSubject.value.map(ci =>
      ci.product.id === productId ? { ...ci, ...data } : ci
    );
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  /**
   * Returns true if all items that require prescription have either a linked
   * system prescription (prescriptionId) or an uploaded PDF (prescriptionFileName)
   */
  isCheckoutAllowed(): boolean {
    return this.cartSubject.value.every(ci => {
      if (!ci.product.requiresPrescription) return true;
      return Boolean(ci.prescriptionId || ci.prescriptionFileName);
    });
  }

  // Checkout context helpers
  setCheckoutContext(ctx: any) {
    this.checkoutContextSubject.next(ctx);
    if (this.isBrowser()) localStorage.setItem('checkoutContext', JSON.stringify(ctx));
  }
  getCheckoutContext(): any | null {
    const ctx = this.checkoutContextSubject.value;
    if (ctx) return ctx;
    if (this.isBrowser()) {
      try { return JSON.parse(localStorage.getItem('checkoutContext') || 'null'); } catch { return null; }
    }
    return null;
  }

  // Replace entire cart (silent)
  setCart(cart: CartItem[]) {
    this.cartSubject.next(cart);
    this.persistCart(cart);
  }

  // Order storage helpers
  setCreatedOrder(order: any | null) {
    this.createdOrderSubject.next(order);
    if (this.isBrowser()) localStorage.setItem('createdOrder', JSON.stringify(order));
  }
  getCreatedOrder(): any | null {
    const cur = this.createdOrderSubject.value;
    if (cur) return cur;
    if (this.isBrowser()) {
      try { return JSON.parse(localStorage.getItem('createdOrder') || 'null'); } catch { return null; }
    }
    return null;
  }
}
