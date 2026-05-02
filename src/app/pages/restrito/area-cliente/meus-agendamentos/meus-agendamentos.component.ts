import {
  Component,
  EventEmitter,
  Inject,
  Input,
  OnInit,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  ApiService,
  ClienteAgendamentoTimelineItem,
  ClienteAgendamentoTimelineKind,
  ClienteAgendamentoTimelineQuery,
} from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';
import { HttpErrorResponse } from '@angular/common/http';

export interface MeusAgendamentosPetOption {
  id: string | number;
  nome: string;
  tipo?: string;
  especie?: string;
  especie_id?: number | null;
}

@Component({
  selector: 'app-meus-agendamentos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent],
  templateUrl: './meus-agendamentos.component.html',
  styleUrls: ['./meus-agendamentos.component.scss'],
})
export class MeusAgendamentosComponent implements OnInit {
  @Input() modal = false;
  /** Pets do tutor (opcional; usado nos filtros). */
  @Input() petsCatalogo: MeusAgendamentosPetOption[] = [];
  @Output() close = new EventEmitter<void>();

  loading = false;
  loadError: string | null = null;
  itens: ClienteAgendamentoTimelineItem[] = [];

  filterKind: '' | ClienteAgendamentoTimelineKind = '';
  filterPetId = '';
  filterParceiroId = '';
  filterEspecieId = '';
  filterDataInicio = '';
  filterDataFim = '';

  parceiroOptions: { id: number; nome: string }[] = [];
  especieOptions: { id: number; label: string }[] = [];

  readonly kindLabels: Record<ClienteAgendamentoTimelineKind, string> = {
    agenda: 'Loja / serviço',
    telemedicina: 'Telemedicina',
    hotel: 'Hospedagem',
  };

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.rebuildEspecieOptions();
    if (this.isBrowser) {
      this.ensurePetsCatalogoIfEmpty();
      this.load();
    }
  }

  /** Página `/meus-agendamentos` fora do modal: carrega pets para os filtros. */
  private ensurePetsCatalogoIfEmpty(): void {
    if (this.petsCatalogo?.length) return;
    const t = this.auth.getToken();
    if (!t) return;
    this.api.getClienteMe(t).subscribe({
      next: (me) => {
        const id = Number(me?.user?.id ?? 0);
        if (!id) return;
        this.api.getPetsByCliente(id, t).subscribe({
          next: (pets) => {
            this.petsCatalogo = (pets || []).map((p: any) => ({
              id: p.id,
              nome: p.nome,
              tipo: p.tipo,
              especie: p.especie,
              especie_id: p.especie_id != null ? Number(p.especie_id) : undefined,
            }));
            this.rebuildEspecieOptions();
          },
          error: () => {
            /* filtros por pet ficam vazios */
          },
        });
      },
      error: () => {
        /* ignore */
      },
    });
  }

  private rebuildEspecieOptions(): void {
    const map = new Map<number, string>();
    for (const p of this.petsCatalogo || []) {
      const eid = p.especie_id != null ? Number(p.especie_id) : NaN;
      if (!Number.isFinite(eid) || eid < 1) continue;
      const label = (p.especie || p.tipo || `Espécie #${eid}`).trim();
      if (!map.has(eid)) map.set(eid, label || `Espécie #${eid}`);
    }
    this.especieOptions = [...map.entries()].map(([id, label]) => ({ id, label }));
  }

  voltar(): void {
    if (this.modal) {
      this.close.emit();
      return;
    }
    void this.router.navigateByUrl('/area-cliente');
  }

  load(): void {
    const token = this.auth.getToken();
    if (!token) {
      this.loadError = 'Faça login para ver seus agendamentos.';
      return;
    }
    this.loading = true;
    this.loadError = null;
    const q: ClienteAgendamentoTimelineQuery = {};
    if (this.filterDataInicio.trim()) q.data_inicio = this.filterDataInicio.trim();
    if (this.filterDataFim.trim()) q.data_fim = this.filterDataFim.trim();
    const pid = parseInt(this.filterPetId, 10);
    if (Number.isFinite(pid) && pid > 0) q.pet_id = pid;
    const parId = parseInt(this.filterParceiroId, 10);
    if (Number.isFinite(parId) && parId > 0) q.parceiro_id = parId;
    const espId = parseInt(this.filterEspecieId, 10);
    if (Number.isFinite(espId) && espId > 0) q.especie_id = espId;
    if (this.filterKind) q.kind = this.filterKind;

    this.api.listClienteAgendamentosTimeline(token, q).subscribe({
      next: (res) => {
        this.itens = res?.itens || [];
        this.mergeParceiroOptionsFromItems(this.itens);
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        const msg =
          err?.error?.error ||
          err?.error?.message ||
          err?.message ||
          'Não foi possível carregar os agendamentos.';
        this.loadError = typeof msg === 'string' ? msg : 'Erro ao carregar.';
        this.toast.error(this.loadError, 'Agendamentos');
      },
    });
  }

  private mergeParceiroOptionsFromItems(rows: ClienteAgendamentoTimelineItem[]): void {
    const byId = new Map<number, string>();
    for (const o of this.parceiroOptions) byId.set(o.id, o.nome);
    for (const it of rows || []) {
      const id = Number(it.parceiro_id);
      if (!Number.isFinite(id) || id < 1) continue;
      const nome = (it.parceiro_nome || `Parceiro #${id}`).trim();
      byId.set(id, nome);
    }
    this.parceiroOptions = [...byId.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  setKind(k: '' | ClienteAgendamentoTimelineKind): void {
    this.filterKind = k;
    this.load();
  }

  applyFilters(): void {
    this.load();
  }

  clearFilters(): void {
    this.filterKind = '';
    this.filterPetId = '';
    this.filterParceiroId = '';
    this.filterEspecieId = '';
    this.filterDataInicio = '';
    this.filterDataFim = '';
    this.load();
  }

  kindBadgeClass(kind: ClienteAgendamentoTimelineKind): string {
    if (kind === 'telemedicina') return 'ma-card__badge--teal';
    if (kind === 'hotel') return 'ma-card__badge--amber';
    return 'ma-card__badge--lime';
  }

  goTelemedicina(): void {
    if (this.modal) {
      this.close.emit();
    }
    void this.router.navigateByUrl('/area-cliente?view=telemedicina');
  }

  formatRange(it: ClienteAgendamentoTimelineItem): string {
    const a = it.inicio ? this.fmtDate(it.inicio) : '—';
    const b = it.fim ? this.fmtDate(it.fim) : '—';
    return `${a} → ${b}`;
  }

  private fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  get hasPetOrEspecieFilter(): boolean {
    return (
      (this.filterPetId !== '' && this.filterPetId !== '0') ||
      (this.filterEspecieId !== '' && this.filterEspecieId !== '0')
    );
  }
}
