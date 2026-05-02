import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  NgZone,
  ApplicationRef,
  HostBinding,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { firstValueFrom, forkJoin, of, Subject, combineLatest } from 'rxjs';
import { filter, take, takeUntil } from 'rxjs/operators';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SessionService } from '../../services/session.service';
import { ToastService } from '../../services/toast.service';
import {
  LOJA_CEP,
  LOJA_ENDERECO_TEXTO,
  LOJA_MAPA_LAT,
  LOJA_MAPA_LNG,
  MARCA_NOME,
  MARCA_LOGO_PATH,
} from '../../constants/loja-public';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { FP_MAP_STYLES } from './mapa-map-styles';
import { MapLocationConsentService } from '../../services/map-location-consent.service';
import { TenantLojaHospedagemLeitoPublic, TenantLojaService } from '../../services/tenant-loja.service';
import { PartnerChatLauncherService } from '../../features/partner-chat/partner-chat-launcher.service';
import { environment } from '../../../environments/environment';
import { RealtimeService } from '../../services/realtime.service';

const FP_MAPA_LS_PREFIX = 'fp_mapa_';
const DEFAULT_SEARCH_RADIUS_KM = 15;

  // `allPartners` holds the raw/full list from backend; `partners` is the filtered/visible list
@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BannerSlotComponent],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.scss']
})
export class MapaComponent implements OnInit, OnDestroy {
  // start with no tab selected; user must pick a service type to load partners
  // `allPartners` holds the raw/full list from backend; `partners` is the filtered/visible list
  allPartners: Array<any> = [];
  partners: Array<any> = [];
  // tabs populated from backend (/tipos-profissionais)
  tabs: Array<{ id: string; label: string; typeId?: number; icon?: string }> = [];
  // currently selected tab id (string slug) — default to 'todos' so initial load requests all types
  active: string = 'todos';
  mapsApiKey: string | null = null;
  loading = false;
  error: string | null = null;
  // google maps runtime objects
  private map: any = null;
  private markers: any[] = [];
  private partnerClusterer: MarkerClusterer | null = null;
  private pharmacyPulseCircle: any = null;
  private pharmacyPulseRaf = 0;
  private infoWindow: any = null;
  // currently opened info window instance (so different markers don't overwrite behavior)
  private currentInfoWindow: any = null;
  private directionsService: any = null;
  private directionsRenderer: any = null;
  private originMarker: any = null;
  /** Marcador da posição atual do usuário (geolocalização) */
  private userLocationMarker: any = null;
  private mapInitialized = false;
  private mapReadyPromise: Promise<void> | null = null;
  private mapReadyResolver: (() => void) | null = null;
  marcaNome = MARCA_NOME;
  readonly marcaNomeMapa = MARCA_NOME;
  /** Pill da camada principal: texto claro para tutores vs vitrine tenant. */
  get mapLegendReferenceLabel(): string {
    return this.tenantLoja.isTenantLoja() ? `${this.marcaNome} · sua vitrine` : 'Petsphere · rede nacional';
  }
  lojaEnderecoExibicao = `${LOJA_ENDERECO_TEXTO}, CEP ${LOJA_CEP}`;
  /** Cidade e UF para o hero (default = loja demo; tenant sobrescreve em applyStoreAddressFromParts). */
  mapHeroCidadeEstado = 'Curitiba - PR';
  readonly defaultPartnerLogoPath = MARCA_LOGO_PATH || '/imagens/logo-marca.svg';
  private defaultCenterAddress = `${LOJA_ENDERECO_TEXTO}, Curitiba, PR, CEP ${LOJA_CEP}`;
  private pharmacyAddress = `${LOJA_ENDERECO_TEXTO}, Curitiba, PR`;
  private pharmacyCoords: { lat: number; lng: number } | null = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
  private readonly pinLojaUrl = '/icones/pin-pata.svg';

  /** Full map + overlays (matches CSS breakpoint max-width 860px) */
  isMobileMapLayout = false;
  /** Painel inferior (mobile): acordeão de resultados — inicia fechado */
  resultsAccordionOpen = false;
  /** Aviso LGPD: pedir consentimento para geolocalização (antes de gravação em cookies). */
  mapLocationOptInVisible = false;
  /** Usuário recusou: mostrar atalho para reabrir a escolha. */
  mapLocationReopenBar = false;
  @HostBinding('class.host--mobile-map') get hostMobileMap() {
    return this.isMobileMapLayout;
  }

  mapSearchUiOpen = false;
  mapTextQuery = '';
  @ViewChild('mapSearchInput') mapSearchInput?: ElementRef<HTMLInputElement>;
  mobileServiceMenuOpen = false;

  /** PetSphere = ecossistema completo; Parceiros = foco na loja atual (subdomínio), quando houver tenant. */
  mapSphereView: 'petsphere' | 'parceiros' = 'petsphere';

  partnersForMap: any[] = [];
  visibleCategoryIds: { [tabId: string]: boolean } = {};
  mapCategoryPillsVisible = true;
  mapShowPharmacy = false;
  mapConfigOpen = false;
  searchRadiusKm = DEFAULT_SEARCH_RADIUS_KM;
  priceFilterMin: number | null = null;
  priceFilterMax: number | null = null;
  priceFilterEnabled = false;
  quickSearchIndex = 0;
  quickSearchOrdered: any[] = [];

  /** Transporte Pet — painel manual no mapa; URL `?service=transporte` com `:slug` abre o painel automaticamente. */
  transportePetAtivo = false;
  /** Painel inferior / modal com origem, destino, cotação (esconde chips de categoria). */
  transportePetPainelAberto = false;
  /** Data/hora local (input datetime-local) quando urgência = agendado. */
  transportePetScheduledAtLocal = '';
  transportePetPorte: 'pequeno' | 'medio' | 'grande' ='medio';
  transportePetUrgencia: 'agora' | 'agendado' = 'agora';
  transportePetOrigemLat: number | null = null;
  transportePetOrigemLng: number | null = null;
  transportePetDestLat: number | null = null;
  transportePetDestLng: number | null = null;
  transportePetQuote: {
    preco_centavos?: number;
    distancia_km?: number;
    pickup_eta_min?: number | null;
    online_driver_count?: number;
    nearest_driver_distance_km?: number | null;
  } | null = null;
  transportePetBusy = false;
  transportePetLocLoading = false;
  transportePetLastCorridaId: number | null = null;
  transportePetLastParceiroId: number | null = null;
  /** Mapa nacional: loja escolhida para cotação/pagamento (rota ou tenant têm prioridade). */
  transportePetLojaSlugEscolhida: string | null = null;
  /** Fluxo: escolher loja antes do painel de cotação. */
  transportePetSelecaoLojaAberta = false;
  /** Passo no sheet nacional: intenção (Agora / Com clínica) ou lista de lojas. */
  transportePetFluxoEtapa: 'intencao' | 'lista_lojas' | null = null;
  /** Modo de negócio ativo para APIs (intenção validada no backend). */
  transportePetOperacaoAtual: 'marketplace' | 'estabelecimento' | null = null;
  /** Pets do tutor (para solicitar transporte com pet_id). */
  transportePetPets: Array<{ id: number; nome: string; apelido?: string; photoURL?: string; porte?: string }> = [];
  transportePetSelectedPetId: number | null = null;
  /** Destino em texto livre (rua, número, bairro). */
  transporteDestinoTexto = '';
  transporteOrigemTexto = '';

  get transporteLojaSlugEfetivo(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const paramSlug = String(this.route.snapshot.paramMap.get('slug') || '').trim().toLowerCase();
    if (paramSlug) return paramSlug;
    const p = this.tenantLoja.profile();
    const ls = p?.loja_slug != null ? String(p.loja_slug).trim().toLowerCase() : '';
    return ls || null;
  }

  /** Slug usado nas APIs de transporte: URL/tenant ou escolha manual no mapa rede. */
  get transporteLojaSlugParaCorrida(): string | null {
    const base = this.transporteLojaSlugEfetivo;
    if (base) return base;
    const s = this.transportePetLojaSlugEscolhida;
    return s ? String(s).trim().toLowerCase() : null;
  }

  /** Botão visível no mapa rede e vitrine — antes só aparecia com slug na URL. */
  get transportePetMostrarBotao(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  /** Slug do operador marketplace (configurado no environment + backend). */
  get transporteMarketplaceSlug(): string | null {
    const s = String((environment as { transporteMarketplaceLojaSlug?: string }).transporteMarketplaceLojaSlug || '')
      .trim()
      .toLowerCase();
    return s || null;
  }

  /** Lojas com slug de vitrine carregadas no mapa (para pedir corrida sem URL da loja). */
  get parceirosParaTransportePet(): Array<{ nome: string; slug: string; lat?: number; lng?: number }> {
    const src = this.allPartners?.length ? this.allPartners : this.partners;
    const seen = new Set<string>();
    const out: Array<{ nome: string; slug: string; lat?: number; lng?: number }> = [];
    const opSlug = this.transporteMarketplaceSlug;
    for (const p of src || []) {
      const slug = this.getPartnerStoreSlug(p);
      if (!slug || seen.has(slug)) continue;
      if (opSlug && slug === opSlug) continue;
      seen.add(slug);
      const lat = Number(p.latitude ?? p.lat ?? p._raw?.latitude);
      const lng = Number(p.longitude ?? p.lng ?? p._raw?.longitude);
      const nome = String(p.nome_fantasia ?? p.nome ?? p.nome_parceiro ?? slug).trim() || slug;
      const row: { nome: string; slug: string; lat?: number; lng?: number } = { nome, slug };
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        row.lat = lat;
        row.lng = lng;
      }
      out.push(row);
    }
    out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return out;
  }

  toggleResultsAccordion(): void {
    this.resultsAccordionOpen = !this.resultsAccordionOpen;
    this.scheduleMapResize();
  }

  tenantHospedagemVisible(): boolean {
    const h = this.tenantLoja.hospedagemPublic();
    if (!h) return false;
    return (h.leitos?.length ?? 0) > 0 || (h.hotel_servicos_globais?.length ?? 0) > 0;
  }

  resolveHospedagemFoto(url: string | null | undefined): string {
    return this.api.resolveMediaUrl(url || '', '/imagens/image.png');
  }

  /** Primeira URL http(s) na galeria; senão `foto_url`. */
  tenantHospLeadRawUrl(leito: TenantLojaHospedagemLeitoPublic): string | null {
    const gal = leito.galeria_urls;
    if (Array.isArray(gal)) {
      const hit = gal.find((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()));
      if (hit) return hit.trim();
    }
    const f = leito.foto_url;
    return typeof f === 'string' && f.trim() ? f.trim() : null;
  }

  tenantHospLeadPhoto(leito: TenantLojaHospedagemLeitoPublic): string {
    const raw = this.tenantHospLeadRawUrl(leito);
    return this.resolveHospedagemFoto(raw || '');
  }

  tenantHospVitrineBadge(leito: TenantLojaHospedagemLeitoPublic): string | null {
    const v = String(leito.vitrine_nivel || 'basico').toLowerCase();
    if (v === 'destaque') return 'Destaque';
    if (v === 'top') return 'Top';
    return null;
  }

  tenantHospGaleriaStripUrls(leito: TenantLojaHospedagemLeitoPublic): string[] {
    const gal = Array.isArray(leito.galeria_urls) ? leito.galeria_urls : [];
    const thumbs = gal
      .filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()))
      .map((u) => u.trim())
      .slice(0, 12);
    const lead = this.tenantHospLeadRawUrl(leito);
    const extra = lead ? thumbs.filter((u) => u !== lead) : thumbs;
    return extra.slice(0, 8);
  }

  tenantHospConfortoLabel(lc: string | null | undefined): string | null {
    const k = String(lc || '').trim().toLowerCase();
    const map: Record<string, string> = {
      basico: 'Básico',
      conforto: 'Conforto',
      premium: 'Premium',
      luxo: 'Luxo',
    };
    return map[k] || (k ? String(lc).trim() : null);
  }

  tenantHospAmbienteLabel(a: string | null | undefined): string | null {
    const k = String(a || '').trim().toLowerCase();
    const map: Record<string, string> = { interno: 'Interno', externo: 'Externo', misto: 'Misto' };
    return map[k] || (k ? String(a).trim() : null);
  }

  private mobileLayoutMql: MediaQueryList | null = null;
  private mobileLayoutListener: (() => void) | null = null;
  private requestedPartnerSlug: string | null = null;
  private requestedPartnerId: number | null = null;
  private readonly destroyRoute$ = new Subject<void>();

  private readonly partnerQuickServiceCatalog: Record<string, {
    label: string;
    query: string;
    matchers: RegExp[];
  }> = {
    clinica: {
      label: 'Clínica veterinária',
      query: 'clinica',
      matchers: [/clinica|cl[ií]nica|veterin|vet/i],
    },
    creche: {
      label: 'Creche / Day care',
      query: 'daycare',
      matchers: [/creche|day\s*care|daycare/i],
    },
    dogwalker: {
      label: 'Dog walker',
      query: 'dogwalker',
      matchers: [/dog\s*walker|passea|walker/i],
    },
    hotel: {
      label: 'Hotel para pets',
      query: 'hospedagem',
      matchers: [/hotel|hosped|hospedagem/i],
    },
    petshop: {
      label: 'Petshop',
      query: 'petshop',
      matchers: [/pet\s*shop|petshop|loja/i],
    },
    transporte: {
      label: 'Transporte pet',
      query: 'transporte',
      matchers: [/transporte|corrida|motorista/i],
    },
  };

  constructor(
    private api: ApiService,
    private toast: ToastService,
    private mapLocationConsent: MapLocationConsentService,
    readonly tenantLoja: TenantLojaService,
    private route: ActivatedRoute,
    private router: Router,
    private session: SessionService,
    private partnerChatLauncher: PartnerChatLauncherService,
    private realtime: RealtimeService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private appRef: ApplicationRef,
    private zone: NgZone
  ) {}

  // keep references so we can remove listeners on destroy
  private __errHandler = (ev: any) => { console.error('map uncaught error', ev); try { this.showFallbackMap(); } catch (e) {}; };
  private __unhandledRejection = (ev: any) => { console.error('map unhandledrejection', ev); try { this.showFallbackMap(); } catch (e) {}; };

  // filters per service (each tab has its own set)
  filtersByTab: { [key: string]: Array<{ id: string; label: string; on: boolean }> } = {};

  
  toggleFilter(f: any){
    f.on = !f.on;
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }
    this.scheduleMapResize();
  }

  /** Lista lateral: mensagem rápida (abre fluxo cliente / login). */
  onResultPartnerChat(p: any, ev: Event): void {
    ev.stopPropagation();
    ev.preventDefault();
    this.goToPartnerChatFromMap(p);
  }

  /** URL da vitrine do parceiro (subdomínio), se existir slug. */
  partnerStoreHref(p: any): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return this.buildPartnerStoreUrl(this.getPartnerStoreSlug(p));
  }

  /** Lista vazia: voltar a ver todos os pontos disponíveis. */
  explorarLimparFiltrosMapa(ev?: Event): void {
    ev?.stopPropagation();
    ev?.preventDefault();
    this.mapTextQuery = '';
    if (this.mapSearchUiOpen) this.closeMapSearchUi();
    const todosId = this.tabs.find(x => x.id === 'todos')?.id;
    this.select(todosId ?? this.tabs[0]?.id ?? 'todos');
    for (const list of Object.values(this.filtersByTab)) {
      for (const chip of list) chip.on = false;
    }
    try {
      this.applyFilters();
    } catch {
      /* ignore */
    }
    if (this.isMobileMapLayout) this.resultsAccordionOpen = true;
    this.toast.info('Mostrando todas as categorias — filtros de texto e chips foram limpos.');
  }

  openMapSearchUi(): void {
    this.mapSearchUiOpen = true;
    this.mobileServiceMenuOpen = false;
    this.resultsAccordionOpen = false;
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        this.zone.run(() => {
          try { this.mapSearchInput?.nativeElement?.focus(); } catch (e) { /* ignore */ }
        });
      }, 0);
    });
  }

  closeMapSearchUi(): void {
    this.mapSearchUiOpen = false;
    this.mapTextQuery = '';
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters on close search failed', e); }
  }

  toggleMobileServiceMenu(): void {
    this.mobileServiceMenuOpen = !this.mobileServiceMenuOpen;
    if (this.mobileServiceMenuOpen) {
      this.mapConfigOpen = false;
      this.mapSearchUiOpen = false;
    }
  }

  closeMobileServiceMenu(): void {
    this.mobileServiceMenuOpen = false;
  }

  mobileServiceTabs(): Array<{ id: string; label: string; typeId?: number; icon?: string }> {
    return this.tabs || [];
  }

  onMobileServiceSelect(tabId: string): void {
    this.select(tabId);
    this.mobileServiceMenuOpen = false;
    this.resultsAccordionOpen = true;
  }

  onMapTextInput(ev: Event): void {
    this.mapTextQuery = (ev.target as HTMLInputElement)?.value ?? '';
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }
  }

  get quickSearchCountLabel(): string {
    const n = this.quickSearchOrdered.length;
    if (n < 1) return '';
    return `${this.quickSearchIndex + 1} / ${n}`;
  }

  onQuickSearchChipClick(): void {
    if (!this.quickSearchOrdered.length) {
      this.toast.info('Nenhum parceiro com os filtros atuais. Ajuste a categoria ou o texto.');
      return;
    }
    const p = this.quickSearchOrdered[this.quickSearchIndex];
    if (p) this.centerOnPartner(p);
    this.quickSearchIndex = (this.quickSearchIndex + 1) % this.quickSearchOrdered.length;
  }

  toggleMapCategory(tabId: string): void {
    this.visibleCategoryIds[tabId] = !this.visibleCategoryIds[tabId];
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }
  }

  allMapCategoriesVisible(): boolean {
    const nonTodos = this.tabs.filter((t) => t.id !== 'todos');
    if (!nonTodos.length) return false;
    return nonTodos.every((t) => !!this.visibleCategoryIds[t.id]);
  }

  toggleMapCategoriesVisibility(): void {
    const nonTodos = this.tabs.filter((t) => t.id !== 'todos');
    if (!nonTodos.length) return;
    const shouldShowAll = !this.allMapCategoriesVisible();
    for (const t of nonTodos) {
      this.visibleCategoryIds[t.id] = shouldShowAll;
    }
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }
  }

  toggleMapCategoryPillsVisibility(): void {
    this.mapCategoryPillsVisible = !this.mapCategoryPillsVisible;
  }

  isCategoryMapVisible(tabId: string): boolean {
    return !!this.visibleCategoryIds[tabId];
  }

  mapTabsForPills(): Array<{ id: string; label: string; typeId?: number; icon?: string }> {
    return (this.tabs || []).filter(t => t.id !== 'todos');
  }

  toggleMapConfig(): void {
    this.mobileServiceMenuOpen = false;
    this.mapConfigOpen = !this.mapConfigOpen;
  }

  toggleMapShowPharmacy(): void {
    this.mapShowPharmacy = !this.mapShowPharmacy;
    try { this.refreshMarkers(); } catch (e) { console.warn('refreshMarkers failed', e); }
  }

  setMapSphereView(mode: 'petsphere' | 'parceiros'): void {
    if (this.mapSphereView === mode) return;
    this.mapSphereView = mode;
    try { this.applyFilters(); } catch (e) { console.warn('applyFilters failed', e); }
    if (mode === 'parceiros') {
      this.maybeCenterTenantFoco();
    }
  }

  private maybeCenterTenantFoco(): void {
    const tid = this.tenantLoja.parceiroId();
    if (tid == null) return;
    const p = this.allPartners.find((x) => Number(x.id) === tid);
    if (p) void this.centerOnPartner(p, { scrollPage: false });
  }

  onMapSettingsRadiusInput(ev: Event): void {
    const n = Number((ev.target as HTMLInputElement).value);
    if (!isNaN(n) && n >= 1) {
      this.searchRadiusKm = n;
      this.saveMapLocalSettings();
      try { this.rebuildQuickSearchList(); } catch (e) { /* ignore */ }
    }
  }

  onPriceMinInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.priceFilterMin = v === '' ? null : Number(v);
    this.saveMapLocalSettings();
    try { this.applyFilters(); } catch (e) { /* ignore */ }
  }

  onPriceMaxInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.priceFilterMax = v === '' ? null : Number(v);
    this.saveMapLocalSettings();
    try { this.applyFilters(); } catch (e) { /* ignore */ }
  }

  onPriceFilterEnabledChange(ev: Event): void {
    this.priceFilterEnabled = (ev.target as HTMLInputElement).checked;
    if (!this.priceFilterEnabled) {
      this.priceFilterMin = null;
      this.priceFilterMax = null;
    }
    this.saveMapLocalSettings();
    try { this.applyFilters(); } catch (e) { /* ignore */ }
  }

  get lodgingPriceAvailable(): boolean {
    for (const p of this.allPartners || []) {
      if (this.getPartnerLodgingPrice(p) != null) return true;
    }
    return false;
  }

  trackTabId(_: number, t: { id: string }): string {
    return t.id;
  }

  private initVisibleCategoryToggles(): void {
    for (const t of this.tabs) {
      if (this.visibleCategoryIds[t.id] === undefined) {
        this.visibleCategoryIds[t.id] = true;
      }
    }
  }

  private loadMapLocalSettings(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      const r = localStorage.getItem(`${FP_MAPA_LS_PREFIX}raio_km`);
      if (r != null) {
        const n = Number(r);
        if (!isNaN(n) && n >= 1 && n <= 500) this.searchRadiusKm = n;
      }
      const pmin = localStorage.getItem(`${FP_MAPA_LS_PREFIX}preco_min`);
      const pmax = localStorage.getItem(`${FP_MAPA_LS_PREFIX}preco_max`);
      this.priceFilterMin = pmin != null && pmin !== '' ? Number(pmin) : null;
      this.priceFilterMax = pmax != null && pmax !== '' ? Number(pmax) : null;
      this.priceFilterEnabled = this.priceFilterMin != null || this.priceFilterMax != null;
    } catch (e) { /* ignore */ }
  }

  private saveMapLocalSettings(): void {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(`${FP_MAPA_LS_PREFIX}raio_km`, String(this.searchRadiusKm));
      if (this.priceFilterMin != null) localStorage.setItem(`${FP_MAPA_LS_PREFIX}preco_min`, String(this.priceFilterMin));
      else localStorage.removeItem(`${FP_MAPA_LS_PREFIX}preco_min`);
      if (this.priceFilterMax != null) localStorage.setItem(`${FP_MAPA_LS_PREFIX}preco_max`, String(this.priceFilterMax));
      else localStorage.removeItem(`${FP_MAPA_LS_PREFIX}preco_max`);
    } catch (e) { /* ignore */ }
  }

  private distanceKm(
    a: { lat: number; lng: number },
    p: { latitude?: number; longitude?: number; lat?: any; lng?: any }
  ): number {
    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = (Number(p.latitude ?? p.lat) || 0) * (Math.PI / 180);
    const dLat = lat2 - lat1;
    const dLng = (Number(p.longitude ?? p.lng) - a.lng) * (Math.PI / 180);
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return 6371 * c;
  }

  private getQuickSearchReferencePoint(): { lat: number; lng: number } {
    const last = this.mapLocationConsent.getLastPosition();
    if (last && this.mapLocationConsent.getConsent() === true) {
      return { lat: last.lat, lng: last.lng };
    }
    return this.pharmacyCoords ?? { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
  }

  getPartnerLodgingPrice(p: any): number | null {
    try {
      const r = p?._raw;
      for (const k of ['preco_diaria', 'diaria_valor', 'valor_diaria', 'preco', 'hospedagem_preco'] as const) {
        if (r?.[k] != null) {
          const n = Number(r[k]);
          if (!isNaN(n)) return n;
        }
      }
      const sel = p?.filtros_selecionados || {};
      for (const key of Object.keys(sel)) {
        if (!/diaria|hosped|preço|preco|valor/i.test(key)) continue;
        const v = (sel as any)[key];
        if (typeof v === 'number' && !isNaN(v)) return v;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  private partnerMatchesTextQuery(p: any): boolean {
    const q = (this.mapTextQuery || '').trim().toLowerCase();
    if (!q) return true;
    const name = String(p.nome || p.titulo || p.name || '').toLowerCase();
    const loc = (this.getPartnerLocation(p) || '').toLowerCase();
    const end = String(p.endereco || p._raw?.endereco || '').toLowerCase();
    return name.includes(q) || loc.includes(q) || end.includes(q);
  }

  private partnerMatchesActiveTab(p: any): boolean {
    if (this.active === 'todos') return true;
    return this.partnerMatchesTabId(p, this.active);
  }

  private partnerMatchesTabId(p: any, tabId: string): boolean {
    if (tabId === 'todos') return true;
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return false;
    const wantId = tab.typeId;
    const cands: any[] = [];
    if (p?.tipo) cands.push(p.tipo);
    if (Array.isArray(p?.tipos)) cands.push(...p.tipos);
    for (const t of cands) {
      if (!t) continue;
      if (wantId != null) {
        const id = t.id ?? t.tipo_id ?? t.tipoId;
        if (id != null && Number(id) === Number(wantId)) return true;
      }
      if (t.slug && String(t.slug) === String(tabId)) return true;
    }
    if (typeof p?.tipo === 'string' && p.tipo && String(p.tipo).toLowerCase() === String(tabId).toLowerCase()) {
      return true;
    }
    return false;
  }

  /** Parceiro com tipo definido (id/slug/nome/icone em tipo ou em tipos[]). */
  private partnerHasAnyTipo(p: any): boolean {
    try {
      const t = p?.tipo;
      if (
        t &&
        typeof t === 'object' &&
        (t.id != null ||
          (t.slug && String(t.slug).trim()) ||
          (t.nome && String(t.nome).trim()) ||
          (t.icone && String(t.icone).trim()))
      ) {
        return true;
      }
      if (typeof t === 'string' && String(t).trim()) return true;
      if (Array.isArray(p?.tipos)) {
        return p.tipos.some(
          (x: any) =>
            x &&
            (x.id != null ||
              (x.slug && String(x.slug).trim()) ||
              (x.nome && String(x.nome).trim()) ||
              (x.icone && String(x.icone).trim()))
        );
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  /**
   * Camadas do mapa (pills): parceiro visível se casa com alguma categoria ligada.
   * Sem tipo: só no mapa quando todas as categorias estão ligadas (equivale a “Todos” com pills padrão).
   */
  private partnerVisibleForMapCategories(p: any): boolean {
    const nonTodos = this.tabs.filter((t) => t.id !== 'todos');
    if (!nonTodos.length) return true;
    const visibleTabs = nonTodos.filter((t) => this.visibleCategoryIds[t.id]);
    if (!visibleTabs.length) return false;
    for (const t of visibleTabs) {
      if (this.partnerMatchesTabId(p, t.id)) return true;
    }
    if (!this.partnerHasAnyTipo(p)) {
      return nonTodos.every((t) => this.visibleCategoryIds[t.id]);
    }
    return false;
  }

  private matchesAttributeFilters(p: any): boolean {
    const key = this.active || '';
    const filters = this.filtersByTab[key] || [];
    const activeFilterKeys = filters.filter(f => !!f.on).map(f => String(f.id));
    if (!activeFilterKeys.length) return true;
    try {
      const sel = p.filtros_selecionados || {};
      return activeFilterKeys.every(k => !!sel[k]);
    } catch (e) {
      return false;
    }
  }

  private matchesAttributeFiltersMapContext(p: any): boolean {
    if (!this.partnerMatchesActiveTab(p)) return true;
    return this.matchesAttributeFilters(p);
  }

  private matchesPriceIfConfigured(p: any): boolean {
    if (!this.priceFilterEnabled) return true;
    const price = this.getPartnerLodgingPrice(p);
    if (price == null || isNaN(price)) return true;
    if (this.priceFilterMin != null && !isNaN(this.priceFilterMin) && price < this.priceFilterMin) return false;
    if (this.priceFilterMax != null && !isNaN(this.priceFilterMax) && price > this.priceFilterMax) return false;
    return true;
  }

  private matchesForSidebarList(p: any): boolean {
    if (!this.partnerMatchesActiveTab(p)) return false;
    if (!this.matchesAttributeFilters(p)) return false;
    if (!this.partnerMatchesTextQuery(p)) return false;
    if (!this.matchesPriceIfConfigured(p)) return false;
    return true;
  }

  private matchesForMapView(p: any): boolean {
    if (!this.partnerVisibleForMapCategories(p)) return false;
    if (!this.matchesAttributeFiltersMapContext(p)) return false;
    if (!this.partnerMatchesTextQuery(p)) return false;
    if (!this.matchesPriceIfConfigured(p)) return false;
    return true;
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  private tabLooksLikeService(tab: { id?: string; label?: string }, matchers: RegExp[]): boolean {
    const src = `${this.normalizeText(tab.id)} ${this.normalizeText(tab.label)}`;
    return matchers.some((rx) => rx.test(src));
  }

  private detectPartnerServiceIds(partner: any): string[] {
    const srcParts: string[] = [];
    const tipo = partner?.tipo;
    const tipos = Array.isArray(partner?.tipos) ? partner.tipos : [];
    const filtros = partner?.filtros_selecionados && typeof partner.filtros_selecionados === 'object'
      ? Object.keys(partner.filtros_selecionados)
      : [];

    srcParts.push(
      partner?.titulo,
      partner?.nome,
      partner?.descricao,
      tipo?.slug,
      tipo?.nome,
      partner?._raw?.partner_type,
      ...tipos.map((t: any) => t?.slug),
      ...tipos.map((t: any) => t?.nome),
      ...filtros
    );

    const blob = this.normalizeText(srcParts.filter(Boolean).join(' '));
    const found: string[] = [];
    for (const [id, cfg] of Object.entries(this.partnerQuickServiceCatalog)) {
      if (cfg.matchers.some((rx) => rx.test(blob))) found.push(id);
    }

    if (found.length) return found.slice(0, 5);

    const fallback = ['clinica', 'dogwalker', 'petshop', 'hotel', 'creche'];
    return fallback.slice(0, 4);
  }

  private resolveTabByQuickService(serviceId: string): string | null {
    const cfg = this.partnerQuickServiceCatalog[serviceId];
    if (!cfg) return null;
    const hit = this.tabs.find((t) => t.id !== 'todos' && this.tabLooksLikeService(t, cfg.matchers));
    return hit?.id ?? null;
  }

  private applyPartnerQuickService(partner: any, serviceId: string): void {
    const cfg = this.partnerQuickServiceCatalog[serviceId];
    if (!cfg) return;

    const tabId = this.resolveTabByQuickService(serviceId);
    if (tabId) {
      this.select(tabId);
    } else {
      this.select('todos');
    }

    this.resultsAccordionOpen = true;
    void this.centerOnPartner(partner, { scrollPage: false });

    const parceiroId = Number(partner?.id ?? partner?._raw?.id ?? 0);
    const queryParams: Record<string, string | number | null> = { service: cfg.query };
    if (Number.isFinite(parceiroId) && parceiroId > 0) {
      queryParams['parceiro'] = parceiroId;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private buildPartnerGeocodeAddress(p: any): string {
    const endereco = String(p?.endereco ?? p?._raw?.endereco ?? '').trim();
    const cidade = String(p?.cidade ?? p?._raw?.cidade ?? '').trim();
    const estado = String(p?.estado ?? p?._raw?.estado ?? '').trim();
    const cep = String(p?.cep ?? p?._raw?.cep ?? '').trim();
    return [endereco, cidade, estado, cep, 'Brasil'].filter(Boolean).join(', ');
  }

  private buildPartnerMergeKey(p: any): string {
    const type = String(p?.partner_type ?? p?._raw?.partner_type ?? 'anunciante').toLowerCase();
    const id = p?.id ?? p?.anuncio_id ?? p?._raw?.id ?? '';
    const email = String(p?.email ?? p?._raw?.email ?? '').trim().toLowerCase();
    if (id !== '' && id != null) return `${type}:${id}`;
    if (email) return `${type}:email:${email}`;
    return `${type}:rand:${Math.random().toString(36).slice(2)}`;
  }

  private async backfillPartnersCoordinates(partners: any[]): Promise<void> {
    const missing = (partners || []).filter((p) => {
      const lat = Number(p?.latitude ?? p?.lat);
      const lng = Number(p?.longitude ?? p?.lng);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      if (hasCoords) return false;
      const address = this.buildPartnerGeocodeAddress(p);
      return !!address;
    });

    for (const p of missing) {
      const address = this.buildPartnerGeocodeAddress(p);
      if (!address) continue;
      try {
        const geo = await firstValueFrom(this.api.geocodeAddress(address));
        const first = Array.isArray(geo) ? geo[0] : null;
        const lat = first?.lat != null ? Number(first.lat) : NaN;
        const lng = first?.lon != null ? Number(first.lon) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          p.latitude = lat;
          p.longitude = lng;
          if (p._raw && typeof p._raw === 'object') {
            p._raw.latitude = lat;
            p._raw.longitude = lng;
          }
        }
      } catch (e) {
        // ignore geocode failures for individual partners and continue
      }
    }
  }

  private rebuildQuickSearchList(): void {
    const ref = this.getQuickSearchReferencePoint();
    const base = (this.allPartners || []).filter(p => this.matchesForSidebarList(p));
    const withD = base
      .map(p => ({ p, d: this.distanceKm(ref, p) }))
      .filter(x => {
        if (x.p.latitude == null && x.p.longitude == null) return false;
        return x.d <= this.searchRadiusKm;
      })
      .sort((a, b) => a.d - b.d);
    this.quickSearchOrdered = withD.map(x => x.p);
    if (this.quickSearchIndex >= this.quickSearchOrdered.length) {
      this.quickSearchIndex = 0;
    }
  }

  private applyFilters(){
    let base = this.allPartners || [];
    if (this.mapSphereView === 'parceiros') {
      const tid = this.tenantLoja.parceiroId();
      if (tid != null) {
        base = base.filter((p) => Number(p.id) === tid);
      }
    }
    this.partners = base.filter(p => this.matchesForSidebarList(p));
    this.partnersForMap = base.filter(p => this.matchesForMapView(p));
    try { this.rebuildQuickSearchList(); } catch (e) { console.warn('rebuildQuickSearchList failed', e); }
    try { this.refreshMarkers(); } catch (e) { console.warn('refreshMarkers failed in applyFilters', e); }
  }
  getActiveLabel(){
    const t = this.tabs.find(x => x.id === this.active);
    return t ? t.label : '';
  }

  getFiltersForActive(){
    return this.filtersByTab[this.active] || [];
  }

  /**
   * Retorna o caminho de um ícone amigável para a aba, baseando-se no slug/label.
   * Sem efeito sobre a lógica dos markers — usado apenas no template para decorar abas.
   */
  getTabIcon(tab: { id?: string; label?: string; icon?: string }): string {
    try {
      const ic = tab?.icon != null ? String(tab.icon).trim() : '';
      if (ic && /\.(png|svg|webp)$/i.test(ic)) {
        const base = ic.split(/[/\\]/).pop()!.toLowerCase().replace(/[^a-z0-9._-]/g, '');
        if (base) return `/icones/${base}`;
      }
      const raw = String(tab?.icon ?? tab?.id ?? tab?.label ?? '').toLowerCase();
      const key = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      if (!key) return '/icones/paw.png';
      if (key === 'todos' || key === 'all') return '/icones/paw.png';
      if (/vet|clinic/.test(key)) return '/icones/clinic-icon.png';
      if (/walker|passeio|passeador/.test(key)) return '/icones/walker-icon.png';
      if (/petshop|pet-shop|loja|shop/.test(key)) return '/icones/loja.png';
      if (/banho|tosa|groom/.test(key)) return '/icones/shop-icon.png';
      if (/creche|hotel|daycare/.test(key)) return '/icones/galeria-pet.png';
      if (/sitter|pet-sitter|petsitter/.test(key)) return '/icones/paw.png';
      return '/icones/paw.png';
    } catch (e) {
      return '/icones/paw.png';
    }
  }

  /**
   * Label amigável para o tipo do parceiro (exibido como badge no card de resultado).
   */
  getPartnerTypeLabel(p: any): string {
    try {
      const t = p?.tipo;
      if (!t) {
        const firstTipo = Array.isArray(p?.tipos) ? p.tipos[0] : null;
        if (firstTipo) return String(firstTipo.nome ?? firstTipo.label ?? firstTipo.slug ?? '').trim();
        return '';
      }
      if (typeof t === 'string') return t;
      return String(t.nome ?? t.label ?? t.slug ?? '').trim();
    } catch (e) {
      return '';
    }
  }

  /**
   * Retorna { src, isIcon } para o avatar do card de resultado.
   * Prefere a logo do parceiro; caso contrário usa o ícone do tipo como fallback.
   */
  getPartnerAvatar(p: any): { src: string; isIcon: boolean } {
    try {
      const logo = p?.logo_url ?? p?._raw?.logo_url ?? null;
      if (logo && typeof logo === 'string') return { src: logo, isIcon: false };
      const tipoSlug = p?.tipo?.slug ?? (Array.isArray(p?.tipos) && p.tipos[0]?.slug) ?? p?.tipo?.nome ?? '';
      const iconSrc = this.getTabIcon({ id: tipoSlug, label: this.getPartnerTypeLabel(p) });
      return { src: iconSrc, isIcon: true };
    } catch (e) {
      return { src: '/icones/paw.png', isIcon: true };
    }
  }

  /**
   * Cidade/estado resumidos para exibir no card de resultado.
   */
  getPartnerLocation(p: any): string {
    try {
      const cidade = p?.cidade ?? p?._raw?.cidade ?? '';
      const estado = p?.estado ?? p?._raw?.estado ?? '';
      if (cidade && estado) return `${cidade} - ${estado}`;
      return String(cidade || estado || p?.endereco || '').trim();
    } catch (e) {
      return '';
    }
  }

  private buildAddressPartsAddress(parts: { endereco?: any; cidade?: any; estado?: any; cep?: any }): string {
    const endereco = String(parts.endereco ?? '').trim();
    const cidade = String(parts.cidade ?? '').trim();
    const estado = String(parts.estado ?? '').trim();
    const cep = String(parts.cep ?? '').trim();
    const local = [cidade, estado].filter(Boolean).join(' - ');
    const formattedCep = cep ? `CEP ${cep}` : '';
    return [endereco, local, formattedCep].filter(Boolean).join(', ');
  }

  private applyStoreAddressFromParts(
    parts: { nome?: any; endereco?: any; cidade?: any; estado?: any; cep?: any; latitude?: any; longitude?: any } | null
  ): void {
    if (!parts) return;
    const nome = String(parts.nome ?? '').trim();
    if (nome) this.marcaNome = nome;
    const cidade = String(parts.cidade ?? '').trim();
    const estado = String(parts.estado ?? '').trim();
    if (cidade || estado) {
      this.mapHeroCidadeEstado = [cidade, estado].filter(Boolean).join(' - ');
    }
    const fullDisplay = this.buildAddressPartsAddress(parts);
    if (!fullDisplay) return;

    this.lojaEnderecoExibicao = fullDisplay;
    this.defaultCenterAddress = fullDisplay;
    this.pharmacyAddress = [String(parts.endereco ?? '').trim(), String(parts.cidade ?? '').trim(), String(parts.estado ?? '').trim()]
      .filter(Boolean)
      .join(', ') || fullDisplay;

    const lat = Number(parts.latitude);
    const lng = Number(parts.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      this.pharmacyCoords = { lat, lng };
    }
  }

  private applyStoreAddressFromTenantProfile(): void {
    const profile = this.tenantLoja.profile();
    if (!profile) return;
    this.applyStoreAddressFromParts({
      nome: (profile as any).nome,
      endereco: (profile as any).endereco,
      cidade: (profile as any).cidade,
      estado: (profile as any).estado,
      cep: (profile as any).cep,
      latitude: (profile as any).latitude,
      longitude: (profile as any).longitude,
    });
  }

  ngOnInit(): void {
    // follow the same pattern as other pages: only call API from the browser
    // to avoid SSR network errors.
    if (isPlatformBrowser(this.platformId)) {
      combineLatest([this.route.paramMap, this.route.queryParamMap])
        .pipe(takeUntil(this.destroyRoute$))
        .subscribe(() => {
        const slug = String(this.route.snapshot.paramMap.get('slug') || '').trim().toLowerCase();
        const svc = String(this.route.snapshot.queryParamMap.get('service') || '').toLowerCase();
        if (slug) {
          this.transportePetLojaSlugEscolhida = null;
        }
        this.transportePetAtivo = svc === 'transporte';
        if (svc !== 'transporte') {
          this.stopTransporteGlobalMapPoll();
        }
        if (svc === 'transporte') {
          if (this.transporteLojaSlugParaCorrida) {
            this.transportePetSelecaoLojaAberta = false;
            this.transportePetFluxoEtapa = null;
            this.transportePetPainelAberto = true;
            this.transportePetOperacaoAtual = 'estabelecimento';
            this.initTransporteCoordsSeNecessario();
            this.ensureTransporteScheduledLocal();
          } else {
            this.transportePetPainelAberto = false;
            this.transportePetSelecaoLojaAberta = true;
            this.transportePetFluxoEtapa = 'intencao';
          }
        }
        this.capturePartnerFromRoute();
        try {
          this.resolveRequestedPartnerIdFromLoadedPartners();
        } catch {
          /* ignore */
        }
        try {
          this.applyFilters();
        } catch {
          /* ignore */
        }
        void this.maybeCenterRequestedPartner();
        if (this.requestedPartnerId != null || this.requestedPartnerSlug) {
          this.resultsAccordionOpen = true;
        }
      });

      this.capturePartnerFromRoute();
      this.applyStoreAddressFromTenantProfile();
      if (this.tenantLoja.isTenantLoja()) {
        this.mapSphereView = 'parceiros';
      }
      this.loadMapLocalSettings();
      this.syncLocationOptInFromCookies();
      this.initMobileLayoutListener();
      // attach global handlers to capture initialization errors so the app doesn't get left in a broken state
      try { window.addEventListener('error', this.__errHandler); window.addEventListener('unhandledrejection', this.__unhandledRejection); } catch (e) {}
      // load partners and types together from /maps endpoint
      // Defer heavy partner/map initialization until the app is stable to avoid
      // NG0506 hydration timeouts (don't start long-running async work during hydration).
      try {
        // wait until ApplicationRef reports stability (first true) and then start partners/map
        // but don't wait forever: fallback after a short timeout to avoid blocking map init
        const stableSub = (this.appRef.isStable as any).pipe(filter((s: boolean) => s), take(1)).subscribe(() => {
          try { clearTimeout(stableTimer as any); } catch (e) {}
            this.loadPartners();
        });
        const stableTimer = setTimeout(() => {
          try { stableSub.unsubscribe(); } catch (e) {}
            this.loadPartners();
        }, 1500);
      } catch (e) {
        setTimeout(() => { this.loadPartners(); }, 0);
      }

      this.loadTransportePetsForCliente();
      this.realtime
        .on<{ status?: string; requestId?: number }>('transportepet:logisticaRequestUpdated')
        .pipe(takeUntil(this.destroyRoute$))
        .subscribe((p) => {
          if (p?.status) {
            this.toast.info(`Pedido de transporte: ${p.status.replace(/_/g, ' ')}`);
          }
        });
    } else {
      this.loading = false;
    }
  }

  private loadTransportePetsForCliente(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const tok = this.session.getBackendToken();
    const dec = this.session.decodeToken(tok || undefined);
    if (!tok || String(dec?.tipo || '').toLowerCase() !== 'cliente') {
      this.transportePetPets = [];
      this.transportePetSelectedPetId = null;
      return;
    }
    this.api.listClientePets(tok).subscribe({
      next: (r) => {
        this.transportePetPets = r.pets || [];
        if (this.transportePetPets.length === 1) {
          this.transportePetSelectedPetId = this.transportePetPets[0].id;
          this.applyTransportePorteFromPet(this.transportePetPets[0]);
        }
      },
      error: () => {
        this.transportePetPets = [];
      },
    });
  }

  onTransportePetSelectedChange(): void {
    const id = this.transportePetSelectedPetId;
    if (id == null) return;
    const pet = this.transportePetPets.find((p) => p.id === id);
    if (pet) this.applyTransportePorteFromPet(pet);
  }

  private applyTransportePorteFromPet(pet: { porte?: string }): void {
    const po = String(pet.porte || '').toLowerCase();
    if (po === 'pequeno' || po === 'mini' || po === 'pequeno_porte') this.transportePetPorte = 'pequeno';
    else if (po === 'grande' || po === 'gigante') this.transportePetPorte = 'grande';
    else this.transportePetPorte = 'medio';
  }

  private initTransporteCoordsSeNecessario(): void {
    if (this.transportePetOrigemLat != null) return;
    this.transportePetOrigemLat = this.pharmacyCoords?.lat ?? LOJA_MAPA_LAT;
    this.transportePetOrigemLng = this.pharmacyCoords?.lng ?? LOJA_MAPA_LNG;
    this.transportePetDestLat = (this.pharmacyCoords?.lat ?? LOJA_MAPA_LAT) + 0.02;
    this.transportePetDestLng = (this.pharmacyCoords?.lng ?? LOJA_MAPA_LNG) + 0.02;
  }

  private toDatetimeLocalValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private ensureTransporteScheduledLocal(): void {
    if (this.transportePetUrgencia !== 'agendado') return;
    if (this.transportePetScheduledAtLocal) return;
    this.transportePetScheduledAtLocal = this.toDatetimeLocalValue(new Date(Date.now() + 2 * 3600000));
  }

  private scheduledAtIsoFromLocal(): string | undefined {
    if (this.transportePetUrgencia !== 'agendado') return undefined;
    const raw = (this.transportePetScheduledAtLocal || '').trim();
    if (!raw) return undefined;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return undefined;
    return dt.toISOString();
  }

  abrirTransportePetPainel(): void {
    this.loadTransportePetsForCliente();
    this.mapSearchUiOpen = false;
    this.mapConfigOpen = false;
    if (this.transporteLojaSlugParaCorrida) {
      this.transportePetSelecaoLojaAberta = false;
      this.transportePetFluxoEtapa = null;
      this.transportePetOperacaoAtual = 'estabelecimento';
      this.transportePetPainelAberto = true;
      this.initTransporteCoordsSeNecessario();
      this.ensureTransporteScheduledLocal();
    } else {
      this.transportePetPainelAberto = false;
      this.transportePetSelecaoLojaAberta = true;
      this.transportePetFluxoEtapa = 'intencao';
    }
    this.scheduleMapResize();
  }

  fecharTransportePetPainel(): void {
    this.transportePetPainelAberto = false;
    this.scheduleMapResize();
  }

  fecharTransporteSelecaoLoja(): void {
    this.transportePetSelecaoLojaAberta = false;
    this.transportePetFluxoEtapa = null;
    this.scheduleMapResize();
  }

  escolherTransporteAgora(): void {
    const slug = this.transporteMarketplaceSlug;
    if (!slug) {
      this.toast.error('Transporte imediato não configurado. Defina environment.transporteMarketplaceLojaSlug e o operador no servidor.');
      return;
    }
    this.transportePetLojaSlugEscolhida = slug;
    this.transportePetOperacaoAtual = 'marketplace';
    this.transportePetFluxoEtapa = null;
    this.transportePetSelecaoLojaAberta = false;
    this.transportePetPainelAberto = true;
    this.transportePetOrigemLat = null;
    this.transportePetOrigemLng = null;
    this.transportePetDestLat = null;
    this.transportePetDestLng = null;
    this.initTransporteCoordsSeNecessario();
    this.ensureTransporteScheduledLocal();
    this.scheduleMapResize();
    this.startTransporteGlobalMapPoll();
    setTimeout(() => this.refreshGlobalSupplyMarkers(), 400);
  }

  escolherTransporteComClinica(): void {
    this.transportePetFluxoEtapa = 'lista_lojas';
    if (!this.parceirosParaTransportePet.length && !this.loading) {
      this.toast.info('Carregue o mapa ou aproxime o zoom para listar estabelecimentos com vitrine.');
    }
  }

  voltarTransporteIntencao(): void {
    this.transportePetFluxoEtapa = 'intencao';
  }

  recarregarParceirosMapaTransporte(): void {
    this.loadPartners();
  }

  escolherLojaParaTransporte(slug: string, lat?: number | null, lng?: number | null): void {
    const s = String(slug || '').trim().toLowerCase();
    if (!s) return;
    this.transportePetOperacaoAtual = 'estabelecimento';
    this.transportePetLojaSlugEscolhida = s;
    this.transportePetSelecaoLojaAberta = false;
    this.transportePetPainelAberto = true;
    this.stopTransporteGlobalMapPoll();
    this.clearGlobalDriverMarkersFromMap();
    const la = lat != null ? Number(lat) : NaN;
    const ln = lng != null ? Number(lng) : NaN;
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      this.transportePetOrigemLat = la;
      this.transportePetOrigemLng = ln;
      this.transportePetDestLat = la + 0.02;
      this.transportePetDestLng = ln + 0.02;
    } else {
      this.transportePetOrigemLat = null;
      this.transportePetOrigemLng = null;
      this.transportePetDestLat = null;
      this.transportePetDestLng = null;
      this.initTransporteCoordsSeNecessario();
    }
    this.ensureTransporteScheduledLocal();
    this.scheduleMapResize();
  }

  trocarLojaTransporte(): void {
    if (!this.transportePetLojaSlugEscolhida || this.transporteLojaSlugEfetivo) return;
    this.transportePetPainelAberto = false;
    this.transportePetLojaSlugEscolhida = null;
    this.transportePetQuote = null;
    this.transportePetOperacaoAtual = null;
    this.stopTransporteGlobalMapPoll();
    this.clearGlobalDriverMarkersFromMap();
    this.transportePetSelecaoLojaAberta = true;
    this.transportePetFluxoEtapa = 'intencao';
    this.scheduleMapResize();
  }

  onTransporteUrgenciaChange(): void {
    this.ensureTransporteScheduledLocal();
  }

  transportePetCotar(): void {
    const slug = this.transporteLojaSlugParaCorrida;
    if (!slug) return;
    const op = this.transportePetOperacaoAtual;
    if (!op) {
      this.toast.error('Selecione como deseja pedir o transporte.');
      return;
    }
    const oLat = Number(this.transportePetOrigemLat);
    const oLng = Number(this.transportePetOrigemLng);
    const dLat = Number(this.transportePetDestLat);
    const dLng = Number(this.transportePetDestLng);
    if (![oLat, oLng, dLat, dLng].every((x) => Number.isFinite(x))) {
      this.toast.error('Preencha origem e destino (coordenadas).');
      return;
    }
    this.transportePetBusy = true;
    this.api
      .publicTransportePetQuote(slug, {
        origem_lat: oLat,
        origem_lng: oLng,
        destino_lat: dLat,
        destino_lng: dLng,
        pet_porte: this.transportePetPorte,
        urgencia: this.transportePetUrgencia,
        operacao: op,
      })
      .subscribe({
        next: (q) => {
          this.transportePetQuote = q;
          this.transportePetBusy = false;
          this.toast.success('Cotação atualizada');
        },
        error: (e) => {
          this.transportePetBusy = false;
          this.toast.error(e?.error?.error || 'Falha na cotação');
        },
      });
  }

  transportePetSolicitar(): void {
    const slug = this.transporteLojaSlugParaCorrida;
    if (!slug) return;
    const op = this.transportePetOperacaoAtual;
    if (!op) {
      this.toast.error('Selecione como deseja pedir o transporte.');
      return;
    }
    const tok = this.session.getBackendToken();
    const dec = this.session.decodeToken(tok || undefined);
    if (!tok || String(dec?.tipo || '').toLowerCase() !== 'cliente') {
      this.toast.error('Entre com sua conta de tutor para solicitar.');
      void this.router.navigate(['/area-cliente'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    const oLat = Number(this.transportePetOrigemLat);
    const oLng = Number(this.transportePetOrigemLng);
    const dLat = Number(this.transportePetDestLat);
    const dLng = Number(this.transportePetDestLng);
    if (![oLat, oLng, dLat, dLng].every((x) => Number.isFinite(x))) {
      this.toast.error('Coordenadas inválidas.');
      return;
    }
    let scheduledIso: string | undefined;
    if (this.transportePetUrgencia === 'agendado') {
      scheduledIso = this.scheduledAtIsoFromLocal();
      if (!scheduledIso) {
        this.toast.error('Informe data e horário da viagem.');
        return;
      }
    }
    if (this.transportePetPets.length > 0 && this.transportePetSelectedPetId == null) {
      this.toast.error('Selecione qual pet vai no transporte.');
      return;
    }
    const destTxt = (this.transporteDestinoTexto || '').trim();
    const origTxt = (this.transporteOrigemTexto || '').trim();
    this.transportePetBusy = true;
    this.api
      .createClienteTransportePetCorrida(tok, {
        loja_slug: slug,
        operacao: op,
        origem_lat: oLat,
        origem_lng: oLng,
        destino_lng: dLng,
        destino_lat: dLat,
        origem_texto: origTxt || 'Origem (mapa)',
        destino_texto: destTxt || 'Destino (mapa)',
        pet_porte: this.transportePetPorte,
        pet_id: this.transportePetSelectedPetId != null ? this.transportePetSelectedPetId : undefined,
        urgencia: this.transportePetUrgencia,
        scheduled_at: scheduledIso,
      } as any)
      .subscribe({
        next: (r) => {
          const id = Number((r.corrida as any)?.id);
          const pid = Number((r.corrida as any)?.parceiro_id);
          const reqLog = r.logistica_request_id;
          if (reqLog != null) {
            void this.realtime.emit('transportepet:joinLogisticaRequest', { requestId: Number(reqLog) });
          }
          this.transportePetLastCorridaId = id;
          this.transportePetLastParceiroId = Number.isFinite(pid) && pid > 0 ? pid : null;
          if (!id) {
            this.transportePetBusy = false;
            this.toast.error('Resposta inválida');
            return;
          }
          this.api.checkoutClienteTransportePetCorrida(tok, id, slug, op).subscribe({
            next: (c) => {
              this.transportePetBusy = false;
              if (c.payment_url) window.location.href = c.payment_url;
              else this.toast.error('URL de pagamento indisponível');
            },
            error: (e) => {
              this.transportePetBusy = false;
              this.toast.error(e?.error?.error || 'Falha no checkout');
            },
          });
        },
        error: (e) => {
          this.transportePetBusy = false;
          this.toast.error(e?.error?.error || 'Falha ao criar corrida');
        },
      });
  }

  transportePetFmtReais(centavos?: number | null): string {
    if (centavos == null || !Number.isFinite(Number(centavos))) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(centavos) / 100
    );
  }

  /** Define origem da corrida na posição atual do dispositivo. */
  transportePetUsarMinhaOrigem(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.transportePetLocLoading = true;
    this.getUserPosition({ maxAge: 0, timeout: 20000 })
      .then((pos) => {
        this.zone.run(() => {
          this.transportePetOrigemLat = pos.lat;
          this.transportePetOrigemLng = pos.lng;
          this.transportePetLocLoading = false;
          this.toast.success('Origem definida pela sua localização.');
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.transportePetLocLoading = false;
          this.toast.error('Não foi possível obter sua localização. Verifique permissões do navegador.');
        });
      });
  }

  /** Origem no endereço da loja (pin da farmácia / tenant). */
  transportePetUsarLojaComoOrigem(): void {
    const lat = this.pharmacyCoords?.lat ?? LOJA_MAPA_LAT;
    const lng = this.pharmacyCoords?.lng ?? LOJA_MAPA_LNG;
    this.transportePetOrigemLat = lat;
    this.transportePetOrigemLng = lng;
    this.toast.success('Origem definida no ponto da loja no mapa.');
  }

  transportePetInverterOrigemDestino(): void {
    const oLat = this.transportePetOrigemLat;
    const oLng = this.transportePetOrigemLng;
    this.transportePetOrigemLat = this.transportePetDestLat;
    this.transportePetOrigemLng = this.transportePetDestLng;
    this.transportePetDestLat = oLat;
    this.transportePetDestLng = oLng;
    this.toast.success('Origem e destino invertidos.');
  }

  ngOnDestroy(): void {
    this.stopTransporteGlobalMapPoll();
    try {
      this.destroyRoute$.next();
      this.destroyRoute$.complete();
    } catch {
      /* ignore */
    }
    try { window.removeEventListener('error', this.__errHandler); window.removeEventListener('unhandledrejection', this.__unhandledRejection); } catch (e) {}
    this.teardownMobileLayoutListener();
    this.stopPharmacyPulse();
    this.disposePartnerClusterer();
    if (this.userLocationMarker) {
      try { this.userLocationMarker.setMap(null); } catch { /* ignore */ }
      this.userLocationMarker = null;
    }
  }

  private initMobileLayoutListener(): void {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 860px)');
    this.mobileLayoutMql = mql;
    const apply = () => {
      const next = !!mql.matches;
      this.zone.run(() => {
        this.isMobileMapLayout = next;
        if (!next) {
          this.resultsAccordionOpen = false;
        }
        this.scheduleMapResize();
      });
    };
    this.mobileLayoutListener = apply;
    try {
      if (mql.addEventListener) mql.addEventListener('change', apply);
      else (mql as any).addListener(apply);
    } catch (e) {
      /* ignore */
    }
    apply();
  }

  private teardownMobileLayoutListener(): void {
    if (!this.mobileLayoutMql || !this.mobileLayoutListener) return;
    try {
      if (this.mobileLayoutMql.removeEventListener) this.mobileLayoutMql.removeEventListener('change', this.mobileLayoutListener);
      else (this.mobileLayoutMql as any).removeListener(this.mobileLayoutListener);
    } catch (e) {
      /* ignore */
    }
    this.mobileLayoutMql = null;
    this.mobileLayoutListener = null;
  }

  /** After layout changes (esp. mobile overlay), refresh map tiles. */
  private scheduleMapResize(): void {
    if (!isPlatformBrowser(this.platformId) || !this.map) return;
    const run = () => {
      try {
        const g = (window as any).google;
        if (g?.maps?.event) g.maps.event.trigger(this.map, 'resize');
      } catch (e) {
        /* ignore */
      }
    };
    setTimeout(run, 0);
    setTimeout(run, 200);
  }

  /** Evita que o ponto activo fique sob o acordeão / dock em mobile. */
  private nudgeMapForMobileChrome(): void {
    if (!this.isMobileMapLayout || !this.map) return;
    try {
      this.map.panBy(0, -100);
    } catch (e) {
      /* ignore */
    }
  }

  private disposePartnerClusterer(): void {
    if (!this.partnerClusterer) return;
    try {
      this.partnerClusterer.clearMarkers();
    } catch (e) {
      /* ignore */
    }
    try {
      (this.partnerClusterer as any).setMap(null);
    } catch (e) {
      /* ignore */
    }
    this.partnerClusterer = null;
  }

  private stopPharmacyPulse(): void {
    if (this.pharmacyPulseRaf) {
      try {
        cancelAnimationFrame(this.pharmacyPulseRaf);
      } catch (e) {
        /* ignore */
      }
      this.pharmacyPulseRaf = 0;
    }
    if (this.pharmacyPulseCircle) {
      try {
        this.pharmacyPulseCircle.setMap(null);
      } catch (e) {
        /* ignore */
      }
      this.pharmacyPulseCircle = null;
    }
  }

  private startPharmacyPulse(center: { lat: number; lng: number }): void {
    this.stopPharmacyPulse();
    if (!this.map || !(window as any).google) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const google = (window as any).google;
    try {
      this.pharmacyPulseCircle = new google.maps.Circle({
        map: this.map,
        center,
        radius: 28,
        strokeColor: '#c4d600',
        strokeOpacity: 0.5,
        strokeWeight: 2,
        fillColor: '#c4d600',
        fillOpacity: 0.1,
        zIndex: 0,
      });
    } catch (e) {
      return;
    }
    let t = 0;
    const tick = () => {
      if (!this.pharmacyPulseCircle) return;
      t += 0.028;
      const w = 0.5 + 0.5 * Math.sin(t);
      const r = 22 + 18 * w;
      const fo = 0.06 + 0.08 * w;
      try {
        this.pharmacyPulseCircle.setRadius(r);
        this.pharmacyPulseCircle.setOptions({
          fillOpacity: fo,
          strokeOpacity: 0.32 + 0.22 * w,
        });
      } catch (e) {
        /* ignore */
      }
      this.pharmacyPulseRaf = requestAnimationFrame(tick) as unknown as number;
    };
    this.pharmacyPulseRaf = requestAnimationFrame(tick) as unknown as number;
  }

  // Lista carregada uma vez (todos); aba muda só filtros no cliente
  select(tabId: string){
    this.active = tabId;
    this.scheduleMapResize();
    if (isPlatformBrowser(this.platformId)) {
      try { this.applyFilters(); } catch (e) { console.warn('applyFilters on select failed', e); }
    }
  }

  private readonly clusterPartnerThreshold = 15;
  /** Atualização periódica dos motoristas da rede global no mapa (somente modo marketplace). */
  private transporteGlobalMapPoll: ReturnType<typeof setInterval> | null = null;

  private stopTransporteGlobalMapPoll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.transporteGlobalMapPoll) {
      clearInterval(this.transporteGlobalMapPoll);
      this.transporteGlobalMapPoll = null;
    }
  }

  private startTransporteGlobalMapPoll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stopTransporteGlobalMapPoll();
    this.transporteGlobalMapPoll = setInterval(() => {
      this.zone.run(() => this.refreshGlobalSupplyMarkers());
    }, 28000);
  }

  /** Remove marcadores da API pública de motoristas PetSphere (sem afetar parceiros). */
  private clearGlobalDriverMarkersFromMap(): void {
    if (!this.map) return;
    const keep: any[] = [];
    for (const m of this.markers) {
      if ((m as any).__isGlobalDriver) {
        try {
          m.setMap(null);
        } catch {
          /* ignore */
        }
      } else {
        keep.push(m);
      }
    }
    this.markers = keep;
  }

  /**
   * Rede pública: motoristas globais online (não inclui frota privada de clínicas).
   * Só no fluxo transporte + operação marketplace.
   */
  private refreshGlobalSupplyMarkers(): void {
    if (!isPlatformBrowser(this.platformId) || !this.map || !(window as any).google) return;
    if (!this.transportePetAtivo || this.transportePetOperacaoAtual !== 'marketplace') {
      this.clearGlobalDriverMarkersFromMap();
      return;
    }
    this.clearGlobalDriverMarkersFromMap();
    this.api.getPublicTransportePetGlobalMotoristasMap().subscribe({
      next: (res) => {
        const google = (window as any).google;
        const list = res.motoristas || [];
        const icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#0284c7',
          fillOpacity: 0.92,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        };
        for (const d of list) {
          const lat = Number(d['lat']);
          const lng = Number(d['lng']);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          try {
            const mk = new google.maps.Marker({
              position: { lat, lng },
              map: this.map,
              title: 'Motorista PetSphere (rede)',
              zIndex: 850,
              icon,
            });
            (mk as any).__isGlobalDriver = true;
            this.markers.push(mk);
          } catch {
            /* ignore */
          }
        }
      },
      error: () => {
        /* silencioso: endpoint público pode falhar antes do backend subir */
      },
    });
  }

  private refreshMarkers() {
    if (!this.map || !(window as any).google) return;
    try {
      if (this.currentInfoWindow) {
        try {
          this.currentInfoWindow.close();
        } catch (e) {
          /* ignore */
        }
        this.currentInfoWindow = null;
      }
    } catch (e) {
      /* ignore */
    }

    this.stopPharmacyPulse();
    this.disposePartnerClusterer();
    for (const m of this.markers) {
      try {
        m.setMap(null);
      } catch (e) {
        /* ignore */
      }
    }
    this.markers = [];

    const fallbackCoords = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
    const coordsToUse = this.pharmacyCoords ?? fallbackCoords;
    const google = (window as any).google;

    if (this.mapShowPharmacy) {
      try {
        const pinFpUrl = this.pinLojaUrl;
        const iconPharm = {
          url: pinFpUrl,
          scaledSize: new google.maps.Size(36, 44),
          anchor: new google.maps.Point(18, 44),
        };
        const pharmacyMarker = new google.maps.Marker({
          position: coordsToUse,
          map: this.map,
          icon: iconPharm,
          title: 'Farmácia / Loja',
          zIndex: 1000,
        });
        this.markers.push(pharmacyMarker);
        try {
          this.attachPharmacyInfo(pharmacyMarker, coordsToUse);
        } catch (e) {
          console.warn('attachPharmacyInfo failed', e);
        }
      } catch (e) {
        const pharmacyMarker = new google.maps.Marker({
          position: coordsToUse,
          map: this.map,
          title: 'Farmácia / Loja',
          zIndex: 1000,
        });
        this.markers.push(pharmacyMarker);
        try {
          this.attachPharmacyInfo(pharmacyMarker, coordsToUse);
        } catch (err) {
          console.warn('attachPharmacyInfo fallback failed', err);
        }
      }

      this.startPharmacyPulse(coordsToUse);
    }

    const mapPartners = this.partnersForMap || [];
    const partnerMarkers: any[] = [];
    for (const p of mapPartners) {
      const lat = p.latitude ?? p.lat ?? p.latitud ?? null;
      const lng = p.longitude ?? p.lng ?? p.long ?? null;
      if (lat == null || lng == null) continue;
      try {
        const iconObj = this.getIconForPartner(p);
        const defaultIcon = {
          url: '/icones/pin-pata.svg',
          scaledSize: new google.maps.Size(32, 36),
          anchor: new google.maps.Point(16, 36),
        };
        const useCluster = mapPartners.length > this.clusterPartnerThreshold;
        const markerOpts: any = {
          position: { lat: Number(lat), lng: Number(lng) },
          map: useCluster ? null : this.map,
          title: p.nome || p.name || p.id?.toString?.() || 'Anunciante',
          zIndex: 500,
        };
        if (iconObj) markerOpts.icon = iconObj;
        else markerOpts.icon = defaultIcon;
        const marker = new google.maps.Marker(markerOpts);
        try {
          (marker as any).__partnerId = p.anuncio_id ?? p.id ?? p._raw?.id ?? null;
        } catch (e) {
          /* ignore */
        }
        this.markers.push(marker);
        partnerMarkers.push(marker);
        try {
          this.attachPartnerInfo(marker, p);
        } catch (e) {
          console.warn('attachPartnerInfo failed', e);
        }
      } catch (e) {
        const marker = new google.maps.Marker({
          position: { lat: Number(lat), lng: Number(lng) },
          map: mapPartners.length > this.clusterPartnerThreshold ? null : this.map,
          title: p.nome || p.name || 'Anunciante',
          zIndex: 500,
        });
        try {
          (marker as any).__partnerId = p.anuncio_id ?? p.id ?? p._raw?.id ?? null;
        } catch (e) {
          /* ignore */
        }
        this.markers.push(marker);
        partnerMarkers.push(marker);
        try {
          this.attachPartnerInfo(marker, p);
        } catch (err) {
          console.warn('attachPartnerInfo fallback failed', err);
        }
      }
    }

    if (partnerMarkers.length > this.clusterPartnerThreshold) {
      try {
        this.partnerClusterer = new MarkerClusterer({
          map: this.map,
          markers: partnerMarkers,
        });
      } catch (e) {
        console.warn('MarkerClusterer failed, falling back to individual markers', e);
        for (const m of partnerMarkers) {
          try {
            m.setMap(this.map);
          } catch (e) {
            /* ignore */
          }
        }
      }
    }

    this.refreshGlobalSupplyMarkers();
  }

  /** Abre o chat parceiro-cliente usando o modal reutilizável global. */
  private goToPartnerChatFromMap(partner: any): void {
    const parceiroId = Number(partner?.id ?? partner?._raw?.id ?? 0);
    if (!Number.isFinite(parceiroId) || parceiroId < 1) {
      this.toast.error('Não foi possível identificar esta loja para o chat.');
      return;
    }
    this.partnerChatLauncher.openForPartner(parceiroId);
  }

  openLastRidePartnerChat(ev: Event): void {
    ev.preventDefault();
    const parceiroId = Number(this.transportePetLastParceiroId);
    const corridaId = Number(this.transportePetLastCorridaId);
    this.partnerChatLauncher.openForPartner(parceiroId, corridaId);
  }

  /**
   * Attach an info window to a partner marker showing basic info and actions.
   */
  private attachPartnerInfo(marker: any, partner: any) {
    if (!(window as any).google) return;
    const google = (window as any).google;
    try { if (this.infoWindow) this.infoWindow.close(); } catch {}

    const lat = partner.latitude ?? partner.lat ?? partner._raw?.latitude ?? 0;
    const lng = partner.longitude ?? partner.lng ?? partner._raw?.longitude ?? 0;
    const uid = String(partner.anuncio_id ?? partner.id ?? Math.abs(Math.floor(Math.random() * 1e9)));
    const dest = encodeURIComponent(`${lat},${lng}`);
    const name = partner.nome ?? partner.titulo ?? partner._raw?.anunciante?.nome ?? '';
    const title = partner.titulo ?? '';
    const address = partner.endereco ?? partner._raw?.endereco ?? '';
    const phone = partner.telefone ?? partner._raw?.telefone ?? '';
    const storeSlug = this.getPartnerStoreSlug(partner);
    const storeUrl = this.buildPartnerStoreUrl(storeSlug);
    const logoCandidate = String(partner.logo_url ?? partner._raw?.logo_url ?? '').trim();
    const logoSrc = logoCandidate || this.defaultPartnerLogoPath;
    const logoFallback = this.defaultPartnerLogoPath;
    const quickServices = this.detectPartnerServiceIds(partner);

    const routeBtnId = `map-route-btn-${uid}`;
    const msgBtnId = `map-msg-btn-${uid}`;
    const closeBtnId = `map-close-btn-${uid}`;
    const servicesWrapId = `map-services-wrap-${uid}`;
    const storeLinkHtml = storeUrl
      ? `<a href="${storeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#0369a1">Ver loja online →</a>`
      : '';
    const servicesHtml = quickServices.length
      ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Menu rápido de serviços</div>
          <div id="${servicesWrapId}" style="display:flex;flex-wrap:wrap;gap:6px">
            ${quickServices.map((svcId) => {
              const svc = this.partnerQuickServiceCatalog[svcId];
              if (!svc) return '';
              return `<button type="button" data-service-id="${svcId}" style="border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer">${svc.label}</button>`;
            }).join('')}
          </div>
          <div style="margin-top:7px;font-size:11px;color:#64748b">Toque em um serviço para filtrar no mapa e abrir o contexto.</div>
        </div>`
      : '';

    const content = `
      <div style="max-width:340px;font-family:Inter,Arial,Helvetica,sans-serif;color:#0f172a;padding:12px;box-sizing:border-box;border-radius:10px;position:relative;overflow:visible">
      <button id="${closeBtnId}" aria-label="Fechar" style="position:absolute;top:-20px;right:-20px;width:40px;height:40px;border-radius:50%;background:#111827;color:#fff;border:0;box-shadow:0 10px 28px rgba(0,0,0,.32);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0">✕</button>

      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
        <img
          src="${logoSrc}"
          alt="Logo de ${name || 'parceiro'}"
          style="width:46px;height:46px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;background:#fff;flex:0 0 auto"
          onerror="this.onerror=null;this.src='${logoFallback}';" />
        <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:15px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
        <div style="font-size:13px;color:#374151;margin-top:4px;line-height:1.2;word-break:break-word">${title}${address ? ' · ' + address : ''}</div>
        ${phone ? `<div style="font-size:13px;color:#374151;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Tel: ${phone}</div>` : ''}
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button id="${routeBtnId}" type="button" style="flex:1;min-width:120px;border:0;background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer">Traçar rota</button>
        <button id="${msgBtnId}" type="button" style="flex:1;min-width:120px;border:1px solid #0ea5e9;background:#e0f2fe;color:#0c4a6e;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer">Enviar mensagem</button>
      </div>
      ${servicesHtml}
      ${storeLinkHtml}
      </div>
    `;

    const iw = new google.maps.InfoWindow({ content, maxWidth: 360 });

    marker.addListener('click', () => {
      try { if (this.currentInfoWindow) this.currentInfoWindow.close(); } catch {}
      try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
      this.nudgeMapForMobileChrome();
      iw.open(this.map, marker);
      this.currentInfoWindow = iw;
      try {
        google.maps.event.addListenerOnce(iw, 'domready', () => {
          try {
            // ensure style injection exists (allows overflow and hides built-in close)
            try {
              if (!document.querySelector('style[data-gm-style-iw]')) {
                const st = document.createElement('style');
                st.setAttribute('data-gm-style-iw', '1');
                st.innerHTML = `
                  .gm-style .gm-style-iw { overflow: visible !important; }
                  .gm-style .gm-style-iw > div { overflow: visible !important; }
                  .gm-style .gm-style-iw-chr > button.gm-ui-hover-effect { display: none !important; }
                  .gm-style .gm-ui-hover-effect[aria-label='Fechar'] { display: none !important; }
                `;
                document.head.appendChild(st);
              }
            } catch (e) {}

            const routeBtn = document.getElementById(routeBtnId);
            const msgBtn = document.getElementById(msgBtnId);
            const closeBtn = document.getElementById(closeBtnId);
            const servicesWrap = document.getElementById(servicesWrapId);
            if (routeBtn) {
              routeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const destObj = { lat: Number(lat), lng: Number(lng) };
                this.zone.run(() => {
                  void this.drawRoute(destObj);
                });
                try { iw.close(); } catch (e) {}
              });
            }
            if (msgBtn) {
              msgBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                this.zone.run(() => {
                  this.goToPartnerChatFromMap(partner);
                  try { iw.close(); } catch {}
                });
              });
            }
            if (closeBtn) {
              try { (closeBtn as HTMLElement).style.zIndex = '99999'; } catch (e) {}
              closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { iw.close(); } catch {} });
            }
            if (servicesWrap) {
              const serviceButtons = Array.from(servicesWrap.querySelectorAll('button[data-service-id]'));
              for (const node of serviceButtons) {
                node.addEventListener('click', (ev) => {
                  ev.preventDefault();
                  const svcId = String((node as HTMLElement).getAttribute('data-service-id') || '').trim();
                  if (!svcId) return;
                  this.zone.run(() => {
                    this.applyPartnerQuickService(partner, svcId);
                    try { iw.close(); } catch {}
                  });
                });
              }
            }
          } catch (e) { console.warn('partner info domready handler failed', e); }
        });
      } catch (e) {}
    });
  }

  private getPartnerStoreSlug(partner: any): string | null {
    const rawSlug = String(
      partner?.loja_slug ??
      partner?._raw?.loja_slug ??
      partner?.slug ??
      partner?._raw?.slug ??
      ''
    ).trim().toLowerCase();
    return rawSlug || null;
  }

  private buildPartnerStoreUrl(slug: string | null): string | null {
    if (!slug) return null;
    try {
      const protocol = window.location.protocol || 'https:';
      const host = String(window.location.hostname || '').trim().toLowerCase();
      const port = String(window.location.port || '').trim();
      if (!host) return null;

      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
        const localHost = `${slug}.localhost${port ? `:${port}` : ''}`;
        return `${protocol}//${localHost}`;
      }

      const normalizedHost = host.endsWith('.petsphere.com.br')
        ? 'petsphere.com.br'
        : (host.includes('.') ? host.replace(/^[^.]+\./, '') : host);
      return `${protocol}//${slug}.${normalizedHost}`;
    } catch (e) {
      return null;
    }
  }

  /**
   * Determine an icon object for a partner based on its type.
   * Usa icone/slug do backend; se faltar, reutiliza a mesma heurística de `getTabIcon`.
   */
  private getIconForPartner(partner: any) {
    try {
      if (!(window as any).google) return undefined;
      const google = (window as any).google;
      const firstTipo =
        partner?.tipo ?? (Array.isArray(partner?.tipos) && partner.tipos[0] ? partner.tipos[0] : null);
      const candidates = [
        partner?.tipo?.icone,
        partner?.tipo?.slug,
        partner?.tipo?.nome,
        Array.isArray(partner?.tipos) && partner?.tipos[0]?.icone,
        Array.isArray(partner?.tipos) && partner?.tipos[0]?.slug,
        Array.isArray(partner?.tipos) && partner?.tipos[0]?.nome,
        partner?._raw?.tipo?.icone,
        partner?._raw?.tipo?.slug,
        partner?._raw?.tipo?.nome,
        partner?._raw?.tipos && Array.isArray(partner._raw.tipos) ? partner._raw.tipos[0]?.icone : undefined,
        partner?._raw?.tipos && Array.isArray(partner._raw.tipos) ? partner._raw.tipos[0]?.slug : undefined,
        partner?._raw?.tipos && Array.isArray(partner._raw.tipos) ? partner._raw.tipos[0]?.nome : undefined,
        this.tabs.find((t) => t.id === this.active)?.icon,
        this.tabs.find(
          (t) => typeof t.typeId !== 'undefined' && firstTipo != null && Number(firstTipo.id) === Number(t.typeId)
        )?.icon,
      ];
      let name: any = null;
      for (const c of candidates) {
        if (c) {
          name = c;
          break;
        }
      }
      let url: string | null = null;
      if (name) {
        let file = String(name)
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{Diacritic}/gu, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-_.]/g, '');
        if (!file.endsWith('.png') && !file.endsWith('.svg')) file = `${file}.png`;
        url = `/icones/${file}`;
      }
      if (!url && firstTipo) {
        url = this.getTabIcon({
          id: String(firstTipo.slug ?? firstTipo.id ?? ''),
          label: String(firstTipo.nome ?? firstTipo.label ?? ''),
          icon: firstTipo.icone,
        });
      }
      if (!url) {
        const tab = this.tabs.find(
          (t) => t.id !== 'todos' && typeof t.typeId !== 'undefined' && firstTipo != null && Number(firstTipo.id) === Number(t.typeId)
        );
        if (tab) url = this.getTabIcon(tab);
      }
      if (!url) return undefined;
      return { url, scaledSize: new google.maps.Size(32, 36), anchor: new google.maps.Point(16, 36) };
    } catch (e) {
      return undefined;
    }
  }

  private loadProfessionalTypes(){
    // call the API service to fetch types; if it fails we keep defaults
    this.api.getProfessionalTypes().subscribe({
      next: (res) => {
        // normalize response to an array of types
        const types: any[] = Array.isArray(res)
          ? (res as any[])
          : (res && Array.isArray((res as any).types) ? (res as any).types : []);
        if (types.length) {
          // map to { id: slug(for DOM), label, typeId: numeric id for backend, icon }
          this.tabs = types.map((t: any) => {
            const anyT: any = t;
            const slug = anyT.slug ? String(anyT.slug) : String(anyT.id ?? anyT.key ?? anyT.nome ?? anyT.label ?? anyT.name ?? '');
            const label = String(anyT.nome ?? anyT.label ?? anyT.name ?? '');
            const typeId = (typeof anyT.id !== 'undefined' && anyT.id !== null) ? Number(anyT.id) : undefined;
            const icon = anyT.icone ?? anyT.icon ?? undefined;
            return { id: slug, label, typeId, icon };
          });
          // ensure a default 'todos' tab exists at the beginning so UI/backends can request all
          if (!this.tabs.find(x => x.id === 'todos')) {
            this.tabs.unshift({ id: 'todos', label: 'Todos', typeId: undefined, icon: undefined });
          }
          this.initVisibleCategoryToggles();
          const baseF = this.filtersByTab['todos'] || this.filtersByTab[this.active];
          if (baseF && baseF.length) {
            for (const t of this.tabs) {
              if (!this.filtersByTab[t.id]?.length) {
                this.filtersByTab[t.id] = baseF.map(f => ({ id: f.id, label: f.label, on: false }));
              }
            }
            try { this.applyFilters(); } catch (e) { /* ignore */ }
          }
        }
      },
      error: (err) => {
        console.error('getProfessionalTypes failed', err);
        // don't break the page; show a soft toast so developer knows
        this.toast.error('Erro ao carregar tipos de profissionais');
      }
    });
  }

  loadPartners(){
    this.loading = true;
    this.error = null;
    // Load all partners from the /maps endpoint (includes parceiros + vets, all registered partners)
    this.api.getMaps().subscribe({
      next: async (mapsRes) => {
        // Normalize partners from /maps endpoint
        const rawPartners: any[] = Array.isArray(mapsRes.partners) ? mapsRes.partners : [];
        
        this.allPartners = rawPartners.map((p: any) => {
          const latitude = p.latitude != null ? Number(p.latitude) : undefined;
          const longitude = p.longitude != null ? Number(p.longitude) : undefined;
          
          return {
            id: p.id ?? undefined,
            nome: p.nome ?? '',
            titulo: p.titulo ?? '',
            telefone: p.telefone ?? '',
            email: p.email ?? '',
            endereco: p.endereco ?? '',
            cidade: p.cidade ?? '',
            estado: p.estado ?? '',
            cep: p.cep ?? '',
            descricao: p.descricao ?? '',
            logo_url: p.logo_url ?? null,
            destaque: !!p.destaque,
            latitude: typeof latitude === 'number' && !isNaN(latitude) ? latitude : undefined,
            longitude: typeof longitude === 'number' && !isNaN(longitude) ? longitude : undefined,
            filtros_selecionados: p.filtros_selecionados ?? {},
            // normalize tipo/tipos: backend returns tipos array
            tipo: Array.isArray(p.tipos) && p.tipos[0] ? p.tipos[0] : null,
            tipos: Array.isArray(p.tipos) ? p.tipos : undefined,
            partner_type: p.partner_type ?? 'anunciante',
            loja_slug: p.loja_slug != null ? String(p.loja_slug).trim().toLowerCase() : undefined,
            _raw: p
          };
        });

        // Populate professional types from the response
        const tipos = Array.isArray(mapsRes.tipos) ? mapsRes.tipos : [];
        if (tipos.length) {
          this.tabs = tipos.map((t: any) => ({
            id: t.slug ? String(t.slug) : String(t.id ?? t.nome ?? ''),
            label: t.nome ?? t.label ?? '',
            typeId: t.id,
            icon: t.icone ?? undefined
          }));
          this.initVisibleCategoryToggles();
          // build empty filters for each tab (will be populated if needed later)
          for (const tab of this.tabs) {
            this.filtersByTab[tab.id] = this.filtersByTab[tab.id] || [];
          }
        }

        try {
          await this.backfillPartnersCoordinates(this.allPartners);
        } catch (e) {
          console.warn('backfillPartnersCoordinates failed', e);
        }

        // compute visible partners according to any current filters
        try { this.applyFilters(); } catch (e) { this.partners = this.allPartners.slice(); }
        this.resolveRequestedPartnerIdFromLoadedPartners();
        const targetId = this.requestedPartnerId ?? this.tenantLoja.parceiroId();
        if (targetId != null) {
          const target = this.allPartners.find((p) => Number(p.id) === Number(targetId));
          if (target) {
            this.applyStoreAddressFromParts({
              nome: target.nome ?? target._raw?.nome,
              endereco: target.endereco ?? target._raw?.endereco,
              cidade: target.cidade ?? target._raw?.cidade,
              estado: target.estado ?? target._raw?.estado,
              cep: target.cep ?? target._raw?.cep,
              latitude: target.latitude ?? target._raw?.latitude,
              longitude: target.longitude ?? target._raw?.longitude,
            });
          }
        }
        this.mapsApiKey = mapsRes.mapsApiKey ?? null;
        this.loading = false;
        
        // if we have a maps key, initialize the interactive map
        if (this.mapsApiKey && isPlatformBrowser(this.platformId)) {
          this.initInteractiveMapWithRetries(this.mapsApiKey, 3).catch(err => {
            console.error('initInteractiveMap failed after retries', err);
            this.toast.error('Erro ao inicializar o mapa');
            try { this.showFallbackMap(); } catch (e) {}
          });
        } else {
          // no API key available — show a simple iframe fallback so the page isn't empty
          try { if (isPlatformBrowser(this.platformId)) this.showFallbackMap(); } catch (e) {}
        }
      },
      error: (err) => {
        console.error('getMaps failed', err);
        this.toast.error('Erro ao carregar parceiros');
        this.error = 'Erro ao carregar parceiros';
        this.loading = false;
      }
    });
  }

  // If interactive map fails, replace the container with an embedded iframe as fallback
  private showFallbackMap() {
    try {
      const mapEl = document.getElementById('gmap');
      if (!mapEl) return;
      const addr = encodeURIComponent(this.pharmacyAddress || this.defaultCenterAddress || 'Curitiba, PR');
      const iframe = `<iframe src="https://www.google.com/maps?q=${addr}&output=embed" width="100%" height="100%" style="border:0;border-radius:12px;" allowfullscreen="" loading="lazy" title="Mapa (fallback)"></iframe>`;
      mapEl.innerHTML = iframe;
    } catch (e) {
      console.warn('showFallbackMap failed', e);
    }
  }

  // wrapper with retries to improve robustness on flaky reloads
  private async initInteractiveMapWithRetries(apiKey: string, attempts = 3): Promise<void> {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        await this.initInteractiveMap(apiKey);
        return;
      } catch (e) {
        lastErr = e;
        const delay = 500 * Math.pow(2, i); // exponential backoff: 500,1000,2000
        await this.sleep(delay);
      }
    }
    throw lastErr;
  }

  private sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

  /**
   * Load Google Maps script dynamically and initialize map/markers.
   * - returns a promise that resolves when map is ready.
   */
  private async initInteractiveMap(apiKey: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    // prevent double initialization
    if (this.mapInitialized) return;

    // ensure mapReadyPromise exists so callers can await readiness
    if (!this.mapReadyPromise) {
      this.mapReadyPromise = new Promise((resolve) => { this.mapReadyResolver = resolve; });
    }

    try {
      // load Google Maps script if necessary
      if (!(window as any).google) {
        await this.loadGoogleMapsScript(apiKey);
      }

      const google = (window as any).google;
      const mapEl = document.getElementById('gmap');
      if (!mapEl) throw new Error('Map container not found');

      const opts: any = {
        zoom: 15,
        disableDefaultUI: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        styles: [...FP_MAP_STYLES],
      };

      // geocode pharmacy address (best effort)
      let centerLatLng: any = null;
      const fallbackCenter = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
      try {
        const geocoder = new google.maps.Geocoder();
        const results = await this.geocodeAddress(geocoder, this.pharmacyAddress).catch((err) => { console.warn('geocode error', err); return null; });
        if (results && results[0] && results[0].geometry && results[0].geometry.location) {
          const loc = results[0].geometry.location;
          this.pharmacyCoords = { lat: loc.lat(), lng: loc.lng() };
          centerLatLng = { lat: loc.lat(), lng: loc.lng() };
        }
      } catch (e) {
        console.warn('geocode construction failed', e);
      }

      if (!centerLatLng && this.allPartners && this.allPartners.length) {
        const p = this.allPartners[0];
        const lat = p.lat ?? p.latitude ?? p.latitud ?? null;
        const lng = p.lng ?? p.longitude ?? p.long ?? null;
        if (lat != null && lng != null) centerLatLng = { lat: Number(lat), lng: Number(lng) };
      }

      opts.center = centerLatLng ?? fallbackCenter;
      this.map = new google.maps.Map(mapEl, opts);

      // small resize nudges to avoid blank tiles
      setTimeout(() => { try { google.maps.event.trigger(this.map, 'resize'); } catch (e) {} }, 250);

      try {
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true, polylineOptions: { strokeColor: '#c4d600', strokeWeight: 6, strokeOpacity: 0.95 } });
        this.directionsRenderer.setMap(this.map);
      } catch (e) {
        this.directionsService = null;
        this.directionsRenderer = null;
      }

      setTimeout(() => { try { google.maps.event.trigger(this.map, 'resize'); } catch (e) {} }, 600);

      try {
        this.refreshMarkers();
      } catch (e) {
        console.warn('refreshMarkers during init failed', e);
      }

      // mark ready and resolve waiters
      this.mapInitialized = true;
      if (this.mapReadyResolver) { try { this.mapReadyResolver(); } catch (e) {} this.mapReadyResolver = null; }

      // Só centraliza no usuário após consentimento explícito e gravação conforme política (cookies).
      this.maybeCenterFromUserConsent();
      this.maybeCenterTenantFoco();
      this.maybeCenterRequestedPartner();

    } catch (initErr) {
      console.error('initInteractiveMap unexpected error', initErr);
      try { this.showFallbackMap(); } catch (e) { console.warn('showFallbackMap failed during init error', e); }
      // ensure waiters are resolved
      try { if (this.mapReadyResolver) { try { this.mapReadyResolver(); } catch (e) {} this.mapReadyResolver = null; } } catch (e) {}
      this.mapInitialized = false;
    }

    // safe window handlers (outside main try)
    try {
      const google = (window as any).google;
      window.addEventListener('resize', () => { try { if (this.map && google && google.maps) google.maps.event.trigger(this.map, 'resize'); } catch (e) {} });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { try { if (this.map && google && google.maps) google.maps.event.trigger(this.map, 'resize'); } catch (e) {} } });
    } catch (e) {}
  }

  // returns a promise that resolves when the map becomes initialized
  private waitForMapReady(timeoutMs = 10000): Promise<void> {
    if (this.mapInitialized) return Promise.resolve();
    if (!this.mapReadyPromise) {
      this.mapReadyPromise = new Promise((resolve) => { this.mapReadyResolver = resolve; });
    }
    // create a timeout wrapper
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { reject(new Error('map ready timeout')); }, timeoutMs);
      this.mapReadyPromise!.then(() => { clearTimeout(t); resolve(); }).catch((e) => { clearTimeout(t); reject(e); });
    });
  }

  private geocodeAddress(geocoder: any, address: string): Promise<any> {
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK') resolve(results);
        else reject(status);
      });
    });
  }

  /**
   * Lê a posição do dispositivo (com permissão do navegador).
   * Tenta alta precisão e, se falhar, posição aproximada (melhor taxa de sucesso em desktop / Wi-Fi).
   */
  private getUserPosition(opts?: { maxAge?: number; timeout?: number }): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
        reject(new Error('no-geolocation'));
        return;
      }
      const maxAge = opts?.maxAge ?? 120000;
      const timeout = opts?.timeout ?? 15000;
      const run = (highAccuracy: boolean) =>
        new Promise<{ lat: number; lng: number }>((res, rej) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => res({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            rej,
            { enableHighAccuracy: highAccuracy, timeout, maximumAge: maxAge }
          );
        });
      run(true)
        .then(resolve)
        .catch(() => run(false).then(resolve).catch(reject));
    });
  }

  private syncLocationOptInFromCookies(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const c = this.mapLocationConsent.getConsent();
    this.mapLocationOptInVisible = c === null;
    this.mapLocationReopenBar = c === false;
  }

  /** Endereço legível a partir de coordenadas (Google Geocoder), para cookie e alinhamento com o “endereço” do usuário. */
  private reverseGeocodeToAddress(pos: { lat: number; lng: number }): Promise<string | null> {
    try {
      const google = (window as any).google;
      if (!google?.maps?.Geocoder) return Promise.resolve(null);
      const geocoder = new google.maps.Geocoder();
      return new Promise((resolve) => {
        try {
          geocoder.geocode({ location: pos }, (results: any, status: string) => {
            if (status === 'OK' && results?.[0]?.formatted_address) {
              resolve(String(results[0].formatted_address));
            } else {
              resolve(null);
            }
          });
        } catch {
          resolve(null);
        }
      });
    } catch {
      return Promise.resolve(null);
    }
  }

  /**
   * Após o usuário permitir: obtém posição, atualiza mapa, grava posição e endereço aproximado em cookie.
   */
  private async refreshUserPositionOnMap(userInitiated: boolean): Promise<void> {
    if (this.mapLocationConsent.getConsent() !== true || !this.map) return;
    const pos = await this.getUserPosition(
      userInitiated
        ? { maxAge: 0, timeout: 20000 }
        : { maxAge: 300000, timeout: 15000 }
    );
    this.zone.run(() => {
      try {
        this.map.setCenter(pos);
        this.map.setZoom(Math.max(this.map.getZoom ? this.map.getZoom() : 15, 14));
        this.setUserLocationMarker(pos);
        this.nudgeMapForMobileChrome();
        try { this.rebuildQuickSearchList(); } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('refreshUserPositionOnMap center failed', e);
      }
    });
    const address = await this.reverseGeocodeToAddress(pos);
    this.mapLocationConsent.setLastPosition(pos, address);
  }

  async acceptMapLocation(): Promise<void> {
    this.mapLocationConsent.setConsent(true);
    this.syncLocationOptInFromCookies();
    try {
      await this.waitForMapReady(12000).catch(() => {});
    } catch { /* */ }
    if (!this.map) {
      this.toast.error('Mapa ainda não está pronto. Tente “Minha posição” em instantes.');
      return;
    }
    try {
      await this.refreshUserPositionOnMap(true);
    } catch (e) {
      this.toast.error('Não foi possível obter sua localização. Verifique a permissão do navegador.');
    }
  }

  declineMapLocation(): void {
    this.mapLocationConsent.setConsent(false);
    this.mapLocationConsent.clearLastPosition();
    this.syncLocationOptInFromCookies();
    this.toast.info('O mapa permanece na região da loja. Você pode reativar a localização quando quiser.');
  }

  /** Volta a exibir o aviso (limpa o cookie de decisão). */
  reopenMapLocationPrompt(): void {
    this.mapLocationConsent.clearConsent();
    this.mapLocationConsent.clearLastPosition();
    this.syncLocationOptInFromCookies();
  }

  private setUserLocationMarker(pos: { lat: number; lng: number }): void {
    if (!this.map || !(window as any).google) return;
    const google = (window as any).google;
    if (this.userLocationMarker) {
      try { this.userLocationMarker.setMap(null); } catch { /* ignore */ }
      this.userLocationMarker = null;
    }
    try {
      this.userLocationMarker = new google.maps.Marker({
        position: pos,
        map: this.map,
        title: 'Sua posição',
        zIndex: 999998,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#1a73e8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 8
        }
      });
    } catch (e) {
      console.warn('setUserLocationMarker failed', e);
    }
  }

  /**
   * Se o visitante já consentiu, usa a última posição em cookie (rápido) e atualiza em seguida, sem toasts.
   */
  private maybeCenterFromUserConsent(): void {
    if (!isPlatformBrowser(this.platformId) || !this.map) return;
    if (this.mapLocationConsent.getConsent() !== true) return;

    const last = this.mapLocationConsent.getLastPosition();
    if (last) {
      const ageMs = Date.now() - new Date(last.savedAt).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        this.zone.run(() => {
          try {
            this.map.setCenter({ lat: last.lat, lng: last.lng });
            this.map.setZoom(Math.max(this.map.getZoom ? this.map.getZoom() : 15, 14));
            this.setUserLocationMarker({ lat: last.lat, lng: last.lng });
            this.nudgeMapForMobileChrome();
          } catch (e) {
            console.warn('maybeCenterFromUserConsent (cache) failed', e);
          }
        });
      }
    }

    this.refreshUserPositionOnMap(false).catch(() => { /* manter loja/parceiro */ });
  }

  /**
   * Centraliza o mapa na posição do usuário (e mostra o marcador azul).
   * @param userInitiated se true, exibe aviso se a localização falhar
   */
  async centerOnUserLocation(userInitiated = false): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !(window as any).google) return;
    const consent = this.mapLocationConsent.getConsent();
    if (consent !== true) {
      this.syncLocationOptInFromCookies();
      if (consent === null) {
        if (userInitiated) {
          this.toast.info('Para usar sua posição no mapa, responda ao aviso de localização no topo da página.');
        }
        return;
      }
      if (userInitiated) {
        this.toast.info('A localização no mapa está desativada. Use "Alterar localização" para permitir de novo.');
      }
      return;
    }
    try {
      await this.waitForMapReady(10000).catch(() => {});
    } catch { /* ignore */ }
    if (!this.map) {
      if (userInitiated) {
        this.toast.error('Mapa ainda não está pronto.');
      }
      return;
    }
    try {
      await this.refreshUserPositionOnMap(!!userInitiated);
    } catch (e) {
      if (userInitiated) {
        this.toast.error('Não foi possível obter sua localização. Verifique a permissão de localização no navegador.');
      }
    }
  }

  private loadGoogleMapsScript(apiKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).google) return resolve();
      const existing = document.querySelector('script[data-gmaps]') as HTMLScriptElement;
      if (existing) {
        // If script exists but google isn't available yet, wait for it with a timeout
        const onLoad = () => {
          // poll for window.google availability (some CSPs may delay attach)
          const start = Date.now();
          const poll = () => {
            if ((window as any).google) return resolve();
            if (Date.now() - start > 10000) return reject(new Error('Google Maps did not initialize in time'));
            setTimeout(poll, 200);
          };
          poll();
        };
        existing.addEventListener('load', onLoad);
        existing.addEventListener('error', (e) => reject(e));
        // if already complete, trigger onLoad
        if ((existing as any).readyState === 'complete') onLoad();
        return;
      }

      const script = document.createElement('script');
      script.async = true;
      script.defer = true;
      script.setAttribute('data-gmaps', '1');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.onload = () => {
        // ensure google object is attached; poll briefly if needed
        const start = Date.now();
        const poll = () => {
          if ((window as any).google) return resolve();
          if (Date.now() - start > 10000) return reject(new Error('Google Maps did not initialize in time'));
          setTimeout(poll, 200);
        };
        poll();
      };
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  /**
   * Center the interactive map on the pharmacy address.
   * Uses the cached geocoded `pharmacyCoords` if available, otherwise attempts
   * to geocode the configured `pharmacyAddress`. Falls back to hardcoded coords.
   */
  async centerOnPharmacy(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !(window as any).google || !this.map) return;
    const google = (window as any).google;
    const fallback = { lat: LOJA_MAPA_LAT, lng: LOJA_MAPA_LNG };
    try {
      let coords = this.pharmacyCoords;
      if (!coords && this.pharmacyAddress) {
        try {
          const geocoder = new google.maps.Geocoder();
          const results = await this.geocodeAddress(geocoder, this.pharmacyAddress);
          if (results && results[0] && results[0].geometry && results[0].geometry.location) {
            const loc = results[0].geometry.location;
            coords = { lat: loc.lat(), lng: loc.lng() };
            this.pharmacyCoords = coords;
          }
        } catch (e) {
          // geocode failed; we'll fallback below
          console.warn('Geocode for pharmacy failed', e);
        }
      }

      const center = coords ?? fallback;
      try { this.map.setCenter(center); } catch (e) { console.warn('map.setCenter failed', e); }
      try { this.map.setZoom(Math.max(this.map.getZoom ? this.map.getZoom() : 15, 15)); } catch (e) {}
      this.nudgeMapForMobileChrome();
    } catch (e) {
      console.warn('centerOnPharmacy unexpected error', e);
    }
  }

  /**
   * Center the map on a partner and open its info window.
   * If a marker with a matching partner id exists, trigger its click handler.
   */
  async centerOnPartner(partner: any, options?: { scrollPage?: boolean }): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !(window as any).google || !this.map) return;
    const shouldScrollPage = options?.scrollPage ?? true;
    try {
      await this.waitForMapReady(5000).catch(() => {});
      const google = (window as any).google;
      const lat = partner.latitude ?? partner.lat ?? partner._raw?.latitude ?? null;
      const lng = partner.longitude ?? partner.lng ?? partner._raw?.longitude ?? null;
      const partnerId = partner.anuncio_id ?? partner.id ?? partner._raw?.id ?? null;

      // try to find marker by attached partner id
      let marker: any = null;
      if (partnerId != null) {
        marker = this.markers.find(m => m && (m as any).__partnerId != null && String((m as any).__partnerId) === String(partnerId));
      }

      // fallback: match by coordinates (within tiny tolerance)
      if (!marker && lat != null && lng != null) {
        const latN = Number(lat);
        const lngN = Number(lng);
        const eps = 1e-6;
        marker = this.markers.find(m => {
          try {
            const pos = (m as any).getPosition && (m as any).getPosition();
            if (!pos) return false;
            const plat = pos.lat(); const plng = pos.lng();
            return Math.abs(plat - latN) < eps && Math.abs(plng - lngN) < eps;
          } catch (e) { return false; }
        });
      }

      // If marker found, pan to it and trigger click to open info window
      if (marker) {
        try { this.map.panTo(marker.getPosition()); } catch (e) { /* ignore */ }
        try { if (this.map.setZoom) this.map.setZoom(Math.max(this.map.getZoom ? this.map.getZoom() : 15, 15)); } catch (e) {}
        try { google.maps.event.trigger(marker, 'click'); } catch (e) { /* ignore */ }
        // full-screen mobile map: map is always in view; avoid scrolling the page
        if (shouldScrollPage && !this.isMobileMapLayout) {
          try {
            const wrap = document.getElementById('gmap');
            if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (e) {}
        }
        return;
      }

      // final fallback: if we have coords, center the map on them
      if (lat != null && lng != null) {
        try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
        this.nudgeMapForMobileChrome();
      }
    } catch (e) {
      console.warn('centerOnPartner failed', e);
    }
  }

  private capturePartnerFromRoute(): void {
    try {
      const slug = String(this.route.snapshot.paramMap.get('slug') || '').trim().toLowerCase();
      const tenantSlug = String(this.tenantLoja.lojaSlug() || '').trim().toLowerCase();
      this.requestedPartnerSlug = slug || tenantSlug || null;
      const queryParceiro = String(this.route.snapshot.queryParamMap.get('parceiro') || '').trim();
      const queryParceiroId = Number(queryParceiro);
      const tenantParceiroId = this.tenantLoja.parceiroId();
      this.requestedPartnerId = Number.isFinite(queryParceiroId) && queryParceiroId > 0
        ? queryParceiroId
        : (tenantParceiroId != null ? Number(tenantParceiroId) : null);
    } catch (e) {
      this.requestedPartnerSlug = null;
      this.requestedPartnerId = null;
    }
  }

  private resolveRequestedPartnerIdFromLoadedPartners(): void {
    if (this.requestedPartnerId == null) {
      const tenantId = this.tenantLoja.parceiroId();
      if (tenantId != null) this.requestedPartnerId = Number(tenantId);
    }
    if (!this.requestedPartnerSlug) {
      const tenantSlug = String(this.tenantLoja.lojaSlug() || '').trim().toLowerCase();
      if (tenantSlug) this.requestedPartnerSlug = tenantSlug;
    }
    if (this.requestedPartnerId != null || !this.requestedPartnerSlug) return;
    const wanted = this.requestedPartnerSlug;
    const direct = (this.allPartners || []).find((p) => {
      const cand = String(
        p?.loja_slug ??
        p?._raw?.loja_slug ??
        p?.slug ??
        p?._raw?.slug ??
        ''
      ).trim().toLowerCase();
      return !!cand && cand === wanted;
    });
    if (direct?.id != null) {
      this.requestedPartnerId = Number(direct.id);
    }
  }

  private async maybeCenterRequestedPartner(): Promise<void> {
    if (this.requestedPartnerId == null && !this.requestedPartnerSlug) return;
    let target: any | null = null;

    if (this.requestedPartnerId != null) {
      target = (this.allPartners || []).find((p) => Number(p.id) === Number(this.requestedPartnerId)) || null;
    }

    if (!target && this.requestedPartnerSlug) {
      try {
        const parceiro = await firstValueFrom(this.api.getParceiroPorSlugPublico(this.requestedPartnerSlug));
        const pid = Number(parceiro?.id);
        if (Number.isFinite(pid) && pid > 0) {
          this.requestedPartnerId = pid;
          target = (this.allPartners || []).find((p) => Number(p.id) === pid) || null;
        }
      } catch (e) {
        // slug inválido/inexistente: segue fluxo normal do mapa
      }
    }

    if (!target) return;

    try {
      await this.centerOnPartner(target, { scrollPage: false });
      if (this.isMobileMapLayout) {
        this.resultsAccordionOpen = true;
      }
    } catch (e) {
      console.warn('maybeCenterRequestedPartner failed', e);
    }
  }

  /**
   * Attach a styled info window to the pharmacy marker.
   * Shows the configured pharmacy address and quick actions to get directions or open in Google Maps.
   */
  private attachPharmacyInfo(marker: any, coords: { lat: number; lng: number }, openImmediately = false) {
    if (!(window as any).google) return;
    const google = (window as any).google;

    const address = this.pharmacyAddress || this.defaultCenterAddress || '';
    const lat = coords?.lat ?? (coords as any)?.lat ?? 0;
    const lng = coords?.lng ?? (coords as any)?.lng ?? 0;
    const dest = encodeURIComponent(`${lat},${lng}`);

    const content = `
      <div style="max-width:320px;font-family:Inter,Arial,Helvetica,sans-serif;color:#0f172a;padding:12px;box-sizing:border-box;border-radius:10px;position:relative;overflow:visible">
        <!-- floating close button (visually overflows the card) -->
        <button id="map-close-btn" aria-label="Fechar" style="position:absolute;top:-20px;right:-20px;width:40px;height:40px;border-radius:50%;background:#111827;color:#fff;border:0;box-shadow:0 10px 28px rgba(0,0,0,.32);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0">✕</button>
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
          <img src=\"${this.pinLojaUrl}\" style=\"width:36px;height:44px;object-fit:contain;border-radius:4px\"/>
          <div style="flex:1">
            <div style=\"font-family:'Pacifico',cursive,'Montserrat',Arial,sans-serif;font-weight:700;font-size:16px;color:#0f172a\">${MARCA_NOME}</div>
            <div style=\"font-size:13px;color:#374151;margin-top:4px;line-height:1.2\">${address}</div>
          </div>
        </div>
        <div style=\"display:flex;gap:8px;margin-top:10px\">
          <button id=\"map-route-btn\" style=\"flex:1;border:0;background:#0f172a;color:#fff;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer\">Traçar rota</button>
          <button id=\"map-open-btn\" style=\"flex:1;border:1px solid #e5e7eb;background:#fff;color:#0f172a;padding:8px 10px;border-radius:8px;font-weight:600;cursor:pointer\">Abrir no Maps</button>
        </div>
      </div>
    `;

    const iw = new google.maps.InfoWindow({ content, maxWidth: 360 });

    marker.addListener('click', () => {
      try { if (this.currentInfoWindow) this.currentInfoWindow.close(); } catch {}
      try { this.map.panTo({ lat: Number(lat), lng: Number(lng) }); } catch (e) {}
      this.nudgeMapForMobileChrome();
      iw.open(this.map, marker);
      this.currentInfoWindow = iw;
      try {
        google.maps.event.addListenerOnce(iw, 'domready', () => {
          try {
            if (!document.querySelector('style[data-gm-style-iw]')) {
              const st = document.createElement('style');
              st.setAttribute('data-gm-style-iw', '1');
              st.innerHTML = `
                /* allow content to overflow so floating close button is visible */
                .gm-style .gm-style-iw { overflow: visible !important; }
                .gm-style .gm-style-iw > div { overflow: visible !important; }
                /* hide Google Maps built-in infoWindow close button (duplicate) */
                .gm-style .gm-style-iw-chr > button.gm-ui-hover-effect { display: none !important; }
                .gm-style .gm-ui-hover-effect[aria-label='Fechar'] { display: none !important; }
              `;
              document.head.appendChild(st);
            }

            const routeBtn = document.getElementById('map-route-btn');
            const openBtn = document.getElementById('map-open-btn');
            const closeBtn = document.getElementById('map-close-btn');
            if (routeBtn) {
              routeBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const destObj = { lat: Number(lat), lng: Number(lng) };
                this.drawRoute(destObj);
                try { iw.close(); } catch {}
              });
            }
            if (openBtn) {
              openBtn.addEventListener('click', async (ev) => {
                ev.preventDefault();
                await this.openMapsWithRoute({ lat: Number(lat), lng: Number(lng) });
              });
            }
            if (closeBtn) {
              try { (closeBtn as HTMLElement).style.position = 'absolute'; (closeBtn as HTMLElement).style.top = '-20px'; (closeBtn as HTMLElement).style.right = '-20px'; (closeBtn as HTMLElement).style.zIndex = '99999'; } catch (e) {}
              closeBtn.addEventListener('click', (ev) => { ev.preventDefault(); try { iw.close(); } catch {} });
            }
          } catch (e) { console.warn('infoWindow domready handler failed', e); }
        });
      } catch (e) {}
    });

    if (openImmediately) {
      try { if (this.currentInfoWindow) this.currentInfoWindow.close(); } catch {}
      iw.open(this.map, marker);
      this.currentInfoWindow = iw;
    }
  }

  private async drawRoute(dest: { lat: number; lng: number }) {
    if (!(window as any).google || !this.map) return;
    const google = (window as any).google;
    // Ensure directions services are available
    if (!this.directionsService || !this.directionsRenderer) {
      try {
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: false });
        this.directionsRenderer.setMap(this.map);
      } catch (e) {
        console.warn('DirectionsService not available', e);
        return;
      }
    }

    // Origem: só lê o GPS com consentimento no mapa (LGPD); senão, centro do mapa
    let origin: any = null;
    if (this.mapLocationConsent.getConsent() === true) {
      try {
        origin = await this.getUserPosition({ maxAge: 120000, timeout: 12000 });
      } catch (e) {
        try { const c = this.map.getCenter(); origin = { lat: c.lat(), lng: c.lng() }; } catch { origin = null; }
      }
    } else {
      try { const c = this.map.getCenter(); origin = { lat: c.lat(), lng: c.lng() }; } catch { origin = null; }
    }

    if (!origin) {
      console.warn('No origin available for routing');
      return;
    }

    const request = {
      origin,
      destination: { lat: Number(dest.lat), lng: Number(dest.lng) },
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date() }
    };

    try {
      this.directionsService.route(request, (result: any, status: any) => {
        if (status === 'OK' && result) {
          try { this.directionsRenderer.setDirections(result); } catch (e) { console.warn('setDirections failed', e); }
          try {
            // fit map to route bounds
            const route = result.routes && result.routes[0];
            if (route && route.bounds) {
              if (this.isMobileMapLayout) {
                this.map.fitBounds(route.bounds, { top: 48, right: 20, bottom: 100, left: 20 });
              } else {
                this.map.fitBounds(route.bounds, 48);
              }
            }
          } catch (e) {}

          // create/update a single origin marker (user) while keeping pharmacy marker intact
          try {
            if (this.originMarker) {
              try { this.originMarker.setMap(null); } catch (e) {}
              this.originMarker = null;
            }
            const google = (window as any).google;
            const originIcon = {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#c4d600',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            };
            this.originMarker = new google.maps.Marker({ position: origin, map: this.map, title: 'Você', icon: originIcon, zIndex: 9999 });
          } catch (e) {
            console.warn('failed to create origin marker', e);
          }

        } else {
          console.warn('Directions request failed:', status);
        }
      });
    } catch (e) { console.warn('route request failed', e); }
  }

  /**
   * Clear any drawn route and remove origin marker and stored last-destination.
   */
  public clearRoute() {
    try {
      if (this.directionsRenderer) {
        try { (this.directionsRenderer as any).set('directions', null); } catch (e) { /* fallback attempt */ try { this.directionsRenderer.setDirections({ routes: [] } as any); } catch (er) {} }
      }
    } catch (e) { console.warn('clearRoute: clearing directions failed', e); }
    try { if (this.originMarker) { try { this.originMarker.setMap(null); } catch (e) {} this.originMarker = null; } } catch (e) {}
  }

  private async openMapsWithRoute(dest: { lat: number; lng: number }) {
    const destStr = `${dest.lat},${dest.lng}`;
    if (this.mapLocationConsent.getConsent() !== true) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}`;
      window.open(url, '_blank');
      return;
    }
    try {
      const pos = await this.getUserPosition({ maxAge: 120000, timeout: 10000 });
      const originStr = `${pos.lat},${pos.lng}`;
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destStr)}`;
      window.open(url, '_blank');
    } catch (e) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destStr)}`;
      window.open(url, '_blank');
    }
  }
}
