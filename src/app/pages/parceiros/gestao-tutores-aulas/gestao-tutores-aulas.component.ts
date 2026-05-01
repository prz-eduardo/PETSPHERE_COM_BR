import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ParceiroGestaoTutoresAulasService } from './gestao-tutores-aulas.service';
import type {
  AulaGestaoRow,
  PetGestaoRow,
  TurmaGestaoRow,
  TutorGestaoRow,
} from './gestao-tutores-aulas.mock';

export type GestaoTab = 'tutores' | 'pets' | 'turmas' | 'aulas';

@Component({
  selector: 'app-parceiro-gestao-tutores-aulas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './gestao-tutores-aulas.component.html',
  styleUrls: ['./gestao-tutores-aulas.component.scss'],
})
export class ParceiroGestaoTutoresAulasComponent implements OnInit {
  private readonly svc = inject(ParceiroGestaoTutoresAulasService);

  tab: GestaoTab = 'tutores';
  loading = true;

  tutores: TutorGestaoRow[] = [];
  pets: PetGestaoRow[] = [];
  turmas: TurmaGestaoRow[] = [];
  aulas: AulaGestaoRow[] = [];

  filtroTurmaAulas = '';

  ngOnInit(): void {
    forkJoin({
      tutores: this.svc.getTutores(),
      pets: this.svc.getPets(),
      turmas: this.svc.getTurmas(),
      aulas: this.svc.getAulas(),
    }).subscribe({
      next: (r) => {
        this.tutores = r.tutores;
        this.pets = r.pets;
        this.turmas = r.turmas;
        this.aulas = r.aulas;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  setTab(t: GestaoTab): void {
    this.tab = t;
  }

  tutorNome(id: string): string {
    return this.tutores.find((x) => x.id === id)?.nome ?? id;
  }

  turmaNome(id: string): string {
    return this.turmas.find((x) => x.id === id)?.nome ?? id;
  }

  fmtQuando(iso: string): string {
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  aulasFiltradas(): AulaGestaoRow[] {
    const q = this.filtroTurmaAulas.trim();
    if (!q) return this.aulas;
    return this.aulas.filter(
      (a) =>
        this.turmaNome(a.turmaId).toLowerCase().includes(q.toLowerCase()) ||
        a.titulo.toLowerCase().includes(q.toLowerCase())
    );
  }
}
