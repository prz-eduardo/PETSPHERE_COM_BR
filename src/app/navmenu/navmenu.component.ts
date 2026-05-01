import {
  Component, AfterViewInit, ChangeDetectorRef, Inject, PLATFORM_ID, HostListener,
  OnDestroy, ViewChild, ViewContainerRef, ElementRef, OnInit
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, NavigationCancel, NavigationError, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { StoreService } from '../services/store.service';
import { AuthService } from '../services/auth.service';
import { gsap } from 'gsap';
import { ClienteAreaModalService, ClienteAreaModalView } from '../services/cliente-area-modal.service';
import { HapticsService } from '../services/haptics.service';
import { DockContextService, DockMode, DockActionId } from '../services/dock-context.service';
import { PsIconComponent, PsIconName } from '../shared/icons/ps-icon.component';

export interface NavMainItem {
  id: string;
  label: string;
  shortLabel?: string;
  link: string;
  icon: string;       // legacy FontAwesome (mantido para desktop top bar)
  psIcon?: PsIconName; // novo Petsphere icon family (mobile dock)
}

export interface QuickAction {
  id: DockActionId;
  label: string;
  caption?: string;
  link: string;
  icon: PsIconName;
  tone?: 'aurora' | 'aqua' | 'coral' | 'neutral';
}

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [RouterLink, CommonModule, PsIconComponent],
  templateUrl: './navmenu.component.html',
  styleUrls: ['./navmenu.component.scss']
})
export class NavmenuComponent implements OnInit, AfterViewInit, OnDestroy {
  // ─── Visibility / route signals ─────────────────────────────────────────────
  get showSlideMenu(): boolean {
    const url = this.currentRoute || '';
    if (url.startsWith('/restrito/admin') || url.startsWith('/restrito/produto')) return false;
    return true;
  }

  get isAreaVetRoute(): boolean { return (this.currentRoute || '').includes('/area-vet'); }

  user: any = null;
  userFoto: string | null = null;
  previousScroll: number = 0;
  isVisible = true;
  /** Compact mode (encolhe para pill) ao rolar — substitui o "hide" antigo no mobile. */
  isCompact = false;
  currentRoute: string = '';
  cartCount = 0;
  cartTotal = 0;
  cartBadgeBumping = false;
  isCliente = false;
  showFullMenu = true;
  selectedMainTabId: string | null = null;

  // ─── Aurora Dock state ──────────────────────────────────────────────────────
  /** Modo atual do dock: guest / cliente / vet / parceiro */
  dockMode: DockMode = 'guest';
  /** Cosmic mode (após 19h local) */
  isNight = false;
  /** Bottom sheet de ações rápidas (tap no FAB). */
  isSheetOpen = false;
  /** Radial menu (long-press no FAB) */
  isRadialOpen = false;
  /** Ações do radial — top 4 mais usadas (aprende com o tempo). */
  radialActions: QuickAction[] = [];
  /** Live Context Ribbon — visível quando há mensagem contextual relevante. */
  liveRibbon: { kind: 'cart' | 'reminder' | 'order'; text: string; cta?: string; link?: string } | null = null;
  liveRibbonClosing = false;
  private liveRibbonDismissed = false;

  // ─── Items: dock móvel = 4 abas + FAB ───────────────────────────────────────
  /**
   * Top desktop bar — mantém as 4 abas + (carrinho condicional) + sobre.
   * Carrinho desce para mini-bag em mobile, mas é mantido na lista
   * desktop para não quebrar `visibleNavItems` no top bar.
   */
  readonly mainNavItems: NavMainItem[] = [
    { id: 'galeria', label: 'Galeria', shortLabel: 'Início', link: '/galeria', icon: 'fas fa-fw fa-images', psIcon: 'home' },
    { id: 'mapa',    label: 'Mapa',    shortLabel: 'Mapa',   link: '/mapa',    icon: 'fas fa-fw fa-map-location-dot', psIcon: 'map' },
    { id: 'loja',    label: 'Loja',    shortLabel: 'Loja',   link: '/',        icon: 'fas fa-fw fa-store', psIcon: 'shop' },
    { id: 'sobre',   label: 'Sobre',   shortLabel: 'Sobre',  link: '/sobre-nos', icon: 'fas fa-fw fa-circle-info', psIcon: 'sparkle' },
  ];

  private readonly carrinhoNavItem: NavMainItem = {
    id: 'carrinho', label: 'Carrinho', shortLabel: 'Carrinho', link: '/carrinho',
    icon: 'fas fa-fw fa-cart-shopping', psIcon: 'cart',
  };

  /**
   * Mobile dock — Aurora: 4 abas (Início, Mapa, Loja, Eu) + FAB central.
   * "Eu" vira "Entrar" para guest. Carrinho NÃO aparece como aba — vai pra mini-bag.
   */
  get mobileDockItems(): NavMainItem[] {
    const homeId = 'galeria';
    const left: NavMainItem[] = [
      { id: homeId, label: 'Início', shortLabel: 'Início', link: '/galeria', icon: 'fas fa-fw fa-house', psIcon: 'home' },
      { id: 'mapa', label: 'Mapa', shortLabel: 'Mapa', link: '/mapa', icon: 'fas fa-fw fa-map-location-dot', psIcon: 'map' },
    ];
    const right: NavMainItem[] = [
      { id: 'loja', label: 'Loja', shortLabel: 'Loja', link: '/', icon: 'fas fa-fw fa-store', psIcon: 'shop' },
    ];
    if (this.dockMode === 'guest') {
      right.push({ id: 'login', label: 'Entrar', shortLabel: 'Entrar', link: '#', icon: 'fas fa-fw fa-right-to-bracket', psIcon: 'login' });
    } else {
      right.push({ id: 'esfera', label: 'Minha Esfera', shortLabel: 'Eu', link: '#', icon: 'fas fa-fw fa-user', psIcon: 'sparkle' });
    }
    return [...left, ...right];
  }

  /** Dock para vet/parceiro — variante profissional, mesma linguagem visual. */
  get mobileDockItemsProfessional(): NavMainItem[] {
    if (this.dockMode === 'vet') {
      return [
        { id: 'pacientes', label: 'Pacientes', shortLabel: 'Pacientes', link: '/pacientes', icon: 'fas fa-fw fa-paw', psIcon: 'paw' },
        { id: 'receitas', label: 'Receitas', shortLabel: 'Receitas', link: '/historico-receitas', icon: 'fas fa-fw fa-file-prescription', psIcon: 'sparkle' },
        { id: 'gerar', label: 'Nova', shortLabel: 'Nova', link: '/gerar-receita', icon: 'fas fa-fw fa-plus', psIcon: 'sparkle' },
        { id: 'esfera', label: 'Eu', shortLabel: 'Eu', link: '#', icon: 'fas fa-fw fa-user', psIcon: 'sparkle' },
      ];
    }
    if (this.dockMode === 'parceiro') {
      return [
        { id: 'painel', label: 'Painel', shortLabel: 'Painel', link: '/parceiros/painel', icon: 'fas fa-fw fa-gauge', psIcon: 'home' },
        { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', link: '/parceiros/agenda', icon: 'fas fa-fw fa-calendar', psIcon: 'calendar' },
        { id: 'colab', label: 'Equipe', shortLabel: 'Equipe', link: '/parceiros/colaboradores', icon: 'fas fa-fw fa-users', psIcon: 'person' },
        { id: 'esfera', label: 'Eu', shortLabel: 'Eu', link: '#', icon: 'fas fa-fw fa-user', psIcon: 'sparkle' },
      ];
    }
    return this.mobileDockItems;
  }

  get activeMobileItems(): NavMainItem[] {
    return this.dockMode === 'vet' || this.dockMode === 'parceiro'
      ? this.mobileDockItemsProfessional
      : this.mobileDockItems;
  }

  // ─── Quick actions catalog (FAB sheet + radial) ─────────────────────────────
  readonly quickActionCatalog: Record<DockActionId, QuickAction> = {
    'agendar':      { id: 'agendar',      label: 'Agendar',         caption: 'Consulta com vet',          link: '/mapa?service=consulta', icon: 'calendar', tone: 'aqua' },
    'telemedicina': { id: 'telemedicina', label: 'Telemedicina',    caption: 'Consulta online agora',     link: '/mapa?service=telemedicina', icon: 'video', tone: 'aqua' },
    'buscar-vet':   { id: 'buscar-vet',   label: 'Buscar vet',      caption: 'Veterinários próximos',     link: '/mapa', icon: 'stethoscope', tone: 'aqua' },
    'comprar':      { id: 'comprar',      label: 'Comprar',         caption: 'Loja Petsphere',            link: '/loja', icon: 'shop', tone: 'aurora' },
    'hospedagem':   { id: 'hospedagem',   label: 'Hospedagem',      caption: 'Hotéis pet near you',       link: '/mapa?service=hospedagem', icon: 'bed', tone: 'aurora' },
    'meus-pets':    { id: 'meus-pets',    label: 'Meus pets',       caption: 'Cadastros e carteirinhas',  link: '/meus-pets', icon: 'paw', tone: 'aurora' },
    'galeria':      { id: 'galeria',      label: 'Galeria pet',     caption: 'Comunidade Petsphere',      link: '/galeria', icon: 'sparkle', tone: 'aurora' },
    'vet-pacientes': { id: 'vet-pacientes', label: 'Pacientes',    caption: 'Carteira clínica',          link: '/pacientes', icon: 'paw', tone: 'aqua' },
    'vet-receitas':  { id: 'vet-receitas',  label: 'Receitas',     caption: 'Histórico de prescrições',  link: '/historico-receitas', icon: 'sparkle', tone: 'aqua' },
    'vet-gerar':     { id: 'vet-gerar',     label: 'Nova receita',  caption: 'Emitir receita',            link: '/gerar-receita', icon: 'sparkle', tone: 'aqua' },
    'parceiro-painel':   { id: 'parceiro-painel',   label: 'Painel',     caption: 'Resumo da loja',       link: '/parceiros/painel', icon: 'home', tone: 'neutral' },
    'parceiro-agenda':   { id: 'parceiro-agenda',   label: 'Agenda',     caption: 'Compromissos',         link: '/parceiros/agenda', icon: 'calendar', tone: 'neutral' },
    'parceiro-equipe':   { id: 'parceiro-equipe',   label: 'Equipe',     caption: 'Colaboradores',        link: '/parceiros/colaboradores', icon: 'person', tone: 'neutral' },
  };

  /**
   * Sheet FAB — 5 ações por contexto:
   * - vet: rotas área veterinário
   * - parceiro: painel loja física + loja online
   * - guest / cliente: ecossistema consumidor (igual ao anterior)
   */
  get sheetActions(): QuickAction[] {
    if (this.dockMode === 'vet') {
      const ids: DockActionId[] = ['vet-pacientes', 'vet-receitas', 'vet-gerar', 'telemedicina', 'buscar-vet'];
      return ids.map(id => this.quickActionCatalog[id]);
    }
    if (this.dockMode === 'parceiro') {
      const ids: DockActionId[] = ['parceiro-painel', 'parceiro-agenda', 'parceiro-equipe', 'comprar', 'buscar-vet'];
      return ids.map(id => this.quickActionCatalog[id]);
    }
    const ids: DockActionId[] = this.isCliente
      ? ['agendar', 'telemedicina', 'buscar-vet', 'comprar', 'hospedagem']
      : ['buscar-vet', 'agendar', 'telemedicina', 'comprar', 'hospedagem'];
    return ids.map(id => this.quickActionCatalog[id]);
  }

  private fabRadialDefaultIds(): DockActionId[] {
    if (this.dockMode === 'vet') {
      return ['vet-pacientes', 'vet-receitas', 'vet-gerar', 'telemedicina'];
    }
    if (this.dockMode === 'parceiro') {
      return ['parceiro-painel', 'parceiro-agenda', 'parceiro-equipe', 'comprar'];
    }
    return ['agendar', 'telemedicina', 'buscar-vet', 'comprar'];
  }

  // ─── Mini-bag (carrinho contextual flutuante) ───────────────────────────────
  /** Mostra a mini-bag em rotas de compra com itens. */
  get isShoppingRoute(): boolean {
    const p = (this.currentRoute || '').split('?')[0] || '';
    return p === '/' || p.startsWith('/loja') || p.startsWith('/produto/') || p.startsWith('/favoritos');
  }

  get showMiniBag(): boolean {
    if (!this.isCliente) return false;
    if (this.cartCount <= 0) return false;
    if ((this.currentRoute || '').startsWith('/carrinho') || (this.currentRoute || '').startsWith('/checkout')) return false;
    return this.isShoppingRoute;
  }

  // ─── Existing modal state (Área Cliente) ────────────────────────────────────
  showClienteModal = false;
  clienteLoading = false;
  private clienteModalScrollLockActive = false;
  private clienteModalClosing = false;
  private clienteModalCloseTimer: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('clienteHost', { read: ViewContainerRef }) clienteHost?: ViewContainerRef;
  @ViewChild('userBtn', { read: ElementRef }) userBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('desktopTabsTrack', { read: ElementRef }) desktopTabsTrack?: ElementRef<HTMLElement>;
  @ViewChild('fabBtn', { read: ElementRef }) fabBtn?: ElementRef<HTMLButtonElement>;

  private idleTimer: any = null;
  private readonly idleTimeoutMs = 5000;
  private tabPillLayoutGen = 0;
  private trackResize: ResizeObserver | null = null;
  private pillLayoutDebounce: ReturnType<typeof setTimeout> | null = null;
  private menubarSettleTimer: ReturnType<typeof setTimeout> | null = null;
  private pillFlipClearTimer: ReturnType<typeof setTimeout> | null = null;
  private cartBadgeBumpTimer: ReturnType<typeof setTimeout> | null = null;
  private liveRibbonCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private cartCountSeenFromStore = false;
  private clienteModalOpenSub?: Subscription;
  private nightSub?: Subscription;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  /** Evita que o `click` pós-long-press abra o sheet por cima do radial. */
  private fabIgnoreNextClick = false;
  private interactionDismissEventsBound = false;
  private readonly interactionDismissEvents: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
  private lastPillMetrics: { left: number; top: number; width: number; height: number; key: string } | null = null;
  private static readonly CLIENTE_MODAL_ENTER_MS = 720;
  private static readonly CLIENTE_MODAL_EXIT_MS = 500;
  private static readonly PILL_DIFF_PX = 0.85;
  private static readonly LONG_PRESS_MS = 360;
  /** Histerese do compact: evita piscar com micro-scroll. */
  private static readonly COMPACT_ENTER_SCROLL_Y = 96;
  private static readonly COMPACT_EXIT_SCROLL_Y = 44;
  private static readonly COMPACT_DIRECTION_DELTA_PX = 6;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private store: StoreService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private clienteAreaModal: ClienteAreaModalService,
    private haptics: HapticsService,
    private dockCtx: DockContextService,
  ) {}

  ngOnInit(): void {
    this.restoreLiveRibbonDismissState();
    this.bindInteractionDismissEvents();
    this.setCurrentRoutePath(this.router.url);
    this.updateMenuMode();
    this.refreshDockMode();

    this.router.events
      .pipe(filter(e => e instanceof NavigationStart || e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError))
      .subscribe(event => {
        if (event instanceof NavigationCancel || event instanceof NavigationError) {
          this.selectedMainTabId = null;
          return;
        }
        if (event instanceof NavigationStart) {
          this.setCurrentRoutePath(event.url);
          this.updateMenuMode();
          this.refreshDockMode();
          this.recomputeRibbon();
          this.cdr.detectChanges();
          this.scheduleTabPillUpdate();
        } else {
          const ne = event as NavigationEnd;
          this.setCurrentRoutePath(ne.urlAfterRedirects);
          this.updateMenuMode();
          this.refreshDockMode();
          this.recomputeRibbon();
          this.selectedMainTabId = null;
          this.scheduleTabPillUpdate();
        }
      });

    this.store.cart$.subscribe(items => {
      const next = items.reduce((n, it) => n + it.quantity, 0);
      const prev = this.cartCount;
      if (this.cartCountSeenFromStore && next > prev) this.triggerCartBadgeBump();
      this.cartCount = next;
      try { this.cartTotal = this.store.getCartTotals().total || 0; } catch {}
      this.cartCountSeenFromStore = true;
      this.recomputeRibbon();
      this.scheduleTabPillUpdate();
    });

    this.clienteModalOpenSub = this.clienteAreaModal.openRequests$.subscribe(view => {
      this.abrirClienteModal(view || undefined);
    });

    this.nightSub = this.dockCtx.night$.subscribe(n => {
      this.isNight = n;
      this.cdr.detectChanges();
    });

    this.refreshUser();
    this.auth.isLoggedIn$.subscribe(async ok => {
      if (ok) {
        this.isCliente = await this.store.isClienteLoggedSilent().catch(() => false);
        this.refreshDockMode();
        this.scheduleTabPillUpdate();
        await this.loadUserProfileIfNeeded();
      } else {
        this.isCliente = false;
        this.user = null;
        this.userFoto = null;
        if (typeof window !== 'undefined' && window.localStorage) localStorage.removeItem('cliente_me');
        this.refreshDockMode();
        this.scheduleTabPillUpdate();
      }
      this.recomputeRibbon();
    });

    this.radialActions = this.dockCtx
      .topActions(4, this.fabRadialDefaultIds())
      .map(id => this.quickActionCatalog[id]);
  }

  // ─── User load helpers ──────────────────────────────────────────────────────
  private async loadUserProfileIfNeeded(): Promise<void> {
    let localUserLoaded = false;
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = localStorage.getItem('cliente_me');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          this.user = userObj;
          this.userFoto = userObj?.user?.foto || userObj?.foto || null;
          localUserLoaded = true;
        } catch {}
      }
    }
    if (this.isCliente && !localUserLoaded) {
      try {
        const u = await this.store.getClienteMe();
        this.user = u;
        this.userFoto = u?.foto || null;
        if (typeof window !== 'undefined' && window.localStorage && u) {
          localStorage.setItem('cliente_me', JSON.stringify(u));
        }
      } catch {
        this.user = null;
        this.userFoto = null;
      }
    }
  }

  private refreshUser(): void {
    this.isCliente = false;
    this.user = null;
    this.userFoto = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = localStorage.getItem('cliente_me');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          this.user = userObj;
          this.userFoto = userObj?.user?.foto || userObj?.foto || null;
        } catch {}
      }
    }
    this.store.isClienteLoggedSilent()
      .then(async ok => {
        this.isCliente = ok;
        this.refreshDockMode();
        this.scheduleTabPillUpdate();
        if (ok) await this.loadUserProfileIfNeeded();
        this.recomputeRibbon();
      })
      .catch(() => {
        this.isCliente = false;
        this.user = null;
        this.userFoto = null;
        this.refreshDockMode();
        this.scheduleTabPillUpdate();
      });
  }

  // ─── Mode resolution ────────────────────────────────────────────────────────
  private refreshDockMode(): void {
    const next = this.dockCtx.resolveModeFromRoute(this.currentRoute, this.isCliente);
    if (next !== this.dockMode) {
      this.dockMode = next;
      this.dockCtx.setMode(next);
      this.cdr.detectChanges();
      this.scheduleTabPillUpdate();
    }
  }

  // ─── Live Context Ribbon ────────────────────────────────────────────────────
  private recomputeRibbon(): void {
    if (this.liveRibbonDismissed) {
      this.liveRibbon = null;
      this.liveRibbonClosing = false;
      return;
    }
    if (this.dockMode === 'guest' || this.dockMode === 'vet' || this.dockMode === 'parceiro') {
      this.liveRibbon = null;
      return;
    }
    if (this.cartCount > 0 && this.isShoppingRoute) {
      this.liveRibbon = {
        kind: 'cart',
        text: `${this.cartCount} ${this.cartCount === 1 ? 'item' : 'itens'} · ${this.formatCurrency(this.cartTotal)}`,
        cta: 'Finalizar',
        link: '/carrinho',
      };
      return;
    }
    this.liveRibbon = null;
  }

  private formatCurrency(v: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
    } catch {
      return `R$ ${(v || 0).toFixed(2)}`;
    }
  }

  onLiveRibbonClick(): void {
    if (!this.liveRibbon?.link) return;
    this.haptics.light();
    this.router.navigateByUrl(this.liveRibbon.link);
  }

  private bindInteractionDismissEvents(): void {
    if (!isPlatformBrowser(this.platformId) || this.interactionDismissEventsBound) return;
    this.interactionDismissEventsBound = true;
    for (const ev of this.interactionDismissEvents) {
      document.addEventListener(ev, this.onAnyPageInteraction, { passive: true });
    }
  }

  private unbindInteractionDismissEvents(): void {
    if (!isPlatformBrowser(this.platformId) || !this.interactionDismissEventsBound) return;
    for (const ev of this.interactionDismissEvents) {
      document.removeEventListener(ev, this.onAnyPageInteraction);
    }
    this.interactionDismissEventsBound = false;
  }

  private onAnyPageInteraction = (): void => {
    this.dismissLiveRibbon(true);
  };

  private dismissLiveRibbon(persist = false): void {
    if (persist) this.persistLiveRibbonDismissState();
    if (this.liveRibbonDismissed || this.liveRibbonClosing) return;
    if (!this.liveRibbon) {
      this.liveRibbonDismissed = true;
      return;
    }
    this.liveRibbonClosing = true;
    if (this.liveRibbonCloseTimer) clearTimeout(this.liveRibbonCloseTimer);
    this.liveRibbonCloseTimer = setTimeout(() => {
      this.liveRibbonCloseTimer = null;
      this.liveRibbon = null;
      this.liveRibbonClosing = false;
      this.liveRibbonDismissed = true;
      this.cdr.detectChanges();
    }, 220);
  }

  private restoreLiveRibbonDismissState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.liveRibbonDismissed = localStorage.getItem('fp_nav_ribbon_dismissed') === '1';
    } catch {
      this.liveRibbonDismissed = false;
    }
  }

  private persistLiveRibbonDismissState(): void {
    this.liveRibbonDismissed = true;
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem('fp_nav_ribbon_dismissed', '1');
    } catch {
      /* ignore */
    }
  }

  // ─── Route helpers ──────────────────────────────────────────────────────────
  private setCurrentRoutePath(url: string): void {
    this.currentRoute = (url || '').split('?')[0] || '';
  }

  onMainTabClick(tabId: string): void {
    this.selectedMainTabId = tabId;
    this.haptics.selection();
    this.cdr.detectChanges();
    this.scheduleTabPillUpdate();
  }

  /** `activeMobileItems` recria objetos a cada CD — sem trackBy o DOM do dock era destruído sempre (piscar + FAB quebrado). */
  trackByNavItemId(_index: number, item: NavMainItem): string {
    return item.id;
  }

  trackByQuickActionId(_index: number, action: QuickAction): string {
    return action.id;
  }

  /** Item especial: Esfera (perfil) ou Login. Não navega — abre modal. */
  onMobileItemActivate(item: NavMainItem, ev?: Event): void {
    if (item.id === 'esfera' || item.id === 'login') {
      ev?.preventDefault();
      this.haptics.light();
      this.abrirClienteModal();
      return;
    }
    this.onMainTabClick(item.id);
  }

  isMobileTabHighlighted(item: NavMainItem): boolean {
    if (item.id === 'esfera' || item.id === 'login') return false;
    return this.isTabHighlighted(item);
  }

  isTabHighlighted(item: NavMainItem): boolean {
    if (this.selectedMainTabId != null && this.selectedMainTabId !== '') return item.id === this.selectedMainTabId;
    return this.isNavActive(item);
  }

  isNavActive(item: NavMainItem): boolean {
    const path = (this.currentRoute || '').split('?')[0] || '';
    switch (item.id) {
      case 'loja':       return path === '/' || path.startsWith('/loja') || path.startsWith('/produto/') || path.startsWith('/favoritos') || path.startsWith('/checkout');
      case 'sobre':      return path.startsWith('/sobre-nos');
      case 'mapa':       return path.startsWith('/mapa');
      case 'galeria':    return path.startsWith('/galeria');
      case 'carrinho':   return path.startsWith('/carrinho');
      case 'pacientes':  return path.startsWith('/pacientes');
      case 'receitas':   return path.startsWith('/historico-receitas');
      case 'gerar':      return path.startsWith('/gerar-receita');
      case 'painel':     return path.startsWith('/parceiros/painel');
      case 'agenda':     return path.startsWith('/parceiros/agenda');
      case 'colab':      return path.startsWith('/parceiros/colaboradores');
      default: return false;
    }
  }

  /**
   * Mantido para compatibilidade com top-bar desktop. Carrinho ainda aparece lá
   * para clientes logados (entre Loja e Sobre).
   */
  get visibleNavItems(): NavMainItem[] {
    if (this.isCliente) {
      const i = this.mainNavItems.findIndex(x => x.id === 'loja') + 1;
      return [...this.mainNavItems.slice(0, i), this.carrinhoNavItem, ...this.mainNavItems.slice(i)];
    }
    return this.mainNavItems;
  }

  // ─── FAB: tap → bottom sheet, long-press → radial menu ──────────────────────
  onFabPointerDown(ev: PointerEvent): void {
    // Não usar preventDefault aqui: em alguns WebViews/iOS isso quebra a sequência
    // confiável de pointerup/click no botão fixo.
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    this.fabIgnoreNextClick = false;
    this.longPressFired = false;
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      this.longPressFired = true;
      this.fabIgnoreNextClick = true;
      this.openRadial();
    }, NavmenuComponent.LONG_PRESS_MS);
  }

  onFabPointerUp(ev?: PointerEvent): void {
    if (ev && ev.button !== 0 && ev.pointerType === 'mouse') return;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.longPressFired) {
      this.longPressFired = false;
      return;
    }
    this.openSheet();
  }

  onFabPointerCancel(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressFired = false;
  }

  /**
   * Fallback para toque quando Pointer Events falham ou o alvo some no meio do gesto
   * (ex.: re-render do dock). Não abre sheet se radial/sheet já estiverem abertos.
   */
  onFabTouchEnd(ev: TouchEvent): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isRadialOpen || this.isSheetOpen) {
      try { ev.preventDefault(); } catch { /* ignore */ }
      return;
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (this.longPressFired) {
      this.longPressFired = false;
      return;
    }
    try { ev.preventDefault(); } catch { /* ignore */ }
    this.openSheet();
  }

  /** Fallback quando só o evento de click chega (ex.: teclado mouse emulado). */
  onFabClick(ev: Event): void {
    if (this.fabIgnoreNextClick) {
      this.fabIgnoreNextClick = false;
      ev.preventDefault();
      return;
    }
    ev.preventDefault();
    this.openSheet();
  }

  /** Acessibilidade: Enter/Espaço também abrem ações rápidas. */
  onFabKeyboardActivate(ev: Event): void {
    ev.preventDefault();
    this.openSheet();
  }

  openSheet(): void {
    if (this.isSheetOpen) return;
    this.haptics.medium();
    this.isSheetOpen = true;
    this.applyBodyScrollLock();
    this.cdr.detectChanges();
  }

  closeSheet(): void {
    if (!this.isSheetOpen) return;
    this.isSheetOpen = false;
    this.releaseBodyScrollLock();
    this.cdr.detectChanges();
  }

  openRadial(): void {
    if (this.isRadialOpen) return;
    this.haptics.heavy();
    this.radialActions = this.dockCtx
      .topActions(4, this.fabRadialDefaultIds())
      .map(id => this.quickActionCatalog[id]);
    this.isRadialOpen = true;
    this.cdr.detectChanges();
  }

  closeRadial(): void {
    if (!this.isRadialOpen) return;
    this.isRadialOpen = false;
    this.cdr.detectChanges();
  }

  triggerQuickAction(action: QuickAction, source: 'sheet' | 'radial'): void {
    this.haptics.light();
    this.dockCtx.registerAction(action.id);
    if (source === 'sheet') this.closeSheet();
    if (source === 'radial') this.closeRadial();
    setTimeout(() => this.router.navigateByUrl(action.link), 60);
  }

  private applyBodyScrollLock(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { document.body.style.overflow = 'hidden'; } catch {}
  }
  private releaseBodyScrollLock(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { document.body.style.overflow = ''; } catch {}
  }

  // ─── Mini-bag ───────────────────────────────────────────────────────────────
  onMiniBagClick(): void {
    this.haptics.light();
    this.router.navigateByUrl('/carrinho');
  }

  // ─── Cart badge bump ────────────────────────────────────────────────────────
  private triggerCartBadgeBump(): void {
    if (this.cartBadgeBumpTimer) clearTimeout(this.cartBadgeBumpTimer);
    this.cartBadgeBumping = true;
    this.cdr.detectChanges();
    this.cartBadgeBumpTimer = setTimeout(() => {
      this.cartBadgeBumping = false;
      this.cartBadgeBumpTimer = null;
      this.cdr.detectChanges();
    }, 500);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMetaBalls();
      this.resetIdleTimer();
      this.rebindTabsTrackResizeObserver();
      this.scheduleTabPillUpdate();
    }
  }

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const currentScroll = window.scrollY;
    const delta = currentScroll - this.previousScroll;
    const goingDown = delta > NavmenuComponent.COMPACT_DIRECTION_DELTA_PX;
    const goingUp = delta < -NavmenuComponent.COMPACT_DIRECTION_DELTA_PX;
    // Top bar (desktop) — esconde como antes
    this.isVisible = !goingDown || currentScroll <= 0;
    // Mobile dock — histerese: entra só depois de descer bem, sai com folga.
    if (!this.isCompact) {
      if (goingDown && currentScroll >= NavmenuComponent.COMPACT_ENTER_SCROLL_Y) {
        this.isCompact = true;
      }
    } else {
      if (
        currentScroll <= NavmenuComponent.COMPACT_EXIT_SCROLL_Y ||
        (goingUp && currentScroll < NavmenuComponent.COMPACT_ENTER_SCROLL_Y)
      ) {
        this.isCompact = false;
      }
    }
    this.previousScroll = currentScroll;
    this.resetIdleTimer();
    this.requestPillLayoutFromScroll();
  }

  @HostListener('window:resize', [])
  onWindowResize(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.requestPillLayoutFromScroll();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(_e: KeyboardEvent): void {
    if (this.isSheetOpen) this.closeSheet();
    else if (this.isRadialOpen) this.closeRadial();
  }

  private updateMenuMode(): void {
    this.showFullMenu = this.showSlideMenu;
    this.scheduleTabPillUpdate();
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.rebindTabsTrackResizeObserver(), 0);
  }

  private rebindTabsTrackResizeObserver(): void {
    this.trackResize?.disconnect();
    this.trackResize = null;
    if (!isPlatformBrowser(this.platformId) || typeof ResizeObserver === 'undefined') return;
    const track = this.desktopTabsTrack?.nativeElement;
    if (!track) return;
    this.trackResize = new ResizeObserver(() => this.requestPillLayoutFromScroll());
    this.trackResize.observe(track);
  }

  private requestPillLayoutFromScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.pillLayoutDebounce) clearTimeout(this.pillLayoutDebounce);
    this.pillLayoutDebounce = setTimeout(() => {
      this.pillLayoutDebounce = null;
      this.applyDesktopPillFromDom({ allowFlip: false, force: false });
    }, 24);
  }

  private scheduleTabPillUpdate(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const session = ++this.tabPillLayoutGen;
    if (this.menubarSettleTimer) { clearTimeout(this.menubarSettleTimer); this.menubarSettleTimer = null; }
    if (this.pillLayoutDebounce) { clearTimeout(this.pillLayoutDebounce); this.pillLayoutDebounce = null; }
    if (this.pillFlipClearTimer) { clearTimeout(this.pillFlipClearTimer); this.pillFlipClearTimer = null; }
    setTimeout(() => {
      if (session !== this.tabPillLayoutGen) return;
      this.cdr.detectChanges();
      this.applyDesktopPillFromDom({ allowFlip: true, force: true });
    }, 0);
    this.menubarSettleTimer = setTimeout(() => {
      this.menubarSettleTimer = null;
      if (session !== this.tabPillLayoutGen) return;
      this.applyDesktopPillFromDom({ allowFlip: false, force: true });
    }, 360);
  }

  /**
   * Posiciona o hori-selector (desktop top bar) com FLIP. Mantida — funciona
   * bem e dá identidade ao top bar. Agora estilizada como "liquid glass".
   */
  private applyDesktopPillFromDom(opts: { allowFlip: boolean; force: boolean }): void {
    const track = this.desktopTabsTrack?.nativeElement;
    if (!track || !this.showFullMenu) { this.lastPillMetrics = null; return; }
    const selector = track.querySelector('.hori-selector') as HTMLElement | null;
    if (!selector) return;
    const active = track.querySelector('li.nav-tab-item.active a.nav-tab-link') as HTMLElement | null;
    if (!active) {
      if (this.lastPillMetrics) selector.style.opacity = '0';
      this.lastPillMetrics = null;
      return;
    }
    const tr = track.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const left = ar.left - tr.left + track.scrollLeft;
    const top = ar.top - tr.top + track.scrollTop;
    const heightToTrackBottom = Math.max(0, tr.bottom - ar.top);
    const w = ar.width;
    const h = heightToTrackBottom;
    const li = active.closest('li') as HTMLElement | null;
    const key = (li?.getAttribute('data-nav-id') || '').trim();

    const last = this.lastPillMetrics;
    if (last) {
      const d = Math.max(Math.abs(last.left - left), Math.abs(last.top - top), Math.abs(last.width - w), Math.abs(last.height - h));
      if (!opts.force && d < NavmenuComponent.PILL_DIFF_PX && last.key === key) return;
    }

    if (!opts.allowFlip) {
      if (this.pillFlipClearTimer) { clearTimeout(this.pillFlipClearTimer); this.pillFlipClearTimer = null; }
      try { selector.style.removeProperty('transform'); selector.style.removeProperty('transition'); } catch {}
    }

    if (opts.allowFlip && last && key && last.key && key !== last.key) {
      const dx = last.left - left;
      const dy = last.top - top;
      if (Math.hypot(dx, dy) > 1) {
        if (this.pillFlipClearTimer) { clearTimeout(this.pillFlipClearTimer); this.pillFlipClearTimer = null; }
        selector.style.transition = 'none';
        selector.style.left = `${left}px`;
        selector.style.top = `${top}px`;
        selector.style.width = `${w}px`;
        selector.style.height = `${h}px`;
        selector.style.opacity = '1';
        selector.style.transform = `translate(${dx}px, ${dy}px)`;
        this.lastPillMetrics = { left, top, width: w, height: h, key };
        void selector.offsetWidth;
        requestAnimationFrame(() => {
          selector.style.transition = 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)';
          selector.style.transform = 'translate(0, 0)';
          this.pillFlipClearTimer = setTimeout(() => {
            this.pillFlipClearTimer = null;
            try { selector.style.removeProperty('transform'); selector.style.removeProperty('transition'); } catch {}
          }, 500);
        });
        return;
      }
    }

    if (this.pillFlipClearTimer) { clearTimeout(this.pillFlipClearTimer); this.pillFlipClearTimer = null; }
    try { selector.style.removeProperty('transform'); selector.style.removeProperty('transition'); } catch {}
    selector.style.left = `${left}px`;
    selector.style.top = `${top}px`;
    selector.style.width = `${w}px`;
    selector.style.height = `${h}px`;
    selector.style.opacity = '1';
    this.lastPillMetrics = { left, top, width: w, height: h, key: key || last?.key || '' };
  }

  // ─── Cliente Modal (mantido) ────────────────────────────────────────────────
  private applyClienteModalScrollLock(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      this.clienteModalScrollLockActive = true;
    } catch {}
  }

  private releaseClienteModalScrollLock(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.clienteModalScrollLockActive) return;
    this.clienteModalScrollLockActive = false;
    try { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; } catch {}
  }

  private clearClienteModalCloseTimer(): void {
    if (!this.clienteModalCloseTimer) return;
    clearTimeout(this.clienteModalCloseTimer);
    this.clienteModalCloseTimer = null;
  }

  private finalizeClienteModalClose(): void {
    this.clearClienteModalCloseTimer();
    this.clienteModalClosing = false;
    this.showClienteModal = false;
    this.clienteLoading = false;
    try { this.clienteHost?.clear(); } catch {}
    this.releaseClienteModalScrollLock();
  }

  async abrirClienteModal(initialView?: ClienteAreaModalView | undefined) {
    this.clearClienteModalCloseTimer();
    this.clienteModalClosing = false;
    this.showClienteModal = true;
    this.applyClienteModalScrollLock();
    this.clienteLoading = true;
    requestAnimationFrame(() => {
      try {
        const btn = this.userBtn?.nativeElement;
        const modal = document.querySelector('.cliente-modal') as HTMLElement | null;
        if (btn && modal) {
          const br = btn.getBoundingClientRect();
          const mr = modal.getBoundingClientRect();
          const ox = (br.left + br.width / 2 - mr.left) / Math.max(mr.width, 1);
          const oy = (br.top + br.height / 2 - mr.top) / Math.max(mr.height, 1);
          modal.style.setProperty('--origin-x', `${Math.min(Math.max(ox, 0), 1)}`);
          modal.style.setProperty('--origin-y', `${Math.min(Math.max(oy, 0), 1)}`);
          modal.classList.remove('anim-exit');
          modal.classList.add('anim-enter');
          setTimeout(() => modal.classList.remove('anim-enter'), NavmenuComponent.CLIENTE_MODAL_ENTER_MS);
        }
      } catch {}
    });
    try {
      setTimeout(async () => {
        if (!this.clienteHost) return;
        this.clienteHost.clear();
        const mod = await import('../pages/restrito/area-cliente/area-cliente.component');
        const Cmp = (mod as any).AreaClienteComponent;
        if (Cmp) {
          const ref = this.clienteHost.createComponent(Cmp);
          if (ref?.instance) {
            (ref.instance as any).modal = true;
            (ref.instance as any).initialView = initialView || null;
          }
          setTimeout(() => { this.clienteLoading = false; }, 0);
        }
      });
    } catch (e) {
      console.error('Falha ao carregar Área do Cliente', e);
      this.clienteLoading = false;
    }
  }

  fecharClienteModal() {
    if (!this.showClienteModal || this.clienteModalClosing) return;
    this.clienteModalClosing = true;
    try {
      const modal = document.querySelector('.cliente-modal') as HTMLElement | null;
      const overlay = document.querySelector('.cliente-overlay') as HTMLElement | null;
      if (modal) {
        modal.classList.add('anim-exit');
        if (overlay) overlay.classList.add('anim-exit');
        this.clienteModalCloseTimer = setTimeout(() => {
          modal.classList.remove('anim-exit');
          if (overlay) overlay.classList.remove('anim-exit');
          this.finalizeClienteModalClose();
        }, NavmenuComponent.CLIENTE_MODAL_EXIT_MS);
        return;
      }
    } catch {}
    this.finalizeClienteModalClose();
  }

  ngOnDestroy(): void {
    try { this.clienteModalOpenSub?.unsubscribe(); } catch {}
    try { this.nightSub?.unsubscribe(); } catch {}
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.pillLayoutDebounce) clearTimeout(this.pillLayoutDebounce);
    if (this.menubarSettleTimer) clearTimeout(this.menubarSettleTimer);
    if (this.pillFlipClearTimer) clearTimeout(this.pillFlipClearTimer);
    if (this.cartBadgeBumpTimer) { clearTimeout(this.cartBadgeBumpTimer); this.cartBadgeBumpTimer = null; }
    if (this.liveRibbonCloseTimer) { clearTimeout(this.liveRibbonCloseTimer); this.liveRibbonCloseTimer = null; }
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.unbindInteractionDismissEvents();
    this.trackResize?.disconnect();
    this.trackResize = null;
    this.tabPillLayoutGen += 1;
    this.clearClienteModalCloseTimer();
    this.releaseClienteModalScrollLock();
    this.releaseBodyScrollLock();
  }

  private resetIdleTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const currentScroll = window.scrollY || 0;
    if (currentScroll <= 0) { this.isVisible = true; this.isCompact = false; return; }
    this.idleTimer = setTimeout(() => { this.isVisible = false; }, this.idleTimeoutMs);
  }

  private initMetaBalls(): void {
    const wrapper = document.querySelector('.logo-container #wrapper') as HTMLElement | null;
    if (!wrapper) return;
    const ball = wrapper.querySelector('#ball') as HTMLElement | null;
    if (!ball) return;
    let i = 0;
    const raf = () => { if (i % 25 === 0) createBall(); i++; requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    function createBall() {
      if (!wrapper) return;
      const ball1 = document.createElement('div');
      ball1.classList.add('ball1');
      ball1.style.left = '50%';
      ball1.style.top = '50%';
      ball1.style.transform = 'translate(-50%, -50%)';
      ball1.style.willChange = 'transform';
      setTimeout(() => {
        wrapper.appendChild(ball1);
        const aleaY = Math.round(Math.random() * 200 - 100);
        const aleaX = Math.round(Math.random() * 200 - 100);
        const a = Math.abs(aleaX);
        const b = Math.abs(aleaY);
        let c = Math.sqrt(a * a + b * b);
        c = (c * 100 / 150) / 100;
        c = 1 - c;
        gsap.set(ball1, { x: 0, y: 0, scale: 1 });
        gsap.to(ball1, { duration: 3, x: aleaX, y: aleaY, scale: c, ease: 'bounce.in', delay: 0.5, onComplete: () => ballMove(ball1) });
      }, 300);
    }
    function destroy(elem: HTMLElement) { if (!wrapper) return; if (elem.parentElement === wrapper) wrapper.removeChild(elem); }
    function ballMove(elem: HTMLElement) {
      gsap.to(elem, { duration: 2, x: 0, y: 0, scale: 0.7, ease: 'power2.inOut', onComplete: () => destroy(elem) });
    }
  }
}
