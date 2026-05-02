import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento } from '../../../../types/agenda.types';
import { getTime, toDate } from '../utils/date-helpers';

interface MonthCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  agendamentos: Agendamento[];
}

@Component({
  selector: 'app-agenda-month',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agenda-month.component.html',
  styleUrls: ['./agenda-month.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaMonthComponent {
  @Input() set selectedDate(d: Date) {
    this._selectedDate = d;
    this.buildMonth();
  }

  @Input() set agendamentos(list: Agendamento[]) {
    this._agendamentos = list;
    this.buildMonth();
  }

  @Output() daySelected = new EventEmitter<Date>();
  @Output() openModal = new EventEmitter<string>();

  private _selectedDate = new Date();
  private _agendamentos: Agendamento[] = [];

  readonly weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  readonly maxPerCell = 3;

  cells: MonthCell[] = [];

  private buildMonth(): void {
    const base = new Date(this._selectedDate);
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
    const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    const startDay = this.mondayBasedWeekday(monthStart);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - startDay);
    gridStart.setHours(0, 0, 0, 0);

    this.cells = Array.from({ length: 42 }, (_, i) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + i);

      const agendamentos = this._agendamentos
        .filter((a) => toDate(a.inicio).toDateString() === day.toDateString())
        .sort((a, b) => getTime(a.inicio) - getTime(b.inicio));

      return {
        date: day,
        inMonth: day.getMonth() === base.getMonth(),
        isToday: day.toDateString() === new Date().toDateString(),
        isSelected: day.toDateString() === this._selectedDate.toDateString(),
        agendamentos,
      };
    });

    if (monthEnd.getDate() <= 0) {
      this.cells = [];
    }
  }

  private mondayBasedWeekday(d: Date): number {
    return (d.getDay() + 6) % 7;
  }

  topItems(cell: MonthCell): Agendamento[] {
    return cell.agendamentos.slice(0, this.maxPerCell);
  }

  overflowCount(cell: MonthCell): number {
    return Math.max(0, cell.agendamentos.length - this.maxPerCell);
  }

  formatTime(value: Date | string): string {
    return toDate(value).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  eventLabel(a: Agendamento): string {
    const petNome = a.pet?.nome || a.pet_nome || a.pet_nome_snapshot || 'Pet';
    const servicoNome = a.servico?.nome || 'Atendimento';
    return `${petNome} - ${servicoNome}`;
  }

  eventStatusClass(a: Agendamento): string {
    return `evt-${a.status.toLowerCase().replace('_', '-')}`;
  }

  asString(value: string | number): string {
    return String(value);
  }
}
