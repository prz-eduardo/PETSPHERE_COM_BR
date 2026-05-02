import {
  Component, AfterViewInit, ChangeDetectorRef, Inject, PLATFORM_ID, HostListener,
  OnDestroy, ViewChild, ViewContainerRef, ElementRef, OnInit
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router, NavigationEnd, NavigationStart, NavigationCancel, NavigationError, RouterLink } from '@angular/router';
import { Subscription, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StoreService } from '../services/store.service';
import { AuthService } from '../services/auth.service';
import { gsap } from 'gsap';
import { ClienteAreaModalService, ClienteAreaModalView } from '../services/cliente-area-modal.service';
import { HapticsService } from '../services/haptics.service';
import { DockContextService, DockMode, DockActionId } from '../services/dock-context.service';
import { PsIconComponent, PsIconName } from '../shared/icons/ps-icon.component';
import { TenantLojaService } from '../services/tenant-loja.service';
import { ParceirosMobileShellService } from '../services/parceiros-mobile-shell.service';
import { ParceiroAuthService } from '../services/parceiro-auth.service';
import { NotificationsBellComponent } from '../shared/notifications-bell/notifications-bell.component';

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

export interface SheetPanelRow {
  sectionLabel: string | null;
  actions: QuickAction[];
}

/** Uma célula do grid do dock mobile — sempre um único `<li>` (evita desalinhamento). */
export type DockGridCell = { kind: 'spacer' } | { kind: 'nav'; item: NavMainItem };

@Component({
  selector: 'app-navmenu',
  standalone: true,
  imports: [RouterLink, CommonModule, PsIconComponent, NotificationsBellComponent],
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
  /** Radial menu (long-press no FAB). */
  isRadialOpen = false;
  /** Dock: painel fullscreen de notificações aberto — sobe a lista sobre o FAB (stacking). */
  dockNotifFullscreenOpen = false;
  /** Snapshot ao abrir o sheet — evita *ngFor a recriar o DOM a cada CD (pisca). */
  sheetRowsSnapshot: SheetPanelRow[] = [];
  sheetLeadTitle = 'O que você quer fazer?';
  sheetLeadSubtitle = 'Atalhos rápidos do seu ecossistema pet';
  /** Ações do radial — top 4 mais usadas (aprende com o tempo). */
  radialActions: QuickAction[] = [];
  /** Live Context Ribbon — visível quando há mensagem contextual relevante. */
  liveRibbon: { kind: 'cart' | 'reminder' | 'order'; text: string; cta?: string; link?: string } | null = null;
  liveRibbonClosing = false;
  private liveRibbonDismissed = false;

  /** Carrinho aparece só na lente cliente logado (desktop e labels). */
  private readonly carrinhoNavItem: NavMainItem = {
    id: 'carrinho', label: 'Carrinho', shortLabel: 'Carrinho', link: '/carrinho',
    icon: 'fas fa-fw fa-cart-shopping', psIcon: 'cart',
  };

  /**
   * Mobile dock tutor — exatamente 4 itens + slot do FAB central:
   *   Galeria · Mapa · (FAB) · Loja · Entrar|Sair.
   * `Sobre` e `Notificações` saem do dock (Sobre vai para o FAB sheet — seção institucional;
   * Notificações vira ação no FAB sheet via `dockBell.toggle()`).
   */
  get mobileDockItems(): NavMainItem[] {
    const tenantSf = this.tenantLoja.isTenantLoja();
    const galeriaLink = tenantSf ? '/' : '/galeria';
    const left: NavMainItem[] = [
      {
        id: 'galeria',
        label: 'Galeria',
        shortLabel: 'Galeria',
        link: galeriaLink,
        icon: 'fas fa-fw fa-images',
        psIcon: 'home',
      },
      {
        id: 'mapa',
        label: 'Mapa',
        shortLabel: 'Mapa',
        link: '/mapa',
        icon: 'fas fa-fw fa-map-location-dot',
        psIcon: 'map',
      },
      {
        id: 'loja',
        label: 'Loja',
        shortLabel: 'Loja',
        link: this.lojaHref,
        icon: 'fas fa-fw fa-store',
        psIcon: 'shop',
      },
    ];
    const authItem: NavMainItem =
      this.dockMode === 'guest'
        ? {
          id: 'login',
          label: 'Entrar',
          shortLabel: 'Entrar',
          link: '#',
          icon: 'fas fa-fw fa-right-to-bracket',
          psIcon: 'login',
        }
        : {
          id: 'logout',
          label: 'Sair',
          shortLabel: 'Sair',
          link: '#',
          icon: 'fas fa-fw fa-right-from-bracket',
          psIcon: 'logout',
        };
    return [...left, authItem];
  }

  /**
   * Profissional logado “dentro do painel”: rotas `/parceiros/*` exceto login,
   * recuperação de senha e fluxo de convite. Define qual conjunto de 4 itens
   * o dock móvel mostra (institucional vs operacional).
   */
  private get isPartnerPainelRoute(): boolean {
    const r = this.currentRoute || '';
    if (!r.startsWith('/parceiros')) return false;
    if (
      r === '/parceiros/login' ||
      r.startsWith('/parceiros/recuperar-senha') ||
      r.startsWith('/parceiros/convite/')
    ) return false;
    return true;
  }

  /** Rotas UI clínica já servidas dentro de `/parceiros/…`. */
  private vetClinicalBase(): string {
    const path = (this.currentRoute || '').split('?')[0] || '';
    if (
      path.startsWith('/parceiros/area-vet') ||
      path.startsWith('/parceiros/gerar-receita') ||
      path.startsWith('/parceiros/historico-receitas') ||
      path.startsWith('/parceiros/pacientes') ||
      path.startsWith('/parceiros/panorama-atendimento')
    ) {
      return '/parceiros';
    }
    return '';
  }

  /**
   * Prefixa `/pacientes`, `/historico-receitas`, etc. com `/parceiros` dentro do portal;
   * deixa `mapa`, `sobre-nos`, etc. inalterados.
   */
  private vetClinicalHref(pathWithQuery: string): string {
    const [pathname, qs] = pathWithQuery.split('?', 2);
    const publicRoots = ['/pacientes', '/historico-receitas', '/gerar-receita', '/panorama-atendimento'];
    const isClinical = publicRoots.some((r) => pathname === r || pathname.startsWith(`${r}/`));
    if (!isClinical) return pathWithQuery;
    const base = this.vetClinicalBase();
    const pathOut = base ? `${base}${pathname}` : pathname;
    return qs !== undefined ? `${pathOut}?${qs}` : pathOut;
  }

  /**
   * Desktop (≥768): lente Prestador não mostra Painel/Agenda/Equipe como abas superiores
   * (esses atalhos continuam apenas no dock móvel). Abas institucionais aqui + CTA Painel/Entrar.
   */
  private desktopParceiroTopNavTabs(): NavMainItem[] {
    const tenantSf = this.tenantLoja.isTenantLoja();
    const sobrePainelHref = tenantSf ? '/institucional-loja' : '/sobre-nos';
    const sobreItem: NavMainItem = {
      id: 'sobre',
      label: 'Quem somos',
      shortLabel: 'Quem somos',
      link: sobrePainelHref,
      icon: 'fas fa-fw fa-circle-info',
      psIcon: 'sparkle',
    };
    if (tenantSf) return [sobreItem];
    return [
      sobreItem,
      {
        id: 'lp-vet-tab',
        label: 'Veterinários',
        shortLabel: 'Veterinários',
        link: '/parceiro/veterinarios',
        icon: 'fas fa-fw fa-stethoscope',
        psIcon: 'stethoscope',
      },
      {
        id: 'lp-hotel-tab',
        label: 'Hotel e creche',
        shortLabel: 'Hotel',
        link: '/parceiro/hotel-e-creche',
        icon: 'fas fa-fw fa-hotel',
        psIcon: 'bed',
      },
      {
        id: 'lp-adestramentos-tab',
        label: 'Adestramentos',
        shortLabel: 'Adestramentos',
        link: '/adestramentos',
        icon: 'fas fa-fw fa-paw',
        psIcon: 'paw',
      },
      {
        id: 'planos-dock',
        label: 'Planos',
        shortLabel: 'Planos',
        link: '/parceiro/planos',
        icon: 'fas fa-fw fa-layer-group',
        psIcon: 'sparkle',
      },
    ];
  }

  /** Abas primárias da lente atual — dock móvel Profissionais/Vet; vet desktop usa as mesmas. */
  private get primaryNavItemsForProfissionalLens(): NavMainItem[] | null {
    const tenantSf = this.tenantLoja.isTenantLoja();
    if (this.dockMode === 'vet') {
      const h = (p: string): string => this.vetClinicalHref(p);
      const sobreLink = tenantSf ? '/institucional-loja' : h('/sobre-nos');
      return [
        { id: 'pacientes', label: 'Pacientes', shortLabel: 'Pacientes', link: h('/pacientes'), icon: 'fas fa-fw fa-paw', psIcon: 'paw' },
        { id: 'receitas', label: 'Receitas', shortLabel: 'Receitas', link: h('/historico-receitas'), icon: 'fas fa-fw fa-file-prescription', psIcon: 'sparkle' },
        { id: 'gerar', label: 'Nova', shortLabel: 'Nova', link: h('/gerar-receita'), icon: 'fas fa-fw fa-plus', psIcon: 'sparkle' },
        { id: 'sobre', label: 'Quem somos', shortLabel: 'Quem somos', link: sobreLink, icon: 'fas fa-fw fa-circle-info', psIcon: 'sparkle' },
      ];
    }
    if (this.dockMode === 'parceiro') {
      const logoutItem: NavMainItem = {
        id: 'logout',
        label: 'Sair',
        shortLabel: 'Sair',
        link: '#',
        icon: 'fas fa-fw fa-right-from-bracket',
        psIcon: 'logout',
      };
      const entrarPrestadorItem: NavMainItem = {
        id: 'prestador-shell',
        label: 'Entrar',
        shortLabel: 'Entrar',
        link: '/parceiros/login',
        icon: 'fas fa-fw fa-right-to-bracket',
        psIcon: 'login',
      };
      const painelItem: NavMainItem = {
        id: 'painel', label: 'Painel', shortLabel: 'Painel',
        link: '/parceiros/painel', icon: 'fas fa-fw fa-gauge', psIcon: 'home',
      };
      const agendaItem: NavMainItem = {
        id: 'agenda', label: 'Agenda', shortLabel: 'Agenda',
        link: '/parceiros/agenda', icon: 'fas fa-fw fa-calendar', psIcon: 'calendar',
      };
      const planosItem: NavMainItem = {
        id: 'planos-dock', label: 'Planos', shortLabel: 'Planos',
        link: '/parceiro/planos', icon: 'fas fa-fw fa-layer-group', psIcon: 'sparkle',
      };

      if (!this.parceiroAuth.isLoggedIn()) {
        const loja = this.lojaHref;
        // Vitrine tenant: variante enxuta (Loja + Entrar) — sem marketing institucional Petsphere.
        if (tenantSf) {
          return [
            {
              id: 'loja',
              label: 'Loja',
              shortLabel: 'Loja',
              link: loja,
              icon: 'fas fa-fw fa-desktop',
              psIcon: 'sparkle',
            },
            entrarPrestadorItem,
          ];
        }
        // Prestador deslogado (4 itens): Sobre · Planos · (FAB) · Cadastro · Entrar
        return [
          {
            id: 'sobre',
            label: 'Sobre nós',
            shortLabel: 'Sobre',
            link: '/sobre-nos',
            icon: 'fas fa-fw fa-circle-info',
            psIcon: 'sparkle',
          },
          planosItem,
          {
            id: 'cadastro-parc',
            label: 'Seja parceiro',
            shortLabel: 'Cadastro',
            link: '/parceiro/cadastrar',
            icon: 'fas fa-fw fa-handshake',
            psIcon: 'person',
          },
          entrarPrestadorItem,
        ];
      }

      // Logado — painel (dentro de /parceiros/*): Painel · Agenda · (FAB) · Equipe · Sair
      if (this.isPartnerPainelRoute) {
        return [
          painelItem,
          agendaItem,
          {
            id: 'colab', label: 'Equipe', shortLabel: 'Equipe',
            link: '/parceiros/colaboradores', icon: 'fas fa-fw fa-users', psIcon: 'person',
          },
          logoutItem,
        ];
      }
      // Logado — institucional (fora de /parceiros/*): Painel · Planos · (FAB) · Agenda · Sair
      return [
        painelItem,
        planosItem,
        agendaItem,
        logoutItem,
      ];
    }
    return null;
  }

  /** Dock para vet/parceiro — variante profissional, mesma linguagem visual. */
  get mobileDockItemsProfessional(): NavMainItem[] {
    return this.primaryNavItemsForProfissionalLens ?? this.mobileDockItems;
  }

  get activeMobileItems(): NavMainItem[] {
    return this.dockMode === 'vet' || this.dockMode === 'parceiro'
      ? this.mobileDockItemsProfessional
      : this.mobileDockItems;
  }

  /** Grid do dock com slot do FAB: 5 células, um `<li>` por célula. */
  get dockGridCells(): DockGridCell[] {
    const items = this.activeMobileItems;
    const out: DockGridCell[] = [];
    const n = items.length;
    for (let i = 0; i < n; i++) {
      if (n >= 4 && i === 2) out.push({ kind: 'spacer' });
      out.push({ kind: 'nav', item: items[i] });
    }
    return out;
  }

  /**
   * Incluir `dockMode` evita reuso Ivy de `<li>` entre lentes Tutores vs Profissionais/Vet —
   * o mesmo índice com ids diferentes chegava a deixar “fantasmas” sobrepostos ao mudar modo.
   */
  trackDockGridCell(_index: number, cell: DockGridCell): string {
    const m = this.dockMode;
    return cell.kind === 'spacer' ? `${m}::__fab-slot` : `${m}::${cell.item.id}`;
  }

  // ─── Quick actions catalog (FAB sheet + radial) ─────────────────────────────
  readonly quickActionCatalog: Record<DockActionId, QuickAction> = {
    'agendar':      { id: 'agendar',      label: 'Agendar',         caption: 'Consulta com vet',          link: '/mapa?service=consulta', icon: 'calendar', tone: 'aqua' },
    'telemedicina': { id: 'telemedicina', label: 'Telemedicina',    caption: 'Consulta online agora',     link: '/area-cliente?view=telemedicina', icon: 'video', tone: 'aqua' },
    'meus-agendamentos': {
      id: 'meus-agendamentos',
      label: 'Meus agendamentos',
      caption: 'Loja, telemedicina e hospedagem',
      link: '/meus-agendamentos',
      icon: 'calendar',
      tone: 'aqua',
    },
    'buscar-vet':   { id: 'buscar-vet',   label: 'Buscar vet',      caption: 'Veterinários próximos',     link: '/mapa', icon: 'stethoscope', tone: 'aqua' },
    'transporte-pet': { id: 'transporte-pet', label: 'Transporte pet', caption: 'Pedir corrida no mapa', link: '/mapa?service=transporte', icon: 'map', tone: 'aqua' },
    'comprar':      { id: 'comprar',      label: 'Comprar',         caption: 'Loja Petsphere',            link: '/loja', icon: 'shop', tone: 'aurora' },
    'notificacoes': { id: 'notificacoes', label: 'Notificações',    caption: 'Avisos e atualizações',     link: '#',     icon: 'bell', tone: 'aurora' },
    'hospedagem':   { id: 'hospedagem',   label: 'Hospedagem',      caption: 'Hotéis pet near you',       link: '/mapa?service=hospedagem', icon: 'bed', tone: 'aurora' },
    'meus-pets':    { id: 'meus-pets',    label: 'Meus pets',       caption: 'Cadastros e carteirinhas',  link: '/meus-pets', icon: 'paw', tone: 'aurora' },
    'galeria':      { id: 'galeria',      label: 'Galeria pet',     caption: 'Comunidade Petsphere',      link: '/galeria', icon: 'sparkle', tone: 'aurora' },
    'vet-pacientes': { id: 'vet-pacientes', label: 'Pacientes',    caption: 'Carteira clínica',          link: '/pacientes', icon: 'paw', tone: 'aqua' },
    'vet-receitas':  { id: 'vet-receitas',  label: 'Receitas',     caption: 'Histórico de prescrições',  link: '/historico-receitas', icon: 'sparkle', tone: 'aqua' },
    'vet-gerar':     { id: 'vet-gerar',     label: 'Nova receita',  caption: 'Emitir receita',            link: '/gerar-receita', icon: 'sparkle', tone: 'aqua' },
    'vet-panorama':  { id: 'vet-panorama',  label: 'Panorama',      caption: 'Custos e exames',          link: '/panorama-atendimento', icon: 'map', tone: 'aqua' },
    'vet-cockpit':   { id: 'vet-cockpit',   label: 'Painel Vet',    caption: 'Visão geral do dia',        link: '/parceiros/vet-cockpit', icon: 'home', tone: 'aqua' },
    'parceiro-painel':   { id: 'parceiro-painel',   label: 'Painel',     caption: 'Resumo da loja',       link: '/parceiros/painel', icon: 'home', tone: 'neutral' },
    'parceiro-agenda':   { id: 'parceiro-agenda',   label: 'Agenda',     caption: 'Compromissos',         link: '/parceiros/agenda', icon: 'calendar', tone: 'neutral' },
    'parceiro-equipe':   { id: 'parceiro-equipe',   label: 'Equipe',     caption: 'Colaboradores',        link: '/parceiros/colaboradores', icon: 'person', tone: 'neutral' },
    'parceiro-cadastro': {
      id: 'parceiro-cadastro',
      label: 'Seja parceiro',
      caption: 'Cadastrar seu negócio',
      link: '/parceiro/cadastrar',
      icon: 'person',
      tone: 'neutral',
    },
    'sobre-nos':         { id: 'sobre-nos',       label: 'Quem somos',   caption: 'Institucional Petsphere', link: '/sobre-nos', icon: 'sparkle', tone: 'neutral' },
    'planos-parceiro':   { id: 'planos-parceiro', label: 'Planos Petsphere', caption: 'Créditos e negócio', link: '/parceiro/planos', icon: 'sparkle', tone: 'neutral' },
    'lp-veterinarios': {
      id: 'lp-veterinarios',
      label: 'Veterinários',
      caption: 'Clínicas na PetSphere',
      link: '/parceiro/veterinarios',
      icon: 'stethoscope',
      tone: 'aqua',
    },
    'lp-hotel-creche': {
      id: 'lp-hotel-creche',
      label: 'Hotel e creche',
      caption: 'Hospedagem e day use',
      link: '/parceiro/hotel-e-creche',
      icon: 'bed',
      tone: 'aurora',
    },
    'lp-adestramentos': {
      id: 'lp-adestramentos',
      label: 'Adestramentos',
      caption: 'Comportamento e profissionais',
      link: '/adestramentos',
      icon: 'paw',
      tone: 'neutral',
    },
    'prestador-login':   { id: 'prestador-login', label: 'Entrar na área Prestador', caption: 'Login e painel', link: '/parceiros/login', icon: 'person', tone: 'neutral' },
  };

  /**
   * Ajusta atalhos “Comprar” na lente Prestador: mesmo destino que a vitrine (`lojaHref`),
   * texto de vitrine/demo para quem está deslogado do painel parceiro.
   */
  private mapParceiroQuickActionCopy(id: DockActionId, src: QuickAction): QuickAction {
    if (id !== 'comprar' || this.dockMode !== 'parceiro') return src;
    const next = { ...src, link: this.lojaHref };
    if (!this.parceiroAuth.isLoggedIn()) {
      next.label = 'Vitrine';
      next.caption = 'Demonstração na mesma experiência da vitrine — exemplos de painel e ferramentas SaaS.';
    }
    return next;
  }

  /** Na vitrine tenant, “Comprar” deve ir para a própria loja — não `/loja` global com copy Petsphere. */
  private mapTenantConsumerQuickActionIfNeeded(id: DockActionId, src: QuickAction): QuickAction {
    if (!this.tenantLoja.isTenantLoja() || id !== 'comprar') return src;
    return {
      ...src,
      link: this.lojaHref,
      caption: 'Na vitrine deste parceiro',
      label: 'Comprar',
    };
  }

  /** Painéis da bottom sheet — conteúdo depende só do modo do dock ao abrir (snapshot em openSheet). */
  private computeSheetPanels(): SheetPanelRow[] {
    const c = this.quickActionCatalog;
    if (this.dockMode === 'vet') {
      const ids: DockActionId[] = ['vet-cockpit', 'vet-gerar', 'vet-pacientes', 'vet-receitas', 'vet-panorama'];
      return [
        {
          sectionLabel: null,
          actions: ids.map((id) => ({
            ...c[id],
            link: this.vetClinicalHref(c[id].link),
          })),
        },
      ];
    }
    if (this.dockMode === 'parceiro') {
      const tenantSf = this.tenantLoja.isTenantLoja();
      const ids: DockActionId[] = !this.parceiroAuth.isLoggedIn()
        ? tenantSf
          ? ['comprar', 'prestador-login']
          : [
              'sobre-nos',
              'planos-parceiro',
              'lp-veterinarios',
              'lp-hotel-creche',
              'lp-adestramentos',
              'parceiro-cadastro',
              'comprar',
              'prestador-login',
            ]
        : ['parceiro-painel', 'parceiro-agenda', 'parceiro-equipe', 'comprar', 'buscar-vet'];
      return [{
        sectionLabel: null,
        actions: ids.map((id) => this.mapParceiroQuickActionCopy(id, { ...c[id] })),
      }];
    }
    return this.buildConsumerSheetPanels();
  }

  /** Lente tutor (app cliente/guest/vet-legado FAB se guest). */
  get isClienteLensToggleActive(): boolean {
    return this.dockMode !== 'parceiro';
  }

  get isParceirosLensToggleActive(): boolean {
    return this.dockMode === 'parceiro';
  }

  /** Só há shell com drawer após entrada na área autenticada (não login/convite). */
  get showPartnerShellMenuLauncher(): boolean {
    const r = this.currentRoute || '';
    if (!r.startsWith('/parceiros/')) return false;
    if (
      r === '/parceiros/login' ||
      r.startsWith('/parceiros/recuperar-senha') ||
      /^\/parceiros\/convite\//.test(r)
    ) {
      return false;
    }
    return this.isViewportMax767();
  }

  private isViewportMax767(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return !!(typeof window.matchMedia !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
    } catch {
      return false;
    }
  }

  private isViewportMin768(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return !!(typeof window.matchMedia !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);
    } catch {
      return false;
    }
  }

  /** Vitrine em subdomínio / host do parceiro — sem marketing institucional Petsphere. */
  get isTenantPartnerStorefront(): boolean {
    return this.tenantLoja.isTenantLoja();
  }

  openPartnerShellDrawerFromNav(): void {
    this.closeSheet();
    this.closeRadial();
    this.haptics.medium();
    this.parceirosMobileShell.requestOpenPartnerDrawer();
  }

  private buildConsumerSheetPanels(): SheetPanelRow[] {
    const cat = this.quickActionCatalog;
    const tenantSf = this.tenantLoja.isTenantLoja();
    let coreIds: DockActionId[] = this.isCliente
      ? ['transporte-pet', 'agendar', 'telemedicina', 'buscar-vet', 'hospedagem']
      : ['transporte-pet', 'buscar-vet', 'agendar', 'telemedicina', 'hospedagem'];

    let lojaPanel: DockActionId[] = ['comprar'];
    if (this.isShoppingRoute) {
      const rest = coreIds.filter((id) => id !== 'comprar');
      coreIds = (['comprar', ...rest] as DockActionId[]).slice(0, 5);
      lojaPanel = [];
    }

    const rows: SheetPanelRow[] = [];
    /** Cliente logado: notificações sai do dock e ganha linha dedicada no topo do sheet. */
    if (this.isCliente && !this.isAreaVetRoute) {
      rows.push({ sectionLabel: null, actions: [cat['notificacoes']] });
    }
    rows.push({ sectionLabel: 'Mapa e cuidados com o pet', actions: coreIds.map((id) => cat[id]) });
    if (lojaPanel.length > 0) {
      const lojaActions = lojaPanel.map((id) => {
        const base = cat[id];
        if (tenantSf && id === 'comprar') {
          return {
            ...base,
            link: this.lojaHref,
            caption: 'Na vitrine deste parceiro',
            label: 'Comprar',
          };
        }
        return base;
      });
      rows.push({
        sectionLabel: tenantSf ? 'Loja' : 'Loja oficial Petsphere',
        actions: lojaActions,
      });
    }
    if (this.isCliente) {
      const contaIds: DockActionId[] = ['meus-agendamentos', 'meus-pets'];
      rows.push({
        sectionLabel: 'Compromissos e pets',
        actions: contaIds.map((id) => this.mapTenantConsumerQuickActionIfNeeded(id, { ...cat[id] })),
      });
    }
    /** Parceiro: toggle na navbar superior (ver `Cliente | Parceiro`) — não no sheet central. */
    if (!tenantSf) {
      const institucionalIds: DockActionId[] = ['sobre-nos', 'lp-veterinarios', 'lp-hotel-creche'];
      rows.push({
        sectionLabel: 'Institucional e parceiros',
        actions: institucionalIds.map((id) => cat[id]),
      });
    }
    return rows;
  }

  /** Hub vs galeria no logo desktop; tenant permanece na vitrine `/`. */
  get brandHomeLink(): string {
    return this.tenantLoja.isTenantLoja() ? '/' : '/galeria';
  }

  get brandHomeAriaLabel(): string {
    return this.tenantLoja.isTenantLoja()
      ? 'Petsphere — ir para a página inicial da vitrine'
      : 'Petsphere — ir para a galeria';
  }

  get lojaHref(): string {
    return this.tenantLoja.isTenantLoja() ? '/' : '/loja';
  }

  get showDesktopParceiroPainelBtn(): boolean {
    return !!(this.showFullMenu && this.dockMode === 'parceiro' && this.parceiroAuth.isLoggedIn() && this.isViewportMin768());
  }

  get showDesktopParceiroEntrarBtn(): boolean {
    return !!(this.showFullMenu && this.dockMode === 'parceiro' && !this.parceiroAuth.isLoggedIn() && this.isViewportMin768());
  }

  /**
   * Alternância app tutor ↔ prestador sem abrir o bottom sheet do FAB (melhor no mobile).
   */
  get showClienteParceiroToggle(): boolean {
    if (!this.showFullMenu || this.isAreaVetRoute) return false;
    if (this.tenantLoja.isTenantLoja() || this.tenantLoja.isTenantDedicatedHost()) return false;
    return this.dockMode !== 'vet';
  }

  /** Desktop e tablet largo: sino na barra superior; no celular só no dock inferior. */
  get showClienteNotifInNavbar(): boolean {
    return !!(this.isCliente && !this.isAreaVetRoute && !this.isViewportMax767());
  }

  /**
   * Navega para o hub do app cliente (vitrine tenant usa `/`; caso contrário `/galeria`).
   */
  navigateToClienteAppHome(): void {
    this.haptics.light();
    this.dockCtx.setNavLensPreference('cliente');
    this.router.navigateByUrl(this.tenantLoja.isTenantLoja() ? '/' : '/galeria');
  }

  navigateToParceiroPanel(): void {
    this.haptics.light();
    this.dockCtx.setNavLensPreference('parceiro');
    if (this.parceiroAuth.isLoggedIn()) {
      this.router.navigateByUrl('/parceiros/painel');
      return;
    }
    this.router.navigateByUrl('/parceiro/planos');
  }

  isDockFillItem(item: NavMainItem): boolean {
    return item.id === '__dock-fill-a' || item.id === '__dock-fill-b';
  }

  private fabRadialDefaultIds(): DockActionId[] {
    if (this.dockMode === 'vet') {
      return ['vet-pacientes', 'vet-receitas', 'vet-gerar', 'vet-panorama'];
    }
    if (this.dockMode === 'parceiro') {
      const tenantSf = this.tenantLoja.isTenantLoja();
      if (!this.parceiroAuth.isLoggedIn()) {
        return tenantSf
          ? ['comprar', 'prestador-login', 'buscar-vet', 'transporte-pet']
          : ['planos-parceiro', 'parceiro-cadastro', 'comprar', 'prestador-login'];
      }
      return ['parceiro-painel', 'parceiro-agenda', 'parceiro-equipe', 'comprar'];
    }
    return ['transporte-pet', 'buscar-vet', 'agendar', 'comprar'];
  }

  // ─── Mini-bag (carrinho contextual flutuante) ───────────────────────────────
  /** Mostra a mini-bag em rotas de compra com itens. */
  get isShoppingRoute(): boolean {
    const p = (this.currentRoute || '').split('?')[0] || '';
    const tenantStorefront = this.tenantLoja.isTenantLoja() && p === '/';
    return tenantStorefront || p.startsWith('/loja') || p.startsWith('/produto/') || p.startsWith('/favoritos');
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
  /** Sino mantido fora do dock (oculto via CSS) — disparado pela ação Notificações do FAB sheet. */
  @ViewChild('dockBell') dockBell?: NotificationsBellComponent;

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
  private partnerFabBridgeSub?: Subscription;
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
    private tenantLoja: TenantLojaService,
    private parceirosMobileShell: ParceirosMobileShellService,
    private parceiroAuth: ParceiroAuthService,
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
          if (this.showClienteModal) {
            this.finalizeClienteModalClose();
          }
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
      .map(id => this.mapTenantConsumerQuickActionIfNeeded(id, { ...this.quickActionCatalog[id] }));

    this.partnerFabBridgeSub = merge(
      this.parceirosMobileShell.openPartnerFabRadial$.pipe(map(() => 'radial' as const)),
      this.parceirosMobileShell.openPartnerFabSheet$.pipe(map(() => 'sheet' as const)),
    ).subscribe(kind => {
      if (!isPlatformBrowser(this.platformId)) return;
      if (this.dockMode !== 'parceiro') return;
      if (!this.isViewportMax767()) return;
      this.haptics.medium();
      if (kind === 'radial') {
        this.closeSheet();
        this.openRadial();
      } else {
        this.closeRadial();
        this.openSheet();
      }
    });
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
    if (next === 'parceiro') {
      this.dockCtx.setNavLensPreference('parceiro');
    }
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

  trackBySheetRow(_index: number, row: SheetPanelRow): string {
    const head = row.sectionLabel ?? '∅';
    return `${head}|${row.actions.map(a => a.id).join(',')}`;
  }

  /** Login / logout / slot de notificações (painel no template). */
  onMobileItemActivate(item: NavMainItem, ev?: Event): void {
    if (this.isDockFillItem(item)) {
      ev?.preventDefault();
      return;
    }
    if (item.id === 'dock-notificacoes') {
      ev?.preventDefault();
      return;
    }
    if (item.id === 'login') {
      ev?.preventDefault();
      this.haptics.light();
      this.abrirClienteModal();
      return;
    }
    if (item.id === 'logout') {
      ev?.preventDefault();
      this.haptics.medium();
      this.dockLogoutForCurrentMode();
      return;
    }
    this.onMainTabClick(item.id);
  }

  /** Logout sensível ao modo do dock (parceiro encerra sessão do prestador). */
  private dockLogoutForCurrentMode(): void {
    if (this.dockMode === 'parceiro') {
      this.dockLogoutParceiro();
      return;
    }
    this.dockLogoutCliente();
  }

  private dockLogoutCliente(): void {
    this.fecharClienteModal();
    try { this.auth.logout(); } catch {}
    try {
      this.router.navigateByUrl('/');
    } catch {
      if (typeof window !== 'undefined') window.location.href = '/';
    }
  }

  private dockLogoutParceiro(): void {
    try { this.parceiroAuth.logout(); } catch {}
    /** Mantém a lente “Profissionais” — usuário permanece no contexto após sair. */
    try {
      this.router.navigateByUrl('/parceiros/login');
    } catch {
      if (typeof window !== 'undefined') window.location.href = '/parceiros/login';
    }
  }

  isMobileTabHighlighted(item: NavMainItem): boolean {
    if (item.id === 'login' || item.id === 'logout' || item.id === 'dock-notificacoes') return false;
    if (this.isDockFillItem(item)) return false;
    return this.isTabHighlighted(item);
  }

  /** Fotinha no FAB — mesma área que a antiga aba "Eu" (modal da conta). */
  onFabAvatarClick(ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.haptics.light();
    this.abrirClienteModal();
  }

  isTabHighlighted(item: NavMainItem): boolean {
    if (this.selectedMainTabId != null && this.selectedMainTabId !== '') return item.id === this.selectedMainTabId;
    return this.isNavActive(item);
  }

  isNavActive(item: NavMainItem): boolean {
    const path = (this.currentRoute || '').split('?')[0] || '';
    switch (item.id) {
      case 'loja':       return (
        (path === '/' && this.tenantLoja.isTenantLoja()) ||
        path.startsWith('/loja') || path.startsWith('/produto/') || path.startsWith('/favoritos') || path.startsWith('/checkout')
      );
      case 'sobre':      return path.startsWith('/sobre-nos') || path.startsWith('/institucional-loja');
      case 'mapa':       return path.startsWith('/mapa');
      case 'galeria':
        return (
          path.startsWith('/galeria') ||
          (this.tenantLoja.isTenantLoja() && path === '/')
        );
      case 'carrinho':   return path.startsWith('/carrinho');
      case 'pacientes':  return path.includes('/pacientes');
      case 'receitas':   return path.includes('/historico-receitas');
      case 'gerar':      return path.includes('/gerar-receita');
      case 'painel':     return path.startsWith('/parceiros/painel');
      case 'agenda':     return path.startsWith('/parceiros/agenda');
      case 'colab':      return path.startsWith('/parceiros/colaboradores');
      case 'planos-dock': return path.startsWith('/parceiro/planos');
      case 'cadastro-parc': return path.startsWith('/parceiro/cadastrar');
      case 'lp-vet-tab': return path.startsWith('/parceiro/veterinarios');
      case 'lp-hotel-tab': return path.startsWith('/parceiro/hotel-e-creche');
      case 'lp-adestramentos-tab': return path.startsWith('/adestramentos');
      case 'prestador-shell':
        return path.startsWith('/parceiros/login') || path.startsWith('/parceiros/recuperar-senha');
      default: return false;
    }
  }

  /**
   * Top-bar desktop: cliente = Galeria, Mapa, Loja, Sobre (+ Carrinho se logado);
   * vet / prestador mantêm suas lentes; FAB móvel segue mesmo strip de 4 itens.
   */
  get visibleNavItems(): NavMainItem[] {
    const prof = this.primaryNavItemsForProfissionalLens;
    if (prof) {
      if (this.dockMode === 'parceiro' && this.isViewportMin768()) return this.desktopParceiroTopNavTabs();
      return prof;
    }

    const tenantSf = this.tenantLoja.isTenantLoja();
    const galeriaLink = tenantSf ? '/' : '/galeria';
    const sobreLink = tenantSf ? '/institucional-loja' : '/sobre-nos';

    /** Lente cliente / guest — desktop + dock: mesmo conjunto padronizado (ícones na barra). */
    const clienteStrip: NavMainItem[] = [
      { id: 'galeria', label: 'Galeria', shortLabel: 'Galeria', link: galeriaLink, icon: 'fas fa-fw fa-images', psIcon: 'home' },
      { id: 'mapa', label: 'Mapa', shortLabel: 'Mapa', link: '/mapa', icon: 'fas fa-fw fa-map-location-dot', psIcon: 'map' },
      { id: 'loja', label: 'Loja', shortLabel: 'Loja', link: this.lojaHref, icon: 'fas fa-fw fa-store', psIcon: 'shop' },
      { id: 'sobre', label: 'Sobre', shortLabel: 'Sobre', link: sobreLink, icon: 'fas fa-fw fa-circle-info', psIcon: 'sparkle' },
    ];
    if (this.isCliente) {
      return [...clienteStrip, this.carrinhoNavItem];
    }
    return clienteStrip;
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
    this.openFabPrimaryMenu();
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
    this.openFabPrimaryMenu();
  }

  /** Fallback quando só o evento de click chega (ex.: teclado mouse emulado). */
  onFabClick(ev: Event): void {
    if (this.fabIgnoreNextClick) {
      this.fabIgnoreNextClick = false;
      ev.preventDefault();
      return;
    }
    ev.preventDefault();
    this.openFabPrimaryMenu();
  }

  /** Acessibilidade: Enter/Espaço também abrem ações rápidas. */
  onFabKeyboardActivate(ev: Event): void {
    ev.preventDefault();
    this.openFabPrimaryMenu();
  }

  private openFabPrimaryMenu(): void {
    if (this.isSheetOpen) this.closeSheet();
    this.openRadial();
  }

  openSheet(): void {
    if (this.isSheetOpen) return;
    this.sheetRowsSnapshot = this.computeSheetPanels();
    if (this.dockMode === 'parceiro') {
      if (!this.parceiroAuth.isLoggedIn()) {
        if (this.tenantLoja.isTenantLoja()) {
          this.sheetLeadTitle = 'Esta vitrine';
          this.sheetLeadSubtitle = 'Loja pública e entrada na área do prestador';
        } else {
          this.sheetLeadTitle = 'Para o seu negócio';
          this.sheetLeadSubtitle = 'Planos, cadastro, vitrine de demonstrações e entrada no painel';
        }
      } else {
        this.sheetLeadTitle = this.tenantLoja.isTenantLoja() ? 'Prestador' : 'Prestador Petsphere';
        this.sheetLeadSubtitle = 'Atalhos do painel e do app cliente';
      }
    } else if (this.dockMode === 'vet') {
      this.sheetLeadTitle = 'Área veterinária';
      this.sheetLeadSubtitle = 'Prescrição e atendimento';
    } else {
      this.sheetLeadTitle = 'O que você quer fazer?';
      this.sheetLeadSubtitle = 'Atalhos rápidos do seu ecossistema pet';
    }
    this.haptics.medium();
    this.isSheetOpen = true;
    this.applyBodyScrollLock();
    this.cdr.detectChanges();
  }

  closeSheet(): void {
    if (!this.isSheetOpen) return;
    this.isSheetOpen = false;
    this.sheetRowsSnapshot = [];
    this.releaseBodyScrollLock();
    this.cdr.detectChanges();
  }

  openRadial(): void {
    if (this.isRadialOpen) return;
    this.haptics.heavy();
    this.radialActions = this.dockCtx
      .topActions(4, this.fabRadialDefaultIds())
      .map((id) => {
        const src = this.quickActionCatalog[id];
        if (this.dockMode === 'vet') {
          return this.mapTenantConsumerQuickActionIfNeeded(id, { ...src, link: this.vetClinicalHref(src.link) });
        }
        let out = this.mapParceiroQuickActionCopy(id, { ...src });
        out = this.mapTenantConsumerQuickActionIfNeeded(id, out);
        return out;
      });
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
    /**
     * Notificações: não navega — abre o painel fullscreen do sino hospedado fora do dock.
     * Aguarda o sheet/radial fechar antes do toggle para o overlay nascer com o body destravado.
     */
    if (action.id === 'notificacoes') {
      setTimeout(() => {
        try { this.dockBell?.toggle(); } catch {}
      }, 60);
      return;
    }
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
    try { this.partnerFabBridgeSub?.unsubscribe(); } catch {}
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
