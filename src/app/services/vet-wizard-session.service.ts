import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type WizardStep =
  | 'identificacao'
  | 'clinica'
  | 'finalizacao-clinica'
  | 'decisao'
  | 'operacao'
  | 'ia'
  | 'concluido';

export type TipoAtendimento = 'presencial' | 'telemedicina' | 'domicilio';
export type DecisaoOperacional = 'telemedicina' | 'domicilio' | 'retorno' | 'encerrar';

export interface WizardSession {
  id: string;
  step: WizardStep;
  tutorNome: string;
  tutorTelefone: string;
  petNome: string;
  tipoAtendimento: TipoAtendimento;
  /** CPF do tutor (apenas dígitos), quando a identificação veio da busca na base. */
  tutorCpf?: string;
  clienteId?: number | null;
  petId?: string | null;
  atendimentoId?: number | null;
  panoramaId?: string | null;
  decisaoOperacional?: DecisaoOperacional | null;
  criadoEm: string;
  atualizadoEm: string;
}

const STORAGE_KEY = 'vet_wizard_session';

@Injectable({ providedIn: 'root' })
export class VetWizardSessionService {
  private _session$ = new BehaviorSubject<WizardSession | null>(null);
  readonly session$ = this._session$.asObservable();

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      const stored = this._read();
      if (stored) this._session$.next(stored);
    }
  }

  get snapshot(): WizardSession | null {
    return this._session$.value;
  }

  iniciar(
    dados: Pick<WizardSession, 'tutorNome' | 'tutorTelefone' | 'petNome' | 'tipoAtendimento'> &
      Partial<Pick<WizardSession, 'tutorCpf' | 'clienteId' | 'petId'>>,
  ): WizardSession {
    const now = new Date().toISOString();
    const session: WizardSession = {
      id: this._newId(),
      step: 'clinica',
      criadoEm: now,
      atualizadoEm: now,
      ...dados,
    };
    this._write(session);
    this._session$.next(session);
    return session;
  }

  avancar(step: WizardStep, patch?: Partial<WizardSession>): void {
    const current = this._session$.value;
    if (!current) return;
    const updated: WizardSession = {
      ...current,
      ...(patch ?? {}),
      step,
      atualizadoEm: new Date().toISOString(),
    };
    this._write(updated);
    this._session$.next(updated);
  }

  patch(partial: Partial<WizardSession>): void {
    const current = this._session$.value;
    if (!current) return;
    const updated: WizardSession = {
      ...current,
      ...partial,
      atualizadoEm: new Date().toISOString(),
    };
    this._write(updated);
    this._session$.next(updated);
  }

  encerrar(): void {
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
    this._session$.next(null);
  }

  private _read(): WizardSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as WizardSession;
    } catch {
      return null;
    }
  }

  private _write(session: WizardSession): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
  }

  private _newId(): string {
    try { return crypto.randomUUID(); } catch {
      return `wiz_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  }
}
