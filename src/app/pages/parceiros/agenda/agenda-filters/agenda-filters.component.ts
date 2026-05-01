import {
  Component, Input, Output, EventEmitter, OnInit, signal, computed, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Agendamento, AgendaFiltros, AgendaStatus, Profissional, Servico
} from '../../../../types/agenda.types';
import { getTime, toDate } from '../utils/date-helpers';

@Component({
  selector: 'app-agenda-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agenda-filters.component.html',
  styleUrls: ['./agenda-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaFiltersComponent implements OnInit {
  @Input() agendamentos: Agendamento[] = [];
  @Input() profissionais: Profissional[] = [];
  @Input() servicos: Servico[] = [];
  @Output() filtersChange = new EventEmitter<AgendaFiltros>();

  expanded = signal(false);
  search = signal('');
  selectedProfId = signal<string>('');
  selectedServicoId = signal<string>('');
  selectedStatuses = signal<AgendaStatus[]>([]);

  readonly ALL_STATUSES: AgendaStatus[] = [
    'AGENDADO', 'CONFIRMADO', 'EM_ANDAMENTO', 'ATRASADO', 'FINALIZADO', 'CANCELADO'
  ];

  readonly STATUS_LABELS: Record<AgendaStatus, string> = {
    AGENDADO: 'Agendado',
    CONFIRMADO: 'Confirmado',
    EM_ANDAMENTO: 'Em andamento',
    ATRASADO: 'Atrasado',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  };

  // ── Insights ────────────────────────────────────────────────────────────

  taxaOcupacao = computed(() => {
    if (!this.agendamentos.length) return 0;
    const ativos = this.agendamentos.filter(
      a => a.status !== 'CANCELADO'
    ).length;
    // assume 20 slots/day as reference
    return Math.min(100, Math.round((ativos / 20) * 100));
  });

  atrasados = computed(() =>
    this.agendamentos.filter(a => a.status === 'ATRASADO').length
  );

  proximoLivre = computed(() => {
    const now = new Date();
    const busy = this.agendamentos
      .filter(a => a.status !== 'CANCELADO')
      .sort((a, b) => getTime(a.inicio) - getTime(b.inicio));

    for (let h = now.getHours(); h < 19; h++) {
      for (const m of [0, 30]) {
        const slot = new Date();
        slot.setHours(h, m, 0, 0);
        if (slot <= now) continue;
        const slotTime = slot.getTime();
        const conflict = busy.find(
          a => getTime(a.inicio) <= slotTime && getTime(a.fim) > slotTime
        );
        if (!conflict) return slot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
    }
    return null;
  });

  ngOnInit(): void {
    this.emit();
  }

  toggleExpanded(): void {
    this.expanded.set(!this.expanded());
  }

  toggleStatus(s: AgendaStatus): void {
    const cur = this.selectedStatuses();
    if (cur.includes(s)) {
      this.selectedStatuses.set(cur.filter(x => x !== s));
    } else {
      this.selectedStatuses.set([...cur, s]);
    }
    this.emit();
  }

  onProfChange(): void { this.emit(); }
  onServicoChange(): void { this.emit(); }
  onSearchChange(): void { this.emit(); }

  clearAll(): void {
    this.selectedProfId.set('');
    this.selectedServicoId.set('');
    this.selectedStatuses.set([]);
    this.search.set('');
    this.emit();
  }

  get hasFilters(): boolean {
    return !!(this.selectedProfId() || this.selectedServicoId() ||
              this.selectedStatuses().length || this.search());
  }

  private emit(): void {
    this.filtersChange.emit({
      profissionalId: this.selectedProfId() || undefined,
      servicoId: this.selectedServicoId() || undefined,
      status: this.selectedStatuses().length ? this.selectedStatuses() : undefined,
      search: this.search() || undefined,
    });
  }
}
