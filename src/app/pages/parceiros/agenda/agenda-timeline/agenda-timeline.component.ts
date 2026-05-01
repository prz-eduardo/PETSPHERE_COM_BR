import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaConfig, Profissional, SlotInfo } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';
import { toDate, getTime } from '../utils/date-helpers';
import { normalizeWorkWindow, profissionaisAsList } from '../utils/agenda-view.utils';

interface TimeHour {
  label: string;
  hour: number;
}

@Component({
  selector: 'app-agenda-timeline',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-timeline.component.html',
  styleUrls: ['./agenda-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaTimelineComponent {
  @Input() agendamentos: Agendamento[] = [];
  @Input() profissionais: Profissional[] = [];
  @Input() config!: AgendaConfig;
  @Input() selectedDate!: Date;
  @Output() slotClick = new EventEmitter<SlotInfo>();
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  readonly PX_PER_HOUR = 120;

  private get bounds(): { start: number; end: number } {
    const c = this.config;
    if (!c) return { start: 8, end: 19 };
    return normalizeWorkWindow(undefined, undefined, c.workStart, c.workEnd);
  }

  get workStart(): number {
    return this.bounds.start;
  }

  get workEnd(): number {
    return this.bounds.end;
  }

  get hours(): TimeHour[] {
    const { start, end } = this.bounds;
    const h: TimeHour[] = [];
    for (let i = start; i <= end; i++) {
      h.push({ label: `${String(i).padStart(2, '0')}:00`, hour: i });
    }
    return h;
  }

  get totalMinutes(): number {
    const { start, end } = this.bounds;
    return (end - start) * 60;
  }

  get timelineWidth(): number {
    const { start, end } = this.bounds;
    return (end - start) * this.PX_PER_HOUR;
  }

  get profRows(): Profissional[] {
    const list = profissionaisAsList(this.profissionais);
    if (this.config?.multiProfessional) return list;
    const first = list[0];
    return first ? [first] : [];
  }

  agendamentosForProf(profId: string): Agendamento[] {
    return this.agendamentos.filter(a => a.profissional?.id === profId);
  }

  leftPx(a: Agendamento): string {
    const { start } = this.bounds;
    const date = toDate(a.inicio);
    const startMin = date.getHours() * 60 + date.getMinutes();
    const offset = startMin - start * 60;
    return Math.max(0, (offset / 60) * this.PX_PER_HOUR) + 'px';
  }

  widthPx(a: Agendamento): string {
    const dur = (getTime(a.fim) - getTime(a.inicio)) / 60000;
    return Math.max(60, (dur / 60) * this.PX_PER_HOUR) + 'px';
  }

  get nowLeftPx(): string | null {
    const { start, end } = this.bounds;
    const spanMin = (end - start) * 60;
    const now = new Date();
    if (now.toDateString() !== this.selectedDate?.toDateString()) return null;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const offset = nowMin - start * 60;
    if (offset < 0 || offset > spanMin) return null;
    return ((offset / 60) * this.PX_PER_HOUR) + 'px';
  }

  gapsForProf(profId: string): Array<{ leftPx: string; widthPx: string }> {
    const { start: ws, end } = this.bounds;
    const busy = this.agendamentosForProf(profId)
      .filter(a => a.status !== 'CANCELADO')
      .sort((a, b) => getTime(a.inicio) - getTime(b.inicio));

    const gaps: Array<{ leftPx: string; widthPx: string }> = [];
    let cursor = ws * 60;
    const windowEndMin = end * 60;

    for (const a of busy) {
      const aStartDate = toDate(a.inicio);
      const aStart = aStartDate.getHours() * 60 + aStartDate.getMinutes();
      if (aStart > cursor + 30) {
        const gapMin = aStart - cursor;
        gaps.push({
          leftPx: ((cursor - ws * 60) / 60 * this.PX_PER_HOUR) + 'px',
          widthPx: (gapMin / 60 * this.PX_PER_HOUR) + 'px',
        });
      }
      const aEndDate = toDate(a.fim);
      const aEnd = aEndDate.getHours() * 60 + aEndDate.getMinutes();
      cursor = Math.max(cursor, aEnd);
    }

    if (cursor < windowEndMin - 30) {
      gaps.push({
        leftPx: ((cursor - ws * 60) / 60 * this.PX_PER_HOUR) + 'px',
        widthPx: ((windowEndMin - cursor) / 60 * this.PX_PER_HOUR) + 'px',
      });
    }

    return gaps;
  }

  onSlotClick(prof: Profissional, hour: TimeHour): void {
    const hora = new Date(this.selectedDate);
    hora.setHours(hour.hour, 0, 0, 0);
    this.slotClick.emit({ hora, profissionalId: prof.id });
  }

  onRowTrackClick(prof: Profissional): void {
    const h = this.hours[0];
    if (!h) return;
    this.onSlotClick(prof, h);
  }
}
