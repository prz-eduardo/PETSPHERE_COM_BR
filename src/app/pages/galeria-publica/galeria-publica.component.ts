import { Component, AfterViewInit, OnDestroy, OnInit, ViewChild, ElementRef, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Router, RouterModule } from '@angular/router';
import { ApiService, ClienteGaleriaFoto } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { PetLightboxComponent, PetLightboxReaction } from './pet-lightbox/pet-lightbox.component';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { GaleriaPostFotoModalComponent } from './galeria-post-foto-modal/galeria-post-foto-modal.component';
import { MARCA_NOME } from '../../constants/loja-public';
import { ClienteAreaModalService } from '../../services/cliente-area-modal.service';
import { TenantLojaService } from '../../services/tenant-loja.service';

@Component({
  selector: 'app-galeria-publica',
  standalone: true,
  imports: [CommonModule, RouterModule, PetLightboxComponent, BannerSlotComponent, GaleriaPostFotoModalComponent],
  templateUrl: './galeria-publica.component.html',
  styleUrls: ['./galeria-publica.component.scss']
})
export class GaleriaPublicaComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly marcaNome = MARCA_NOME;
  pets: any[] = [];
  // client-side UID counter for rendered cards to guarantee uniqueness per instance
  private _uidCounter = 1;
  loading = true; // initial load
  error: string | null = null;

  // pagination / infinite scroll
  page = 1;
  pageSize = 20;
  loadingMore = false;
  hasMore = true;

  private observer?: IntersectionObserver;
  @ViewChild('sentinel', { static: false }) sentinel?: ElementRef;
  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private clienteAreaModal: ClienteAreaModalService,
    private tenantLoja: TenantLojaService
  ) {}
  /** True quando o feed retornou vazio na página 1 (estado vazio da galeria). */
  isEmptyFeed = false;

  // Lightbox: currently-open pet reference (or null). We keep a direct reference so
  // mutations made inside the lightbox (reaction/comment totals) reflect in the card.
  lightboxPet: any = null;
  isMobileFeedOpen = false;
  private readonly mobileFeedBreakpoint = 860;

  /** CTA: acordeão (fechado = só título + chevron). */
  ctaAccordionOpen = false;
  postFotoModalOpen = false;
  ctaClientePets: any[] = [];
  ctaClienteFotos: ClienteGaleriaFoto[] = [];
  ctaContextLoading = false;
  private ctaClienteId: number | null = null;
  private ctaSubscriptions = new Subscription();

  // available reaction types (emoji + tipo)
  reactionTypes = [
    { tipo: 'love', emoji: '❤️' },
    { tipo: 'haha', emoji: '😂' },
    { tipo: 'sad', emoji: '😢' },
    { tipo: 'angry', emoji: '😡' }
  ];

  // throttle for showing the login toast when unauthenticated
  private _lastLoginToastAt: number | null = null;
  private _loginToastCooldown = 1500; // ms

  private _maybeShowLoginToast() {
    try {
      const now = Date.now();
      if (this._lastLoginToastAt && (now - this._lastLoginToastAt) < this._loginToastCooldown) return;
      this._lastLoginToastAt = now;
      try { this.toast.info('Faça login para reagir às fotos.'); } catch (e) {}
    } catch (e) {}
  }

  // template-friendly lookup for an emoji by tipo
  getReactionEmoji(tipo: string) {
    const r = this.reactionTypes.find(x => x.tipo === tipo);
    return r ? r.emoji : '❤️';
  }

  getTotalReactions(): number {
    try {
      return (this.pets || []).reduce((acc: number, p: any) => acc + Number(p?.likes ?? 0), 0);
    } catch (e) { return 0; }
  }

  /** Número de pets distintos representados no feed atual (não confundir com cards). */
  getDistinctPetsCount(): number {
    try {
      const ids = new Set<string>();
      for (const item of this.pets || []) {
        const raw = item?.pet_id ?? item?.petId ?? item?.id;
        if (raw === null || raw === undefined || raw === '') continue;
        ids.add(String(raw));
      }
      return ids.size;
    } catch (e) { return 0; }
  }

  getGaleriaShareUrl(): string {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return '';
    return `${window.location.origin}/galeria`;
  }

  getGaleriaShareText(): string {
    return `Galeria da comunidade ${MARCA_NOME} — veja os pets e reaja!`;
  }

  getGaleriaFullShareMessage(): string {
    const u = this.getGaleriaShareUrl();
    return u ? `${this.getGaleriaShareText()}\n${u}` : this.getGaleriaShareText();
  }

  toggleCtaAccordion(): void {
    this.ctaAccordionOpen = !this.ctaAccordionOpen;
    if (this.ctaAccordionOpen) {
      this.loadClienteCtaContext();
    }
  }

  openClienteAreaView(view: 'meus-pets' | 'novo-pet' | 'postar-foto'): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.clienteAreaModal.open(view);
  }

  openClientePet(pet: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const petId = pet?.id;
    if (petId === null || petId === undefined || petId === '') {
      this.openClienteAreaView('meus-pets');
      return;
    }
    this.clienteAreaModal.openPetEditor(petId);
  }

  hasClienteAuth(): boolean {
    return !!this.auth.getToken();
  }

  getCtaPetHint(): string {
    if (!this.hasClienteAuth()) return 'Entre na sua conta e use o + para cadastrar seu primeiro pet.';
    if (!this.ctaClientePets.length) return 'Nenhum pet cadastrado ainda. Use o + para adicionar.';
    return 'Seus pets aparecem aqui. Use o + para cadastrar outro.';
  }

  getCtaFotoHint(): string {
    if (!this.hasClienteAuth()) return 'Entre na sua conta e use o + para postar sua primeira foto.';
    if (!this.ctaClienteFotos.length) return 'Nenhuma foto postada ainda. Use o + para publicar a primeira.';
    return 'Suas ultimas fotos aparecem aqui. Use o + para postar outra.';
  }

  resolveClientePetAvatar(pet: any): string | null {
    try {
      const raw = String(pet?.photoURL || pet?.foto || pet?.photo || pet?.photo_url || '').trim();
      return raw ? this.normalizeImgUrl(raw) : null;
    } catch {
      return null;
    }
  }

  clientePetInitials(nome?: string): string {
    const base = String(nome || 'Pet').trim();
    if (!base) return 'P';
    const parts = base.split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('')) || 'P';
  }

  resolveClienteFotoThumb(foto: ClienteGaleriaFoto | null | undefined): string {
    const raw = String(foto?.url || '').trim();
    return raw ? this.normalizeImgUrl(raw) : '/imagens/image.png';
  }

  openPostFotoModal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.auth.getToken()) {
      this.toast.info('Faça login para postar uma foto na galeria.');
      this.router.navigateByUrl('/restrito/login');
      return;
    }
    this.postFotoModalOpen = true;
  }

  onPostFotoModalClose(): void {
    this.postFotoModalOpen = false;
  }

  onPostFotoSuccess(): void {
    this.postFotoModalOpen = false;
    this.loadClienteGaleriaFotos(true);
    this.refreshGaleriaFeed();
  }

  private refreshGaleriaFeed(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.page = 1;
    this.hasMore = true;
    this.isEmptyFeed = false;
    this.pets = [];
    this._uidCounter = 1;
    this.loadPage(1);
  }

  async copyGaleriaLink(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const text = this.getGaleriaFullShareMessage();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* empty */ }
        document.body.removeChild(ta);
      }
      this.toast.success('Link copiado');
    } catch {
      this.toast.info('Não foi possível copiar o link');
    }
  }

  openWhatsAppShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const msg = this.getGaleriaFullShareMessage();
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openFacebookShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const u = this.getGaleriaShareUrl();
    if (!u) return;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async shareGaleria(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const title = `Galeria ${MARCA_NOME}`;
    const text = this.getGaleriaShareText();
    const url = this.getGaleriaShareUrl();
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      try {
        await nav.share({ title, text, url });
        return;
      } catch (e: unknown) {
        const name = e && typeof e === 'object' && 'name' in e ? (e as { name?: string }).name : '';
        if (name === 'AbortError') return;
      }
    }
    await this.copyGaleriaLink();
  }

  ngOnInit(): void {
    // only perform fetches in the browser; avoids SSR Node fetch with relative URL
    if (isPlatformBrowser(this.platformId)) {
      this.updateResponsiveViewState();
      // reset uid counter on fresh client render
      this._uidCounter = 1;
      this.loadPage(1);
      this.ctaSubscriptions.add(this.auth.isLoggedIn$.subscribe((loggedIn) => {
        if (!loggedIn || !this.auth.getToken()) {
          this.resetClienteCtaContext();
          return;
        }
        if (this.ctaAccordionOpen) {
          this.loadClienteCtaContext(true);
        }
      }));
      this.ctaSubscriptions.add(this.clienteAreaModal.petsChanged$.subscribe(() => {
        this.loadClientePets(true);
      }));
      this.ctaSubscriptions.add(this.clienteAreaModal.galeriaFotosChanged$.subscribe(() => {
        this.loadClienteGaleriaFotos(true);
      }));
    } else {
      // on server render, skip fetching and let client load after hydration
      this.loading = false;
    }
  }

  ngAfterViewInit(): void {
    // Only run IntersectionObserver in the browser and when the API exists.
    try {
      if (!isPlatformBrowser(this.platformId) || typeof (IntersectionObserver) === 'undefined') {
        // not in a browser or IntersectionObserver not supported
        return;
      }
      // setup IntersectionObserver to load next page
      this.observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting && this.hasMore && !this.loadingMore && !this.loading) {
            this.loadNext();
          }
        }
      }, { rootMargin: '200px' });
      // observe later when view child appears
      setTimeout(() => {
        if (this.sentinel && this.sentinel.nativeElement && this.observer) {
          this.observer.observe(this.sentinel.nativeElement);
        }
      }, 200);
    } catch (e) {
      // IntersectionObserver might not be available in some browsers/environments
      console.warn('IntersectionObserver not available', e);
    }
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    this.ctaSubscriptions.unsubscribe();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateResponsiveViewState();
  }

  private updateResponsiveViewState(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.isMobileFeedOpen = window.innerWidth <= this.mobileFeedBreakpoint;
      if (this.isMobileFeedOpen && this.lightboxPet) {
        this.lightboxPet = null;
      }
    } catch {
      this.isMobileFeedOpen = false;
    }
  }

  private resetClienteCtaContext(): void {
    this.ctaClienteId = null;
    this.ctaClientePets = [];
    this.ctaClienteFotos = [];
    this.ctaContextLoading = false;
  }

  private async resolveClienteIdForCta(token: string, force = false): Promise<number | null> {
    if (!force && this.ctaClienteId) return this.ctaClienteId;
    const me: any = await this.api.getClienteMe(token).toPromise();
    const id = Number(me?.user?.id ?? me?.id ?? 0);
    this.ctaClienteId = !isNaN(id) && id > 0 ? id : null;
    return this.ctaClienteId;
  }

  private async loadClienteCtaContext(force = false): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.auth.getToken();
    if (!token) {
      this.resetClienteCtaContext();
      return;
    }
    if (this.ctaContextLoading) return;
    this.ctaContextLoading = true;
    try {
      const clienteId = await this.resolveClienteIdForCta(token, force);
      const [pets, fotos] = await Promise.all([
        clienteId ? this.api.getPetsByCliente(clienteId, token).toPromise() : Promise.resolve([]),
        this.api.getMinhaGaleriaFotos(token).toPromise(),
      ]);
      this.ctaClientePets = Array.isArray(pets) ? pets : [];
      this.ctaClienteFotos = Array.isArray(fotos) ? fotos : [];
    } catch (e) {
      console.warn('Falha ao carregar CTA da galeria', e);
    } finally {
      this.ctaContextLoading = false;
    }
  }

  private async loadClientePets(force = false): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      this.ctaClientePets = [];
      this.ctaClienteId = null;
      return;
    }
    try {
      const clienteId = await this.resolveClienteIdForCta(token, force);
      if (!clienteId) {
        this.ctaClientePets = [];
        return;
      }
      const pets = await this.api.getPetsByCliente(clienteId, token).toPromise();
      this.ctaClientePets = Array.isArray(pets) ? pets : [];
    } catch (e) {
      console.warn('Falha ao recarregar pets da CTA', e);
    }
  }

  private async loadClienteGaleriaFotos(force = false): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      this.ctaClienteFotos = [];
      return;
    }
    try {
      if (force && !this.ctaClienteId) {
        await this.resolveClienteIdForCta(token, true);
      }
      const fotos = await this.api.getMinhaGaleriaFotos(token).toPromise();
      this.ctaClienteFotos = Array.isArray(fotos) ? fotos : [];
    } catch (e) {
      console.warn('Falha ao recarregar fotos da CTA', e);
    }
  }

  /** Chave estável do item do feed (foto, coleção ou anúncio) */
  private _feedItemKey(p: any): string {
    if (!p) return '';
    if (p.type === 'vet_ad') return `ad-${p.vet_id || ''}-${p.nome || ''}`;
    return String(p.feed_key ?? p.id ?? p._uid ?? '');
  }

  async selectReaction(pet: any, tipo: string) {
    const token = this.auth.getToken();
    if (!token) {
      this._maybeShowLoginToast();
      return;
    }
    if (pet?.kind === 'photo' || pet?.kind === 'collection') {
      return;
    }

    // If user already reacted with same tipo, remove it
    const prevTipo = pet.userReactionTipo ?? null;
    const alreadySame = prevTipo === tipo;

  // ensure reactionTotals exists
    pet.reactionTotals = pet.reactionTotals || { love: 0, haha: 0, sad: 0, angry: 0 };
    try {
      if (alreadySame) {
        // optimistic removal
        pet.userReactionTipo = null;
        pet.userReacted = false;
        pet.reactionTotals[tipo] = Math.max(0, Number(pet.reactionTotals[tipo] ?? 0) - 1);
        pet.likes = Math.max(0, Number(pet.likes ?? 0) - 1);
        // send delete and prefer server response to reconcile counts
        const res: any = await this.api.deletePetReaction(pet.id, { tipo }, token).toPromise();
        try {
          if (res && typeof res === 'object') {
            pet.likes = Number(res.total_reacoes_geral ?? res.total_reacoes ?? pet.likes ?? 0);
            pet.reactionTotals = {
              love: Number(res.total_reacao_love ?? res.total_reacoes_love ?? pet.reactionTotals?.love ?? 0),
              haha: Number(res.total_reacao_haha ?? res.total_reacoes_haha ?? pet.reactionTotals?.haha ?? 0),
              sad: Number(res.total_reacao_sad ?? res.total_reacoes_sad ?? pet.reactionTotals?.sad ?? 0),
              angry: Number(res.total_reacao_angry ?? res.total_reacoes_angry ?? pet.reactionTotals?.angry ?? 0)
            };
          }
        } catch (e) { /* ignore server parse errors and keep optimistic state */ }
        try {
          pet._visualActive = false;
        } catch (e) {}
        try {
          delete pet._autoFlowPending;
        } catch (e) {}
      } else {
        // optimistic change/add
        if (prevTipo) {
          // switching reaction: move counts
          pet.reactionTotals[prevTipo] = Math.max(0, Number(pet.reactionTotals[prevTipo] ?? 0) - 1);
        }
        const wasReactedBefore = !!prevTipo;
        pet.reactionTotals[tipo] = (Number(pet.reactionTotals[tipo] ?? 0) + 1);
        // if user had no previous reaction, increment overall likes
        if (!wasReactedBefore) pet.likes = Number(pet.likes ?? 0) + 1;
        pet.userReactionTipo = tipo;
        pet.userReacted = true;
        // send post and reconcile with server response when possible
        const res: any = await this.api.postPetReaction(pet.id, { tipo }, token).toPromise();
        try {
          if (res && typeof res === 'object') {
            // server may return the tipo, totals and overall
            pet.userReactionTipo = res.tipo ?? tipo;
            pet.userReacted = !!(res.minha_reacao || pet.userReactionTipo);
            pet.likes = Number(res.total_reacoes_geral ?? res.total_reacoes ?? pet.likes ?? 0);
            pet.reactionTotals = {
              love: Number(res.total_reacao_love ?? res.total_reacoes_love ?? pet.reactionTotals?.love ?? 0),
              haha: Number(res.total_reacao_haha ?? res.total_reacoes_haha ?? pet.reactionTotals?.haha ?? 0),
              sad: Number(res.total_reacao_sad ?? res.total_reacoes_sad ?? pet.reactionTotals?.sad ?? 0),
              angry: Number(res.total_reacao_angry ?? res.total_reacoes_angry ?? pet.reactionTotals?.angry ?? 0)
            };
          }
        } catch (e) { /* ignore server parse errors */ }
        try {
          pet._visualActive = true;
        } catch (e) {}
        try {
          delete pet._autoFlowPending;
        } catch (e) {}
      }
    } catch (err) {
      console.error('Erro ao enviar reação', err);
      this.toast.error('Não foi possível enviar sua reação.');
      // rollback naive: if we removed, restore; if we added, revert
      if (alreadySame) {
        // we attempted to remove but failed -> restore
        pet.userReactionTipo = prevTipo;
        pet.userReacted = !!prevTipo;
        pet.reactionTotals[tipo] = Number(pet.reactionTotals[tipo] ?? 0) + 1;
        pet.likes = Number(pet.likes ?? 0) + 1;
        try { pet._visualActive = !!prevTipo; } catch (e) {}
      } else {
        // we attempted to add/switch but failed -> revert changes
        if (prevTipo) {
          pet.reactionTotals[prevTipo] = Number(pet.reactionTotals[prevTipo] ?? 0) + 1;
        }
        pet.reactionTotals[tipo] = Math.max(0, Number(pet.reactionTotals[tipo] ?? 1) - 1);
        if (!prevTipo) pet.likes = Math.max(0, Number(pet.likes ?? 1) - 1);
        pet.userReactionTipo = prevTipo;
        pet.userReacted = !!prevTipo;
        try { pet._visualActive = !!prevTipo; } catch (e) {}
      }
    }
  }

  /** Emoji da espécie (igual ao lightbox), para o mini card na grelha */
  typeEmoji(tipo?: string) {
    if (!tipo) return '🐾';
    const t = (tipo || '').toLowerCase();
    if (t.includes('cach') || t.includes('dog') || t.includes('cao') || t.includes('cão')) return '🐶';
    if (t.includes('gat') || t.includes('cat')) return '🐱';
    if (t.includes('ave') || t.includes('bird') || t.includes('pássar') || t.includes('passar')) return '🐦';
    return '🐾';
  }

  // Safe image error handler used from templates. Accepts the event target or element
  // and sets a fallback src only if the element exists and isn't already the fallback
  onImgError(target: any, fallback: string) {
    try {
      const el = target as HTMLImageElement | null;
      if (!el) return;
      if (!el.src || el.src.indexOf(fallback) !== -1) return;
      el.src = fallback;
    } catch (e) {
      // swallow errors — failing to set fallback shouldn't break UI
    }
  }

  // Called when an <img> load event fires. We keep a small flag on the pet
  // in case callers want to animate/mark loaded images. Also useful for debug.
  onImgLoad(ev: Event, pet?: any) {
    try {
      if (pet) pet._imgLoaded = true;
    } catch (e) {}
  }

  getGalleryUrls(p: any): string[] {
    try {
      if (!p || p.type === 'vet_ad') return [];
      if (p.kind === 'photo') {
        const u = (Array.isArray(p.galeria_urls) && p.galeria_urls[0]) || p.foto || p.photo || '';
        const s = typeof u === 'string' ? u.trim() : '';
        return s ? [s] : [];
      }
      const out: string[] = [];
      const direct = p.galeria_urls;
      if (Array.isArray(direct) && direct.length) {
        out.push(...direct.map((u: string) => String(u).trim()).filter(Boolean));
      } else {
        const fotos = p.fotos;
        if (Array.isArray(fotos) && fotos.length) {
          out.push(...fotos.map((x: any) => (typeof x === 'string' ? x : x?.url)).filter(Boolean));
        }
      }
      const main = p.foto || p.photo || p.photoURL || p.url || '';
      const s = typeof main === 'string' ? main.trim() : '';
      if (s && !out.some((u) => u.toLowerCase() === s.toLowerCase())) {
        out.unshift(s);
      }
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const u of out) {
        const k = u.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          deduped.push(u);
        }
      }
      return deduped;
    } catch {
      return [];
    }
  }

  private normalizeImgUrl(raw: string): string {
    return this.api.resolveMediaUrl(raw);
  }

  // Normalize/validate image URLs returned by the API. This helps with
  // protocol-relative URLs (//host/path) and occasional missing-protocol
  // strings that fail to load when navigating client-side.
  resolveImage(p: any) {
    try {
      if (p?.type === 'vet_ad') {
        const raw = p.foto || p.photo || p.photoURL || p.url || '';
        const s = typeof raw === 'string' ? raw.trim() : '';
        if (!s) return '/imagens/image.png';
        return this.normalizeImgUrl(s);
      }
      const urls = this.getGalleryUrls(p);
      const idx = Math.min(Math.max(0, p._galIdx || 0), Math.max(0, urls.length - 1));
      const raw = urls[idx] || urls[0] || '';
      if (!raw) return '/imagens/image.png';
      return this.normalizeImgUrl(raw);
    } catch (e) {
      return '/imagens/image.png';
    }
  }

  // --- Lightbox control ---
  openLightbox(pet: any) {
    if (!pet) return;
    this.lightboxPet = pet;
  }

  closeLightbox() {
    this.lightboxPet = null;
  }

  // Lightbox emits reaction selections: reuse the existing selectReaction to keep
  // optimistic UI, auth checks and server reconciliation in one place.
  onLightboxReaction(ev: PetLightboxReaction) {
    if (!this.lightboxPet || !ev?.tipo) return;
    try { this.selectReaction(this.lightboxPet, ev.tipo); } catch (e) {}
  }

  onInlineLightboxReaction(pet: any, ev: PetLightboxReaction) {
    if (!pet || !ev?.tipo) return;
    try { this.selectReaction(pet, ev.tipo); } catch (e) {}
  }

  private async loadPage(pageNum: number) {
    if (pageNum === 1) {
      this.loading = true;
      this.error = null;
    } else {
      this.loadingMore = true;
    }
    try {
      await this.tenantLoja.ensureHostResolved();
      // use ApiService so baseUrl and headers are handled consistently
      // pass JWT when available so the gallery can return auth-aware data
      const token = this.auth.getToken() ?? undefined;
      const slug = this.tenantLoja.lojaSlug();
      const data = await this.api
        .getGaleriaPublica({ page: pageNum, pageSize: this.pageSize, ...(slug ? { parceiro_slug: slug } : {}) }, token)
        .toPromise();
      // support API returning { data: [], page, totalPages } or plain array
      const items = Array.isArray(data) ? data : (data?.data || []);
      // normalize items: ensure likes and userReacted fields exist
      const normalized = (items || []).map((it: any, idx: number) => ({
        ...it,
        // assign a client-unique uid to each rendered card so duplicate server ids don't collide
        _uid: `g-${Date.now()}-${this._uidCounter++}`,
        // normalize reaction fields
        // Prefer explicit aggregated totals from API when available (total_reacoes_geral),
        // otherwise fall back to legacy fields like reacoes_count or likes.
        likes: Number(it.total_reacoes_geral ?? it.total_reacoes ?? it.reacoes_count ?? it.likes ?? 0),
        // minha_reacao may be null or an object { tipo }
        userReactionTipo: it.minha_reacao?.tipo ?? (it.userReactionTipo ?? it.user_reaction_tipo ?? null),
  userReacted: !!(it.minha_reacao || it.liked || it.liked === true || it.userReacted || it.user_reacted || false),
  // visual highlight for the heart should reflect confirmed server state.
  // Initialize visual-only flag from server-provided reaction. Optimistic
  // client changes should NOT flip this flag until the server confirms.
  _visualActive: !!(it.minha_reacao || it.liked || it.liked === true || it.userReacted || it.user_reacted || false),
        // detailed reaction totals (coerce strings to numbers). Also accept alternate field names.
        reactionTotals: {
          love: Number(it.total_reacao_love ?? it.total_reacoes_love ?? 0),
          haha: Number(it.total_reacao_haha ?? it.total_reacoes_haha ?? 0),
          sad: Number(it.total_reacao_sad ?? it.total_reacoes_sad ?? 0),
          angry: Number(it.total_reacao_angry ?? it.total_reacoes_angry ?? 0)
        },
        // Pet extras (used by the enriched card and lightbox)
        sexo: it.sexo ?? null,
        pesoKg: it.pesoKg ?? it.peso_kg ?? null,
        observacoes: it.observacoes ?? null,
        tutor_nome: it.tutor_nome ?? null,
        tutor_foto: it.tutor_foto ?? null,
        total_comentarios: Number(it.total_comentarios ?? it.comentarios_count ?? 0),
        _galIdx: 0,
        // size removed: visual sizing now handled by CSS and original image dimensions
      }));

      // When appending pages, avoid exact duplicate ids and distribute incoming items
      // across the existing list so similar items don't cluster together.
      if (pageNum === 1) {
        this.pets = normalized;
      } else {
        const existing = this.pets || [];
        const incoming = normalized; // do NOT drop duplicates; keep all incoming items

        // If no existing content, just set pets to incoming
        if (!existing.length) {
          this.pets = incoming;
        } else if (!incoming.length) {
          // nothing to append
        } else if (incoming.length >= existing.length) {
          // If incoming is large, interleave to avoid clustering
          const merged: any[] = [];
          const max = Math.max(existing.length, incoming.length);
          for (let i = 0; i < max; i++) {
            if (existing[i]) merged.push(existing[i]);
            if (incoming[i]) {
              // try to avoid placing identical id right after the same id
              if (merged.length > 0 && this._feedItemKey(merged[merged.length - 1]) === this._feedItemKey(incoming[i])) {
                // attempt to find a later incoming item with different id and swap
                let found = -1;
                for (let j = i + 1; j < incoming.length; j++) {
                  if (this._feedItemKey(incoming[j]) !== this._feedItemKey(incoming[i])) {
                    found = j;
                    break;
                  }
                }
                if (found !== -1) {
                  const tmp = incoming[i];
                  incoming[i] = incoming[found];
                  incoming[found] = tmp;
                }
              }
              merged.push(incoming[i]);
            }
          }
          this.pets = merged;
        } else {
          // Distribute incoming items evenly among existing items, but try to avoid adjacent identical ids
          const merged: any[] = [];
          const gap = Math.ceil((existing.length + 1) / (incoming.length + 1));
          let pos = 0;
          for (let i = 0; i < incoming.length; i++) {
            const slice = existing.slice(pos, pos + gap);
            merged.push(...slice);
            pos += gap;

            // Before pushing incoming[i], try to avoid duplicate adjacency with last merged
            if (merged.length > 0 && this._feedItemKey(merged[merged.length - 1]) === this._feedItemKey(incoming[i])) {
              // Find a later incoming item with different id to swap with
              let found = -1;
              for (let j = i + 1; j < incoming.length; j++) {
                if (this._feedItemKey(incoming[j]) !== this._feedItemKey(incoming[i])) {
                  found = j;
                  break;
                }
              }
              if (found !== -1) {
                const tmp = incoming[i];
                incoming[i] = incoming[found];
                incoming[found] = tmp;
              }
            }

            merged.push(incoming[i]);
          }
          if (pos < existing.length) merged.push(...existing.slice(pos));
          this.pets = merged;
        }
      }

      if (pageNum === 1) {
        this.isEmptyFeed = Array.isArray(items) && items.length === 0;
      }

      // determine hasMore
      if (!Array.isArray(data)) {
        // try to use totalPages or total
        const totalPages = data?.totalPages ?? data?.total_pages ?? null;
        if (totalPages != null) {
          this.hasMore = (pageNum < totalPages);
        } else if (Array.isArray(items)) {
          this.hasMore = items.length === this.pageSize;
        }
      } else {
        this.hasMore = items.length === this.pageSize;
      }
  this.page = pageNum;
    } catch (err) {
      console.error(err);
      this.error = 'Não foi possível carregar a galeria.';
    } finally {
      this.loading = false;
      this.loadingMore = false;
    }
  }

  loadNext() {
    if (!this.hasMore) return;
    this.loadPage(this.page + 1);
  }
}
