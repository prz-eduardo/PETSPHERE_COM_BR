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
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { ClienteAreaModalService } from '../../../services/cliente-area-modal.service';
import { petInitials as utilPetInitials } from '../gallery-utils';

const MAX_FILES = 12;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CAPTION = 800;
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

interface PreviewFile {
  file: File;
  url: string;
  id: string;
}

@Component({
  selector: 'app-galeria-post-foto-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './galeria-post-foto-modal.component.html',
  styleUrls: ['./galeria-post-foto-modal.component.scss'],
})
export class GaleriaPostFotoModalComponent implements OnChanges, OnInit {
  @Input() open = false;
  @Input() embedded = false;
  @Input() initialPets: any[] | null = null;
  @Input() initialClienteId: number | null = null;
  /** Arquivos pré-carregados (drag-and-drop fora do modal). */
  @Input() initialFiles: File[] | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() posted = new EventEmitter<void>();

  pets: any[] = [];
  private clienteId: number | null = null;

  /** Ordem = pet principal (primeiro) + tags. */
  selectedOrder: number[] = [];
  files: PreviewFile[] = [];
  caption = '';
  galeriaPublica = true;

  loadingPets = false;
  submitting = false;
  fileInputReset = 0;

  /** Drag state for file drop. */
  dragActive = false;
  /** Drag state for preview reorder. */
  private reorderFromIndex: number | null = null;
  reorderHoverIndex: number | null = null;

  readonly maxFiles = MAX_FILES;
  readonly maxFileBytes = MAX_FILE_BYTES;
  readonly maxCaption = MAX_CAPTION;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private clienteAreaModal: ClienteAreaModalService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit(): void {
    if (this.open && isPlatformBrowser(this.platformId)) {
      void this.loadPets();
      this.consumeInitialFiles();
    }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['open'] && this.open && isPlatformBrowser(this.platformId)) {
      void this.loadPets();
      this.consumeInitialFiles();
    }
    if (ch['open'] && !this.open) {
      this.resetForm();
    }
    if (ch['initialFiles'] && this.open) {
      this.consumeInitialFiles();
    }
  }

  private consumeInitialFiles(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const incoming = Array.isArray(this.initialFiles) ? this.initialFiles : null;
    if (!incoming || !incoming.length) return;
    this.addFiles(incoming);
    this.initialFiles = null;
  }

  // ---------------------------------------------------------------------------
  // Carregamento de pets
  // ---------------------------------------------------------------------------

  private async loadPets(): Promise<void> {
    if (this.applyInitialPets()) return;
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Sessão expirada. Faça login novamente.');
      this.close();
      return;
    }
    this.loadingPets = true;
    this.pets = [];
    this.clienteId = null;
    try {
      const cid = await this.resolveClienteId(token);
      if (!cid) {
        this.toast.error('Não foi possível identificar o seu cadastro.');
        this.close();
        return;
      }
      this.clienteId = cid;
      const list = await firstValueFrom(this.api.getPetsByCliente(cid, token));
      this.pets = Array.isArray(list) ? list : [];
      this.selectedOrder = [];
      if (!this.pets.length) {
        this.toast.info('Cadastre um pet em Meus Pets para publicar fotos.');
      }
    } catch (error) {
      console.warn('Falha ao carregar pets para postagem na galeria', error);
      this.toast.error('Não foi possível carregar seus pets.');
    } finally {
      this.loadingPets = false;
    }
  }

  private applyInitialPets(): boolean {
    if (!Array.isArray(this.initialPets) || !this.initialPets.length) return false;
    this.pets = [...this.initialPets];
    this.clienteId = this.initialClienteId ?? this.clienteId;
    this.selectedOrder = [];
    this.loadingPets = false;
    return true;
  }

  private async resolveClienteId(token: string): Promise<number | null> {
    const me: any = await firstValueFrom(this.api.getClienteMe(token));
    const cid = Number(me?.user?.id ?? me?.id ?? 0);
    return !isNaN(cid) && cid > 0 ? cid : null;
  }

  // ---------------------------------------------------------------------------
  // Seleção de pets
  // ---------------------------------------------------------------------------

  isSelected(petId: number): boolean {
    return this.selectedOrder.indexOf(petId) >= 0;
  }

  togglePet(petId: number): void {
    const i = this.selectedOrder.indexOf(petId);
    if (i >= 0) {
      this.selectedOrder = this.selectedOrder.filter((id) => id !== petId);
    } else {
      this.selectedOrder = [...this.selectedOrder, petId];
    }
  }

  selectionIndex(petId: number): number {
    return this.selectedOrder.indexOf(petId) + 1;
  }

  resolvePetAvatar(pet: any): string | null {
    try {
      const raw = String(pet?.photoURL || pet?.foto || pet?.photo || pet?.photo_url || '').trim();
      return raw ? this.api.resolveMediaUrl(raw) : null;
    } catch {
      return null;
    }
  }

  petInitials(nome?: string): string {
    return utilPetInitials(nome);
  }

  petMeta(pet: any): string {
    return String(pet?.raca || pet?.especie || pet?.tipo || '').trim();
  }

  orderNames(): string {
    if (!this.selectedOrder.length) return '';
    const byId = new Map(this.pets.map((p) => [p.id, p.nome || `#${p.id}`]));
    return this.selectedOrder.map((id) => byId.get(id) || `#${id}`).join(' → ');
  }

  openNovoPet(): void {
    this.close();
    setTimeout(() => this.clienteAreaModal.open('novo-pet'), 0);
  }

  // ---------------------------------------------------------------------------
  // Arquivos: validação client-side, preview, reorder
  // ---------------------------------------------------------------------------

  /** Núcleo único de validação/aceite — usado por input, drop e initialFiles. */
  addFiles(incoming: File[] | FileList | null | undefined): void {
    const list: File[] = incoming ? Array.from(incoming as ArrayLike<File>) : [];
    if (!list.length) return;

    const accepted: PreviewFile[] = [];
    const rejected: string[] = [];
    const startCount = this.files.length;

    for (const f of list) {
      const mime = (f.type || '').toLowerCase();
      if (!ALLOWED_MIMES.has(mime)) {
        rejected.push(`${f.name}: formato não suportado`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        rejected.push(`${f.name}: maior que ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB`);
        continue;
      }
      if (startCount + accepted.length >= MAX_FILES) {
        rejected.push(`${f.name}: limite de ${MAX_FILES} fotos atingido`);
        continue;
      }
      accepted.push({
        file: f,
        url: this.createObjectUrl(f),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    }

    if (accepted.length) this.files = [...this.files, ...accepted];

    if (rejected.length) {
      this.toast.info(rejected.join('\n'));
    }

    this.fileInputReset++;
  }

  onFileInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }

  removeFile(idx: number): void {
    const item = this.files[idx];
    if (item?.url) this.revokeObjectUrl(item.url);
    this.files = this.files.filter((_, i) => i !== idx);
  }

  moveFile(from: number, to: number): void {
    if (from === to || from < 0 || to < 0 || from >= this.files.length || to >= this.files.length) return;
    const next = [...this.files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    this.files = next;
  }

  fileInputId(): string {
    return `gpf-file-${this.fileInputReset}`;
  }

  trackById = (_: number, item: PreviewFile) => item.id;

  // ---------------------------------------------------------------------------
  // Drag & Drop: arquivos no wrapper inteiro
  // ---------------------------------------------------------------------------

  onDialogDragOver(ev: DragEvent): void {
    if (!this.hasFilesPayload(ev)) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    this.dragActive = true;
  }

  onDialogDragLeave(ev: DragEvent): void {
    if (!this.dragActive) return;
    const related = ev.relatedTarget as Node | null;
    const current = ev.currentTarget as Node | null;
    if (current && related && current.contains(related)) return;
    this.dragActive = false;
  }

  onDialogDrop(ev: DragEvent): void {
    if (!this.hasFilesPayload(ev)) return;
    ev.preventDefault();
    this.dragActive = false;
    const dt = ev.dataTransfer;
    if (!dt) return;
    this.addFiles(dt.files);
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
  // Drag & Drop: reorder de previews (HTML5 nativo)
  // ---------------------------------------------------------------------------

  onPreviewDragStart(idx: number, ev: DragEvent): void {
    this.reorderFromIndex = idx;
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move';
      try { ev.dataTransfer.setData('text/plain', String(idx)); } catch { /* noop */ }
    }
  }

  onPreviewDragOver(idx: number, ev: DragEvent): void {
    if (this.reorderFromIndex === null) return;
    ev.preventDefault();
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
    this.reorderHoverIndex = idx;
  }

  onPreviewDrop(idx: number, ev: DragEvent): void {
    if (this.reorderFromIndex === null) return;
    ev.preventDefault();
    const from = this.reorderFromIndex;
    this.reorderFromIndex = null;
    this.reorderHoverIndex = null;
    if (from !== idx) this.moveFile(from, idx);
  }

  onPreviewDragEnd(): void {
    this.reorderFromIndex = null;
    this.reorderHoverIndex = null;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  private resetForm(): void {
    for (const item of this.files) {
      if (item.url) this.revokeObjectUrl(item.url);
    }
    this.selectedOrder = [];
    this.files = [];
    this.caption = '';
    this.galeriaPublica = true;
    this.clienteId = null;
    this.fileInputReset++;
    this.dragActive = false;
    this.reorderFromIndex = null;
    this.reorderHoverIndex = null;
  }

  close(): void {
    this.closeModal.emit();
  }

  /** Evita click-through para elementos sob o modal (dock / FAB) após sucesso do upload. */
  private schedulePostSuccessFinalize(): void {
    const run = (): void => {
      this.submitting = false;
      this.clienteAreaModal.notifyGaleriaFotosChanged();
      this.clienteAreaModal.notifyPetsChanged();
      this.resetForm();
      this.posted.emit();
      this.close();
    };
    if (!isPlatformBrowser(this.platformId)) {
      run();
      return;
    }
    window.setTimeout(run, 50);
  }

  submit(ev?: Event): void {
    if (ev) ev.preventDefault();
    const token = this.auth.getToken();
    if (!token) {
      this.toast.info('Faça login para postar.');
      this.close();
      return;
    }
    const cid = this.clienteId;
    if (cid == null) {
      this.toast.error('Sessão inválida.');
      return;
    }
    if (this.selectedOrder.length < 1) {
      this.toast.info('Selecione ao menos um pet que aparece na foto.');
      return;
    }
    if (!this.files.length) {
      this.toast.info('Escolha pelo menos uma imagem.');
      return;
    }

    const fd = new FormData();
    for (const item of this.files) {
      fd.append('foto', item.file, item.file.name);
    }
    fd.append('pet_ids', JSON.stringify(this.selectedOrder));
    if (this.caption?.trim()) {
      fd.append('caption', this.caption.trim());
    }
    fd.append('galeria_publica', this.galeriaPublica ? '1' : '0');

    this.submitting = true;
    this.api.createPost(cid, fd, token).subscribe({
      next: (resp: any) => {
        // Backend devolve `images`; alguns caminhos legados usam `imagens`.
        const postImages = resp?.post?.images ?? resp?.post?.imagens;
        const inserted = Array.isArray(postImages) ? postImages.length : 0;
        const failed: Array<{ filename?: string; reason?: string }> = Array.isArray(resp?.failures)
          ? resp.failures
          : [];

        if (inserted === 0) {
          this.submitting = false;
          const msg = failed.length
            ? `Nenhuma foto foi publicada. ${failed.length} falharam.`
            : 'Nenhuma foto foi publicada.';
          this.toast.error(msg);
          return;
        }

        if (failed.length) {
          const names = failed.map((f) => f.filename || '?').join(', ');
          this.toast.info(
            `${inserted} foto(s) publicada(s). ${failed.length} falharam: ${names}`
          );
        } else {
          this.toast.success(
            inserted === 1 ? 'Foto publicada!' : `${inserted} fotos publicadas!`
          );
        }

        // Adia fechar o overlay: se o DOM some no mesmo ciclo do clique/toque em
        // "Publicar", o evento pode cair no FAB/login do dock e abrir o painel do tutor.
        this.schedulePostSuccessFinalize();
      },
      error: (err: any) => {
        this.submitting = false;
        const failed: Array<{ filename?: string; reason?: string }> = Array.isArray(err?.error?.failures)
          ? err.error.failures
          : [];
        const baseMsg = err?.error?.error || err?.error?.message;
        const fallback = failed.length
          ? `Falha ao enviar. ${failed.length} arquivo(s) rejeitado(s) pelo servidor.`
          : 'Não foi possível enviar a foto.';
        this.toast.error(baseMsg || fallback);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers (object URL — só client-side)
  // ---------------------------------------------------------------------------

  private createObjectUrl(file: File): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      return URL.createObjectURL(file);
    } catch {
      return '';
    }
  }

  private revokeObjectUrl(url: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }

  // Bloqueia comportamento padrão de "abrir arquivo" se cair fora do dialog.
  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(ev: DragEvent): void {
    if (!this.open) return;
    if (this.hasFilesPayload(ev)) ev.preventDefault();
  }

  @HostListener('window:drop', ['$event'])
  onWindowDrop(ev: DragEvent): void {
    if (!this.open) return;
    if (this.hasFilesPayload(ev)) ev.preventDefault();
  }
}
