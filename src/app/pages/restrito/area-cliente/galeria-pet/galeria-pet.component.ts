import {
  Component,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService, PostDto } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { ClienteAreaModalService } from '../../../../services/cliente-area-modal.service';
import {
  FeedPostItem,
  isPublicFeedEligible,
  normalizePost,
} from '../../../galeria-publica/gallery-utils';
import { GaleriaPostFotoModalComponent } from '../../../galeria-publica/galeria-post-foto-modal/galeria-post-foto-modal.component';

interface PetGalleryGroup {
  pet_id: string;
  pet_nome: string;
  posts: FeedPostItem[];
}

interface ImageActionMenu {
  postId: number;
  imagemId: number;
}

@Component({
  selector: 'app-galeria-pet',
  standalone: true,
  imports: [CommonModule, FormsModule, GaleriaPostFotoModalComponent],
  templateUrl: './galeria-pet.component.html',
  styleUrls: ['./galeria-pet.component.scss'],
})
export class GaleriaPetComponent implements OnInit, OnChanges {
  @Input() modal = false;
  @Input() pets: any[] = [];
  @Input() clienteMe: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() petsChanged = new EventEmitter<void>();

  selectedPetIds: string[] = [];
  visibilityFilter: 'all' | 'public' | 'hidden' = 'all';

  /** Posts agrupados por pet selecionado. */
  groups: PetGalleryGroup[] = [];

  loading = false;

  /** Modal de criação de post (overlay local — não usa internalHost). */
  postModalOpen = false;
  pendingDropFiles: File[] | null = null;

  /** Drag-over global na própria galeria (mostra overlay "Solte para criar"). */
  globalDragActive = false;
  private globalDragCounter = 0;

  /** Modal de edição de post. */
  editingPost: FeedPostItem | null = null;
  editDraft: { caption: string; galeria_publica: boolean } = { caption: '', galeria_publica: true };
  savingPost = false;
  deletingPost = false;
  workingImagemId: number | null = null;

  /** Drag-and-drop para reorder de imagens dentro do editor. */
  private editorDragFromIdx: number | null = null;
  editorDragHoverIdx: number | null = null;

  /** Kebab menu aberto (uma imagem por vez). */
  openImageMenu: ImageActionMenu | null = null;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private clienteAreaModal: ClienteAreaModalService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  // ---------------------------------------------------------------------------
  // Ciclo de vida e seleção
  // ---------------------------------------------------------------------------

  get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  private getClienteIdNum(): number | null {
    const c: any = this.clienteMe;
    if (!c) return null;
    const id = c.user?.id ?? c.id;
    const n = Number(id);
    return isNaN(n) || n <= 0 ? null : n;
  }

  ngOnInit(): void {
    this.syncPetSelectionWithInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pets']) {
      this.syncPetSelectionWithInputs();
    }
  }

  get hasPets(): boolean {
    return Array.isArray(this.pets) && this.pets.length > 0;
  }

  get hasSelectedPets(): boolean {
    return this.selectedPetIds.length > 0;
  }

  get totalPosts(): number {
    return this.groups.reduce((acc, g) => acc + g.posts.length, 0);
  }

  get totalPostsPublicos(): number {
    return this.groups.reduce(
      (acc, g) => acc + g.posts.filter((p) => this.isPostPublic(p)).length,
      0
    );
  }

  get totalPostsOcultos(): number {
    return this.totalPosts - this.totalPostsPublicos;
  }

  togglePetSelection(petId: string | number | null | undefined): void {
    if (!petId) return;
    const id = String(petId);
    if (this.selectedPetIds.includes(id)) {
      this.selectedPetIds = this.selectedPetIds.filter((x) => x !== id);
    } else {
      this.selectedPetIds = [...this.selectedPetIds, id];
    }
    this.editingPost = null;
    this.loadPosts();
  }

  isPetSelected(petId: string | number | null | undefined): boolean {
    if (!petId) return false;
    return this.selectedPetIds.includes(String(petId));
  }

  setVisibilityFilter(filter: 'all' | 'public' | 'hidden'): void {
    this.visibilityFilter = filter;
  }

  isVisibilityFilterActive(filter: 'all' | 'public' | 'hidden'): boolean {
    return this.visibilityFilter === filter;
  }

  visiblePostsForGroup(group: PetGalleryGroup): FeedPostItem[] {
    if (this.visibilityFilter === 'all') return group.posts;
    return group.posts.filter((p) => {
      const isPublic = this.isPostPublic(p);
      return this.visibilityFilter === 'public' ? isPublic : !isPublic;
    });
  }

  /** Usado pelos chips de pet: mostra contagem de posts independente do filtro de visibilidade. */
  postsCountForPet(petId: string | number | null | undefined): number {
    if (!petId) return 0;
    const id = String(petId);
    const g = this.groups.find((x) => x.pet_id === id);
    return g ? g.posts.length : 0;
  }

  // ---------------------------------------------------------------------------
  // Carregamento de posts
  // ---------------------------------------------------------------------------

  private syncPetSelectionWithInputs(): void {
    const pets = Array.isArray(this.pets) ? this.pets : [];
    if (!pets.length) {
      this.selectedPetIds = [];
      this.groups = [];
      return;
    }
    const validIds = new Set(pets.map((p) => String(p.id || p._id)));
    const kept = this.selectedPetIds.filter((id) => validIds.has(id));
    this.selectedPetIds = kept.length ? kept : pets.map((p) => String(p.id || p._id));
    this.loadPosts();
  }

  private loadPosts(): void {
    if (!this.token || !this.selectedPetIds.length) {
      this.groups = [];
      return;
    }
    const tk = this.token;
    const requests = this.selectedPetIds.map((petId) =>
      this.api.listPostsByPet(petId, { page: 1, pageSize: 100 }, tk).pipe(
        map((res) => ({
          pet_id: petId,
          pet_nome: this.lookupPetNome(petId),
          posts: (res?.items || []).map((raw) => normalizePost(raw as PostDto)),
        }) as PetGalleryGroup),
        catchError(() => of<PetGalleryGroup>({
          pet_id: petId,
          pet_nome: this.lookupPetNome(petId),
          posts: [],
        }))
      )
    );

    this.loading = true;
    forkJoin(requests).subscribe({
      next: (groups) => {
        this.groups = groups;
        this.loading = false;
      },
      error: () => {
        this.groups = [];
        this.loading = false;
      },
    });
  }

  private lookupPetNome(petId: string): string {
    const pet = (this.pets || []).find((p) => String(p.id || p._id) === petId);
    return String(pet?.nome || `Pet #${petId}`);
  }

  // ---------------------------------------------------------------------------
  // Modal de novo post (overlay local — não troca de view)
  // ---------------------------------------------------------------------------

  openNovoPost(prefilledFiles: File[] | null = null): void {
    this.pendingDropFiles = prefilledFiles && prefilledFiles.length ? prefilledFiles : null;
    this.postModalOpen = true;
  }

  onPostModalClose(): void {
    this.postModalOpen = false;
    this.pendingDropFiles = null;
  }

  onPostModalPosted(): void {
    this.postModalOpen = false;
    this.pendingDropFiles = null;
    this.loadPosts();
    this.refreshPetsFromServer();
  }

  // ---------------------------------------------------------------------------
  // Drag global na página inteira → abre modal com arquivos pré-carregados
  // ---------------------------------------------------------------------------

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(ev: DragEvent): void {
    if (!this.hasFilesPayload(ev)) return;
    ev.preventDefault();
    this.globalDragCounter++;
    this.globalDragActive = true;
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(ev: DragEvent): void {
    if (!this.hasFilesPayload(ev)) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(ev: DragEvent): void {
    if (!this.hasFilesPayload(ev)) return;
    this.globalDragCounter = Math.max(0, this.globalDragCounter - 1);
    if (this.globalDragCounter === 0) this.globalDragActive = false;
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(ev: DragEvent): void {
    if (!this.hasFilesPayload(ev)) return;
    ev.preventDefault();
    this.globalDragCounter = 0;
    this.globalDragActive = false;
    // Se modal já está aberto, ele assume o drop. (HostListener do modal disputa primeiro,
    // mas como estamos no window scope, vamos só abrir se não tiver modal aberto.)
    if (this.postModalOpen) return;
    const files = ev.dataTransfer?.files ? Array.from(ev.dataTransfer.files) : [];
    if (files.length) this.openNovoPost(files);
  }

  private hasFilesPayload(ev: DragEvent): boolean {
    const types = ev.dataTransfer?.types;
    if (!types) return false;
    for (let i = 0; i < types.length; i++) {
      if (types[i] === 'Files') return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Editor de post — abrir/fechar e ações
  // ---------------------------------------------------------------------------

  openPostEditor(post: FeedPostItem): void {
    if (!post?.id) return;
    this.editingPost = post;
    this.editDraft = {
      caption: post.caption || '',
      galeria_publica: !!post.galeria_publica,
    };
    this.openImageMenu = null;
  }

  closePostEditor(): void {
    if (this.savingPost || this.deletingPost) return;
    this.editingPost = null;
    this.openImageMenu = null;
  }

  savePostEdits(): void {
    const post = this.editingPost;
    const tk = this.token;
    if (!post || !tk) return;
    this.savingPost = true;
    this.api
      .patchPost(
        post.pet_id,
        post.id,
        {
          caption: this.editDraft.caption.trim() || null,
          galeria_publica: this.editDraft.galeria_publica ? 1 : 0,
        },
        tk
      )
      .subscribe({
        next: (updated) => {
          this.savingPost = false;
          const next = normalizePost(updated as PostDto);
          this.replacePostInGroups(next);
          this.editingPost = next;
          this.toast.success('Post atualizado.');
        },
        error: (err) => {
          this.savingPost = false;
          this.toast.error(err?.error?.error || 'Falha ao atualizar o post.', 'Erro');
        },
      });
  }

  togglePostPublic(post: FeedPostItem, ev?: Event): void {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const tk = this.token;
    if (!post?.id || !tk) return;
    const next = !post.galeria_publica;
    this.api
      .patchPost(post.pet_id, post.id, { galeria_publica: next ? 1 : 0 }, tk)
      .subscribe({
        next: () => {
          post.galeria_publica = next;
          this.toast.success(next ? 'Post visível na galeria pública.' : 'Post oculto da galeria.');
        },
        error: (err) => {
          this.toast.error(err?.error?.error || 'Falha ao alterar visibilidade.', 'Erro');
        },
      });
  }

  deletePost(post: FeedPostItem | null): void {
    const target = post || this.editingPost;
    const tk = this.token;
    if (!target?.id || !tk) return;
    if (typeof window !== 'undefined' && !window.confirm('Excluir este post inteiro? Essa ação não pode ser desfeita.')) {
      return;
    }
    this.deletingPost = true;
    this.api.deletePost(target.pet_id, target.id, tk).subscribe({
      next: () => {
        this.deletingPost = false;
        this.removePostFromGroups(target.id);
        this.editingPost = null;
        this.toast.success('Post removido.');
        this.refreshPetsFromServer();
      },
      error: (err) => {
        this.deletingPost = false;
        this.toast.error(err?.error?.error || 'Falha ao excluir post.', 'Erro');
      },
    });
  }

  removePostImage(post: FeedPostItem, imagemId: number): void {
    const tk = this.token;
    if (!post || !tk || !imagemId) return;
    this.openImageMenu = null;
    if (post.imagens.length <= 1) {
      if (typeof window !== 'undefined' && !window.confirm('Esta é a última foto do post. Remover irá excluir o post inteiro. Continuar?')) {
        return;
      }
      this.deletePost(post);
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Remover esta foto do post?')) return;

    this.workingImagemId = imagemId;
    this.api.removePostImage(post.pet_id, post.id, imagemId, tk).subscribe({
      next: () => {
        this.workingImagemId = null;
        post.imagens = post.imagens.filter((img) => img.id !== imagemId);
        post.galeria_urls = post.imagens.map((img) => img.url);
        if (post.cover_imagem_id === imagemId) {
          const first = post.imagens[0];
          post.cover_imagem_id = first ? first.id : null;
          post.cover_url = first ? first.url : null;
        }
        this.toast.success('Foto removida do post.');
      },
      error: (err) => {
        this.workingImagemId = null;
        this.toast.error(err?.error?.error || 'Falha ao remover foto.', 'Erro');
      },
    });
  }

  setImageAsPetCover(post: FeedPostItem, imagemId: number): void {
    const tk = this.token;
    if (!post || !tk || !imagemId) return;
    this.openImageMenu = null;
    this.workingImagemId = imagemId;
    this.api
      .setPostImageAsPetCover(post.pet_id, post.id, { imagem_id: imagemId }, tk)
      .subscribe({
        next: () => {
          this.workingImagemId = null;
          this.toast.success('Foto definida como capa do pet.');
          this.refreshPetsFromServer();
        },
        error: (err) => {
          this.workingImagemId = null;
          this.toast.error(err?.error?.error || 'Falha ao definir capa.', 'Erro');
        },
      });
  }

  setPostCover(post: FeedPostItem, imagemId: number): void {
    const tk = this.token;
    if (!post || !tk || !imagemId) return;
    this.openImageMenu = null;
    this.workingImagemId = imagemId;
    this.api.patchPost(post.pet_id, post.id, { cover_imagem_id: imagemId }, tk).subscribe({
      next: (updated) => {
        this.workingImagemId = null;
        const next = normalizePost(updated as PostDto);
        this.replacePostInGroups(next);
        if (this.editingPost?.id === next.id) this.editingPost = next;
        this.toast.success('Capa do post atualizada.');
      },
      error: (err) => {
        this.workingImagemId = null;
        this.toast.error(err?.error?.error || 'Falha ao definir capa do post.', 'Erro');
      },
    });
  }

  movePostImage(post: FeedPostItem, from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= post.imagens.length || to >= post.imagens.length) return;
    const tk = this.token;
    if (!tk) return;
    const next = [...post.imagens];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ordem = next.map((img) => img.id);

    post.imagens = next;
    post.galeria_urls = next.map((img) => img.url);

    this.api.reorderPostImages(post.pet_id, post.id, { ordem }, tk).subscribe({
      next: () => {
        this.toast.success('Ordem atualizada.');
      },
      error: (err) => {
        this.toast.error(err?.error?.error || 'Falha ao reordenar.', 'Erro');
        this.loadPosts();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Drag & Drop dentro do editor (HTML5 nativo)
  // ---------------------------------------------------------------------------

  onEditorDragStart(idx: number, ev: DragEvent): void {
    this.editorDragFromIdx = idx;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', String(idx)); } catch { /* noop */ }
    }
  }

  onEditorDragOver(idx: number, ev: DragEvent): void {
    if (this.editorDragFromIdx === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.editorDragHoverIdx = idx;
  }

  onEditorDrop(idx: number, ev: DragEvent): void {
    if (this.editorDragFromIdx === null || !this.editingPost) return;
    ev.preventDefault();
    const from = this.editorDragFromIdx;
    this.editorDragFromIdx = null;
    this.editorDragHoverIdx = null;
    if (from !== idx) this.movePostImage(this.editingPost, from, idx);
  }

  onEditorDragEnd(): void {
    this.editorDragFromIdx = null;
    this.editorDragHoverIdx = null;
  }

  // ---------------------------------------------------------------------------
  // Kebab menu por imagem
  // ---------------------------------------------------------------------------

  toggleImageMenu(post: FeedPostItem, imagemId: number, ev?: Event): void {
    if (ev) ev.stopPropagation();
    if (
      this.openImageMenu &&
      this.openImageMenu.postId === post.id &&
      this.openImageMenu.imagemId === imagemId
    ) {
      this.openImageMenu = null;
      return;
    }
    this.openImageMenu = { postId: post.id, imagemId };
  }

  isImageMenuOpen(post: FeedPostItem, imagemId: number): boolean {
    return !!(
      this.openImageMenu &&
      this.openImageMenu.postId === post.id &&
      this.openImageMenu.imagemId === imagemId
    );
  }

  @HostListener('document:click')
  onDocClick(): void {
    if (this.openImageMenu) this.openImageMenu = null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  isPostPublic(post: FeedPostItem): boolean {
    if (!post.galeria_publica || !post.ativo) return false;
    const pet = (this.pets || []).find((p) => String(p.id || p._id) === String(post.pet_id));
    if (!pet) return true;
    if (!isPublicFeedEligible(pet)) return false;
    const aprovado = pet.aprovado_por_admin;
    if (aprovado === 0 || aprovado === '0' || aprovado === false) return false;
    return true;
  }

  postStatusLabel(post: FeedPostItem): string {
    if (!post.ativo) return 'Removido';
    if (!post.galeria_publica) return 'Oculto na galeria';
    const pet = (this.pets || []).find((p) => String(p.id || p._id) === String(post.pet_id));
    if (pet) {
      if (!isPublicFeedEligible(pet)) return 'Oculto: pet fora da galeria pública';
      const aprovado = pet.aprovado_por_admin;
      if (aprovado === 0 || aprovado === '0' || aprovado === false) {
        return 'Aguardando aprovação da equipe';
      }
    }
    return 'Público no feed';
  }

  postStatusTone(post: FeedPostItem): 'public' | 'hidden' | 'pending' {
    const pet = (this.pets || []).find((p) => String(p.id || p._id) === String(post.pet_id));
    if (pet && (pet.aprovado_por_admin === 0 || pet.aprovado_por_admin === '0' || pet.aprovado_por_admin === false)) {
      return 'pending';
    }
    return this.isPostPublic(post) ? 'public' : 'hidden';
  }

  /** Verifica se uma imagem do post é a capa atual do pet (badge "Capa do pet"). */
  isPetCoverImage(post: FeedPostItem, imagemId: number): boolean {
    const pet = (this.pets || []).find((p) => String(p.id || p._id) === String(post.pet_id));
    if (!pet || !imagemId) return false;
    const img = post.imagens.find((x) => x.id === imagemId);
    if (!img?.url) return false;
    const petPhoto = String(pet?.photoURL || pet?.foto || pet?.photo_url || '').trim();
    if (!petPhoto) return false;
    return petPhoto === img.url;
  }

  private replacePostInGroups(post: FeedPostItem): void {
    for (const g of this.groups) {
      const idx = g.posts.findIndex((p) => p.id === post.id);
      if (idx >= 0) {
        g.posts[idx] = post;
        return;
      }
    }
  }

  private removePostFromGroups(postId: number): void {
    for (const g of this.groups) {
      g.posts = g.posts.filter((p) => p.id !== postId);
    }
  }

  formatDate(raw: string | null): string {
    if (!raw) return '';
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  }

  trackPostId = (_: number, post: FeedPostItem) => post.id;
  trackImagemId = (_: number, img: { id: number }) => img.id;

  // ---------------------------------------------------------------------------
  // Recarrega pets do servidor (mantém capa atualizada)
  // ---------------------------------------------------------------------------

  private refreshPetsFromServer(done?: () => void): void {
    const cid = this.getClienteIdNum();
    const tk = this.token;
    if (!cid || !tk) {
      if (done) done();
      return;
    }
    this.api.getPetsByCliente(cid, tk).subscribe({
      next: (lista: any[]) => {
        const prevSelected = [...this.selectedPetIds];
        this.pets = Array.isArray(lista) ? lista : [];
        const validIds = new Set(this.pets.map((p) => String(p.id || p._id)));
        this.selectedPetIds = prevSelected.filter((id) => validIds.has(id));
        if (!this.selectedPetIds.length) {
          this.selectedPetIds = this.pets.map((p) => String(p.id || p._id));
        }
        this.loadPosts();
        try {
          this.petsChanged.emit();
          this.clienteAreaModal.notifyPetsChanged();
          this.clienteAreaModal.notifyGaleriaFotosChanged();
        } catch {
          /* noop */
        }
        if (done) done();
      },
      error: () => {
        if (done) done();
      },
    });
  }

  fechar(): void {
    this.close.emit();
  }
}
