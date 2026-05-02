import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AgendaApiService } from '../services/agenda-api.service';

@Component({
  selector: 'app-agenda-regras',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './agenda-regras.component.html',
  styleUrls: ['./agenda-regras.component.scss'],
})
export class AgendaRegrasComponent implements OnInit {
  disponibilidades = signal<unknown[]>([]);
  bloqueios = signal<unknown[]>([]);
  recursos = signal<{ id: number; nome: string }[]>([]);
  lastImpactos = signal<Record<string, unknown>[]>([]);
  lastConflict = signal<string>('');

  diaSemana = 1;
  horaInicio = '09:00';
  horaFim = '18:00';
  recDisp: number | null = null;

  bloqInicio = '';
  bloqFim = '';
  bloqMotivo = '';
  recBloq: number | null = null;

  msg = signal('');
  err = signal('');

  constructor(private api: AgendaApiService) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [d, b, r] = await Promise.all([
        this.api.listDisponibilidades(),
        this.api.listBloqueios(),
        this.api.getRecursos(),
      ]);
      this.disponibilidades.set(d);
      this.bloqueios.set(b);
      this.recursos.set(
        (r || []).map((x: { id: number; nome: string }) => ({ id: x.id, nome: x.nome || 'Recurso' }))
      );
    } catch (e) {
      console.error(e);
      this.err.set('Falha ao carregar regras');
    }
  }

  async addDisponibilidade(): Promise<void> {
    this.err.set('');
    this.msg.set('');
    try {
      await this.api.createDisponibilidade({
        dia_semana: this.diaSemana,
        hora_inicio: this.horaInicio.length === 5 ? `${this.horaInicio}:00` : this.horaInicio,
        hora_fim: this.horaFim.length === 5 ? `${this.horaFim}:00` : this.horaFim,
        recurso_id: this.recDisp,
      });
      this.msg.set('Disponibilidade adicionada');
      await this.reload();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Erro ao salvar');
    }
  }

  async removeDisp(id: number): Promise<void> {
    try {
      await this.api.deleteDisponibilidade(id);
      await this.reload();
    } catch (e) {
      console.error(e);
    }
  }

  async addBloqueio(): Promise<void> {
    this.err.set('');
    this.msg.set('');
    this.lastImpactos.set([]);
    this.lastConflict.set('');
    if (!this.bloqInicio || !this.bloqFim) {
      this.err.set('Informe início e fim do bloqueio');
      return;
    }
    try {
      const r = await this.api.createBloqueio({
        data_inicio: this.bloqInicio,
        data_fim: this.bloqFim,
        motivo: this.bloqMotivo || null,
        recurso_id: this.recBloq,
      });
      this.lastImpactos.set((r.impactos as Record<string, unknown>[]) || []);
      this.lastConflict.set(r.conflict_state || '');
      this.msg.set(
        r.conflict_state === 'soft'
          ? 'Bloqueio criado — há agendamentos existentes na faixa (revise na lista abaixo).'
          : 'Bloqueio criado'
      );
      await this.reload();
    } catch (e: unknown) {
      this.err.set(e instanceof Error ? e.message : 'Erro ao criar bloqueio');
    }
  }

  async removeBloq(id: number): Promise<void> {
    try {
      await this.api.deleteBloqueio(id);
      await this.reload();
    } catch (e) {
      console.error(e);
    }
  }
}
