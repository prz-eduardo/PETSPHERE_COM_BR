import { Component, Inject, PLATFORM_ID, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService, ClienteMeResponse, PetVacinasResumo } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { NavmenuComponent } from '../../navmenu/navmenu.component';

@Component({
  selector: 'app-meus-pets',
  standalone: true,
  imports: [CommonModule, RouterModule, NavmenuComponent],
  templateUrl: './meus-pets.component.html',
  styleUrls: ['./meus-pets.component.scss']
})
export class MeusPetsComponent implements OnChanges {
  @Input() modal: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() newPet = new EventEmitter<void>();
  // Emit when user requests to edit a pet (id or full pet object)
  @Output() editPet = new EventEmitter<string | number>();
  /** Após excluir um pet (para o host atualizar a lista, ex. área do cliente em modal) */
  @Output() petDeleted = new EventEmitter<void>();
  @Input() clienteMe: any | null = null;
  @Input() pets: any[] = [];
  /** Placeholders para skeleton de carregamento */
  readonly skeletonSlots = [0, 1, 2];
  carregando = true;
  /** id do pet em exclusão (evita cliques duplicados) */
  deletingPetId: string | null = null;
  pendingDeletePet: any | null = null;
  // track image loaded state per pet (key by id when available, otherwise by index fallback)
  petImageLoaded: Record<string, boolean> = {};

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ){}

  onNewPetClick(ev?: Event) {
    if (ev && (ev as Event).preventDefault) (ev as Event).preventDefault();
    if (this.modal) {
      // ask parent to open novo-pet inside the modal host
      try { this.newPet.emit(); } catch (e) {}
      return;
    }
    // otherwise navigate to the novo-pet route
    try { this.router.navigateByUrl('/novo-pet'); } catch (e) { try { (window as any).location.href = '/novo-pet'; } catch {} }
  }

  private getClienteIdNum(): number | null {
    const c: any = this.clienteMe;
    if (!c) return null;
    const id = c.user?.id ?? c.id;
    const n = Number(id);
    return isNaN(n) || n <= 0 ? null : n;
  }

  onDeleteClick(ev: Event, pet: any) {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    const id = this.resolvePetId(pet);
    if (!id || !this.token) {
      this.toast?.info('Não foi possível excluir: sessão ou pet inválido.');
      return;
    }
    this.pendingDeletePet = pet;
  }

  cancelDelete(): void {
    if (this.deletingPetId) return;
    this.pendingDeletePet = null;
  }

  confirmDelete(): void {
    const pet = this.pendingDeletePet;
    const id = this.resolvePetId(pet);
    if (!id || !this.token) {
      this.pendingDeletePet = null;
      this.toast?.info('Não foi possível excluir: sessão ou pet inválido.');
      return;
    }
    const cid = this.getClienteIdNum();
    if (cid == null) {
      this.pendingDeletePet = null;
      this.toast.error('Não foi possível identificar o cliente.', 'Erro');
      return;
    }
    this.deletingPetId = id;
    this.api.deletePet(cid, id, this.token).subscribe({
      next: () => {
        this.deletingPetId = null;
        this.pendingDeletePet = null;
        this.pets = (this.pets || []).filter((p) => String(this.resolvePetId(p)) !== id);
        this.initImageLoadState();
        this.toast.success('Pet excluído.');
        if (this.modal) this.petDeleted.emit();
      },
      error: (err: any) => {
        this.deletingPetId = null;
        const st = err?.status;
        const body = err?.error;
        const msg =
          st === 409
            ? (body?.error || 'Este pet possui receitas vinculadas e não pode ser excluído.')
            : body?.error || body?.message || err?.message || 'Erro ao excluir pet';
        this.toast.error(msg, 'Erro');
      }
    });
  }

  pendingDeleteName(): string {
    return (this.pendingDeletePet && this.pendingDeletePet.nome) || 'este pet';
  }

  // When edit is requested from a pet card
  onEditClick(pet: any) {
    if (!pet) return;
    const id = this.resolvePetId(pet);
    // debug log to help local testing
    try { console.debug('MeusPetsComponent.onEditClick -> resolved id:', id, pet); } catch {}
    if (this.modal) {
      if (id) this.editPet.emit(id);
      else this.toast?.info('ID do pet não encontrado para edição');
    } else {
      if (id) {
        try { this.router.navigateByUrl('/editar-pet/' + encodeURIComponent(String(id))); }
        catch (e) { try { (window as any).location.href = '/editar-pet/' + encodeURIComponent(String(id)); } catch {} }
      } else {
        // no id — avoid navigating to /editar-pet/null
        try { console.warn('Não é possível navegar: pet sem id', pet); } catch {}
      }
    }
  }

  /** Exposto para o template (desabilitar botão durante exclusão). */
  idFor(pet: any): string | null {
    return this.resolvePetId(pet);
  }

  // Robust pet id resolver: supports `id`, `_id` and `_id.$oid` shapes
  private resolvePetId(pet: any): string | null {
    if (!pet) return null;
    if (pet.id) return String(pet.id);
    if (pet._id) {
      if (typeof pet._id === 'object' && pet._id !== null) {
        if ((pet._id as any).$oid) return String((pet._id as any).$oid);
      }
      return String(pet._id);
    }
    return null;
  }

  private get token(): string | null {
    return isPlatformBrowser(this.platformId) ? this.auth.getToken() : null;
  }

  ngOnInit(){
    // If parent passed cliente/pets via @Input, use them and avoid extra API calls
    if (this.clienteMe && Array.isArray(this.pets) && this.pets.length > 0) {
      // initialize image load and allergy state for provided pets
      this.initImageLoadState();
      this.carregando = false;
      return;
    }

    const t = this.token;
    if (!t) { this.carregando = false; return; }

    // If we have cliente but no pets, fetch only pets
    if (this.clienteMe && !this.pets?.length) {
      const id = Number(this.clienteMe?.user?.id || this.clienteMe?.id || 0);
      if (!isNaN(id) && id > 0) {
        this.api.getPetsByCliente(id, t).subscribe({
          next: (res) => { this.pets = res || []; this.initImageLoadState(); this.carregando = false; },
          error: () => { this.toast.error('Erro ao carregar pets'); this.carregando = false; }
        });
        return;
      }
    }

    // Fallback: fetch cliente and pets
    this.api.getClienteMe(t).subscribe({
      next: (me) => {
        this.clienteMe = me;
        const id = Number(me?.user?.id);
        if (!isNaN(id)) {
          this.api.getPetsByCliente(id, t).subscribe({
            next: (res) => { this.pets = res || []; this.initImageLoadState(); this.carregando = false; },
            error: (err) => { this.toast.error('Erro ao carregar pets'); this.carregando = false; }
          });
        } else { this.carregando = false; }
      },
      error: () => { this.carregando = false; }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pets']) {
      // Reinitialize image/allergy state when parent provides or updates the pets list
      this.initImageLoadState();
    }
  }

  voltar(){
    // If rendered as modal, inform parent to close and return control there
    if (this.modal) {
      this.close.emit();
      return;
    }

    // When opened via the gallery route, prefer returning to gallery.
    // Use document.referrer as a hint; if it contains '/galeria' go back in history
    try {
      const ref = (typeof document !== 'undefined' && document.referrer) ? String(document.referrer) : '';
      if (ref && ref.includes('/galeria')) {
        if (history.length > 1) { history.back(); return; }
        else { this.router.navigateByUrl('/galeria'); return; }
      }
    } catch (e) {}

    // Fallback: prefer browser history if available, otherwise navigate to gallery
    try {
      if (history.length > 1) { history.back(); return; }
    } catch (e) {}
    this.router.navigateByUrl('/galeria');
  }

  /** Só URL do animal — nunca misturar com foto de tutor/cliente. */
  getPetImageSrc(p: any): string {
    if (!p) {
      return this.petImagePlaceholder;
    }
    const raw = (p.photoURL || p.foto || p.photo || p.photo_url || p.imagem || '').toString().trim();
    if (!raw) {
      return this.petImagePlaceholder;
    }
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('blob:')) {
      return raw;
    }
    if (raw.startsWith('/')) {
      return raw;
    }
    return '/' + raw.replace(/^\/+/, '');
  }

  get petImagePlaceholder(): string {
    return '/icones/pin-pata.svg';
  }

  onPetImgError(event: Event) {
    const img = event?.target as HTMLImageElement | null;
    if (img) {
      img.src = this.petImagePlaceholder;
    }
  }

  // Called when an image finishes loading
  onImgLoad(pet: any, index: number) {
    const key = this.imageKey(pet, index);
    this.petImageLoaded[key] = true;
  }

  // Return a normalized list of allergy names for a pet
  alergiasFor(pet: any): string[] {
    if (!pet) return [];
    const out: string[] = [];
    // Primary allergy array (various shapes)
    if (Array.isArray(pet.alergias)) {
      pet.alergias.forEach((a: any) => {
        if (!a) return;
        if (typeof a === 'string') out.push(a);
        else if (typeof a === 'object') out.push(a.nome || a.nome_alergia || a.name || String(a));
      });
    }
    // Predefined allergies from API shape
    if (Array.isArray(pet.alergias_predefinidas)) {
      pet.alergias_predefinidas.forEach((a: any) => {
        if (!a) return;
        out.push(a.nome || a.name || String(a));
      });
    }
    // Deduplicate and filter empties
    return Array.from(new Set(out.filter(Boolean)));
  }

  // Helper to generate a stable key for a pet
  private imageKey(pet: any, index: number) {
    return (pet && (pet.id || pet._id)) ? String(pet.id || pet._id) : `i_${index}`;
  }

  isImageLoaded(pet: any, index: number): boolean {
    const key = this.imageKey(pet, index);
    return !!this.petImageLoaded[key];
  }

  // Initialize tracking state for current pets list
  private initImageLoadState() {
    this.petImageLoaded = {};
    (this.pets || []).forEach((p, idx) => {
      const key = this.imageKey(p, idx);
      const src = p ? this.getPetImageSrc(p) : this.petImagePlaceholder;
      this.petImageLoaded[key] = !p || src === this.petImagePlaceholder;
      // normalize and attach allergy list to pet for easier template binding
      try { p._alergiasNormalized = this.alergiasFor(p); } catch { p._alergiasNormalized = []; }
      try {
        const traits = Array.isArray((p as any).pet_traits) ? (p as any).pet_traits : [];
        (p as any)._traitsNormalized = [...new Set(traits.map((t: any) => t?.nome).filter(Boolean))];
      } catch {
        try { (p as any)._traitsNormalized = []; } catch { /* noop */ }
      }
    });
  }

  /** Anos para exibir: prioriza `idade`/`idadeAnos`; se ausente usa `data_nascimento`. */
  idadeAnosParaCard(pet: any): number | null {
    if (!pet) return null;
    const fld = pet.idade ?? pet.idadeAnos;
    if (fld != null && fld !== '') {
      const n = Number(fld);
      if (!Number.isNaN(n)) return n;
    }
    const ymd = this.coerceYmd(pet.data_nascimento ?? pet.dataNascimento);
    return ymd != null ? this.anosDesdeYmd(ymd) : null;
  }

  castradoBadge(pet: any): string {
    const c = pet?.castrado;
    if (c === true || c === 1 || c === '1') return 'Castrado(a)';
    if (c === false || c === 0 || c === '0') return 'Não castrado(a)';
    return '';
  }

  /** Rótulo e variante visual para resumo de vacinas no card. */
  vacinasEtiqueta(pet: any): { text: string; mod: 'neutral' | 'ok' | 'warn' | 'alert' } | null {
    const r = pet?.vacinas_resumo as PetVacinasResumo | undefined;
    if (!r) return null;
    if (r.status === 'sem_registros' || !r.vacinas_count) {
      return { text: 'Carteira: sem registros', mod: 'neutral' };
    }
    if (r.status === 'atrasada') {
      return { text: 'Carteira: reforço em atraso', mod: 'alert' };
    }
    if (r.status === 'proxima') {
      const d = r.proxima_reforco ? this.formatarBrDataCurta(r.proxima_reforco) : '';
      return { text: d ? `Próx. dose ${d}` : 'Próxima dose em breve', mod: 'warn' };
    }
    return { text: `${r.vacinas_count} dose(s) na carteira`, mod: 'ok' };
  }

  private formatarBrDataCurta(ymd: string): string {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return ymd;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  porteBadge(pet: any): string {
    const t = pet?.porte;
    if (!t || String(t).trim() === '') return '';
    const s = String(t).trim().toLowerCase();
    if (s === 'pequeno') return 'Porte peq.';
    if (s === 'medio' || s === 'médio') return 'Porte médio';
    if (s === 'grande') return 'Porte grande';
    return `Porte: ${String(t)}`;
  }

  private coerceYmd(raw: unknown): string | null {
    if (!raw) return null;
    const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  private anosDesdeYmd(ymd: string): number | null {
    const parts = ymd.split('-').map(Number);
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    const [Y, M, D] = parts;
    const birth = new Date(Y, M - 1, D);
    const today = new Date();
    if (birth > today) return null;
    let age = today.getFullYear() - birth.getFullYear();
    const mo = today.getMonth() - birth.getMonth();
    if (mo < 0 || (mo === 0 && today.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  }
}
