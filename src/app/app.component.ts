import { Component, OnInit, Inject, PLATFORM_ID, NgZone, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { NavmenuComponent } from './navmenu/navmenu.component';
import { HeroComponent } from './hero/hero.component';
import { FooterComponent } from './footer/footer.component';
import { AboutComponent } from './about/about.component';
import { TestimonialsComponent } from './testimonials/testimonials.component';
import { ProductPreviewComponent } from './product-preview/product-preview.component';
import { ToastContainerComponent } from './shared/toast/toast-container.component';
import { LoginClienteComponent } from './pages/restrito/area-cliente/login-cliente/login-cliente.component';
import { StoreService } from './services/store.service';
import { RastreioLojaService } from './services/rastreio-loja.service';
import { CookiePreferencesService, CookiePreferences } from './services/cookie-preferences.service';
import { CookieConsentComponent } from './shared/cookie-consent/cookie-consent.component';
import { BannedUserModalComponent } from './shared/banned-user-modal/banned-user-modal.component';
import { MARCA_NOME } from './constants/loja-public';
import { TenantLojaService } from './services/tenant-loja.service';
import { register } from 'swiper/element/bundle';
import { PartnerChatModalComponent } from './features/partner-chat/partner-chat-modal/partner-chat-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ToastContainerComponent,
    NavmenuComponent,
    FooterComponent,
    LoginClienteComponent,
    CookieConsentComponent,
    BannedUserModalComponent,
    PartnerChatModalComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = MARCA_NOME;
  deviceType: string = 'desktop';
  showFooter: boolean = true;
  showNav: boolean = true;
  private routerSub?: Subscription;
  /** Sincroniza classe no body: mapa + viewport estreita → esconde só o header superior da navbar, mantendo o dock móvel. */
  private mapaTopNavMql: MediaQueryList | null = null;
  private mapaTopNavMqlHandler = () => {
    this.syncShellVisibility();
    this.syncMapaNoTopnavBodyClass();
  };
  /** Área Prestador (/parceiros/*): em desktop/tablet só o shell; em celular também mostra nav global Petsphere. */
  private parceirosDockedNavMql: MediaQueryList | null = null;
  private readonly parceirosDockedNavMqlHandler = () => {
    this.zone.run(() => this.syncShellVisibility());
  };
  showLoginModal = false;
  private openLoginHandler?: EventListenerOrEventListenerObject;
  private cookiePreferencesSub?: Subscription;
  private elfsightBadgeInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private zone: NgZone,
    private router: Router,
    private store: StoreService,
    private rastreio: RastreioLojaService,
    private cookiePreferences: CookiePreferencesService,
    private titleService: Title,
    private tenantLoja: TenantLojaService
  ) {
    register(); // Swiper
  }

  ngOnInit(): void {
    this.detectDevice();
    if (isPlatformBrowser(this.platformId)) {
      void this.tenantLoja.initFromLocation().then(() => {
        const nome = this.tenantLoja.displayBrandName();
        try {
          this.titleService.setTitle(nome ? `${nome} | ${MARCA_NOME}` : MARCA_NOME);
        } catch {
          /* ignore */
        }
        this.zone.run(() => this.syncShellVisibility(this.router.url));
      });
      try {
        document.documentElement.classList.add('force-light');
        document.body.classList.add('force-light');
      } catch (e) {}
      try {
        this.syncCookieDefaultsIfLoggedInClienteOrVet();
      } catch (e) {}
    }
    // Hide global footer and nav on admin routes and product registration page; on /mapa hide footer only on mobile.
    try {
      if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.matchMedia) {
        this.mapaTopNavMql = window.matchMedia('(max-width: 767px)');
        try {
          if (this.mapaTopNavMql.addEventListener) {
            this.mapaTopNavMql.addEventListener('change', this.mapaTopNavMqlHandler);
          } else {
            (this.mapaTopNavMql as any).addListener(this.mapaTopNavMqlHandler);
          }
        } catch (e) {
          /* ignore */
        }
        this.parceirosDockedNavMql = window.matchMedia('(max-width: 767px)');
        try {
          if (this.parceirosDockedNavMql.addEventListener) {
            this.parceirosDockedNavMql.addEventListener('change', this.parceirosDockedNavMqlHandler);
          } else {
            (this.parceirosDockedNavMql as any).addListener(this.parceirosDockedNavMqlHandler);
          }
        } catch (e2) {
          /* ignore */
        }
      }
      const current = (this.router && (this.router.url || '')) as string;
      this.syncShellVisibility(current);
      this.syncMapaNoTopnavBodyClass();
      this.syncParceiroShellBodyClass(current);
      this.routerSub = this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((ev: any) => {
        const u = ev.urlAfterRedirects || ev.url || '';
        this.syncShellVisibility(u);
        this.syncMapaNoTopnavBodyClass();
        this.syncParceiroShellBodyClass(u);
      });
    } catch (e) {}
    try {
      this.cookiePreferencesSub = this.cookiePreferences.preferences$
        .pipe(
          filter(
            (p): p is CookiePreferences =>
              p != null && this.cookiePreferences.isValid(p)
          )
        )
        .subscribe((p) => this.applyCookiePreferences(p));
    } catch (e) {}
    // Global listener for programmatic login requests (from other components)
    if (typeof window !== 'undefined') {
      this.openLoginHandler = () => { this.showLoginModal = true; };
      window.addEventListener('open-login', this.openLoginHandler as EventListener);
    }
  }

  ngOnDestroy(): void {
    try {
      if (isPlatformBrowser(this.platformId)) {
        document.documentElement.classList.remove('force-light');
        document.body.classList.remove('force-light');
        try {
          document.body.classList.remove('mapa-no-topnav');
        } catch (e) {
          /* */
        }
        try {
          document.documentElement.classList.remove('ps-parceiro-shell');
          document.body.classList.remove('ps-parceiro-shell');
        } catch {
          /* */
        }
        if (this.mapaTopNavMql) {
          try {
            if (this.mapaTopNavMql.removeEventListener) {
              this.mapaTopNavMql.removeEventListener('change', this.mapaTopNavMqlHandler);
            } else {
              (this.mapaTopNavMql as any).removeListener(this.mapaTopNavMqlHandler);
            }
          } catch (e) {
            /* */
          }
          this.mapaTopNavMql = null;
        }
        if (this.parceirosDockedNavMql) {
          try {
            if (this.parceirosDockedNavMql.removeEventListener) {
              this.parceirosDockedNavMql.removeEventListener('change', this.parceirosDockedNavMqlHandler);
            } else {
              (this.parceirosDockedNavMql as any).removeListener(this.parceirosDockedNavMqlHandler);
            }
          } catch {
            /* ignore */
          }
          this.parceirosDockedNavMql = null;
        }
      }
    } catch (e) {}
    try { if (this.routerSub) this.routerSub.unsubscribe(); } catch (e) {}
    try { this.cookiePreferencesSub?.unsubscribe(); } catch (e) {}
    try { if (this.elfsightBadgeInterval) { clearInterval(this.elfsightBadgeInterval); } } catch (e) {}
    try { if (this.openLoginHandler && typeof window !== 'undefined') window.removeEventListener('open-login', this.openLoginHandler as EventListener); } catch {}

  }

  /** Cliente/vet já autenticado (token em storage) mas sem decisão de cookies ainda — alinha ao pós-login/cadastro. */
  private syncCookieDefaultsIfLoggedInClienteOrVet(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const rawType = localStorage.getItem('userType') || sessionStorage.getItem('userType');
      const userType = (rawType || '').toLowerCase();
      if (token && userType && (userType === 'cliente' || userType === 'vet')) {
        this.cookiePreferences.applyDefaultsIfNoConsentYet();
      }
    } catch {
      /* */
    }
  }

  private applyCookiePreferences(p: CookiePreferences): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      this.rastreio.start(p.analytics);
    } catch (e) {}
    if (p.thirdParty) {
      this.loadElfsightScript();
    } else {
      this.removeElfsightScript();
    }
  }

  closeLoginModal() {
    this.showLoginModal = false;
  }

  onClienteLoggedIn() {
    this.closeLoginModal();
    this.store.resetClienteGate();
  }

  /**
   * Rotas do shell autenticado (/parceiros/* com guard): fundo do documento deve ser escuro
   * para overscroll e áreas atrás do conteúdo não mostrarem o creme global + force-light.
   */
  private syncParceiroShellBodyClass(url?: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const raw = url ?? this.router.url ?? '';
      const path = (raw.split('?')[0] || '').split('#')[0] || '';
      const isPublicParceiroRoute =
        path.startsWith('/parceiros/login') ||
        path.startsWith('/parceiros/recuperar-senha') ||
        path.startsWith('/parceiros/convite/');
      const isShell = path.startsWith('/parceiros/') && !isPublicParceiroRoute;
      this.zone.run(() => {
        try {
          if (isShell) {
            document.documentElement.classList.add('ps-parceiro-shell');
            document.body.classList.add('ps-parceiro-shell');
          } else {
            document.documentElement.classList.remove('ps-parceiro-shell');
            document.body.classList.remove('ps-parceiro-shell');
          }
        } catch {
          /* */
        }
      });
    } catch {
      /* */
    }
  }

  /**
   * Em /mapa no telefone (≤767px, igual ao `sm` do navmenu) remove só a faixa do topo (logo + área do cliente);
   * o dock inferior continua a ser o `app-navmenu` completo.
   */
  private syncMapaNoTopnavBodyClass(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      const u = this.router.url || '';
      const p = (u.split('?')[0] || '').split('#')[0] || '';
      const isMapa = p === '/mapa' || p.startsWith('/mapa/');
      const narrow = this.mapaTopNavMql?.matches ?? false;
      this.zone.run(() => {
        try {
          if (isMapa && narrow) {
            document.body.classList.add('mapa-no-topnav');
          } else {
            document.body.classList.remove('mapa-no-topnav');
          }
        } catch (e) {
          /* */
        }
      });
    } catch (e) {
      /* */
    }
  }

  private syncShellVisibility(url?: string): void {
    const current = url ?? this.router.url ?? '';
    const path = (current.split('?')[0] || '').split('#')[0] || '';
    const isLegacyVetArea =
      path === '/area-vet' ||
      path === '/gerar-receita' ||
      path === '/historico-receitas' ||
      path.startsWith('/historico-receitas/') ||
      path === '/pacientes' ||
      path.startsWith('/pacientes/') ||
      path === '/panorama-atendimento';
    /** Desktop parceiros só com shell; celular mostra esta barra junto do shell (header do shell fica recolhido via CSS). */
    const isParceirosPath = path.startsWith('/parceiros/');
    const parceirosShowGlobalDockNav = isParceirosPath && (this.parceirosDockedNavMql?.matches ?? false);
    const hide =
      current.startsWith('/restrito/admin') ||
      current.startsWith('/restrito/produto') ||
      isLegacyVetArea ||
      (isParceirosPath && !parceirosShowGlobalDockNav);
    const isMapaPath = path === '/mapa' || path.startsWith('/mapa/');
    const hideFooterMapa = isMapaPath && (this.mapaTopNavMql?.matches ?? false);
    const tenantStorefront = this.tenantLoja.isTenantLoja();

    this.showFooter = !hide && !hideFooterMapa && !isParceirosPath && !tenantStorefront;
    this.showNav = !hide;
  }

  detectDevice(): void {
    if (isPlatformBrowser(this.platformId)) {
      const width = window.innerWidth;

      if (width < 768) {
        this.deviceType = 'mobile';
      } else if (width >= 768 && width < 1024) {
        this.deviceType = 'tablet';
      } else {
        this.deviceType = 'desktop';
      }
    }
  }

  loadElfsightScript(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.elfsightBadgeInterval) {
      clearInterval(this.elfsightBadgeInterval);
      this.elfsightBadgeInterval = null;
    }
    const existingScript = document.getElementById('elfsight-script');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'elfsight-script';
      script.src = 'https://static.elfsight.com/platform/platform.js';
      script.defer = true;
      document.body.appendChild(script);
    }
    this.startElfsightBadgeStripper();
  }

  private startElfsightBadgeStripper(): void {
    this.zone.runOutsideAngular(() => {
      let tries = 0;
      const maxTries = 25;
      this.elfsightBadgeInterval = setInterval(() => {
        const badge = document.querySelector('a[href*="elfsight.com/google-reviews-widget"]');
        if (badge) {
          badge.remove();
          if (this.elfsightBadgeInterval) {
            clearInterval(this.elfsightBadgeInterval);
            this.elfsightBadgeInterval = null;
          }
        } else if (++tries >= maxTries) {
          if (this.elfsightBadgeInterval) {
            clearInterval(this.elfsightBadgeInterval);
            this.elfsightBadgeInterval = null;
          }
        }
      }, 2000);
    });
  }

  private removeElfsightScript(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (this.elfsightBadgeInterval) {
      try {
        clearInterval(this.elfsightBadgeInterval);
      } catch {
        /* */
      }
      this.elfsightBadgeInterval = null;
    }
    const s = document.getElementById('elfsight-script');
    try {
      s?.remove();
    } catch {
      /* */
    }
  }
}
