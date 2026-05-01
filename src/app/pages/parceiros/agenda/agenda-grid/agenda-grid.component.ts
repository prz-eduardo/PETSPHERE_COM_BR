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
import { Agendamento, AgendaConfig, Profissional, SlotInfo } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';
import { toDate, getTime } from '../utils/date-helpers';
import { normalizeWorkWindow, profissionaisAsList } from '../utils/agenda-view.utils';

interface TimeSlot {
  label: string;
  hour: number;
  minute: number;
}

@Component({
  selector: 'app-agenda-grid',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-grid.component.html',
  styleUrls: ['./agenda-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaGridComponent {

  readonly agendamentos = input<Agendamento[]>([]);
  readonly profissionais = input<Profissional[]>([]);
  readonly config = input.required<AgendaConfig>();
  readonly workStart = input<number | undefined>(undefined);
  readonly workEnd = input<number | undefined>(undefined);
  readonly selectedDate = input.required<Date>();

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

  readonly totalMinutes = computed(() => {
    const start = this.effectiveWorkStart();
    const end = this.effectiveWorkEnd();
    return Math.max(0, (end - start) * 60);
  });

  readonly gridHeight = computed(() => this.timeSlots().length * this.SLOT_HEIGHT_PX);

  readonly profCols = computed((): Profissional[] => {
    const cfg = this.config();
    const profs = this.profissionaisList();
    if (cfg.multiProfessional) return profs;
    const first = profs[0];
    return first ? [first] : [];
  });

  readonly nowLineTop = computed((): string | null => {
    const total = this.totalMinutes();
    if (total <= 0) return null;
    const sd = this.selectedDate();
    const now = new Date();
    if (now.toDateString() !== sd.toDateString()) return null;
    const start = this.effectiveWorkStart() * 60;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const offset = nowMin - start;
    if (offset < 0 || offset > total) return null;
    return ((offset / total) * 100).toFixed(2) + '%';
  });

  constructor() {
    effect(() => {
      this.timeSlots();
      this.selectedDate();
      queueMicrotask(() => this.scrollToInitial());
    });
  }

  agendamentosForProf(profId: string): Agendamento[] {
    return this.agendamentos().filter(a => a.profissional?.id === profId);
  }

  topPercent(a: Agendamento): string {
    const total = Math.max(this.totalMinutes(), 1);
    const start = this.effectiveWorkStart() * 60;
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

  onSlotClick(prof: Profissional, slot: TimeSlot): void {
    const hora = new Date(this.selectedDate());
    hora.setHours(slot.hour, slot.minute, 0, 0);
    this.slotClick.emit({ hora, profissionalId: prof.id });
  }

  private scrollToInitial(): void {
    try {
      const host = this.el.nativeElement;
      const scroller =
        (host.querySelector('.grid-scroll') as HTMLElement | null) ?? host;
      const gridBody = host.querySelector('.grid-body') as HTMLElement | null;
      if (!gridBody) return;

      const total = this.totalMinutes();
      if (!total || total <= 0) return;

      const startMin = this.effectiveWorkStart() * 60;
      const now = new Date();
      let offsetMin = 0;

      const sd = this.selectedDate();
      if (now.toDateString() === sd.toDateString()) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const off = nowMin - startMin;
        if (off < 0) offsetMin = 0;
        else if (off > total) offsetMin = total;
        else offsetMin = off;
      } else {
        offsetMin = 0;
      }

      if (offsetMin <= 0) {
        scroller.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const gh = this.gridHeight();
      const bodyHeight = gridBody.clientHeight || gh;
      const pixelOffset = gridBody.offsetTop + (offsetMin / total) * bodyHeight;
      const preferred = Math.max(0, pixelOffset - scroller.clientHeight * 0.18);
      scroller.scrollTo({ top: preferred, behavior: 'smooth' });
    } catch {
      // ignore scroll errors
    }
  }
}
