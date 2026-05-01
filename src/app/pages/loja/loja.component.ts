import { Component, OnInit, ElementRef, ViewChild, Renderer2, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { StoreService, ShopProduct, StoreCategory, StoreMeta } from '../../services/store.service';
import { ToastService } from '../../services/toast.service';
import { FooterComponent } from '../../footer/footer.component';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { RastreioLojaService } from '../../services/rastreio-loja.service';
import { ProductCardRendererComponent } from '../../product-cards/product-card-renderer.component';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../../constants/card.constants';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { normalizeCatalogConfig } from '../../constants/loja-tema-card.config';
import { BannedUserModalService } from '../../services/banned-user-modal.service';
import { isAccountBannedHttpError } from '../../utils/account-ban.util';
import { MARCA_NOME } from '../../constants/loja-public';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-loja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FooterComponent, ProductCardRendererComponent, BannerSlotComponent],
  templateUrl: './loja.component.html',
  styleUrls: ['./loja.component.scss']
})
export class LojaComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly marcaNome = MARCA_NOME;
  public readonly defaultCardWidth = DEFAULT_PRODUCT_CARD_WIDTH;
  categorias: StoreCategory[] = [];
  produtos: ShopProduct[] = [];
  // Infinite scroll accumulation
  private accum: ShopProduct[] = [];
  // Memoized render lists to avoid recomputation on every change detection
  interleavedList: ShopProduct[] = [];
  featuredTopList: ShopProduct[] = [];
  featuredRowList: ShopProduct[] = [];
  storeMeta: StoreMeta | null = null;
  filtro = '';
  categoria = '';
  sort: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'my_favorites' = 'relevance';
  onlyFavorites = false;
  // Pagination
  page = 1;
  pageSize = 20;
  total = 0;
  totalPagesSrv = 1;
  loading = false;
  // Auth UI
  showLogin = false;
  closingLogin = false;
  showEmailLogin = false;
  email = '';
  senha = '';
  me: any = null;
  popoverTop = 0;
  popoverLeft = 0;
  private pendingProduct: ShopProduct | null = null;
  // Filters modal state
  showFilters = false;
  filtroDraft = '';
  categoriaDraft = '';
  sortDraft: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popularity' | 'my_favorites' = 'relevance';
  // Extra filters (applied)
  minPrice?: number;
  maxPrice?: number;
  promoOnly = false;
  inStockOnly = false;
  minRating?: number;
  // Drafts for modal
  minPriceDraft?: number;
  maxPriceDraft?: number;
  promoOnlyDraft = false;
  inStockOnlyDraft = false;
  minRatingDraft?: number;
  // UI responsive flag: true when viewport matches mobile breakpoint
  mobileView = false;
  /** Itens no carrinho (atualizado via cart$). */
  cartCount = 0;
  /** Ex.: "3 itens · R$ 89,90" para o botão do carrinho na barra da loja. */
  cartSummaryLine = '';
  private cartSub?: Subscription;
  private resizeListener?: () => void;
  private openLoginListener?: EventListenerOrEventListenerObject;

  get catalogColsMobile(): number {
    return normalizeCatalogConfig((this.storeMeta?.activeTheme?.config as any)?.catalog).columnsMobile;
  }

  get catalogColsDesktop(): number {
    return normalizeCatalogConfig((this.storeMeta?.activeTheme?.config as any)?.catalog).columnsDesktop;
  }

  @ViewChild('cartBtn', { static: true }) cartBtn?: ElementRef<HTMLButtonElement>;

  async ngOnInit() {
    // Subscriptions (lightweight) remain synchronous so UI reacts quickly
    this.store.products$.subscribe(p => {
      this.produtos = p;
      this.refreshProductRefs();
    });
    this.store.categories$.subscribe(c => this.categorias = c);
    this.store.meta$.subscribe(m => this.storeMeta = m);
    this.cartSub = this.store.cart$.subscribe(() => this.refreshCartBar());

    // Initialize mobileView and listen for resizes so template can conditionally
    // hide/skip the first item only on small screens.
    if (typeof window !== 'undefined') {
      this.mobileView = window.innerWidth <= 640;
      this.resizeListener = () => { this.mobileView = window.innerWidth <= 640; };
      window.addEventListener('resize', this.resizeListener, { passive: true });
      // Listen for global requests to open the login popover (e.g., from other components)
      this.openLoginListener = () => this.openLoginAfterScrollTop();
      window.addEventListener('open-login', this.openLoginListener as EventListener);
    }

    // React to global auth changes: apenas atualiza perfil; não refaz produtos
    this.auth.isLoggedIn$.subscribe(async ok => {
      if (this.lastLoggedIn === ok) return;
      this.lastLoggedIn = ok ?? false;
      if (ok) {
        await this.fetchMe();
      } else {
        this.me = null;
        this.store.resetClienteGate();
      }
    });

    // read query params to prefill filters (do not trigger initial fetch here)
    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q');
      const cat = params.get('cat');
      const login = params.get('login');
      const fav = params.get('fav');
      const srt = params.get('sort');
      const prom = params.get('promo');
      if (q !== null) this.filtro = q;
      if (cat !== null) this.categoria = cat;
      this.promoOnly = prom === '1';
      if (login === '1') {
        if (!this.auth.getToken()) this.openLoginAfterScrollTop(); else this.openLoginNearProfile();
      }
      this.onlyFavorites = fav === '1';
      if (srt) {
        const valid = ['relevance','newest','price_asc','price_desc','rating','popularity','my_favorites'] as const;
        if ((valid as readonly string[]).includes(srt)) this.sort = srt as any;
      }
      // mark that params were initialized; actual products fetch is deferred to initHeavy()
      if (!this.initializedFromParams) {
        this.initializedFromParams = true;
      } else {
        // subsequent param changes should trigger immediate fetch
        void this.fetchProducts(true).then(() => this.rebuildInterleavedAndFeatured());
      }
    });

    // Defer heavy operations in browser; run immediately on server for prerender
    const initHeavy = async () => {
      try { await this.fetchMe(); } catch {}
      if (!this.auth.getToken()) this.store.clearCart();
      // Ensure initial products load after params are processed
      try { await this.fetchProducts(true); this.rebuildInterleavedAndFeatured(); } catch {}
    };

    // Do not run heavy server-side fetches on SSR to keep response fast.
    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => void initHeavy());
      } else {
        setTimeout(() => void initHeavy(), 50);
      }
    }
  }
  @ViewChild('profileBtn') profileBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('infiniteAnchor') infiniteAnchor?: ElementRef<HTMLDivElement>;
  private io?: IntersectionObserver;
  private lastLoggedIn?: boolean;
  private lastFetchKey: string | null = null;
  private initializedFromParams = false;

  constructor(
    private store: StoreService,
    private toast: ToastService,
    private renderer: Renderer2,
    private api: ApiService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private rastreio: RastreioLojaService,
    private bannedModal: BannedUserModalService
  ) {}
 

  ngAfterViewInit(): void {
    // Set up infinite scroll observer in browser only
    if (typeof window === 'undefined') return;
    if (!('IntersectionObserver' in window)) return;
    this.io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          this.loadNextPageIfNeeded();
        }
      }
    }, { rootMargin: '240px' });
    if (this.infiniteAnchor?.nativeElement) this.io.observe(this.infiniteAnchor.nativeElement);
  }

  ngOnDestroy(): void {
    try { this.io?.disconnect(); } catch {}
    try { this.cartSub?.unsubscribe(); } catch {}
    try {
      if (typeof window !== 'undefined' && this.resizeListener) {
        window.removeEventListener('resize', this.resizeListener);
      }
      if (typeof window !== 'undefined' && this.openLoginListener) {
        window.removeEventListener('open-login', this.openLoginListener as EventListener);
      }
    } catch {}
  }

  private refreshCartBar(): void {
    const { count, total } = this.store.getCartTotals();
    this.cartCount = count;
    if (count <= 0) {
      this.cartSummaryLine = '';
      return;
    }
    const it = count === 1 ? 'item' : 'itens';
    this.cartSummaryLine = `${count} ${it} · ${this.formatCartBrl(total)}`;
  }

  private formatCartBrl(v: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
    } catch {
      return `R$ ${(v || 0).toFixed(2)}`;
    }
  }

  // Base list to display: accumulated (infinite) if present, else latest page
  private baseList(): ShopProduct[] {
    return (this.accum.length ? this.accum : this.produtos) || [];
  }

  get filtered(): ShopProduct[] {
    // Deixe o servidor cuidar de categoria, busca e ordenação.
    // Mantemos a lista como veio do backend; local só faz favoritos quando necessário.
    let base = this.baseList();
    if (this.onlyFavorites) {
      // Em modo favoritos, ainda assim buscamos no servidor, mas caso venha tudo, garantimos estado local coerente
      base = base.filter(p => this.isFav(p));
    }
    // Local filters (complementares ao servidor)
    const minP = typeof this.minPrice === 'number' ? this.minPrice : undefined;
    const maxP = typeof this.maxPrice === 'number' ? this.maxPrice : undefined;
    if (minP != null) base = base.filter(p => this.price(p) >= minP);
    if (maxP != null) base = base.filter(p => this.price(p) <= maxP);
    if (this.promoOnly) base = base.filter(p => (p.discount || 0) > 0);
    if (typeof this.minRating === 'number' && this.minRating > 0) base = base.filter(p => (p.rating || 0) >= this.minRating!);
    if (this.inStockOnly) base = base.filter(p => p.stock != null && p.stock > 0);
    return base;
  }

  // Paginated slice of filtered (server paginates; local slice only if we truly filtered local-only)
  get paginated(): ShopProduct[] {
    return this.filtered;
  }

  // Rebuild memoized lists when data or filters change
  private rebuildInterleavedAndFeatured() {
    // Destaques e catálogo usam o mesmo card, sem misturar estruturas.
    const filtered = this.filtered;
    const feats = filtered.filter((p) => !!(p as any).featured);
    const sorted = feats.length ? [...feats].sort((a, b) => (b.discount || 0) - (a.discount || 0)) : [];
    this.featuredTopList = sorted.slice(0, 6);
    this.featuredRowList = this.featuredTopList.slice(0, 6);
    this.interleavedList = filtered;
  }

  // trackBy helpers to avoid DOM re-creation and image flicker
  trackInterleaved = (_: number, p: ShopProduct) => p.id;
  trackProduct = (_: number, p: ShopProduct) => p.id;
  trackCategory = (_: number, c: StoreCategory) => c.id ?? c.nome;
  trackFilter = (_: number, f: { key: string; label: string }) => f.key;

  // Mantém listas apontando para os objetos de produto mais recentes vindos da Store
  private refreshProductRefs() {
    if (!this.produtos || this.produtos.length === 0) return;
    const map = new Map<number, ShopProduct>(this.produtos.map(p => [p.id, p]));
    if (this.accum && this.accum.length) {
      this.accum = this.accum.map(p => map.get(p.id) || p);
    }
    // Reconstroi listas de renderização para refletir counts/flags atualizados
    this.rebuildInterleavedAndFeatured();
  }

  totalPages(): number { return this.totalPagesSrv; }
  pageStart(): number { return (this.page - 1) * this.pageSize + 1; }
  pageEnd(): number { const totalLocal = this.total; return Math.min(this.page * this.pageSize, totalLocal); }
  canPrev(): boolean { return this.page > 1; }
  canNext(): boolean { return this.page < this.totalPages(); }
  async prevPage() { if (this.canPrev()) { this.page--; await this.fetchProducts(); } }
  async nextPage() { if (this.canNext()) { this.page++; await this.fetchProducts(); } }
  async goToPage(p: number) { const t = this.totalPages(); this.page = Math.min(Math.max(1, p), t); await this.fetchProducts(); }
  async onChangePageSize(ev: Event) { const v = Number((ev.target as HTMLSelectElement).value) || 20; this.pageSize = v; this.page = 1; await this.fetchProducts(); }

  // Active filters summary for UI badges
  get activeFilters(): string[] {
    const out: string[] = [];
    if (this.filtro?.trim()) out.push(`Busca: ${this.filtro.trim()}`);
    // Categoria selecionada não deve aparecer nos badges
    if (typeof this.minPrice === 'number') out.push(`Min: ${this.formatBRL(this.minPrice)}`);
    if (typeof this.maxPrice === 'number') out.push(`Max: ${this.formatBRL(this.maxPrice)}`);
    if (this.promoOnly) out.push('Promoção');
    if (this.inStockOnly) out.push('Com estoque');
    if (typeof this.minRating === 'number' && this.minRating > 0) out.push(`Nota: ${this.minRating}+`);
    if (this.sort && this.sort !== 'relevance') {
      const labelMap: any = { newest: 'Mais recentes', price_asc: 'Menor preço', price_desc: 'Maior preço', rating: 'Melhor avaliação', popularity: 'Mais populares', my_favorites: 'Favoritos' };
      out.push(`Ordenação: ${labelMap[this.sort] || this.sort}`);
    }
    return out;
  }

  // Structured filters for dismissible badges outside the modal
  get activeFiltersDetailed(): Array<{ key: string; label: string }> {
    const out: Array<{ key: string; label: string }> = [];
    if (this.filtro?.trim()) out.push({ key: 'q', label: `Busca: ${this.filtro.trim()}` });
    if (typeof this.minPrice === 'number') out.push({ key: 'min', label: `Min: ${this.formatBRL(this.minPrice)}` });
    if (typeof this.maxPrice === 'number') out.push({ key: 'max', label: `Max: ${this.formatBRL(this.maxPrice)}` });
    if (this.promoOnly) out.push({ key: 'promo', label: 'Promoção' });
    if (this.inStockOnly) out.push({ key: 'stock', label: 'Com estoque' });
    if (typeof this.minRating === 'number' && this.minRating > 0) out.push({ key: 'rating', label: `Nota: ${this.minRating}+` });
    if (this.sort && this.sort !== 'relevance') {
      const labelMap: any = { newest: 'Mais recentes', price_asc: 'Menor preço', price_desc: 'Maior preço', rating: 'Melhor avaliação', popularity: 'Mais populares', my_favorites: 'Favoritos' };
      out.push({ key: 'sort', label: `Ordenação: ${labelMap[this.sort] || this.sort}` });
    }
    return out;
  }

  async clearSearch() {
    if (!this.filtro) return;
    this.filtro = '';
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
    this.rebuildInterleavedAndFeatured();
  }

  async onClearSearch(ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    await this.clearSearch();
  }

  async clearFilterByKey(key: string) {
    switch (key) {
      case 'q':
        this.filtro = '';
        break;
      case 'min':
        this.minPrice = undefined;
        this.minPriceDraft = undefined;
        break;
      case 'max':
        this.maxPrice = undefined;
        this.maxPriceDraft = undefined;
        break;
      case 'promo':
        this.promoOnly = false;
        this.promoOnlyDraft = false;
        break;
      case 'stock':
        this.inStockOnly = false;
        this.inStockOnlyDraft = false;
        break;
      case 'rating':
        this.minRating = undefined;
        this.minRatingDraft = undefined;
        break;
      case 'sort':
        this.sort = 'relevance';
        this.sortDraft = 'relevance';
        break;
      case 'fav':
        this.onlyFavorites = false;
        break;
    }
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
    this.rebuildInterleavedAndFeatured();
  }

  async onClearFilter(ev: MouseEvent, key: string) {
    ev.preventDefault();
    ev.stopPropagation();
    await this.clearFilterByKey(key);
  }

  // Event delegation for badges container to improve click reliability on desktop
  onBadgesContainerClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    // If click lands on the inner X span or the button itself
    const badge = (target.closest('button.mini-badge.closable') as HTMLElement | null);
    const key = badge?.getAttribute('data-key');
    if (key) {
      ev.preventDefault();
      ev.stopPropagation();
      this.clearFilterByKey(key);
    }
  }

  

  private formatBRL(n: number): string {
    try { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${n}`; }
  }

  async onCategoryChange(val: string) {
    this.categoria = val;
    // Selecting a normal category disables promo-only mode
    this.promoOnly = false;
    this.page = 1;
    await this.fetchProducts(true);
    this.rebuildInterleavedAndFeatured();
    this.persistQueryParams();
  }
  async selectPromotions() {
    // Fixed "Promoções" category behavior
    this.promoOnly = true;
    this.categoria = '';
    this.page = 1;
    await this.fetchProducts(true);
    this.rebuildInterleavedAndFeatured();
    this.persistQueryParams();
  }
  async onSortChange(val: 'relevance'|'newest'|'price_asc'|'price_desc'|'rating'|'popularity') { this.sort = val; this.page = 1; await this.fetchProducts(true); this.rebuildInterleavedAndFeatured(); this.persistQueryParams(); }
  private queryDebounce?: any;
  async onQueryChange(val: string) {
    this.filtro = val;
    this.page = 1;
    // debounce quick typing to avoid spamming server
    if (this.queryDebounce) clearTimeout(this.queryDebounce);
    await new Promise<void>(resolve => {
      this.queryDebounce = setTimeout(async () => { await this.fetchProducts(true); this.rebuildInterleavedAndFeatured(); resolve(); }, 250);
    });
    this.persistQueryParams();
  }

  isFav(p: ShopProduct) { return this.store.isFavorite(p.id); }
  async toggleFav(p: ShopProduct) {
    // Require login
  const logged = await this.store.isClienteLoggedSilent();
  if (!logged) { this.openLoginAfterScrollTop(); return; }
    // Optimistic toggle
    const wasFav = this.store.isFavorite(p.id);
    this.store.optimisticFavorite(p.id, !wasFav);
    const ok = await this.store.toggleFavorite(p.id);
    if (!ok) {
      // revert
      this.store.optimisticFavorite(p.id, wasFav);
    }
  }
  openFilters() {
    // seed drafts with current
    this.filtroDraft = this.filtro;
    this.categoriaDraft = this.categoria;
    this.sortDraft = this.sort;
    this.minPriceDraft = this.minPrice;
    this.maxPriceDraft = this.maxPrice;
    this.promoOnlyDraft = this.promoOnly;
    this.inStockOnlyDraft = this.inStockOnly;
    this.minRatingDraft = this.minRating;
    this.showFilters = true;
  }
  closeFilters() { this.showFilters = false; }
  clearFilters() {
    this.filtroDraft = '';
    this.categoriaDraft = '';
    this.sortDraft = 'relevance';
    this.minPriceDraft = undefined;
    this.maxPriceDraft = undefined;
    this.promoOnlyDraft = false;
    this.inStockOnlyDraft = false;
    this.minRatingDraft = undefined;
  }
  async applyFilters() {
    this.filtro = this.filtroDraft;
    this.categoria = this.categoriaDraft;
    this.sort = this.sortDraft;
    this.minPrice = this.minPriceDraft;
    this.maxPrice = this.maxPriceDraft;
    this.promoOnly = this.promoOnlyDraft;
    this.inStockOnly = this.inStockOnlyDraft;
    this.minRating = this.minRatingDraft;
    this.page = 1;
    await this.fetchProducts();
    this.persistQueryParams();
    this.closeFilters();
  }
  async addToCart(p: ShopProduct): Promise<boolean> {
    const ok = await this.store.addToCart(p, 1);
    if (!ok) {
      this.pendingProduct = p;
      this.openLoginAfterScrollTop();
    }
    return ok;
  }
  price(p: ShopProduct) { return this.store.getPriceWithDiscount(p); }

  get hasBackendToken(): boolean {
    return !!this.auth.getToken();
  }

  async onAddToCart(p: ShopProduct, ev: Event) {
    // Demo SaaS: produto institucional vai para o detalhe (lá fica o CTA cadastro/planos).
    if (p.permiteCheckout === false) {
      ev?.preventDefault?.();
      this.router.navigate(['/produto', p.id], { queryParams: { src: 'loja' } });
      return;
    }
    if (!this.auth.getToken()) { this.openLoginAfterScrollTop(); return; }
    const ok = await this.addToCart(p);
    if (ok) this.flyToCart(ev);
  }

  // If user clicks cart link and is not logged in, intercept to open login
  async onCartClick(ev: MouseEvent) {
    ev.preventDefault();
    if (!this.auth.getToken()) { this.openLoginAfterScrollTop(); return; }
    this.router.navigate(['/carrinho']);
  }

  toggleFavoritesOnly() {
    this.onlyFavorites = !this.onlyFavorites;
    // reflect in query params and refetch when toggled off
    this.persistQueryParams();
    // Favoritos é um filtro: sempre refaz a consulta
    this.page = 1;
    this.fetchProducts(true).then(() => this.rebuildInterleavedAndFeatured());
  }

  private flyToCart(ev: Event) {
    try {
      if (!this.cartBtn) return;
      const target = ev.currentTarget as HTMLElement;
      const srcRect = target.getBoundingClientRect();
      const cartRect = this.cartBtn.nativeElement.getBoundingClientRect();
      const centerX = srcRect.left + srcRect.width / 2;
      const centerY = srcRect.top + srcRect.height / 2;
      const destX = cartRect.left + cartRect.width / 2;
      const destY = cartRect.top + cartRect.height / 2;
      const translateX = destX - centerX;
      const translateY = destY - centerY;

      const spawn = (cls: string, size: number, scaleStart: number, opacity: number, delayMs: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        if (cls) this.renderer.addClass(el, cls);
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        // position centered at source
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `${opacity}`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(${scaleStart})`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms cubic-bezier(.22,.61,.36,1), opacity ${durationMs}ms ease`);
        this.renderer.setStyle(el, 'transition-delay', `${delayMs}ms`);
        document.body.appendChild(el);

        // Force layout then animate
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(${translateX}px, ${translateY}px) scale(0.2)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + delayMs + 240);
      };

      // Origin ring for extra feedback
      const spawnRing = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${centerX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${centerY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `0.9`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(0.4)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        document.body.appendChild(el);
        // Force layout
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(1.6)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + 120);
      };

      // Destination burst near the cart
      const spawnDestBurst = (size: number, durationMs: number) => {
        const el = this.renderer.createElement('div');
        this.renderer.addClass(el, 'fly-dot');
        this.renderer.addClass(el, 'ring');
        this.renderer.setStyle(el, 'width', `${size}px`);
        this.renderer.setStyle(el, 'height', `${size}px`);
        this.renderer.setStyle(el, 'left', `${destX - size / 2}px`);
        this.renderer.setStyle(el, 'top', `${destY - size / 2}px`);
        this.renderer.setStyle(el, 'opacity', `0.95`);
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(0.4)`);
        this.renderer.setStyle(el, 'transition', `transform ${durationMs}ms ease-out, opacity ${durationMs}ms ease-out`);
        document.body.appendChild(el);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.clientHeight;
        this.renderer.setStyle(el, 'transform', `translate(0,0) scale(1.7)`);
        this.renderer.setStyle(el, 'opacity', `0`);
        setTimeout(() => el.remove(), durationMs + 120);
      };

  // Spawn a subtle ring at origin
  spawnRing(30, 900);
  // Main dot (bigger, brighter) - slower
  spawn('spark', 26, 1.35, 1, 0, 2000);
  // Trail dots - longer and more visible (extra clones for longer "rastro")
  spawn('ghost', 20, 1.24, 0.92, 120, 2200);
  spawn('tail', 16, 1.14, 0.84, 240, 2350);
  spawn('ghost', 14, 1.10, 0.76, 360, 2450);
  spawn('tail', 12, 1.06, 0.68, 480, 2550);
  spawn('ghost', 10, 1.04, 0.6, 600, 2650);

      // Pulse cart button on arrival
      const pulseDelay = 2000;
      setTimeout(() => {
        this.renderer.addClass(this.cartBtn!.nativeElement, 'pulse');
        setTimeout(() => this.renderer.removeClass(this.cartBtn!.nativeElement, 'pulse'), 800);
      }, pulseDelay);

      // Destination burst close to arrival for extra visibility
      setTimeout(() => spawnDestBurst(30, 700), pulseDelay - 120);
    } catch {
      // ignore animation errors silently
    }
  }

  // Inline auth
  async fetchMe() {
    try {
      const token = this.auth.getToken();
      if (!token) { this.me = null; return; }
      const resp = await this.api.getClienteMe(token).toPromise();
      this.me = resp?.user || null;
    } catch { this.me = null; }
  }

  toggleLogin(ev?: MouseEvent) {
    if (this.showLogin || this.closingLogin) {
      this.closeLogin();
      ev?.stopPropagation();
      return;
    }

    // If we have a backend token, go to Area do Cliente instead of opening the login popover
    if (this.auth.getToken()) {
      try { this.router.navigate(['/area-cliente']); } catch { }
      ev?.stopPropagation();
      return;
    }

    // Otherwise open the login popover
    this.showLogin = true;
    this.closingLogin = false;
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => this.positionPopover());
    } else {
      this.positionPopover();
    }
    ev?.stopPropagation();
  }

  toggleEmailLogin() {
    this.showEmailLogin = !this.showEmailLogin;
    // Ensure popover stays within viewport when content height changes
    this.positionPopover();
  }

  private positionPopover() {
    try {
      const btn = this.profileBtn?.nativeElement;
      if (!btn) { this.popoverTop = 100; this.popoverLeft = 100; return; }
      const rect = btn.getBoundingClientRect();
      // initial estimate
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.left + window.scrollX;
      // First clamp with rough size, then refine after render using actual element size
      const roughW = 300; const roughH = 260;
      const clamp = (w: number, h: number) => {
        const maxLeft = window.scrollX + window.innerWidth - w - 8;
        const maxTop = window.scrollY + window.innerHeight - h - 8;
        this.popoverLeft = Math.max(window.scrollX + 8, Math.min(left, maxLeft));
        // On mobile we slide in from right; align top to the login button with small offset
        const desiredTop = rect.top + window.scrollY - 8; // slightly above button center
        this.popoverTop = Math.max(window.scrollY + 8, Math.min(desiredTop, maxTop));
      };
      clamp(roughW, roughH);
      // next tick: measure and re-clamp
      setTimeout(() => {
        const el = document.querySelector('.login-popover') as HTMLElement | null;
        if (!el) return;
        const w = el.offsetWidth || roughW;
        const h = el.offsetHeight || roughH;
        clamp(w, h);
      }, 0);
    } catch { this.popoverTop = 100; this.popoverLeft = 100; }
  }

  closeLogin() {
    if (!this.showLogin || this.closingLogin) return;
    this.closingLogin = true;
    this.showEmailLogin = false;
  // Match the CSS mobile closing duration (.9s). Desktop closes immediately visually.
  const durationMs = 900;
    setTimeout(() => {
      this.showLogin = false;
      this.closingLogin = false;
    }, durationMs);
  }

  private openLoginNearProfile() {
    this.showLogin = true;
    this.closingLogin = false;
    this.positionPopover();
  }

  // When logged out and an action requires login: scroll to top, then open popover
  private openLoginAfterScrollTop() {
    try {
      if (typeof window === 'undefined') { this.openLoginNearProfile(); return; }
      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const open = () => setTimeout(() => this.openLoginNearProfile(), 20);
      // If already at top, just open
      if (window.scrollY <= 4) { open(); return; }
      if (prefersReduced) { window.scrollTo({ top: 0 }); open(); return; }
      let done = false;
      const onScroll = () => {
        if (done) return;
        if (window.scrollY <= 4) {
          done = true;
          window.removeEventListener('scroll', onScroll);
          open();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      // Fallback in case the scroll event doesn't fire
      setTimeout(() => { if (!done) { done = true; window.removeEventListener('scroll', onScroll); open(); } }, 700);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { this.openLoginNearProfile(); }
  }

  private persistQueryParams() {
    const queryParams: any = {};
    if (this.filtro) queryParams.q = this.filtro; else queryParams.q = null;
    if (this.categoria) queryParams.cat = this.categoria; else queryParams.cat = null;
    if (this.onlyFavorites) queryParams.fav = '1'; else queryParams.fav = null;
    if (this.promoOnly) queryParams.promo = '1'; else queryParams.promo = null;
    if (this.sort && this.sort !== 'relevance') queryParams.sort = this.sort; else queryParams.sort = null;
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  private buildFetchKey(extra?: any): string {
    const base = {
      page: this.page,
      pageSize: this.pageSize,
      categoria: this.categoria || undefined,
      filtro: this.filtro || undefined,
      onlyFavorites: this.onlyFavorites || undefined,
      sort: this.sort,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      promoOnly: this.promoOnly || undefined,
      inStockOnly: this.inStockOnly || undefined,
      minRating: this.minRating,
      ...extra
    };
    return JSON.stringify(base);
  }

  private async fetchProducts(reset: boolean = false) {
    const sortMap = { relevance: 'relevance', newest: 'newest', price_asc: 'price_asc', price_desc: 'price_desc', rating: 'rating', popularity: 'popularity', my_favorites: 'my_favorites' } as const;
    try {
  const key = this.buildFetchKey({ reset });
  if (key === this.lastFetchKey) return; // de-dupe identical requests even if 'reset' is same
      this.lastFetchKey = key;
      this.loading = true;
      if (reset) {
        this.accum = [];
        this.page = 1;
      }
      const useFavs = this.onlyFavorites ? true : undefined;
      const effectiveSort = this.onlyFavorites ? 'my_favorites' : sortMap[this.sort];
      const selected = this.categorias.find(c => c.nome === this.categoria);
      const res = await this.store.loadProducts({
        page: this.page,
        pageSize: this.pageSize,
        category: this.categoria || undefined,
        categoryId: selected?.id,
        q: this.filtro || undefined,
        myFavorites: useFavs,
        sort: effectiveSort,
        minPrice: typeof this.minPrice === 'number' ? this.minPrice : undefined,
        maxPrice: typeof this.maxPrice === 'number' ? this.maxPrice : undefined,
        promoOnly: this.promoOnly || undefined
      });
      this.total = res.total;
      this.totalPagesSrv = res.totalPages;
      this.page = res.page; // in case server adjusted
      this.pageSize = res.pageSize;
      // Current page items as provided by store
      const current = (this.produtos || []).slice();
      // Append to accumulation (dedupe by id)
      const seen = new Set(this.accum.map(p => p.id));
      for (const p of current) { if (!seen.has(p.id)) { this.accum.push(p); seen.add(p.id); } }
      // Rebuild memoized lists after mutating accum
      this.rebuildInterleavedAndFeatured();
    } finally {
      this.loading = false;
    }
  }

  private async loadNextPageIfNeeded() {
    if (this.loading) return;
    if (!this.canNext()) return;
    this.loading = true;
    this.page++;
    try {
      await this.fetchProducts(false);
      this.rebuildInterleavedAndFeatured();
    } finally {
      this.loading = false;
    }
  }

  private passesLocalFilters(p: ShopProduct): boolean {
    const minP = typeof this.minPrice === 'number' ? this.minPrice : undefined;
    const maxP = typeof this.maxPrice === 'number' ? this.maxPrice : undefined;
    if (minP != null && this.price(p) < minP) return false;
    if (maxP != null && this.price(p) > maxP) return false;
    if (this.promoOnly && !((p.discount || 0) > 0)) return false;
    if (typeof this.minRating === 'number' && this.minRating > 0 && (p.rating || 0) < this.minRating) return false;
    if (this.inStockOnly && !(p.stock != null && p.stock > 0)) return false;
    if (this.onlyFavorites && !this.isFav(p)) return false;
    return true;
  }

  async doLogin() {
    try {
      const vid = this.rastreio.getVisitanteId();
      const resp = await this.api.loginCliente({ email: this.email, senha: this.senha, visitanteId: vid }).toPromise();
      if (resp?.token) {
        // Broadcast login to the whole app
        this.auth.login(resp.token, true);
        try {
          this.rastreio.afterClienteLogin();
        } catch { /* */ }
        localStorage.setItem('userType', 'cliente');
        this.toast.success('Login realizado com sucesso');
        this.showLogin = false;
        this.email = '';
        this.senha = '';
        // Populate store cache and localStorage with fresh cliente/me data so other components
        // see the logged-in state immediately without transiently assuming logged-out.
        try {
          const meResp = await this.store.getClienteMe(true);
          this.me = meResp?.user || meResp || null;
        } catch {
          this.me = null;
        }
        // Não recarregamos produtos aqui para evitar chamadas extras; ícones usam flags do servidor nos cards carregados
        if (this.pendingProduct) {
          await this.store.addToCart(this.pendingProduct, 1);
          this.pendingProduct = null;
        }
      } else {
        this.toast.error('Não foi possível fazer login');
      }
    } catch (e: any) {
      if (isAccountBannedHttpError(e)) {
        await this.bannedModal.presentAfterBannedLogin();
        return;
      }
      this.toast.error(e?.error?.message || e?.error?.error || 'Falha no login');
    }
  }

  logout() {
    // Use AuthService to centralize token/state cleanup
    try { this.auth.logout(); } catch {}
    this.me = null;
    // Clear session-scoped data
    this.store.clearCart();
    this.store.resetClienteGate();
    // Close the login popover after logout
    this.closeLogin();
    this.toast.info('Você saiu da conta');
  }

  async resetSenha() {
    try {
      const email = this.email?.trim();
      if (!email) { this.toast.info('Informe seu e-mail para recuperar a senha'); return; }
      await this.auth.sendPasswordReset(email);
      this.toast.success('Enviamos um e-mail para redefinir sua senha.');
    } catch (e: any) {
      this.toast.error(e?.error?.message || 'Não foi possível enviar o e-mail de redefinição');
    }
  }

  async doLoginGoogle() {
    try {
      // Realiza login no Firebase para obter idToken e trocar no backend
      const res = await this.auth.loginGoogle();
      const idToken = await res.user.getIdToken();
      const resp = await this.api.loginCliente({ idToken, visitanteId: this.rastreio.getVisitanteId() }).toPromise();
      if (resp?.token) {
        // Broadcast login to the whole app
        this.auth.login(resp.token, true);
        try {
          this.rastreio.afterClienteLogin();
        } catch { /* */ }
        localStorage.setItem('userType', 'cliente');
        this.toast.success('Login com Google realizado');
        this.showLogin = false;
        try {
          const meResp = await this.store.getClienteMe(true);
          this.me = meResp?.user || meResp || null;
        } catch {
          this.me = null;
        }
        // Evita recarregar produtos aqui; manter comportamento de uma única chamada inicial
        if (this.pendingProduct) {
          await this.store.addToCart(this.pendingProduct, 1);
          this.pendingProduct = null;
        }
      } else {
        this.toast.error('Não foi possível logar com Google');
      }
    } catch (e: any) {
      if (isAccountBannedHttpError(e)) {
        await this.bannedModal.presentAfterBannedLogin();
        return;
      }
      this.toast.error(e?.error?.message || e?.error?.error || 'Falha no login com Google');
    }
  }
}
