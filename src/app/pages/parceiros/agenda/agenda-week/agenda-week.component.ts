import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';
import { toDateString, getTime, toDate } from '../utils/date-helpers';

interface DayCol {
  date: Date;
  label: string;
  dayLabel: string;
  isToday: boolean;
  agendamentos: Agendamento[];
}

@Component({
  selector: 'app-agenda-week',
  standalone: true,
  imports: [CommonModule, AgendaCardComponent],
  templateUrl: './agenda-week.component.html',
  styleUrls: ['./agenda-week.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaWeekComponent {
  @Input() set selectedDate(d: Date) {
    this._selectedDate = d;
    this.buildWeek();
  }
  @Input() set agendamentos(list: Agendamento[]) {
    this._agendamentos = list;
    this.buildWeek();
  }
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  private _selectedDate = new Date();
  private _agendamentos: Agendamento[] = [];
  private _weekStartKey: string | null = null;
  /** Em telas estreitas o corpo do dia só aparece quando a data está “aberta”. */
  expandedDayKeys = new Set<string>();

  days: DayCol[] = [];

  constructor(private readonly cdr: ChangeDetectorRef) {}

  private buildWeek(): void {
    const start = this.weekStart(this._selectedDate);
    const weekStartKey = start.toDateString();
    const weekChanged = this._weekStartKey !== weekStartKey;
    this._weekStartKey = weekStartKey;

    this.days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000);
      const dayAgendamentos = this._agendamentos.filter(
        a => toDateString(a.inicio) === d.toDateString()
      ).sort((a, b) => getTime(a.inicio) - getTime(b.inicio));
      return {
        date: d,
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        dayLabel: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
        isToday: d.toDateString() === new Date().toDateString(),
        agendamentos: dayAgendamentos,
      };
    });

    const validKeys = new Set(this.days.map(d => d.date.toDateString()));
    if (weekChanged) {
      const sel = this._selectedDate.toDateString();
      this.expandedDayKeys = validKeys.has(sel) ? new Set([sel]) : new Set();
    } else {
      this.expandedDayKeys = new Set(
        [...this.expandedDayKeys].filter(k => validKeys.has(k))
      );
    }
  }

  dayKey(date: Date): string {
    return date.toDateString();
  }

  isDayExpanded(day: DayCol): boolean {
    return this.expandedDayKeys.has(this.dayKey(day.date));
  }

  toggleDay(day: DayCol, ev: Event): void {
    ev.preventDefault();
    ev.stopPropagation();
    const key = this.dayKey(day.date);
    const next = new Set(this.expandedDayKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.expandedDayKeys = next;
    this.cdr.markForCheck();
  }

  private weekStart(d: Date): Date {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const s = new Date(d);
    s.setDate(d.getDate() + diff);
    s.setHours(0, 0, 0, 0);
    return s;
  }

  formatTime(d: Date | string): string {
    return toDate(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  asString(value: string | number): string {
    return String(value);
  }
}
