import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PanoramaAtendimento, PanoramaDefaults } from './atendimento-panorama.types';

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

  criar(
    ns: string,
    partial: Partial<PanoramaAtendimento>,
    defaults?: PanoramaDefaults
  ): PanoramaAtendimento {
    const d = defaults ?? {};
    const olat = d.origemLat ?? 0;
    const olng = d.origemLng ?? 0;
    let dlat = d.destinoLat ?? 0;
    let dlng = d.destinoLng ?? 0;
    if (olat === dlat && olng === dlng) {
      dlat = olat;
      dlng = olng + 0.0001;
    }

    const now = new Date().toISOString();
    const base: PanoramaAtendimento = {
      id: newId(),
      criadoEm: now,
      atualizadoEm: now,
      tutorNome: '',
      petNome: '',
      status: 'rascunho',
      origemLat: olat,
      origemLng: olng,
      destinoLat: dlat,
      destinoLng: dlng,
      origemEnderecoTexto: d.origemEnderecoTexto,
      valorPorKm: d.valorPorKm ?? 0,
      valorConsulta: d.valorConsulta ?? 0,
      taxaAdicional: d.taxaAdicional ?? 0,
      extras: [],
      descontoPercent: d.descontoPercent ?? 0,
      formaPagamento: d.formaPagamento ?? undefined,
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
