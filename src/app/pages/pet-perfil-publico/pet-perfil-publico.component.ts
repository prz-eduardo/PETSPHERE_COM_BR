import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { MARCA_NOME } from '../../constants/loja-public';
import { PetLightboxComponent } from '../galeria-publica/pet-lightbox/pet-lightbox.component';

@Component({
  selector: 'app-pet-perfil-publico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PetLightboxComponent],
  templateUrl: './pet-perfil-publico.component.html',
  styleUrls: ['./pet-perfil-publico.component.scss']
})
export class PetPerfilPublicoComponent implements OnInit {
  readonly marca = MARCA_NOME;
  petId: number | null = null;
  data: any = null;
  /** Fotos públicas da galeria em que o pet aparece (API perfil-publico). */
  galeriaFotos: Array<{ id: number; url: string; legenda?: string | null }> = [];
  /** Objeto sintético para o lightbox de uma foto da galeria (reações/comentários por foto). */
  fotoLightboxPet: any = null;
  loading = true;
  error: string | null = null;
  comentarios: any[] = [];
  totalComentarios = 0;
  loadingComentarios = false;
  comentariosError: string | null = null;
  novoComentario = '';
  sendingComentario = false;
  reactionTypes = [
    { tipo: 'love', emoji: '❤️', label: 'Amei' },
    { tipo: 'haha', emoji: '😂', label: 'Haha' },
    { tipo: 'sad', emoji: '😢', label: 'Triste' },
    { tipo: 'angry', emoji: '😡', label: 'Grr' }
  ];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  get token() {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      this.petId = id ? parseInt(id, 10) : null;
      if (!this.petId || Number.isNaN(this.petId)) {
        this.loading = false;
        this.error = 'Perfil inválido.';
        return;
      }
      this.load();
    });
  }

  load() {
    if (!this.petId) return;
    this.loading = true;
    this.error = null;
    this.data = null;
    this.galeriaFotos = [];
    this.closeFotoLightbox();
    this.api.getPetPerfilPublico(this.petId, this.token || undefined).subscribe({
      next: (res) => {
        this.data = res;
        const raw = Array.isArray(res?.galeria_fotos)
          ? res.galeria_fotos.filter((x: any) => x && x.id != null && x.url)
          : [];
        const seenUrl = new Set<string>();
        this.galeriaFotos = [];
        for (const x of raw) {
          const k = String(x.url || '')
            .trim()
            .toLowerCase();
          if (!k || seenUrl.has(k)) continue;
          seenUrl.add(k);
          this.galeriaFotos.push(x);
        }
        this.loading = false;
        this._loadComentarios();
      },
      error: (e) => {
        this.error = e?.error?.error || 'Perfil não disponível.';
        this.loading = false;
      }
    });
  }

  get pet() {
    return this.data?.pet;
  }

  get isLogged(): boolean {
    return !!this.token;
  }

  get petFotoUrl(): string {
    return this.api.resolveMediaUrl(this.pet?.foto);
  }

  get tutorFotoUrl(): string {
    return this.api.resolveMediaUrl(this.pet?.tutor_foto);
  }

  resolveGaleriaFotoUrl(url: string | null | undefined): string {
    return this.api.resolveMediaUrl(url);
  }

  openGaleriaFoto(f: { id: number; url: string }) {
    const p = this.pet;
    if (!p || !this.petId) return;
    this.fotoLightboxPet = {
      kind: 'photo',
      pet_imagem_id: f.id,
      pet_id: this.petId,
      nome: p.nome,
      foto: f.url,
      galeria_urls: [f.url],
      fotos: [],
      likes: 0,
      userReactionTipo: null,
      reactionTotals: { love: 0, haha: 0, sad: 0, angry: 0 },
      total_comentarios: 0,
      minha_reacao: null,
      especie: p.especie,
      raca: p.raca,
      idade: p.idade,
      sexo: p.sexo,
      pesoKg: p.pesoKg,
      observacoes: p.observacoes,
      tutor_nome: p.tutor_nome,
      tutor_foto: p.tutor_foto
    };
  }

  closeFotoLightbox(): void {
    this.fotoLightboxPet = null;
  }

  get charCount(): number {
    return (this.novoComentario || '').length;
  }

  get userReactionTipo() {
    return this.data?.minha_reacao?.tipo ?? null;
  }

  getReactionCount(tipo: string): number {
    const k = `total_reacao_${tipo}` as const;
    return Number((this.data as any)?.[k] ?? 0);
  }

  getTotalReactions(): number {
    return Number(this.data?.total_reacoes_geral ?? 0);
  }

  async onReaction(tipo: string) {
    if (!this.token) {
      this.toast.info('Faça login para reagir.');
      return;
    }
    if (!this.petId) return;
    const prev = this.userReactionTipo;
    const same = prev === tipo;
    try {
      if (same) {
        const res: any = await this.api.deletePetReaction(this.petId, { tipo }, this.token).toPromise();
        this._mergeReactionsFrom(res);
        this.data.minha_reacao = null;
      } else {
        const res: any = await this.api.postPetReaction(this.petId, { tipo }, this.token).toPromise();
        this._mergeReactionsFrom(res);
        this.data.minha_reacao = { tipo: res?.tipo || tipo };
      }
    } catch (e) {
      console.error(e);
      this.toast.error('Não foi possível enviar a reação.');
    }
  }

  private _mergeReactionsFrom(res: any) {
    if (!res || !this.data) return;
    this.data.total_reacoes_geral = Number(res.total_reacoes_geral ?? 0);
    this.data.total_reacao_love = Number(res.total_reacao_love ?? 0);
    this.data.total_reacao_haha = Number(res.total_reacao_haha ?? 0);
    this.data.total_reacao_sad = Number(res.total_reacao_sad ?? 0);
    this.data.total_reacao_angry = Number(res.total_reacao_angry ?? 0);
  }

  private _loadComentarios() {
    if (!this.petId) return;
    this.loadingComentarios = true;
    this.comentariosError = null;
    this.api.getPetComentarios(this.petId, { page: 1, pageSize: 100 }, this.token || undefined).subscribe({
      next: (r: any) => {
        this.comentarios = Array.isArray(r) ? r : (r?.data || []);
        this.totalComentarios = Number(r?.total ?? this.comentarios.length);
        this.loadingComentarios = false;
      },
      error: () => {
        this.comentariosError = 'Não foi possível carregar os comentários deste perfil.';
        this.loadingComentarios = false;
      }
    });
  }

  async enviarComentario() {
    const t = (this.novoComentario || '').trim();
    if (!t || !this.petId || !this.token) return;
    if (t.length > 500) {
      this.toast.error('Comentário muito longo (máx 500 caracteres).');
      return;
    }
    this.sendingComentario = true;
    try {
      const res: any = await this.api.postPetComentario(this.petId, t, this.token).toPromise();
      if (res?.comentario) this.comentarios = [res.comentario, ...this.comentarios];
      this.totalComentarios = Number(res?.total_comentarios ?? this.totalComentarios + 1);
      this.novoComentario = '';
      this.toast.success('Comentário publicado!');
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Falha ao comentar');
    } finally {
      this.sendingComentario = false;
    }
  }

  async removerComentario(c: any) {
    if (!this.petId || !this.token || !c?.id || !this.canDeleteComment(c)) return;
    if (!confirm('Remover este comentário?')) return;
    try {
      const res: any = await this.api.deletePetComentario(this.petId, c.id, this.token).toPromise();
      this.comentarios = this.comentarios.filter((x) => x.id !== c.id);
      this.totalComentarios = Number(res?.total_comentarios ?? Math.max(0, this.totalComentarios - 1));
      this.toast.success('Comentário removido.');
    } catch {
      this.toast.error('Não foi possível remover o comentário.');
    }
  }

  canDeleteComment(c: any): boolean {
    return !!c?.can_delete;
  }

  formatDate(d: any): string {
    try {
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return '';
      const diff = Math.floor((Date.now() - dt.getTime()) / 1000);
      if (diff < 60) return 'agora';
      if (diff < 3600) return `${Math.floor(diff / 60)} min`;
      if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d`;
      return dt.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  }

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (!img) return;
    if (img.src.indexOf('/imagens/image.png') !== -1) return;
    img.src = '/imagens/image.png';
  }

  onAvatarError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (!img) return;
    if (img.src.indexOf('/imagens/image.png') !== -1) return;
    img.src = '/imagens/image.png';
  }

  trackReaction = (_: number, r: any) => r?.tipo ?? _;
  trackComentario = (_: number, c: any) => c?.id ?? _;
  trackGaleriaFoto = (_: number, f: any) => f?.id ?? _;
}
