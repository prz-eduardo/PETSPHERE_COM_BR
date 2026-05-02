import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, PostDto } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ClienteAreaModalService, ClienteAreaModalView } from '../../services/cliente-area-modal.service';
import { TenantLojaService } from '../../services/tenant-loja.service';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { MARCA_NOME } from '../../constants/loja-public';
import { PetLightboxComponent } from './pet-lightbox/pet-lightbox.component';
import { GaleriaPostFotoModalComponent } from './galeria-post-foto-modal/galeria-post-foto-modal.component';
import { GaleriaFeedGridComponent } from './galeria-feed-grid/galeria-feed-grid.component';
import { GaleriaFeedService, GaleriaFeedState } from '../../services/galeria-feed.service';
import { FeedAdItem, FeedPostItem, normalizePost } from './gallery-utils';

@Component({
  selector: 'app-galeria-publica',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BannerSlotComponent,
    PetLightboxComponent,
    GaleriaPostFotoModalComponent,
    GaleriaFeedGridComponent,
  ],
  providers: [GaleriaFeedService],
  templateUrl: './galeria-publica.component.html',
  styleUrls: ['./galeria-publica.component.scss'],
})
export class GaleriaPublicaComponent implements OnInit, OnDestroy {
  readonly marcaNome = MARCA_NOME;

  /** Visitantes veem o feed com conteúdo borrado até entrarem na conta. */
  loggedIn = false;

  feedState: GaleriaFeedState;
  lightboxPost: FeedPostItem | null = null;
  postFotoModalOpen = false;

  // CTA accordion
  ctaAccordionOpen = false;
  ctaClientePets: any[] = [];
  ctaClientePosts: FeedPostItem[] = [];
  ctaContextLoading = false;
  private ctaClienteId: number | null = null;

  private subs = new Subscription();

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private clienteAreaModal: ClienteAreaModalService,
    private tenantLoja: TenantLojaService,
    private feed: GaleriaFeedService
  ) {
    this.feedState = this.feed.state;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    this.subs.add(this.feed.state$.subscribe((s) => (this.feedState = s)));
    if (!isPlatformBrowser(this.platformId)) return;

    this.loggedIn = !!this.auth.getToken();
    this.bootstrapFeed();

    this.subs.add(
      this.auth.isLoggedIn$.subscribe((isIn) => {
        this.loggedIn = !!(isIn && this.auth.getToken());
        if (!isIn || !this.auth.getToken()) {
          this.resetCtaContext();
        } else if (this.ctaAccordionOpen) {
          void this.loadCtaContext(true);
        }
      })
    );

    this.subs.add(
      this.clienteAreaModal.petsChanged$.subscribe(() => void this.loadCtaPets(true))
    );
    this.subs.add(
      this.clienteAreaModal.galeriaFotosChanged$.subscribe(() => {
        void this.loadCtaPosts();
        void this.feed.reload(this.auth.getToken() ?? undefined);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private async bootstrapFeed(): Promise<void> {
    try {
      await this.tenantLoja.ensureHostResolved();
    } catch {
      /* noop */
    }
    await this.feed.reload(this.auth.getToken() ?? undefined);
  }

  // ---------------------------------------------------------------------------
  // Feed callbacks
  // ---------------------------------------------------------------------------

  onLoadMore(): void {
    void this.feed.loadNext(this.auth.getToken() ?? undefined);
  }

  openPostInLightbox(post: FeedPostItem): void {
    this.lightboxPost = post;
  }

  closeLightbox(): void {
    this.lightboxPost = null;
  }

  /** Atualizações vindas do lightbox (após reagir/comentar). */
  onLightboxPostChanged(post: FeedPostItem): void {
    this.feed.upsertPost(post);
    this.lightboxPost = post;
  }

  openAd(ad: FeedAdItem): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (ad.telefone) {
      window.location.href = `tel:${ad.telefone}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Stats helpers
  // ---------------------------------------------------------------------------

  getDistinctPetsCount(): number {
    const ids = new Set<number>();
    for (const post of this.feedState.items) {
      if (post.pet_id) ids.add(post.pet_id);
    }
    return ids.size;
  }

  getTotalReactions(): number {
    return this.feedState.items.reduce((acc, p) => acc + (p.engagement?.total ?? 0), 0);
  }

  // ---------------------------------------------------------------------------
  // Compartilhamento
  // ---------------------------------------------------------------------------

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
        try { document.execCommand('copy'); } catch { /* noop */ }
        document.body.removeChild(ta);
      }
      this.toast.success('Link copiado');
    } catch {
      this.toast.info('Não foi possível copiar o link');
    }
  }

  openWhatsAppShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `https://wa.me/?text=${encodeURIComponent(this.getGaleriaFullShareMessage())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openFacebookShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const u = this.getGaleriaShareUrl();
    if (!u) return;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async shareGaleria(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const nav = typeof navigator !== 'undefined'
      ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> })
      : null;
    if (nav?.share) {
      try {
        await nav.share({
          title: `Galeria ${MARCA_NOME}`,
          text: this.getGaleriaShareText(),
          url: this.getGaleriaShareUrl(),
        });
        return;
      } catch (e: unknown) {
        const name = e && typeof e === 'object' && 'name' in e ? (e as { name?: string }).name : '';
        if (name === 'AbortError') return;
      }
    }
    await this.copyGaleriaLink();
  }

  // ---------------------------------------------------------------------------
  // Modal de novo post
  // ---------------------------------------------------------------------------

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
    void this.loadCtaPosts();
    void this.feed.reload(this.auth.getToken() ?? undefined);
  }

  // ---------------------------------------------------------------------------
  // CTA accordion
  // ---------------------------------------------------------------------------

  toggleCtaAccordion(): void {
    this.ctaAccordionOpen = !this.ctaAccordionOpen;
    if (this.ctaAccordionOpen) {
      void this.loadCtaContext();
    }
  }

  openClienteAreaView(view: ClienteAreaModalView): void {
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

  getCtaPostHint(): string {
    if (!this.hasClienteAuth()) return 'Entre na sua conta e use o + para postar sua primeira foto.';
    if (!this.ctaClientePosts.length) return 'Nenhum post ainda. Use o + para publicar o primeiro.';
    return 'Seus últimos posts aparecem aqui. Use o + para postar outro.';
  }

  resolveClientePetAvatar(pet: any): string | null {
    try {
      const raw = String(pet?.photoURL || pet?.foto || pet?.photo || pet?.photo_url || '').trim();
      return raw ? this.api.resolveMediaUrl(raw) : null;
    } catch {
      return null;
    }
  }

  clientePetInitials(nome?: string): string {
    const base = String(nome || 'Pet').trim();
    if (!base) return 'P';
    const parts = base.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || 'P';
  }

  resolveClientePostThumb(post: FeedPostItem): string {
    const raw = post?.cover_url || post?.galeria_urls?.[0] || '';
    return raw ? this.api.resolveMediaUrl(raw) : '/imagens/image.png';
  }

  trackPostId = (_: number, post: FeedPostItem) => post.id;
  trackPetId = (_: number, pet: any) => pet?.id ?? _;

  // ---------------------------------------------------------------------------
  // CTA context loaders
  // ---------------------------------------------------------------------------

  private resetCtaContext(): void {
    this.ctaClienteId = null;
    this.ctaClientePets = [];
    this.ctaClientePosts = [];
    this.ctaContextLoading = false;
  }

  private async resolveClienteIdForCta(token: string, force = false): Promise<number | null> {
    if (!force && this.ctaClienteId) return this.ctaClienteId;
    const me: any = await this.api.getClienteMe(token).toPromise();
    const id = Number(me?.user?.id ?? me?.id ?? 0);
    this.ctaClienteId = !isNaN(id) && id > 0 ? id : null;
    return this.ctaClienteId;
  }

  private async loadCtaContext(force = false): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.auth.getToken();
    if (!token) {
      this.resetCtaContext();
      return;
    }
    if (this.ctaContextLoading) return;
    this.ctaContextLoading = true;
    try {
      const clienteId = await this.resolveClienteIdForCta(token, force);
      const [pets, postsResp] = await Promise.all([
        clienteId ? this.api.getPetsByCliente(clienteId, token).toPromise() : Promise.resolve([]),
        this.api.getMyPosts(token, { page: 1, pageSize: 12 }).toPromise(),
      ]);
      this.ctaClientePets = Array.isArray(pets) ? pets : [];
      this.ctaClientePosts = (postsResp?.items || []).map((p) => normalizePost(p as PostDto));
    } catch (e) {
      console.warn('Falha ao carregar CTA da galeria', e);
    } finally {
      this.ctaContextLoading = false;
    }
  }

  private async loadCtaPets(force = false): Promise<void> {
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

  private async loadCtaPosts(): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      this.ctaClientePosts = [];
      return;
    }
    try {
      const res = await this.api.getMyPosts(token, { page: 1, pageSize: 12 }).toPromise();
      this.ctaClientePosts = (res?.items || []).map((p) => normalizePost(p as PostDto));
    } catch (e) {
      console.warn('Falha ao recarregar posts da CTA', e);
    }
  }
}
