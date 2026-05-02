import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PetImagemPatchPayload } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';

type GaleriaItem = {
  id: number;
  pet_id: string;
  pet_nome: string;
  url: string;
  ativo?: number | boolean | string | null;
  colecao_id?: number | null;
  legenda?: string | null;
  galeria_publica?: number | boolean | string | null;
};

type Colecao = { id: number; titulo: string };

type CollectionTab = {
  id: string;
  kind: 'all' | 'unassigned' | 'collection';
  label: string;
  count: number;
  pet_id?: string;
  colecao_id?: number;
};

@Component({
  selector: 'app-galeria-pet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './galeria-pet.component.html',
  styleUrls: ['./galeria-pet.component.scss']
})
export class GaleriaPetComponent implements OnInit, OnDestroy, OnChanges {
  @Input() modal: boolean = false;
  @Input() pets: any[] = [];
  @Input() clienteMe: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() petsChanged = new EventEmitter<void>();

  selectedPetIds: string[] = [];
  activeCollectionTabId = 'all';
  visibilityFilter: 'all' | 'public' | 'hidden' = 'all';

  // Gallery state
  galeriaItens: GaleriaItem[] = [];
  colecoesByPet: Record<string, Colecao[]> = {};
  collectionTabs: CollectionTab[] = [];
  novoTituloColecao = '';

  // Upload
  fotoFiles: File[] = [];
  fotoPreviews: string[] = [];

  // Gallery item editing
  selectedGalleryItem: GaleriaItem | null = null;
  galleryDraft: { colecao_id: number | null; legenda: string; galeria_publica: boolean } = { colecao_id: null, legenda: '', galeria_publica: true };
  savingGalleryItem = false;
  deletingGalleryItem = false;
  settingCoverGalleryItem = false;

  carregando = false;
  private readonly maxNovasFotos = 12;
  private readonly maxFotoBytes = 3 * 1024 * 1024;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

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

  ngOnInit() {
    this.syncPetSelectionWithInputs();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pets']) {
      this.syncPetSelectionWithInputs();
    }
  }

  ngOnDestroy() {}

  get selectedPets(): any[] {
    const selected = new Set(this.selectedPetIds);
    return (Array.isArray(this.pets) ? this.pets : []).filter((p) => selected.has(String(p.id || p._id)));
  }

  get hasSelectedPets(): boolean {
    return this.selectedPetIds.length > 0;
  }

  get visibleGaleriaItens(): GaleriaItem[] {
    return this.galeriaItens.filter((item) => this.itemMatchesActiveTab(item) && this.itemMatchesVisibilityFilter(item));
  }

  get totalFotosSalvas(): number {
    return this.galeriaItens.length;
  }

  get totalFotosPublicas(): number {
    return this.galeriaItens.filter((item) => this.isPublicFeedEligible(item)).length;
  }

  get totalFotosOcultas(): number {
    return this.galeriaItens.filter((item) => !this.isPublicFeedEligible(item)).length;
  }

  get totalCardsPublicosEstimados(): number {
    const visibles = this.galeriaItens.filter((item) => this.isPublicFeedEligible(item));
    const collections = new Set<string>();
    let avulsas = 0;
    for (const item of visibles) {
      if (item.colecao_id != null) {
        collections.add(`${item.pet_id}:${Number(item.colecao_id)}`);
      } else {
        avulsas += 1;
      }
    }
    return avulsas + collections.size;
  }

  get uploadTargetPetId(): string | null {
    return this.selectedPetIds[0] || null;
  }

  private syncPetSelectionWithInputs() {
    const pets = Array.isArray(this.pets) ? this.pets : [];
    if (!pets.length) {
      this.selectedPetIds = [];
      this.galeriaItens = [];
      this.colecoesByPet = {};
      this.collectionTabs = [];
      return;
    }

    const validIds = new Set(pets.map((p) => String(p.id || p._id)));
    const kept = this.selectedPetIds.filter((id) => validIds.has(id));
    this.selectedPetIds = kept.length ? kept : pets.map((p) => String(p.id || p._id));
    this.carregarGaleria();
  }

  togglePetSelection(petId: string | number | null | undefined) {
    if (!petId) return;
    const id = String(petId);
    if (this.selectedPetIds.includes(id)) {
      this.selectedPetIds = this.selectedPetIds.filter((x) => x !== id);
    } else {
      this.selectedPetIds = [...this.selectedPetIds, id];
    }
    if (!this.selectedPetIds.length) {
      this.activeCollectionTabId = 'all';
      this.collectionTabs = [{ id: 'all', kind: 'all', label: 'Todas', count: 0 }];
      this.galeriaItens = [];
      this.colecoesByPet = {};
      this.selectedGalleryItem = null;
      return;
    }
    this.selectedGalleryItem = null;
    this.carregarGaleria();
  }

  isPetSelected(petId: string | number | null | undefined): boolean {
    if (!petId) return false;
    return this.selectedPetIds.includes(String(petId));
  }

  private carregarGaleria() {
    const pets = this.selectedPets;
    if (!pets.length) {
      this.galeriaItens = [];
      this.colecoesByPet = {};
      this.collectionTabs = [{ id: 'all', kind: 'all', label: 'Todas', count: 0 }];
      return;
    }

    this.galeriaItens = pets
      .flatMap((pet) => {
        const petId = String(pet.id || pet._id);
        const petNome = String(pet.nome || 'Pet sem nome');
        const gi = pet?.galeria_imagens;
        if (!Array.isArray(gi)) return [];
        return gi.map((x: any) => ({
          id: Number(x.id),
          pet_id: petId,
          pet_nome: petNome,
          url: x.url,
          ativo: x.ativo ?? 1,
          colecao_id: x.colecao_id != null ? Number(x.colecao_id) : null,
          legenda: x.legenda ?? null,
          galeria_publica: x.galeria_publica ?? 1,
        }));
      })
      .filter((x) => x.url && String(x.url).trim() && !isNaN(x.id));

    this.carregarColecoesSelecionadas();
  }

  onFileChange(ev: Event) {
    if (!isPlatformBrowser(this.platformId)) return;
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const remaining = this.maxNovasFotos - this.fotoFiles.length;
    if (remaining <= 0) {
      this.toast.info(`Máximo de ${this.maxNovasFotos} fotos novas por envio.`, 'Atenção');
      input.value = '';
      return;
    }

    const list = Array.from(input.files).slice(0, remaining);
    for (const file of list) {
      if (!file.type.startsWith('image/')) {
        this.toast.info('Cada ficheiro deve ser uma imagem.', 'Atenção');
        continue;
      }
      if (file.size > this.maxFotoBytes) {
        this.toast.info('Cada imagem deve ter no máximo 3MB.', 'Atenção');
        continue;
      }
      this.fotoFiles.push(file);
      const reader = new FileReader();
      reader.onload = () => this.fotoPreviews.push(reader.result as string);
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  removerNovaFoto(i: number) {
    if (i < 0 || i >= this.fotoFiles.length) return;
    this.fotoFiles.splice(i, 1);
    this.fotoPreviews.splice(i, 1);
  }

  removerTodasNovas() {
    this.fotoFiles = [];
    this.fotoPreviews = [];
  }

  carregarColecoesSelecionadas() {
    if (!this.token || !this.selectedPetIds.length) {
      this.colecoesByPet = {};
      this.rebuildCollectionTabs();
      return;
    }
    const selected = [...this.selectedPetIds];
    this.colecoesByPet = {};
    selected.forEach((petId) => {
      this.api.listPetColecoes(petId, this.token!).subscribe({
        next: (r: any) => {
          this.colecoesByPet[petId] = Array.isArray(r) ? r : [];
          this.rebuildCollectionTabs();
        },
        error: () => {
          this.colecoesByPet[petId] = [];
          this.rebuildCollectionTabs();
        }
      });
    });
  }

  criarColecao() {
    const petId = this.uploadTargetPetId;
    if (!petId || !this.token) return;
    const tit = (this.novoTituloColecao || '').trim() || 'Coleção';
    this.api.createPetColecao(petId, { titulo: tit }, this.token).subscribe({
      next: () => {
        this.novoTituloColecao = '';
        this.toast.success('Coleção criada. Atribua as fotos abaixo.');
        this.carregarColecoesSelecionadas();
      },
      error: (e: any) => this.toast.error(e?.error?.error || 'Não foi possível criar a coleção', 'Erro')
    });
  }

  openGalleryItemSettings(item: GaleriaItem) {
    if (!item?.id) return;
    this.selectedGalleryItem = item;
    this.galleryDraft = {
      colecao_id: item.colecao_id != null ? Number(item.colecao_id) : null,
      legenda: item.legenda ? String(item.legenda) : '',
      galeria_publica: item.galeria_publica === false || item.galeria_publica === 0 || item.galeria_publica === '0' ? false : true,
    };
  }

  closeGalleryItemSettings() {
    if (this.savingGalleryItem) return;
    this.selectedGalleryItem = null;
  }

  galleryItemStatus(item: { colecao_id?: number | null; galeria_publica?: number | boolean | string | null }): string {
    const galItem = item as GaleriaItem;
    const pet = this.getPetById(galItem.pet_id);
    const fotoAtiva = this.isTruthyFlag(galItem.ativo);
    const fotoPublica = this.isTruthyFlag(galItem.galeria_publica);
    const petPublico = this.isTruthyFlag(pet?.exibir_galeria_publica ?? 1);
    const petAprovado = this.isApprovedFlag(pet?.aprovado_por_admin);

    if (!fotoAtiva) return 'Oculta: foto inativa';
    if (!petPublico) return 'Oculta: pet fora da galeria pública';
    if (!petAprovado) return 'Aguardando aprovação da equipe';
    if (!fotoPublica) return item.colecao_id ? 'Oculta em coleção' : 'Oculta no feed';
    if (item.colecao_id) return 'Pública em coleção';
    return 'Pública no feed';
  }

  galleryItemStatusTone(item: GaleriaItem): 'public' | 'hidden' | 'pending' {
    const pet = this.getPetById(item.pet_id);
    const fotoAtiva = this.isTruthyFlag(item.ativo);
    const fotoPublica = this.isTruthyFlag(item.galeria_publica);
    const petPublico = this.isTruthyFlag(pet?.exibir_galeria_publica ?? 1);
    const petAprovado = this.isApprovedFlag(pet?.aprovado_por_admin);

    if (!petAprovado) return 'pending';
    if (!fotoAtiva || !fotoPublica || !petPublico) return 'hidden';
    return 'public';
  }

  toggleGalleryItemVisibility(item: GaleriaItem, ev?: Event) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    if (!item?.pet_id || !item?.id || !this.token) return;
    const current = this.isTruthyFlag(item.galeria_publica);
    const next = current ? 0 : 1;
    this.api.patchPetImagem(item.pet_id, item.id, { galeria_publica: next }, this.token).subscribe({
      next: (res: any) => {
        item.galeria_publica = (res as any)?.imagem?.galeria_publica ?? next;
        this.toast.success(next ? 'Foto marcada como pública.' : 'Foto ocultada do feed público.');
      },
      error: (err: any) => {
        this.toast.error(err?.error?.error || 'Falha ao alterar visibilidade da foto', 'Erro');
      }
    });
  }

  saveGalleryItemSettings() {
    const item = this.selectedGalleryItem;
    if (!item?.id || !item.pet_id || !this.token) return;

    const payload: PetImagemPatchPayload = {
      colecao_id: this.galleryDraft.colecao_id,
      legenda: this.galleryDraft.legenda.trim() || null,
      galeria_publica: this.galleryDraft.galeria_publica ? 1 : 0,
    };

    this.savingGalleryItem = true;
    this.api.patchPetImagem(item.pet_id, item.id, payload, this.token).subscribe({
      next: (res: any) => {
        const imagem = (res as any)?.imagem;
        if (imagem) {
          const idx = this.galeriaItens.findIndex((g) => g.id === item.id && g.pet_id === item.pet_id);
          if (idx >= 0) {
            this.galeriaItens[idx] = {
              ...this.galeriaItens[idx],
              colecao_id: imagem.colecao_id != null ? Number(imagem.colecao_id) : null,
              legenda: imagem.legenda ?? null,
              galeria_publica: imagem.galeria_publica ?? 1,
            };
          }
        }
        this.savingGalleryItem = false;
        this.toast.success('Configuração da foto salva.');
        this.selectedGalleryItem = null;
        this.rebuildCollectionTabs();
      },
      error: (err: any) => {
        this.savingGalleryItem = false;
        this.toast.error(err?.error?.error || 'Não foi possível salvar a configuração da foto.', 'Erro');
      }
    });
  }

  onColecaoImagemChange(g: GaleriaItem, raw: any) {
    if (!g?.pet_id || !this.token || !g?.id) return;
    const v = raw == null || raw === '' || raw === 'null' || (typeof raw === 'string' && raw === '') ? null : Number(raw);
    this.api.patchPetImagem(g.pet_id, g.id, { colecao_id: v as any }, this.token).subscribe({
      next: (res) => {
        g.colecao_id = (res as any)?.imagem?.colecao_id != null ? Number((res as any).imagem.colecao_id) : v;
        this.toast.info('Coleção atualizada.');
        this.rebuildCollectionTabs();
      },
      error: (e: any) => this.toast.error(e?.error?.error || 'Falha ao mover foto', 'Erro')
    });
  }

  salvarFotos() {
    const petId = this.uploadTargetPetId;
    if (!petId || !this.token || !this.getClienteIdNum()) {
      this.toast.error('Sessão inválida. Faça login novamente.', 'Erro');
      return;
    }

    if (this.fotoFiles.length === 0) {
      this.toast.info('Selecione pelo menos uma foto para enviar.', 'Atenção');
      return;
    }

    const fd = new FormData();
    for (const f of this.fotoFiles) {
      fd.append('foto', f);
    }

    this.carregando = true;
    this.api.updatePet(this.getClienteIdNum()!, petId, fd, this.token).subscribe({
      next: (_res: any) => {
        this.toast.success('Fotos enviadas com sucesso!');
        this.fotoFiles = [];
        this.fotoPreviews = [];
        this.refreshPetsFromServer(() => { this.carregando = false; });
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Erro ao enviar fotos';
        this.toast.error(msg, 'Erro');
        this.carregando = false;
      }
    });
  }

  excluirFoto(item: GaleriaItem | null) {
    if (!item || !item.id) return;
    if (!item.pet_id || !this.token) return;
    if (typeof window !== 'undefined' && !window.confirm('Excluir esta foto da galeria? Essa ação não pode ser desfeita.')) {
      return;
    }
    this.deletingGalleryItem = true;
    this.api.deletePetImagem(item.pet_id, item.id, this.token).subscribe({
      next: () => {
        this.galeriaItens = this.galeriaItens.filter((g) => !(g.id === item.id && g.pet_id === item.pet_id));
        this.toast.success('Foto removida.');
        this.selectedGalleryItem = null;
        this.rebuildCollectionTabs();
        this.refreshPetsFromServer(() => { this.deletingGalleryItem = false; });
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Erro ao remover foto';
        this.toast.error(msg, 'Erro');
        this.deletingGalleryItem = false;
      }
    });
  }

  definirComoCapa(item: GaleriaItem | null) {
    if (!item || !item.id) return;
    if (!item.pet_id || !this.token) return;
    this.settingCoverGalleryItem = true;
    this.api.patchPetImagem(item.pet_id, item.id, { set_as_cover: true }, this.token).subscribe({
      next: () => {
        this.toast.success('Foto definida como capa do pet.');
        this.settingCoverGalleryItem = false;
        this.refreshPetsFromServer();
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Não foi possível definir a foto como capa';
        this.toast.error(msg, 'Erro');
        this.settingCoverGalleryItem = false;
      }
    });
  }

  /** Recarrega a lista de pets do backend e propaga ao pai (para manter `pets` e galeria_imagens em sincronia). */
  private refreshPetsFromServer(done?: () => void) {
    const cid = this.getClienteIdNum();
    const tk = this.token;
    if (!cid || !tk) {
      this.carregarGaleria();
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
        this.carregarGaleria();
        try { this.petsChanged.emit(); } catch {}
        if (done) done();
      },
      error: () => {
        this.carregarGaleria();
        if (done) done();
      }
    });
  }

  openUploadPicker(input: HTMLInputElement) {
    if (!this.hasSelectedPets) {
      this.toast.info('Selecione ao menos um pet para enviar novas fotos.', 'Atenção');
      return;
    }
    input.click();
  }

  private itemMatchesActiveTab(item: GaleriaItem): boolean {
    if (this.activeCollectionTabId === 'all') return true;
    if (this.activeCollectionTabId === 'unassigned') return item.colecao_id == null;
    const tab = this.collectionTabs.find((x) => x.id === this.activeCollectionTabId && x.kind === 'collection');
    if (!tab || !tab.pet_id || tab.colecao_id == null) return true;
    return item.pet_id === tab.pet_id && Number(item.colecao_id) === Number(tab.colecao_id);
  }

  setVisibilityFilter(filter: 'all' | 'public' | 'hidden') {
    this.visibilityFilter = filter;
  }

  isVisibilityFilterActive(filter: 'all' | 'public' | 'hidden'): boolean {
    return this.visibilityFilter === filter;
  }

  private itemMatchesVisibilityFilter(item: GaleriaItem): boolean {
    if (this.visibilityFilter === 'all') return true;
    const isPublic = this.isPublicFeedEligible(item);
    return this.visibilityFilter === 'public' ? isPublic : !isPublic;
  }

  private isPublicFeedEligible(item: GaleriaItem): boolean {
    const pet = this.getPetById(item.pet_id);
    const fotoAtiva = this.isTruthyFlag(item.ativo);
    const fotoPublica = this.isTruthyFlag(item.galeria_publica);
    const petPublico = this.isTruthyFlag(pet?.exibir_galeria_publica ?? 1);
    const petAprovado = this.isApprovedFlag(pet?.aprovado_por_admin);
    return fotoAtiva && fotoPublica && petPublico && petAprovado;
  }

  private getPetById(petId: string): any | null {
    if (!petId) return null;
    const id = String(petId);
    const list = Array.isArray(this.pets) ? this.pets : [];
    return list.find((p) => String(p.id || p._id) === id) || null;
  }

  private isTruthyFlag(raw: any): boolean {
    return !(raw === false || raw === 0 || raw === '0');
  }

  private isApprovedFlag(raw: any): boolean {
    return !(raw === 0 || raw === '0' || raw === false);
  }

  selectCollectionTab(tabId: string) {
    this.activeCollectionTabId = tabId;
  }

  getColecoesDoItemSelecionado(): Colecao[] {
    const petId = this.selectedGalleryItem?.pet_id;
    if (!petId) return [];
    return this.colecoesByPet[petId] || [];
  }

  private rebuildCollectionTabs() {
    const tabs: CollectionTab[] = [
      { id: 'all', kind: 'all', label: 'Todas', count: this.galeriaItens.length },
      {
        id: 'unassigned',
        kind: 'unassigned',
        label: 'Sem coleção',
        count: this.galeriaItens.filter((item) => item.colecao_id == null).length,
      },
    ];

    this.selectedPetIds.forEach((petId) => {
      const pet = this.pets.find((p) => String(p.id || p._id) === petId);
      const petNome = String(pet?.nome || 'Pet');
      const colecoes = this.colecoesByPet[petId] || [];
      colecoes.forEach((colecao) => {
        tabs.push({
          id: `collection:${petId}:${colecao.id}`,
          kind: 'collection',
          label: `${petNome}: ${colecao.titulo}`,
          pet_id: petId,
          colecao_id: Number(colecao.id),
          count: this.galeriaItens.filter(
            (item) => item.pet_id === petId && Number(item.colecao_id) === Number(colecao.id),
          ).length,
        });
      });
    });

    this.collectionTabs = tabs;
    if (!this.collectionTabs.some((tab) => tab.id === this.activeCollectionTabId)) {
      this.activeCollectionTabId = 'all';
    }
  }

  fechar() {
    this.close.emit();
  }
}
