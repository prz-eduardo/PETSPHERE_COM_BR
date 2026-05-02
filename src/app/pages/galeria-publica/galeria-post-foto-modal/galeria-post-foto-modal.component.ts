import {
  Component,
  EventEmitter,
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
    }
  }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['open'] && this.open && isPlatformBrowser(this.platformId)) {
      void this.loadPets();
    }
    if (ch['open'] && !this.open) {
      this.resetForm();
    }
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
      const list = await this.api.getPetsByCliente(cid, token).toPromise();
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
    const me: any = await this.api.getClienteMe(token).toPromise();
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

  onFileInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const incoming = Array.from(input.files || []);
    if (!incoming.length) return;

    const accepted: PreviewFile[] = [];
    const rejected: string[] = [];

    for (const f of incoming) {
      const mime = (f.type || '').toLowerCase();
      if (!ALLOWED_MIMES.has(mime)) {
        rejected.push(`${f.name}: formato não suportado`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        rejected.push(`${f.name}: maior que ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB`);
        continue;
      }
      if (this.files.length + accepted.length >= MAX_FILES) {
        rejected.push(`${f.name}: limite de ${MAX_FILES} fotos atingido`);
        continue;
      }
      accepted.push({
        file: f,
        url: this.createObjectUrl(f),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    }

    this.files = [...this.files, ...accepted];

    if (rejected.length) {
      this.toast.info(rejected.join('\n'));
    }

    input.value = '';
    this.fileInputReset++;
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
  }

  close(): void {
    this.closeModal.emit();
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
    fd.append('primary_pet_id', String(this.selectedOrder[0]));
    if (this.caption?.trim()) {
      fd.append('caption', this.caption.trim());
    }
    fd.append('galeria_publica', this.galeriaPublica ? '1' : '0');

    this.submitting = true;
    this.api.createPost(cid, fd, token).subscribe({
      next: () => {
        this.submitting = false;
        const n = this.files.length;
        const label = n === 1 ? 'foto publicada' : `${n} fotos publicadas`;
        this.toast.success(`Post criado com ${label}!`);
        this.clienteAreaModal.notifyGaleriaFotosChanged();
        this.clienteAreaModal.notifyPetsChanged();
        this.resetForm();
        this.posted.emit();
        this.close();
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.error || err?.error?.message || 'Não foi possível enviar a foto.';
        this.toast.error(msg);
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
}
