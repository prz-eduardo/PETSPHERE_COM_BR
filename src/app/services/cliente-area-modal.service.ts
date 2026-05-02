import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ClienteAreaModalView =
  | 'meus-pedidos'
  | 'meus-pets'
  | 'novo-pet'
  | 'perfil'
  | 'meus-enderecos'
  | 'meus-cartoes'
  | 'telemedicina'
  | 'meus-agendamentos'
  | 'suporte'
  | 'postar-foto'
  | 'minha-galeria'
  | null;

export type ClientePetEditId = string | number;

@Injectable({
  providedIn: 'root'
})
export class ClienteAreaModalService {
  private readonly openRequestsSubject = new Subject<ClienteAreaModalView>();
  private readonly petsChangedSubject = new Subject<void>();
  private readonly galeriaFotosChangedSubject = new Subject<void>();
  private pendingPetEditId: ClientePetEditId | null = null;

  readonly openRequests$ = this.openRequestsSubject.asObservable();
  readonly petsChanged$ = this.petsChangedSubject.asObservable();
  readonly galeriaFotosChanged$ = this.galeriaFotosChangedSubject.asObservable();

  open(view: ClienteAreaModalView = null): void {
    this.openRequestsSubject.next(view);
  }

  openPetEditor(petId: ClientePetEditId): void {
    this.pendingPetEditId = petId;
    this.open('meus-pets');
  }

  consumePendingPetEditId(): ClientePetEditId | null {
    const current = this.pendingPetEditId;
    this.pendingPetEditId = null;
    return current;
  }

  notifyPetsChanged(): void {
    this.petsChangedSubject.next();
  }

  notifyGaleriaFotosChanged(): void {
    this.galeriaFotosChangedSubject.next();
  }
}