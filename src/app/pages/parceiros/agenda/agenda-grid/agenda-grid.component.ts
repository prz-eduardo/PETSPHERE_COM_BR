import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
  computed, signal, OnChanges, AfterViewInit, SimpleChanges, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaConfig, Profissional, SlotInfo } from '../../../../types/agenda.types';
import { AgendaCardComponent, QuickActionEvent } from '../agenda-card/agenda-card.component';
import { toDate, getTime } from '../utils/date-helpers';

interface TimeSlot {
  label: string;   // '08:00'
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
export class AgendaGridComponent implements OnChanges, AfterViewInit {
  @Input() agendamentos: Agendamento[] = [];
  @Input() profissionais: Profissional[] = [];
  @Input() config!: AgendaConfig;
  @Input() workStart?: number;
  @Input() workEnd?: number;
  @Input() selectedDate!: Date;
  @Output() slotClick = new EventEmitter<SlotInfo>();
  @Output() quickAction = new EventEmitter<QuickActionEvent>();
  @Output() openModal = new EventEmitter<string>();

  readonly SLOT_HEIGHT_PX = 60; // pixels per 30 min slot

  constructor(private el: ElementRef) {}

  private get effectiveWorkStart(): number {
    return this.workStart ?? this.config?.workStart ?? 8;
  }

  private get effectiveWorkEnd(): number {
    return this.workEnd ?? this.config?.workEnd ?? 19;
  }

  get timeSlots(): TimeSlot[] {
    const start = this.effectiveWorkStart;
    const end = this.effectiveWorkEnd;
    const slots: TimeSlot[] = [];
    for (let h = start; h < end; h++) {
      slots.push({ label: `${String(h).padStart(2, '0')}:00`, hour: h, minute: 0 });
      slots.push({ label: `${String(h).padStart(2, '0')}:30`, hour: h, minute: 30 });
    }
    return slots;
  }

  get totalMinutes(): number {
    const start = this.effectiveWorkStart;
    const end = this.effectiveWorkEnd;
    return (end - start) * 60;
  }

  get gridHeight(): number {
    return this.timeSlots.length * this.SLOT_HEIGHT_PX;
  }

  get profCols(): Profissional[] {
    return this.config?.multiProfessional ? this.profissionais : [this.profissionais[0]].filter(Boolean);
  }

  agendamentosForProf(profId: string): Agendamento[] {
    return this.agendamentos.filter(a => a.profissional?.id === profId);
  }

  topPercent(a: Agendamento): string {
    const start = (this.effectiveWorkStart) * 60;
    const date = toDate(a.inicio);
    const startMin = date.getHours() * 60 + date.getMinutes();
    const offset = Math.max(0, startMin - start);
    return ((offset / this.totalMinutes) * 100).toFixed(2) + '%';
  }

  heightPercent(a: Agendamento): string {
    const dur = (getTime(a.fim) - getTime(a.inicio)) / 60000;
    return ((Math.min(dur, this.totalMinutes) / this.totalMinutes) * 100).toFixed(2) + '%';
  }

  get nowLineTop(): string | null {
    const now = new Date();
    if (now.toDateString() !== this.selectedDate?.toDateString()) return null;
    const start = (this.effectiveWorkStart) * 60;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const offset = nowMin - start;
    if (offset < 0 || offset > this.totalMinutes) return null;
    return ((offset / this.totalMinutes) * 100).toFixed(2) + '%';
  }

  onSlotClick(prof: Profissional, slot: TimeSlot): void {
    const hora = new Date(this.selectedDate);
    hora.setHours(slot.hour, slot.minute, 0, 0);
    this.slotClick.emit({ hora, profissionalId: prof.id });
  }

  ngAfterViewInit(): void {
    // initial auto-scroll after view is ready
    setTimeout(() => this.scrollToInitial(), 0);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['selectedDate'] ||
      changes['config'] ||
      changes['workStart'] ||
      changes['workEnd']
    ) {
      setTimeout(() => this.scrollToInitial(), 0);
    }
  }

  private scrollToInitial(): void {
    try {
      const host = this.el.nativeElement as HTMLElement;
      const gridBody = host.querySelector('.grid-body') as HTMLElement | null;
      if (!gridBody) return;

      const total = this.totalMinutes;
      if (!total || total <= 0) return;

      const startMin = (this.effectiveWorkStart) * 60;
      const now = new Date();
      let offsetMin = 0;

      if (this.selectedDate && now.toDateString() === this.selectedDate.toDateString()) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const off = nowMin - startMin;
        if (off < 0) offsetMin = 0;
        else if (off > total) offsetMin = total;
        else offsetMin = off;
      } else {
        offsetMin = 0;
      }

      // Início do dia (ou “agora” antes da janela): manter scroll no topo para o primeiro
      // horário não ficar sob o cabeçalho sticky da grade.
      if (offsetMin <= 0) {
        host.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // The host (:host with overflow: auto) is the scroll container.
      // Body is positioned below the sticky header, so include its offsetTop.
      const bodyHeight = gridBody.clientHeight || this.gridHeight;
      const pixelOffset = gridBody.offsetTop + (offsetMin / total) * bodyHeight;
      const preferred = Math.max(0, pixelOffset - host.clientHeight * 0.18);
      host.scrollTo({ top: preferred, behavior: 'smooth' });
    } catch {
      // ignore scroll errors
    }
  }
}
