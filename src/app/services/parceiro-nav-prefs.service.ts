import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { PsIconName } from '../shared/icons/ps-icon.component';
import { ParceiroAuthService } from './parceiro-auth.service';

export type ParceiroNavCatalogGroup = 'operacao' | 'comercial' | 'gestao' | 'vet';

export interface ParceiroNavCatalogItem {
  id: string;
  label: string;
  shortLabel?: string;
  link: string;
  psIcon: PsIconName;
  faIcon: string;
  group: ParceiroNavCatalogGroup;
}

interface PersistedPrefs {
  dock: string[];
  fab: string[];
}

const STORAGE_PREFIX = 'ps_parceiro_nav_prefs_v1:';

/** Rotas do painel parceiro (`/parceiros/*`) — mesma taxonomia da gaveta mobile/desktop. */
const CATALOG_LIST: ParceiroNavCatalogItem[] = [
  // Operação
  { id: 'painel', label: 'Painel', shortLabel: 'Painel', link: '/parceiros/painel', psIcon: 'home', faIcon: 'fas fa-fw fa-th-large', group: 'operacao' },
  { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', link: '/parceiros/agenda', psIcon: 'calendar', faIcon: 'fas fa-fw fa-calendar', group: 'operacao' },
  { id: 'mensagens', label: 'Mensagens', shortLabel: 'Msgs', link: '/parceiros/mensagens', psIcon: 'sphere', faIcon: 'fas fa-fw fa-comments', group: 'operacao' },
  { id: 'meus-clientes', label: 'Meus clientes', shortLabel: 'Clientes', link: '/parceiros/meus-clientes', psIcon: 'person', faIcon: 'fas fa-fw fa-address-book-o', group: 'operacao' },
  { id: 'servicos', label: 'Serviços', shortLabel: 'Serviços', link: '/parceiros/servicos', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-scissors', group: 'operacao' },
  { id: 'gestao-tutores-aulas', label: 'Turmas & aulas', shortLabel: 'Turmas', link: '/parceiros/gestao-tutores-aulas', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-graduation-cap', group: 'operacao' },
  { id: 'telemedicina-emergencial', label: 'Telemedicina emergencial', shortLabel: 'Telemed', link: '/parceiros/telemedicina-emergencial', psIcon: 'video', faIcon: 'fas fa-fw fa-video-camera', group: 'operacao' },
  { id: 'reservas-hotel', label: 'Hospedagem pet', shortLabel: 'Hotel', link: '/parceiros/reservas-hotel', psIcon: 'bed', faIcon: 'fas fa-fw fa-home', group: 'operacao' },
  { id: 'transporte-pet', label: 'Transporte Pet', shortLabel: 'Transporte', link: '/parceiros/transporte-pet', psIcon: 'map', faIcon: 'fas fa-fw fa-car', group: 'operacao' },
  // Comercial
  { id: 'petshop-online', label: 'Petshop online', shortLabel: 'Petshop', link: '/parceiros/petshop-online', psIcon: 'shop', faIcon: 'fas fa-fw fa-store', group: 'comercial' },
  { id: 'banners', label: 'Banners da loja', shortLabel: 'Banners', link: '/parceiros/banners', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-picture-o', group: 'comercial' },
  { id: 'catalogo-produto', label: 'Cadastro de produto', shortLabel: 'Produto', link: '/parceiros/catalogo-produto', psIcon: 'cart', faIcon: 'fas fa-fw fa-cube', group: 'comercial' },
  { id: 'inventario-pos', label: 'Inventário / POS', shortLabel: 'POS', link: '/parceiros/inventario-pos', psIcon: 'shop', faIcon: 'fas fa-fw fa-barcode', group: 'comercial' },
  { id: 'caixa', label: 'Caixa', shortLabel: 'Caixa', link: '/parceiros/caixa', psIcon: 'cart', faIcon: 'fas fa-fw fa-money', group: 'comercial' },
  // Gestão
  { id: 'colaboradores', label: 'Colaboradores', shortLabel: 'Equipe', link: '/parceiros/colaboradores', psIcon: 'person', faIcon: 'fas fa-fw fa-users', group: 'gestao' },
  { id: 'site-builder', label: 'Site Builder', shortLabel: 'Site', link: '/parceiros/site-builder', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-paint-brush', group: 'gestao' },
  { id: 'blog', label: 'Blog', shortLabel: 'Blog', link: '/parceiros/blog', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-rss', group: 'gestao' },
  { id: 'planos-assinatura', label: 'Plano & créditos', shortLabel: 'Plano', link: '/parceiros/planos-assinatura', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-bolt', group: 'gestao' },
  { id: 'configuracoes', label: 'Configurações', shortLabel: 'Config', link: '/parceiros/configuracoes', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-sliders', group: 'gestao' },
  { id: 'gestao-clinica', label: 'Gestão da clínica', shortLabel: 'Clínica', link: '/parceiros/gestao-clinica', psIcon: 'stethoscope', faIcon: 'fas fa-fw fa-building-o', group: 'gestao' },
  { id: 'financeiro-parceiro', label: 'Pagamentos & repasses', shortLabel: 'Financeiro', link: '/parceiros/financeiro-parceiro', psIcon: 'cart', faIcon: 'fas fa-fw fa-money', group: 'gestao' },
  // Área Vet
  { id: 'vet-cockpit', label: 'Painel Vet', shortLabel: 'Vet', link: '/parceiros/vet-cockpit', psIcon: 'home', faIcon: 'fas fa-fw fa-th-large', group: 'vet' },
  { id: 'atendimento-wizard', label: 'Iniciar atendimento', shortLabel: 'Atender', link: '/parceiros/atendimento-wizard', psIcon: 'stethoscope', faIcon: 'fas fa-fw fa-play-circle', group: 'vet' },
  { id: 'area-vet', label: 'Ativos & Fórmulas', shortLabel: 'Fórmulas', link: '/parceiros/area-vet', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-flask', group: 'vet' },
  { id: 'gerar-receita', label: 'Consulta & receita', shortLabel: 'Receita', link: '/parceiros/gerar-receita', psIcon: 'stethoscope', faIcon: 'fas fa-fw fa-stethoscope', group: 'vet' },
  { id: 'historico-receitas', label: 'Histórico de receitas', shortLabel: 'Histórico', link: '/parceiros/historico-receitas', psIcon: 'sparkle', faIcon: 'fas fa-fw fa-history', group: 'vet' },
  { id: 'pacientes', label: 'Pacientes', shortLabel: 'Pacientes', link: '/parceiros/pacientes', psIcon: 'paw', faIcon: 'fas fa-fw fa-paw', group: 'vet' },
  { id: 'panorama-atendimento', label: 'Panorama do atendimento', shortLabel: 'Panorama', link: '/parceiros/panorama-atendimento', psIcon: 'map', faIcon: 'fas fa-fw fa-map-signs', group: 'vet' },
];

const DEFAULT_DOCK: readonly string[] = ['painel', 'agenda', 'colaboradores'];
const DEFAULT_FAB: readonly string[] = ['painel', 'agenda', 'colaboradores', 'caixa', 'mensagens'];

const VALID_IDS = new Set(CATALOG_LIST.map((c) => c.id));

@Injectable({ providedIn: 'root' })
export class ParceiroNavPrefsService {
  readonly CATALOG: ReadonlyArray<ParceiroNavCatalogItem> = CATALOG_LIST;

  readonly GROUP_ORDER: ParceiroNavCatalogGroup[] = ['operacao', 'comercial', 'gestao', 'vet'];

  readonly GROUP_LABELS: Record<ParceiroNavCatalogGroup, string> = {
    operacao: 'Operação',
    comercial: 'Comercial',
    gestao: 'Gestão',
    vet: 'Área Vet',
  };

  private readonly dockSlotsSubject = new BehaviorSubject<string[]>([...DEFAULT_DOCK]);
  private readonly fabActionsSubject = new BehaviorSubject<string[]>([...DEFAULT_FAB]);

  readonly dockSlots$: Observable<string[]> = this.dockSlotsSubject.asObservable();
  readonly fabActions$: Observable<string[]> = this.fabActionsSubject.asObservable();

  private lastPartnerKey: string | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private parceiroAuth: ParceiroAuthService,
  ) {}

  /** Chamado quando o contexto parceiro pode ter mudado (login / troca de conta). */
  reloadIfPartnerChanged(): void {
    const key = this.resolvePartnerKey();
    if (key === this.lastPartnerKey) return;
    this.lastPartnerKey = key;
    const { dock, fab } = this.readPersisted(key);
    this.dockSlotsSubject.next(dock);
    this.fabActionsSubject.next(fab);
  }

  getById(id: string): ParceiroNavCatalogItem | undefined {
    return CATALOG_LIST.find((c) => c.id === id);
  }

  itemsInGroup(group: ParceiroNavCatalogGroup): ParceiroNavCatalogItem[] {
    return CATALOG_LIST.filter((c) => c.group === group);
  }

  getCurrentDockSlots(): string[] {
    this.ensurePartnerSynced();
    return [...this.dockSlotsSubject.value];
  }

  getCurrentFabActions(): string[] {
    this.ensurePartnerSynced();
    return [...this.fabActionsSubject.value];
  }

  setDockSlots(ids: string[]): void {
    const normalized = this.normalizeDock(ids);
    const key = this.resolvePartnerKey();
    this.persist(key, normalized, this.fabActionsSubject.value);
    this.dockSlotsSubject.next(normalized);
  }

  setFabActions(ids: string[]): void {
    const normalized = this.normalizeFab(ids);
    const key = this.resolvePartnerKey();
    this.persist(key, this.dockSlotsSubject.value, normalized);
    this.fabActionsSubject.next(normalized);
  }

  resetToDefaults(): void {
    const dock = [...DEFAULT_DOCK];
    const fab = [...DEFAULT_FAB];
    const key = this.resolvePartnerKey();
    this.persist(key, dock, fab);
    this.dockSlotsSubject.next(dock);
    this.fabActionsSubject.next(fab);
  }

  private ensurePartnerSynced(): void {
    const key = this.resolvePartnerKey();
    if (key === this.lastPartnerKey) return;
    this.lastPartnerKey = key;
    const { dock, fab } = this.readPersisted(key);
    this.dockSlotsSubject.next(dock);
    this.fabActionsSubject.next(fab);
  }

  private resolvePartnerKey(): string {
    const col = this.parceiroAuth.getCurrentColaborador();
    const pid = col?.parceiroId ?? col?.parceiro_id;
    if (pid != null && pid !== 0) return String(pid);
    return 'default';
  }

  private readPersisted(partnerKey: string): { dock: string[]; fab: string[] } {
    if (!isPlatformBrowser(this.platformId)) {
      return { dock: [...DEFAULT_DOCK], fab: [...DEFAULT_FAB] };
    }
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + partnerKey);
      if (!raw) return { dock: [...DEFAULT_DOCK], fab: [...DEFAULT_FAB] };
      const parsed = JSON.parse(raw) as PersistedPrefs;
      const dock = this.normalizeDock(Array.isArray(parsed?.dock) ? parsed.dock : []);
      const fab = this.normalizeFab(Array.isArray(parsed?.fab) ? parsed.fab : []);
      return { dock, fab };
    } catch {
      return { dock: [...DEFAULT_DOCK], fab: [...DEFAULT_FAB] };
    }
  }

  private persist(partnerKey: string, dock: string[], fab: string[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const payload: PersistedPrefs = { dock, fab };
      localStorage.setItem(STORAGE_PREFIX + partnerKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  private normalizeDock(ids: string[]): string[] {
    const out: string[] = [];
    for (const id of ids) {
      if (VALID_IDS.has(id) && !out.includes(id)) out.push(id);
      if (out.length >= 3) break;
    }
    for (const d of DEFAULT_DOCK) {
      if (out.length >= 3) break;
      if (!out.includes(d)) out.push(d);
    }
    return out.slice(0, 3);
  }

  private normalizeFab(ids: string[]): string[] {
    return ids.filter((id) => VALID_IDS.has(id));
  }
}
