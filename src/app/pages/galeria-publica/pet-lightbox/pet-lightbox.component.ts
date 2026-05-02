import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, PostEngagement } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { MARCA_NOME } from '../../../constants/loja-public';
import { FeedPostItem, typeEmoji } from '../gallery-utils';

@Component({
  selector: 'app-pet-lightbox',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pet-lightbox.component.html',
  styleUrls: ['./pet-lightbox.component.scss'],
})
export class PetLightboxComponent implements OnChanges, OnDestroy {
  @Input() post: FeedPostItem | null = null;
  /** Ao abrir a partir de um thumb específico, foca o slide dessa imagem (`pet_imagens.id`). */
  @Input() initialImageId: number | null = null;
  @Input() isOpen = false;
  @Input() inlineMode = false;

  @Output() close = new EventEmitter<void>();
  @Output() postChanged = new EventEmitter<FeedPostItem>();

  reactionTypes = [
    { tipo: 'love',  emoji: '❤️', label: 'Amei' },
    { tipo: 'haha',  emoji: '😂', label: 'Haha' },
    { tipo: 'sad',   emoji: '😢', label: 'Triste' },
    { tipo: 'angry', emoji: '😡', label: 'Grr' },
  ];

  comentarios: any[] = [];
  loadingComentarios = false;
  sendingComentario = false;
  novoComentario = '';
  commentsExpanded = false;
  comentariosError: string | null = null;
  imageIndex = 0;

  private pointerStartX: number | null = null;
  private pointerStartY: number | null = null;
  private pointerId: number | null = null;
  private readonly swipeThresholdPx = 52;

  private escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') this.onClose();
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) this.onOpen();
      else this.onCloseInternal();
    } else if (changes['post'] && (this.isOpen || this.inlineMode)) {
      this.imageIndex = 0;
      this.commentsExpanded = false;
      this.applyInitialSlide();
      void this.refreshEngagement();
    } else if (changes['initialImageId'] && this.post && (this.isOpen || this.inlineMode)) {
      this.applyInitialSlide();
    }
  }

  ngOnDestroy(): void {
    this.onCloseInternal();
  }

  private onOpen(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.inlineMode) {
      try { document.body.style.overflow = 'hidden'; } catch { /* noop */ }
      try { document.addEventListener('keydown', this.escHandler); } catch { /* noop */ }
    }
    this.novoComentario = '';
    this.commentsExpanded = false;
    this.comentariosError = null;
    this.imageIndex = 0;
    this.applyInitialSlide();
    void this.refreshEngagement();
  }

  private onCloseInternal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.inlineMode) {
      try { document.body.style.overflow = ''; } catch { /* noop */ }
      try { document.removeEventListener('keydown', this.escHandler); } catch { /* noop */ }
    }
    this.resetPointerSwipe();
  }

  onClose(): void {
    this.close.emit();
  }

  onOverlayClick(ev: MouseEvent): void {
    if (this.inlineMode) return;
    const target = ev.target as HTMLElement;
    if (target?.classList?.contains('pet-lightbox-overlay')) {
      this.onClose();
    }
  }

  // ---------------------------------------------------------------------------
  // Carrossel
  // ---------------------------------------------------------------------------

  get galleryUrls(): string[] {
    return this.post?.galeria_urls || [];
  }

  get hasMultipleImages(): boolean {
    return this.galleryUrls.length > 1;
  }

  get dots(): number[] {
    const n = this.galleryUrls.length;
    return n > 1 ? Array.from({ length: n }, (_, i) => i) : [];
  }

  resolveImage(): string {
    const urls = this.galleryUrls;
    const idx = Math.min(Math.max(0, this.imageIndex), Math.max(0, urls.length - 1));
    const raw = urls[idx] || urls[0] || '';
    return raw ? this.api.resolveMediaUrl(raw) : '/imagens/image.png';
  }

  resolveTutorPhotoUrl(): string {
    const u = this.post?.tutor?.foto;
    return u ? this.api.resolveMediaUrl(u) : '';
  }

  private applyInitialSlide(): void {
    const want = this.initialImageId != null ? Number(this.initialImageId) : NaN;
    if (!this.post?.imagens?.length || !want || Number.isNaN(want)) return;
    const idx = this.post.imagens.findIndex((img) => img.id === want);
    if (idx >= 0) this.imageIndex = idx;
  }

  prevSlide(ev?: Event): void {
    if (ev) ev.stopPropagation();
    if (!this.hasMultipleImages) return;
    let i = this.imageIndex - 1;
    if (i < 0) i = this.galleryUrls.length - 1;
    this.imageIndex = i;
  }

  nextSlide(ev?: Event): void {
    if (ev) ev.stopPropagation();
    if (!this.hasMultipleImages) return;
    let i = this.imageIndex + 1;
    if (i >= this.galleryUrls.length) i = 0;
    this.imageIndex = i;
  }

  goSlide(i: number, ev?: Event): void {
    if (ev) ev.stopPropagation();
    this.imageIndex = i;
  }

  // ---------------------------------------------------------------------------
  // Reactions / Comments (per post)
  // ---------------------------------------------------------------------------

  isLogged(): boolean {
    try {
      return !!this.auth.getToken();
    } catch {
      return false;
    }
  }

  get currentReaction(): string | null {
    return this.post?.engagement?.minha_reacao?.tipo || null;
  }

  reactionCount(tipo: string): number {
    if (!this.post) return 0;
    return Number((this.post.engagement as any)[tipo] || 0);
  }

  totalReactions(): number {
    return this.post?.engagement?.total || 0;
  }

  getReactionEmoji(tipo: string): string {
    return this.reactionTypes.find((r) => r.tipo === tipo)?.emoji || '❤️';
  }

  topReactions(limit = 3): { tipo: string; emoji: string; label: string; count: number }[] {
    return this.reactionTypes
      .map((r) => ({ ...r, count: this.reactionCount(r.tipo) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async refreshEngagement(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.post) return;
    const postId = this.post.id;
    if (!postId) return;
    this.loadingComentarios = true;
    this.comentariosError = null;
    const token = this.auth.getToken() || undefined;
    try {
      const [eng, com] = await Promise.all([
        firstValueFrom(this.api.getPostEngajamento(postId, token)) as Promise<PostEngagement>,
        firstValueFrom(this.api.getPostComentarios(postId, { page: 1, pageSize: 50 })) as Promise<any>,
      ]);
      this.applyEngagement(eng);
      const rawList = Array.isArray(com) ? com : com?.data || [];
      this.comentarios = rawList.map((r: any) => this.normalizeCommentRow(r)).filter(Boolean);
      if (this.post && eng?.comentarios != null) {
        this.post.engagement.comentarios = Number(eng.comentarios);
      }
      this.emitChange();
    } catch (e) {
      console.warn('refreshEngagement', e);
      this.comentariosError = 'Não foi possível carregar dados deste post.';
    } finally {
      this.loadingComentarios = false;
    }
  }

  private applyEngagement(eng: PostEngagement | null | undefined): void {
    if (!this.post || !eng) return;
    this.post.engagement = {
      love: Number(eng.love ?? 0),
      haha: Number(eng.haha ?? 0),
      sad: Number(eng.sad ?? 0),
      angry: Number(eng.angry ?? 0),
      total:
        Number(eng.total ?? 0) ||
        Number(eng.love ?? 0) + Number(eng.haha ?? 0) + Number(eng.sad ?? 0) + Number(eng.angry ?? 0),
      comentarios: Number(eng.comentarios ?? this.post.engagement.comentarios ?? 0),
      minha_reacao: eng.minha_reacao ? { tipo: String(eng.minha_reacao.tipo) } : null,
    };
  }

  async onSelectReaction(tipo: string): Promise<void> {
    if (!this.isLogged()) {
      try { this.toast.info('Faça login para reagir aos posts.'); } catch { /* noop */ }
      return;
    }
    const token = this.auth.getToken();
    if (!token || !this.post) return;
    const previous = this.currentReaction;
    const same = previous === tipo;
    try {
      if (same) {
        await firstValueFrom(this.api.deletePostReacao(this.post.id, token));
      } else {
        await firstValueFrom(this.api.postPostReacao(this.post.id, { tipo }, token));
      }
      const eng = await firstValueFrom(this.api.getPostEngajamento(this.post.id, token));
      this.applyEngagement(eng as PostEngagement);
      this.emitChange();
    } catch (err) {
      console.error(err);
      this.toast.error('Não foi possível enviar a reação.');
    }
  }

  toggleComments(): void {
    this.commentsExpanded = !this.commentsExpanded;
  }

  async enviarComentario(): Promise<void> {
    const texto = (this.novoComentario || '').trim();
    if (!texto || !this.post) return;
    if (texto.length > 500) {
      try { this.toast.error('Comentário muito longo (máx 500 caracteres).'); } catch { /* noop */ }
      return;
    }
    const token = this.auth.getToken();
    if (!token) {
      try { this.toast.info('Faça login para comentar.'); } catch { /* noop */ }
      return;
    }
    this.sendingComentario = true;
    try {
      const res: any = await firstValueFrom(this.api.postPostComentario(this.post.id, texto, token));
      const mapped = this.normalizeCommentRow(res?.comentario ?? res);
      if (mapped) {
        this.comentarios = [mapped, ...this.comentarios];
      }
      const total = Number(res?.total_comentarios ?? this.comentarios.length);
      this.post.engagement.comentarios = total;
      this.novoComentario = '';
      try { this.toast.success('Comentário publicado!'); } catch { /* noop */ }
      this.emitChange();
    } catch (err: any) {
      console.error(err);
      this.toast.error(err?.error?.error || 'Não foi possível enviar seu comentário.');
    } finally {
      this.sendingComentario = false;
    }
  }

  async removerComentario(c: any): Promise<void> {
    if (!c?.id || !this.post) return;
    const token = this.auth.getToken();
    if (!token) return;
    if (typeof window !== 'undefined' && !window.confirm('Remover este comentário?')) return;
    try {
      const res: any = await firstValueFrom(this.api.deletePostComentario(this.post.id, c.id, token));
      this.comentarios = this.comentarios.filter((x) => x.id !== c.id);
      const total = Number(res?.total_comentarios ?? Math.max(0, this.post.engagement.comentarios - 1));
      this.post.engagement.comentarios = total;
      this.emitChange();
    } catch (err) {
      console.error(err);
      try { this.toast.error('Não foi possível remover o comentário.'); } catch { /* noop */ }
    }
  }

  canDeleteComment(_: any): boolean {
    return this.isLogged();
  }

  // ---------------------------------------------------------------------------
  // Compartilhamento
  // ---------------------------------------------------------------------------

  getGaleriaShareUrl(): string {
    if (!isPlatformBrowser(this.platformId) || typeof window === 'undefined') return '';
    return `${window.location.origin}/galeria`;
  }

  getPetPerfilPath(): string {
    if (!this.post?.pet_id) return '/galeria';
    return `/galeria/pet/${this.post.pet_id}`;
  }

  getPetShareText(): string {
    const nome = this.post?.pet?.nome || 'este pet';
    return `Conheça o ${nome} na galeria da comunidade ${MARCA_NOME}!`;
  }

  getPetShareMessage(): string {
    const u = this.getGaleriaShareUrl();
    return u ? `${this.getPetShareText()}\n${u}` : this.getPetShareText();
  }

  async copyPetShare(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const text = this.getPetShareMessage();
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

  openWhatsAppPetShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `https://wa.me/?text=${encodeURIComponent(this.getPetShareMessage())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openFacebookPetShare(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const u = this.getGaleriaShareUrl();
    if (!u) return;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  async shareThisPet(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const nome = this.post?.pet?.nome || 'Pet';
    const nav = typeof navigator !== 'undefined'
      ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> })
      : null;
    if (nav?.share) {
      try {
        await nav.share({
          title: `${MARCA_NOME} — ${nome}`,
          text: this.getPetShareText(),
          url: this.getGaleriaShareUrl(),
        });
        return;
      } catch (e: unknown) {
        const name = e && typeof e === 'object' && 'name' in e ? (e as { name?: string }).name : '';
        if (name === 'AbortError') return;
      }
    }
    await this.copyPetShare();
  }

  // ---------------------------------------------------------------------------
  // Eventos de mídia (swipe / wheel)
  // ---------------------------------------------------------------------------

  onMediaPointerDown(ev: PointerEvent): void {
    if (!this.hasMultipleImages) return;
    if (!this.isSwipeCandidateTarget(ev.target)) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    this.pointerId = ev.pointerId;
    this.pointerStartX = ev.clientX;
    this.pointerStartY = ev.clientY;
  }

  onMediaPointerUp(ev: PointerEvent): void {
    if (!this.hasMultipleImages || this.pointerId == null || ev.pointerId !== this.pointerId || this.pointerStartX == null || this.pointerStartY == null) {
      this.resetPointerSwipe();
      return;
    }
    const dx = ev.clientX - this.pointerStartX;
    const dy = ev.clientY - this.pointerStartY;
    if (Math.abs(dx) >= this.swipeThresholdPx && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) this.nextSlide();
      else this.prevSlide();
    }
    this.resetPointerSwipe();
  }

  onMediaPointerCancel(): void {
    this.resetPointerSwipe();
  }

  onMediaWheel(ev: WheelEvent): void {
    if (!this.hasMultipleImages) return;
    const ax = Math.abs(ev.deltaX);
    const ay = Math.abs(ev.deltaY);
    if (ax < 18 || ax <= ay) return;
    ev.preventDefault();
    if (ev.deltaX > 0) this.nextSlide();
    else this.prevSlide();
  }

  private isSwipeCandidateTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return true;
    return !target.closest('button, a, textarea, input, [data-no-swipe]');
  }

  private resetPointerSwipe(): void {
    this.pointerId = null;
    this.pointerStartX = null;
    this.pointerStartY = null;
  }

  // ---------------------------------------------------------------------------
  // Util
  // ---------------------------------------------------------------------------

  speciesEmoji(tipo?: string | null): string {
    return typeEmoji(tipo);
  }

  onImgError(ev: Event): void {
    try {
      const el = ev.target as HTMLImageElement;
      if (el?.src && el.src.indexOf('/imagens/image.png') === -1) {
        el.src = '/imagens/image.png';
      }
    } catch {
      /* noop */
    }
  }

  formatDate(d: any): string {
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      const now = new Date();
      const diff = Math.floor((now.getTime() - dt.getTime()) / 1000);
      if (diff < 60) return 'agora';
      if (diff < 3600) return `${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d`;
      return dt.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  }

  trackComentario = (_: number, c: any) => c?.id ?? _;
  trackReaction = (_: number, r: any) => r?.tipo ?? _;

  /** API devolve `texto` + `cliente_nome`; o template espera `comentario` + `cliente`. */
  private normalizeCommentRow(row: any): any | null {
    if (!row || row.id == null) return null;
    if (row.cliente && (row.comentario != null || row.texto != null)) {
      return {
        ...row,
        comentario: row.comentario ?? row.texto ?? '',
      };
    }
    return {
      id: row.id,
      created_at: row.created_at,
      comentario: row.texto ?? row.comentario ?? '',
      cliente: row.cliente || {
        nome: row.cliente_nome,
        foto: row.cliente_foto,
      },
    };
  }

  private emitChange(): void {
    if (this.post) this.postChanged.emit(this.post);
  }
}
