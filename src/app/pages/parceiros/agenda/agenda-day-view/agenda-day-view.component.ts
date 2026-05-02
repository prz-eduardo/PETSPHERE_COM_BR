import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaConfig, Profissional, SlotInfo, SlotProjectionCell } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';
import { toDate, getTime } from '../utils/date-helpers';
import { normalizeWorkWindow, profissionaisAsList } from '../utils/agenda-view.utils';

interface TimeSlot {
  label: string;
  hour: number;
  minute: number;
}

interface DayRow {
  label: string;
  hour: number;
  minute: number;
  serverIndex?: number;
}

@Component({
  selector: 'app-agenda-day-view',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-day-view.component.html',
  styleUrls: ['./agenda-day-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaDayViewComponent {
  readonly agendamentos = input<Agendamento[]>([]);
  readonly profissionais = input<Profissional[]>([]);
  readonly config = input.required<AgendaConfig>();
  readonly workStart = input<number | undefined>(undefined);
  readonly workEnd = input<number | undefined>(undefined);
  readonly selectedDate = input.required<Date>();
  readonly slotProjections = input<Record<string, SlotProjectionCell[]>>({});

  readonly slotClick = output<SlotInfo>();
  readonly quickAction = output<QuickActionEvent>();
  readonly openModal = output<string>();

  readonly SLOT_HEIGHT_PX = 60;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly profissionaisList = computed((): Profissional[] =>
    profissionaisAsList(this.profissionais() as Profissional[] | Profissional | null | undefined));

  readonly effectiveWorkWindow = computed(() =>
    normalizeWorkWindow(
      this.workStart(),
      this.workEnd(),
      this.config().workStart,
      this.config().workEnd,
    ),
  );

  readonly effectiveWorkStart = computed(() => this.effectiveWorkWindow().start);
  readonly effectiveWorkEnd = computed(() => this.effectiveWorkWindow().end);

  readonly timeSlots = computed((): TimeSlot[] => {
    const start = this.effectiveWorkStart();
    const end = this.effectiveWorkEnd();
    const slots: TimeSlot[] = [];
    for (let min = start * 60; min < end * 60; min += 30) {
      const h = Math.floor(min / 60);
      const minute = min % 60;
      slots.push({
        label: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        hour: h,
        minute,
      });
    }
    return slots;
  });

  readonly profCols = computed((): Profissional[] => {
    const cfg = this.config();
    const profs = this.profissionaisList();
    if (cfg.multiProfessional) return profs;
    const first = profs[0];
    return first ? [first] : [];
  });

  readonly displayRows = computed((): DayRow[] => {
    const first = this.profCols()[0];
    if (first) {
      const cells = this.slotProjections()[first.id];
      if (cells?.length) {
        return cells.map((c, idx) => {
          const d = new Date(c.inicio);
          return {
            label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            hour: d.getHours(),
            minute: d.getMinutes(),
            serverIndex: idx,
          };
        });
      }
    }
    return this.timeSlots().map(s => ({ ...s }));
  });

  readonly serverLayout = computed(() => {
    const first = this.profCols()[0];
    if (!first) return null;
    const cells = this.slotProjections()[first.id];
    if (!cells?.length) return null;
    const s = new Date(cells[0].inicio);
    const e = new Date(cells[cells.length - 1].fim);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    return { startMin, endMin, totalMin: Math.max(1, endMin - startMin) };
  });

  readonly layoutStartMin = computed(() => {
    const w = this.serverLayout();
    if (w) return w.startMin;
    return this.effectiveWorkStart() * 60;
  });

  readonly totalMinutes = computed(() => {
    const w = this.serverLayout();
    if (w) return w.totalMin;
    const start = this.effectiveWorkStart();
    const end = this.effectiveWorkEnd();
    return Math.max(0, (end - start) * 60);
  });

  readonly gridHeight = computed(() => this.displayRows().length * this.SLOT_HEIGHT_PX);

  readonly nowLineTop = computed((): string | null => {
    const total = Math.max(this.totalMinutes(), 1);
    const sd = this.selectedDate();
    const now = new Date();
    if (now.toDateString() !== sd.toDateString()) return null;
    const start = this.layoutStartMin();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const offset = nowMin - start;
    if (offset < 0 || offset > total) return null;
    return ((offset / total) * 100).toFixed(2) + '%';
  });

  constructor() {
    effect(() => {
      this.displayRows();
      this.selectedDate();
      this.agendamentos();
      this.slotProjections();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.scrollToInitial());
      });
    });
  }

  cellFor(profId: string, row: DayRow): SlotProjectionCell | null {
    if (row.serverIndex == null) return null;
    return this.slotProjections()[profId]?.[row.serverIndex] ?? null;
  }

  slotBgClass(prof: Profissional, row: DayRow): Record<string, boolean> {
    const c = this.cellFor(prof.id, row);
    if (!c) return { 'slot-legacy': true };
    return {
      [`slot-server-${c.status}`]: true,
    };
  }

  agendamentosForProf(profId: string): Agendamento[] {
    return this.agendamentos().filter(a => a.profissional?.id === profId);
  }

  topPercent(a: Agendamento): string {
    const total = Math.max(this.totalMinutes(), 1);
    const start = this.layoutStartMin();
    const date = toDate(a.inicio);
    const startMin = date.getHours() * 60 + date.getMinutes();
    const offset = Math.max(0, startMin - start);
    return ((offset / total) * 100).toFixed(2) + '%';
  }

  heightPercent(a: Agendamento): string {
    const total = Math.max(this.totalMinutes(), 1);
    const dur = (getTime(a.fim) - getTime(a.inicio)) / 60000;
    return ((Math.min(dur, total) / total) * 100).toFixed(2) + '%';
  }

  onSlotClick(prof: Profissional, row: DayRow): void {
    const c = this.cellFor(prof.id, row);
    if (c && !c.clickable) return;
    if (c) {
      this.slotClick.emit({ hora: new Date(c.inicio), profissionalId: prof.id });
      return;
    }
    const hora = new Date(this.selectedDate());
    hora.setHours(row.hour, row.minute, 0, 0);
    this.slotClick.emit({ hora, profissionalId: prof.id });
  }

  private getScrollPort(): HTMLElement {
    return (
      (this.el.nativeElement.querySelector('.day-view-scroll') as HTMLElement | null) ??
      this.el.nativeElement
    );
  }

  private scrollToInitial(): void {
    try {
      const scroller = this.getScrollPort();
      const gridBody = this.el.nativeElement.querySelector('.day-body') as HTMLElement | null;
      if (!gridBody) return;

      const total = this.totalMinutes();
      if (!total || total <= 0) return;

      const startMin = this.layoutStartMin();
      const now = new Date();
      const sd = this.selectedDate();
      if (now.toDateString() !== sd.toDateString()) {
        scroller.scrollTop = 0;
        return;
      }

      const nowMin = now.getHours() * 60 + now.getMinutes();
      const off = nowMin - startMin;
      const offsetMin = off < 0 ? 0 : off > total ? total : off;

      const gh = this.gridHeight();
      const bodyHeight = gridBody.clientHeight || gh;
      const bodyRect = gridBody.getBoundingClientRect();
      const scrRect = scroller.getBoundingClientRect();
      const bodyTopInScroller = bodyRect.top - scrRect.top + scroller.scrollTop;
      const pixelOffset = bodyTopInScroller + (offsetMin / total) * bodyHeight;
      const preferred = Math.max(0, pixelOffset - scroller.clientHeight * 0.18);
      scroller.scrollTo({ top: preferred, behavior: 'auto' });
    } catch {
      /* ignore */
    }
  }
}
