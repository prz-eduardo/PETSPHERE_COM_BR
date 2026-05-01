import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import {
  AulaGestaoRow,
  MOCK_AULAS,
  MOCK_PETS_GESTAO,
  MOCK_TURMAS,
  MOCK_TUTORES,
  PetGestaoRow,
  TurmaGestaoRow,
  TutorGestaoRow,
} from './gestao-tutores-aulas.mock';

@Injectable({ providedIn: 'root' })
export class ParceiroGestaoTutoresAulasService {
  getTutores(): Observable<TutorGestaoRow[]> {
    return of([...MOCK_TUTORES]).pipe(delay(120));
  }

  getPets(): Observable<PetGestaoRow[]> {
    return of([...MOCK_PETS_GESTAO]).pipe(delay(120));
  }

  getTurmas(): Observable<TurmaGestaoRow[]> {
    return of([...MOCK_TURMAS]).pipe(delay(120));
  }

  getAulas(): Observable<AulaGestaoRow[]> {
    return of([...MOCK_AULAS]).pipe(delay(120));
  }
}
