import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PanoramaAtendimento } from './atendimento-panorama.types';

const STORAGE_PREFIX = 'ps_vet_panorama_v1';

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

@Injectable({ providedIn: 'root' })
export class AtendimentoPanoramaStorageService {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  private key(ns: string): string {
    return `${STORAGE_PREFIX}:${ns}`;
  }

  listar(ns: string): PanoramaAtendimento[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const raw = localStorage.getItem(this.key(ns));
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  salvarTodos(ns: string, items: PanoramaAtendimento[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.key(ns), JSON.stringify(items));
    } catch {
      // quota / private mode
    }
  }

  criar(ns: string, partial: Partial<PanoramaAtendimento>): PanoramaAtendimento {
    const now = new Date().toISOString();
    const base: PanoramaAtendimento = {
      id: newId(),
      criadoEm: now,
      atualizadoEm: now,
      tutorNome: '',
      petNome: '',
      status: 'rascunho',
      origemLat: -23.55052,
      origemLng: -46.633308,
      destinoLat: -23.56,
      destinoLng: -46.64,
      valorPorKm: 3.5,
      valorConsulta: 150,
      taxaAdicional: 0,
      extras: [],
      descontoPercent: 0,
      exames: [],
      ...partial,
    };
    const all = this.listar(ns);
    all.unshift(base);
    this.salvarTodos(ns, all);
    return base;
  }

  atualizar(ns: string, item: PanoramaAtendimento): void {
    const all = this.listar(ns);
    const i = all.findIndex((x) => x.id === item.id);
    if (i < 0) return;
    all[i] = { ...item, atualizadoEm: new Date().toISOString() };
    this.salvarTodos(ns, all);
  }

  remover(ns: string, id: string): void {
    const all = this.listar(ns).filter((x) => x.id !== id);
    this.salvarTodos(ns, all);
  }
}
