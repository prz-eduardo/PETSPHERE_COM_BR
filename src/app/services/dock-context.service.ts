import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { TenantLojaService } from './tenant-loja.service';

/**
 * Aurora Dock — Contexto adaptativo
 *
 * O mesmo dock serve papéis diferentes (cliente / vet / parceiro / deslogado).
 * Este serviço expõe um "modo" para a barra ler e ajustar conteúdo + variantes,
 * e um "tema noturno" automático (após 19h local).
 *
 * Também guarda contadores de uso do FAB para o long-press apresentar as 4 ações
 * mais frequentes (aprende com o usuário). Persiste em localStorage.
 */

export type DockMode = 'guest' | 'cliente' | 'vet' | 'parceiro';

export type DockActionId =
  | 'agendar'
  | 'telemedicina'
  | 'buscar-vet'
  | 'transporte-pet'
  | 'comprar'
  | 'hospedagem'
  | 'meus-pets'
  | 'galeria'
  | 'sobre-nos'
  | 'planos-parceiro'
  /** Landings B2B (domínio principal) */
  | 'lp-veterinarios'
  | 'lp-hotel-creche'
  | 'lp-adestramentos'
  | 'prestador-login'
  /** Atalhos FAB — modo veterinário (dock profissional) */
  | 'vet-pacientes'
  | 'vet-receitas'
  | 'vet-gerar'
  | 'vet-panorama'
  | 'vet-cockpit'
  /** Atalhos FAB — modo parceiro */
  | 'parceiro-painel'
  | 'parceiro-agenda'
  | 'parceiro-equipe'
  /** Cadastro público Prestador (/parceiro/cadastrar) */
  | 'parceiro-cadastro';

const FREQ_KEY = 'ps_dock_action_freq_v1';
/** sessionStorage: última lente escolhida na pill Tutores | Profissionais (só no browser). */
const NAV_LENS_KEY = 'ps_nav_lens';
const NAV_LENS_PARCEIRO = 'parceiro';
const NAV_LENS_CLIENTE = 'cliente';
const NIGHT_HOUR = 19;
const DAY_HOUR = 6;

@Injectable({ providedIn: 'root' })
export class DockContextService implements OnDestroy {
  private modeSubject = new BehaviorSubject<DockMode>('guest');
  /** Modo atual do dock (atualizado pelo navmenu via setMode/setRouteSignals). */
  mode$: Observable<DockMode> = this.modeSubject.asObservable();

  private nightSubject = new BehaviorSubject<boolean>(false);
  /** True após 19h local — gradient cosmos noturno. */
  night$: Observable<boolean> = this.nightSubject.asObservable();

  private freq: Record<string, number> = {};
  private nightTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private tenantLoja: TenantLojaService,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFrequencies();
      this.evaluateNight();
      this.nightTimer = setInterval(() => this.evaluateNight(), 5 * 60 * 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.nightTimer) clearInterval(this.nightTimer);
  }

  // ─── Mode ──────────────────────────────────────────────────────────────────
  setMode(mode: DockMode): void {
    if (this.modeSubject.value !== mode) this.modeSubject.next(mode);
  }
  get mode(): DockMode { return this.modeSubject.value; }

  /** Pill “Profissionais” / rotas Prestador — para manter dock em páginas partilhadas (ex.: /sobre-nos). */
  setNavLensPreference(lens: 'cliente' | 'parceiro'): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      sessionStorage.setItem(NAV_LENS_KEY, lens === NAV_LENS_PARCEIRO ? NAV_LENS_PARCEIRO : NAV_LENS_CLIENTE);
    } catch {}
  }

  prefersParceiroNavLens(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return sessionStorage.getItem(NAV_LENS_KEY) === NAV_LENS_PARCEIRO;
    } catch {
      return false;
    }
  }

  /** Páginas que podem usar o dock Prestador quando a lente Profissionais está ativa. */
  private isParceiroLensNeutralPath(path: string): boolean {
    const p = path.split('?')[0] || '';
    if (p === '/sobre-nos' || p.startsWith('/sobre-nos/')) return true;
    if (p === '/adestramentos' || p.startsWith('/adestramentos/')) return true;
    if (p === '/institucional' || p.startsWith('/institucional/')) return true;
    if (p === '/loja' || p.startsWith('/loja/')) return true;
    if (p.startsWith('/produto/')) return true;
    if (p === '/favoritos' || p.startsWith('/favoritos/')) return true;
    if (p.startsWith('/checkout') || p.startsWith('/carrinho')) return true;
    // Vitrine tenant: link “Vitrine” no dock Prestador pode ser `/`.
    if (p === '/') return true;
    return false;
  }

  /**
   * Deduz modo do dock: rota, cliente logado e preferência de lente (`sessionStorage` —
   * páginas neutras mantêm Prestador até o usuário voltar a “Cliente”).
   * Prestador por rota: `/parceiro/*`, `/parceiros/*`, convites; clínico: `vet`.
   */
  resolveModeFromRoute(route: string, isCliente: boolean): DockMode {
    const r = (route || '').split('?')[0] || '';
    /** Hub marketing Prestador (/parceiro/planos, /parceiro/cadastrar) — não confundir com /parceiros/*. */
    if (r.startsWith('/parceiro/')) return 'parceiro';
    if (r.startsWith('/convite-dados/')) return 'parceiro';

    /**
     * Rotas clínicas dentro do shell parceiro — antes do catch-all /parceiros/*,
     * para o dock ficar igual ao mobile (Pacientes · Receitas · …), não abas Prestador.
     */
    const isPartnerShellVetRoute =
      r.startsWith('/parceiros/area-vet') ||
      r.startsWith('/parceiros/gerar-receita') ||
      r.startsWith('/parceiros/historico-receitas') ||
      r.startsWith('/parceiros/pacientes') ||
      r.startsWith('/parceiros/panorama-atendimento');
    if (isPartnerShellVetRoute) return 'vet';

    if (r === '/parceiros' || r.startsWith('/parceiros/')) return 'parceiro';

    if (
      r.includes('/area-vet') ||
      r.startsWith('/gerar-receita') ||
      r.startsWith('/historico-receitas') ||
      r.startsWith('/pacientes') ||
      r.startsWith('/panorama-atendimento')
    )
      return 'vet';

    /**
     * Prestador/fornecedor institucional: se o utilizador escolheu a lente "Profissionais"
     * (sessionStorage), manter esse dock mesmo em páginas partilhadas com tutores —
     * inclui cliente tutor logado em `/`, `/sobre-nos`, `/loja`, carrinho, etc.
     * Isto deve vir antes de `isCliente`, senão tutor logado regressava sempre à vista cliente.
     *
     * Na vitrine tenant (subdomínio/hospedagem do parceiro) essa persistência não aplica —
     * evita dock "Prestador" com links de marketing Petsphere sobre a página inicial da loja.
     */
    if (
      !this.tenantLoja.isTenantLoja() &&
      this.prefersParceiroNavLens() &&
      this.isParceiroLensNeutralPath(r)
    ) {
      return 'parceiro';
    }

    if (isCliente) return 'cliente';
    return 'guest';
  }

  // ─── Night mode ────────────────────────────────────────────────────────────
  private evaluateNight(): void {
    try {
      const h = new Date().getHours();
      const isNight = h >= NIGHT_HOUR || h < DAY_HOUR;
      if (this.nightSubject.value !== isNight) {
        this.nightSubject.next(isNight);
        try {
          document.documentElement.setAttribute('data-ps-night', String(isNight));
        } catch {}
      }
    } catch {}
  }

  // ─── FAB action frequencies (para radial menu adaptativo) ──────────────────
  private loadFrequencies(): void {
    try {
      const raw = localStorage.getItem(FREQ_KEY);
      if (raw) this.freq = JSON.parse(raw) || {};
    } catch {
      this.freq = {};
    }
  }

  private persistFrequencies(): void {
    try { localStorage.setItem(FREQ_KEY, JSON.stringify(this.freq)); } catch {}
  }

  /** Registra uso de uma ação rápida. Top 4 viram o radial menu. */
  registerAction(id: DockActionId): void {
    const cur = this.freq[id] || 0;
    this.freq[id] = cur + 1;
    this.persistFrequencies();
  }

  /** Top N ações mais usadas; preenche com defaults se não houver histórico. */
  topActions(n: number = 4, defaults: DockActionId[] = ['transporte-pet', 'buscar-vet', 'agendar', 'comprar']): DockActionId[] {
    const entries = Object.entries(this.freq) as [DockActionId, number][];
    if (entries.length === 0) return defaults.slice(0, n);
    const sorted = entries.sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const merged: DockActionId[] = [];
    for (const id of sorted) {
      if (!merged.includes(id)) merged.push(id);
      if (merged.length >= n) break;
    }
    for (const id of defaults) {
      if (merged.length >= n) break;
      if (!merged.includes(id)) merged.push(id);
    }
    return merged.slice(0, n);
  }
}
