import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PetImagemPatchPayload } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';

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

  selectedPetId: string | null = null;
  selectedPet: any = null;

  // Gallery state
  galeriaItens: Array<{ id: number; url: string; colecao_id?: number | null; legenda?: string | null; galeria_publica?: number | boolean | string | null }> = [];
  colecoes: Array<{ id: number; titulo: string }> = [];
  novoTituloColecao = '';

  // Upload
  fotoFiles: File[] = [];
  fotoPreviews: string[] = [];

  // Gallery item editing
  selectedGalleryItem: { id: number; url: string; colecao_id?: number | null; legenda?: string | null; galeria_publica?: number | boolean | string | null } | null = null;
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

  private syncPetSelectionWithInputs() {
    const pets = Array.isArray(this.pets) ? this.pets : [];
    if (!pets.length) {
      this.selectedPetId = null;
      this.selectedPet = null;
      this.galeriaItens = [];
      return;
    }

    if (this.selectedPetId) {
      const keep = pets.find((p) => String(p.id || p._id) === String(this.selectedPetId));
      if (keep) {
        this.selectedPet = keep;
        this.carregarGaleria();
        return;
      }
    }

    this.onPetSelect(pets[0].id || pets[0]._id);
  }

  onPetSelect(petId: string | number | null | undefined) {
    if (!petId) return;
    this.selectedPetId = String(petId);
    this.selectedPet = this.pets.find(p => String(p.id || p._id) === this.selectedPetId);
    
    // Limpar estados antigos
    this.galeriaItens = [];
    this.colecoes = [];
    this.fotoFiles = [];
    this.fotoPreviews = [];
    this.selectedGalleryItem = null;
    this.novoTituloColecao = '';

    if (this.selectedPet) {
      this.carregarGaleria();
    }
  }

  private carregarGaleria() {
    if (!this.selectedPetId || !this.token) return;

    const gi = this.selectedPet?.galeria_imagens;
    if (Array.isArray(gi) && gi.length) {
      this.galeriaItens = gi
        .map((x: any) => ({
          id: Number(x.id),
          url: x.url,
          colecao_id: x.colecao_id != null ? Number(x.colecao_id) : null,
          legenda: x.legenda ?? null,
          galeria_publica: x.galeria_publica ?? 1,
        }))
        .filter((x: any) => x.url && String(x.url).trim() && !isNaN(x.id));
    } else {
      this.galeriaItens = [];
    }

    this.carregarColecoes();
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

  carregarColecoes() {
    if (!this.selectedPetId || !this.token) return;
    this.api.listPetColecoes(this.selectedPetId, this.token).subscribe({
      next: (r: any) => { this.colecoes = Array.isArray(r) ? r : []; },
      error: () => { this.colecoes = []; }
    });
  }

  criarColecao() {
    if (!this.selectedPetId || !this.token) return;
    const tit = (this.novoTituloColecao || '').trim() || 'Coleção';
    this.api.createPetColecao(this.selectedPetId, { titulo: tit }, this.token).subscribe({
      next: () => {
        this.novoTituloColecao = '';
        this.toast.success('Coleção criada. Atribua as fotos abaixo.');
        this.carregarColecoes();
      },
      error: (e: any) => this.toast.error(e?.error?.error || 'Não foi possível criar a coleção', 'Erro')
    });
  }

  openGalleryItemSettings(item: { id: number; url: string; colecao_id?: number | null; legenda?: string | null; galeria_publica?: number | boolean | string | null }) {
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
    const visivel = !(item.galeria_publica === false || item.galeria_publica === 0 || item.galeria_publica === '0');
    if (item.colecao_id && visivel) return 'Pública em coleção';
    if (item.colecao_id && !visivel) return 'Privada em coleção';
    if (visivel) return 'Pública no feed';
    return 'Privada';
  }

  saveGalleryItemSettings() {
    if (!this.selectedPetId || !this.token) return;
    const item = this.selectedGalleryItem;
    if (!item?.id) return;

    const payload: PetImagemPatchPayload = {
      colecao_id: this.galleryDraft.colecao_id,
      legenda: this.galleryDraft.legenda.trim() || null,
      galeria_publica: this.galleryDraft.galeria_publica ? 1 : 0,
    };

    this.savingGalleryItem = true;
    this.api.patchPetImagem(this.selectedPetId, item.id, payload, this.token).subscribe({
      next: (res: any) => {
        const imagem = (res as any)?.imagem;
        if (imagem) {
          const idx = this.galeriaItens.findIndex((g) => g.id === item.id);
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
      },
      error: (err: any) => {
        this.savingGalleryItem = false;
        this.toast.error(err?.error?.error || 'Não foi possível salvar a configuração da foto.', 'Erro');
      }
    });
  }

  onColecaoImagemChange(g: { id: number; url: string; colecao_id?: number | null }, raw: any) {
    if (!this.selectedPetId || !this.token || !g?.id) return;
    const v = raw == null || raw === '' || raw === 'null' || (typeof raw === 'string' && raw === '') ? null : Number(raw);
    this.api.patchPetImagem(this.selectedPetId, g.id, { colecao_id: v as any }, this.token).subscribe({
      next: (res) => {
        g.colecao_id = (res as any)?.imagem?.colecao_id != null ? Number((res as any).imagem.colecao_id) : v;
        this.toast.info('Coleção atualizada.');
      },
      error: (e: any) => this.toast.error(e?.error?.error || 'Falha ao mover foto', 'Erro')
    });
  }

  salvarFotos() {
    if (!this.selectedPetId || !this.token || !this.getClienteIdNum()) {
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
    this.api.updatePet(this.getClienteIdNum()!, this.selectedPetId, fd, this.token).subscribe({
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

  excluirFoto(item: { id: number; url: string } | null) {
    if (!item || !item.id) return;
    if (!this.selectedPetId || !this.token) return;
    if (typeof window !== 'undefined' && !window.confirm('Excluir esta foto da galeria? Essa ação não pode ser desfeita.')) {
      return;
    }
    this.deletingGalleryItem = true;
    this.api.deletePetImagem(this.selectedPetId, item.id, this.token).subscribe({
      next: () => {
        this.galeriaItens = this.galeriaItens.filter((g) => g.id !== item.id);
        this.toast.success('Foto removida.');
        this.selectedGalleryItem = null;
        this.refreshPetsFromServer(() => { this.deletingGalleryItem = false; });
      },
      error: (err: any) => {
        const msg = err?.error?.message || err?.error?.error || err?.message || 'Erro ao remover foto';
        this.toast.error(msg, 'Erro');
        this.deletingGalleryItem = false;
      }
    });
  }

  definirComoCapa(item: { id: number; url: string } | null) {
    if (!item || !item.id) return;
    if (!this.selectedPetId || !this.token) return;
    this.settingCoverGalleryItem = true;
    this.api.patchPetImagem(this.selectedPetId, item.id, { set_as_cover: true }, this.token).subscribe({
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
        this.pets = Array.isArray(lista) ? lista : [];
        if (this.selectedPetId) {
          this.selectedPet = this.pets.find((p) => String(p.id || p._id) === String(this.selectedPetId)) || null;
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

  fechar() {
    this.close.emit();
  }
}
