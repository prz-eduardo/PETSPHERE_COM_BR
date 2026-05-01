import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

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
  | 'comprar'
  | 'hospedagem'
  | 'meus-pets'
  | 'galeria'
  /** Atalhos FAB — modo veterinário (dock profissional) */
  | 'vet-pacientes'
  | 'vet-receitas'
  | 'vet-gerar'
  | 'vet-panorama'
  /** Atalhos FAB — modo parceiro */
  | 'parceiro-painel'
  | 'parceiro-agenda'
  | 'parceiro-equipe';

const FREQ_KEY = 'ps_dock_action_freq_v1';
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

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
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

  /**
   * Helper para o navmenu: deduz o modo a partir da rota + flag de cliente logado.
   * Rotas /area-vet → 'vet', /parceiros/* → 'parceiro', cliente logado → 'cliente',
   * caso contrário 'guest'.
   */
  resolveModeFromRoute(route: string, isCliente: boolean): DockMode {
    const r = (route || '').split('?')[0] || '';
    if (r.startsWith('/parceiros/') || r === '/parceiros') return 'parceiro';
    if (
      r.includes('/area-vet') ||
      r.startsWith('/gerar-receita') ||
      r.startsWith('/historico-receitas') ||
      r.startsWith('/pacientes') ||
      r.startsWith('/panorama-atendimento')
    )
      return 'vet';
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
  topActions(n: number = 4, defaults: DockActionId[] = ['agendar', 'telemedicina', 'buscar-vet', 'comprar']): DockActionId[] {
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
