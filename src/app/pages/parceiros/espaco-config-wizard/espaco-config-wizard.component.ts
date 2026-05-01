import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AgendaApiService,
  HotelEspacoSlugLabel,
  HotelHospedagemCatalogBundle,
  HotelLeitoRow,
  HotelOfertaCatalogEntry,
} from '../agenda/services/agenda-api.service';

/** Sim / não / indefinido (obrigatório só na vitrine) */
export type Tripolicy = '' | 'sim' | 'nao';

export interface EspacoWizardDraft {
  nome: string;
  capacidade: number;
  capacidade_pequeno: string;
  capacidade_medio: string;
  capacidade_grande: string;
  nivel_conforto: string;
  ambiente: string;
  vitrine_exibir: boolean;
  vitrine_precio: number | null;
  vitrine_nivel: 'basico' | 'destaque' | 'top';
  vitrine_selos: string[];

  servicos_slugs: string[];
  infra_slugs: string[];
  acomodacao_slugs: string[];

  pode_misturar: Tripolicy;
  apenas_mesma_familia: Tripolicy;
  isolamento_obrigatorio: Tripolicy;

  exige_polivalente_v8_v10: Tripolicy;
  exige_antirrabica: Tripolicy;
  exige_vermifugacao: Tripolicy;
  aceita_nao_castrado: Tripolicy;
  aceita_femea_no_cio: Tripolicy;
  aceita_agressivos: Tripolicy;
  aceita_idosos_ou_especiais: Tripolicy;
  aceita_medicacao_continua: Tripolicy;

  galeria_urls: string[];
  video_url: string;

  chk_in_hora: string;
  chk_out_hora: string;
  politica_adaptacao: string;
  limite_estadia: string;
  politica_cancelamento: string;
  taxa_agressivo: string;
}

function emptyDraft(): EspacoWizardDraft {
  return {
    nome: '',
    capacidade: 1,
    capacidade_pequeno: '',
    capacidade_medio: '',
    capacidade_grande: '',
    nivel_conforto: '',
    ambiente: '',
    vitrine_exibir: false,
    vitrine_precio: null,
    vitrine_nivel: 'basico',
    vitrine_selos: [],
    servicos_slugs: [],
    infra_slugs: [],
    acomodacao_slugs: [],
    pode_misturar: '',
    apenas_mesma_familia: '',
    isolamento_obrigatorio: '',
    exige_polivalente_v8_v10: '',
    exige_antirrabica: '',
    exige_vermifugacao: '',
    aceita_nao_castrado: '',
    aceita_femea_no_cio: '',
    aceita_agressivos: '',
    aceita_idosos_ou_especiais: '',
    aceita_medicacao_continua: '',
    galeria_urls: [],
    video_url: '',
    chk_in_hora: '',
    chk_out_hora: '',
    politica_adaptacao: '',
    limite_estadia: '',
    politica_cancelamento: '',
    taxa_agressivo: '',
  };
}

function triToBackend(v: Tripolicy): boolean | null {
  if (v === 'sim') return true;
  if (v === 'nao') return false;
  return null;
}

function boolToTripolicy(v: boolean | null | undefined): Tripolicy {
  if (v === true) return 'sim';
  if (v === false) return 'nao';
  return '';
}

function draftFromLeito(leito: HotelLeitoRow): EspacoWizardDraft {
  const base = emptyDraft();
  base.nome = leito.nome || '';
  base.capacidade = Number(leito.capacidade) >= 1 ? Number(leito.capacidade) : 1;
  base.capacidade_pequeno = leito.capacidade_pequeno != null ? String(leito.capacidade_pequeno) : '';
  base.capacidade_medio = leito.capacidade_medio != null ? String(leito.capacidade_medio) : '';
  base.capacidade_grande = leito.capacidade_grande != null ? String(leito.capacidade_grande) : '';
  base.nivel_conforto = (leito.nivel_conforto || '') as string;
  base.ambiente = (leito.ambiente || '') as string;
  base.vitrine_exibir = !!(leito.exibir_na_vitrine === true || leito.exibir_na_vitrine === 1);
  base.vitrine_precio = leito.preco_diaria != null ? Number(leito.preco_diaria) : null;
  const nv = String(leito.vitrine_nivel || 'basico').toLowerCase();
  base.vitrine_nivel =
    nv === 'destaque' || nv === 'top' ? (nv as 'destaque' | 'top') : 'basico';
  base.vitrine_selos = Array.isArray(leito.vitrine_selos_snapshot) ? [...leito.vitrine_selos_snapshot] : [];
  base.servicos_slugs = Array.isArray(leito.servicos_oferta) ? [...leito.servicos_oferta] : [];
  base.infra_slugs = Array.isArray(leito.infra_slugs) ? [...leito.infra_slugs] : [];
  base.acomodacao_slugs = Array.isArray(leito.acomodacao_tipos) ? [...leito.acomodacao_tipos] : [];
  const c = leito.convivencia;
  base.pode_misturar = boolToTripolicy(c?.pode_misturar ?? null);
  base.apenas_mesma_familia = boolToTripolicy(c?.apenas_mesma_familia ?? null);
  base.isolamento_obrigatorio = boolToTripolicy(c?.isolamento_obrigatorio ?? null);
  const s = leito.saude_perfil;
  base.exige_polivalente_v8_v10 = boolToTripolicy(s?.exige_polivalente_v8_v10 ?? null);
  base.exige_antirrabica = boolToTripolicy(s?.exige_antirrabica ?? null);
  base.exige_vermifugacao = boolToTripolicy(s?.exige_vermifugacao ?? null);
  base.aceita_nao_castrado = boolToTripolicy(s?.aceita_nao_castrado ?? null);
  base.aceita_femea_no_cio = boolToTripolicy(s?.aceita_femea_no_cio ?? null);
  base.aceita_agressivos = boolToTripolicy(s?.aceita_agressivos ?? null);
  base.aceita_idosos_ou_especiais = boolToTripolicy(s?.aceita_idosos_ou_especiais ?? null);
  base.aceita_medicacao_continua = boolToTripolicy(s?.aceita_medicacao_continua ?? null);
  base.galeria_urls = Array.isArray(leito.galeria_urls)
    ? [...leito.galeria_urls]
    : leito.foto_url
      ? [leito.foto_url]
      : [];
  base.video_url = leito.video_url || '';
  const r = leito.regras_operacionais;
  base.chk_in_hora = r?.check_in_hora || '';
  base.chk_out_hora = r?.check_out_hora || '';
  base.politica_adaptacao = r?.politica_adaptacao || '';
  base.limite_estadia = r?.limite_estadia_dias != null ? String(r.limite_estadia_dias) : '';
  base.politica_cancelamento = r?.politica_cancelamento || '';
  base.taxa_agressivo = r?.taxa_comportamento_agressivo || '';
  return base;
}

const STEPS: Array<{ id: number; label: string }> = [
  { id: 1, label: 'Informações básicas' },
  { id: 2, label: 'Estrutura' },
  { id: 3, label: 'Capacidade' },
  { id: 4, label: 'Serviços' },
  { id: 5, label: 'Segurança e saúde' },
  { id: 6, label: 'Mídia' },
  { id: 7, label: 'Vitrine / publicação' },
];

@Component({
  selector: 'app-espaco-config-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './espaco-config-wizard.component.html',
  styleUrls: ['./espaco-config-wizard.component.scss'],
})
export class EspacoConfigWizardComponent {
  open = input(false);
  leito = input<HotelLeitoRow | null>(null);

  dismissed = output<void>();
  saved = output<HotelLeitoRow>();

  readonly step = signal(1);
  readonly draft = signal<EspacoWizardDraft>(emptyDraft());
  readonly catalogs = signal<HotelHospedagemCatalogBundle>({ catalog: [], infra: [], acomodacao_tipos: [] });
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly localFilesCapa = signal<File | null>(null);
  readonly localFilesGaleria = signal<File[]>([]);

  readonly steps = STEPS;

  constructor(private readonly agendaApi: AgendaApiService) {
    effect(() => {
      if (!this.open()) return;
      const lid = this.leito();
      untracked(async () => {
        this.step.set(1);
        this.formError.set(null);
        this.localFilesCapa.set(null);
        this.localFilesGaleria.set([]);
        this.loadError.set(null);
        await this.ensureCatalog();
        this.draft.set(lid ? draftFromLeito(lid) : emptyDraft());
      });
    }, { allowSignalWrites: true });
  }

  catalogForLeito(): HotelOfertaCatalogEntry[] {
    return (this.catalogs().catalog || []).filter((x) => x.scope === 'leito' || x.scope === 'both');
  }

  /** Escopo `@for/@if` sem arrow no template (parser Angular). */
  catalogForLeitoOutros(): HotelOfertaCatalogEntry[] {
    return this.catalogForLeito().filter((e) => (e.categoria || 'outros') === 'outros');
  }

  infraCat(): HotelEspacoSlugLabel[] {
    return this.catalogs().infra || [];
  }

  acoCat(): HotelEspacoSlugLabel[] {
    return this.catalogs().acomodacao_tipos || [];
  }

  byCategoria(cat: string): HotelOfertaCatalogEntry[] {
    return this.catalogForLeito().filter((e) => (e.categoria || 'outros') === cat);
  }

  private async ensureCatalog(): Promise<void> {
    try {
      const b = await this.agendaApi.getHotelHospedagemCatalog();
      this.catalogs.set(b);
    } catch {
      this.loadError.set('Não foi possível carregar catálogo de hospedagem.');
    }
  }

  toggleSlug(arr: string[], slug: string, checked: boolean): string[] {
    const set = new Set(arr || []);
    if (checked) set.add(slug);
    else set.delete(slug);
    return [...set];
  }

  patchDraft(patch: Partial<EspacoWizardDraft>): void {
    this.draft.update((d) => ({ ...d, ...patch }));
  }

  patchCapacidadeTotal(ev: unknown): void {
    const n = Number(ev);
    this.patchDraft({ capacidade: Number.isFinite(n) && n >= 1 ? n : 1 });
  }

  patchPorteCap(kind: 'capacidade_pequeno' | 'capacidade_medio' | 'capacidade_grande', ev: unknown): void {
    this.patchDraft({ [kind]: ev != null && ev !== '' ? String(ev) : '' } as Partial<EspacoWizardDraft>);
  }

  patchVitrinePrecio(ev: unknown): void {
    if (ev === '' || ev == null) {
      this.patchDraft({ vitrine_precio: null });
      return;
    }
    const n = Number(ev);
    this.patchDraft({ vitrine_precio: Number.isFinite(n) ? n : null });
  }

  toggleAcomodacaoSlug(slug: string, checked: boolean): void {
    this.draft.update((z) => ({
      ...z,
      acomodacao_slugs: this.toggleSlug(z.acomodacao_slugs, slug, checked),
    }));
  }

  toggleServicosSlug(slug: string, checked: boolean): void {
    this.draft.update((z) => ({
      ...z,
      servicos_slugs: this.toggleSlug(z.servicos_slugs, slug, checked),
    }));
  }

  toggleInfraSlug(slug: string, checked: boolean): void {
    this.draft.update((z) => ({
      ...z,
      infra_slugs: this.toggleSlug(z.infra_slugs, slug, checked),
    }));
  }

  setGaleriaUrlAt(idx: number, url: string): void {
    this.draft.update((z) => {
      const next = [...z.galeria_urls];
      next[idx] = url;
      return { ...z, galeria_urls: next };
    });
  }

  setStep(n: number): void {
    this.step.set(Math.min(Math.max(n, 1), 7));
  }

  next(): void {
    const err = this.validateStep(this.step());
    if (err) {
      this.formError.set(err);
      return;
    }
    this.formError.set(null);
    this.setStep(this.step() + 1);
  }

  prev(): void {
    this.formError.set(null);
    this.setStep(this.step() - 1);
  }

  private validateStep(s: number): string | null {
    const d = this.draft();
    if (s === 1 && !d.nome.trim()) return 'Informe o nome do espaço.';
    if (s === 1 && (!Number.isFinite(d.capacidade) || d.capacidade < 1)) return 'Capacidade total inválida.';
    if (s === 2 && !(d.acomodacao_slugs || []).length) return 'Escolha ao menos um tipo de acomodação.';
    if (s === 3) {
      const pq = this.parseNullableInt(d.capacidade_pequeno);
      const pm = this.parseNullableInt(d.capacidade_medio);
      const pg = this.parseNullableInt(d.capacidade_grande);
      const sum =
        (pq ?? 0) + (pm ?? 0) + (pg ?? 0);
      if (pq != null || pm != null || pg != null) {
        if (sum > d.capacidade) return 'Capacidades por porte não podem ultrapassar a capacidade total.';
      }
    }
    return null;
  }

  validateVitrine(d: EspacoWizardDraft): string | null {
    if (!d.vitrine_exibir) return null;
    if (d.vitrine_precio == null || !Number.isFinite(d.vitrine_precio) || d.vitrine_precio < 0) {
      return 'Informe um preço de diária válido para publicar.';
    }
    const keys: (keyof EspacoWizardDraft)[] = [
      'exige_polivalente_v8_v10',
      'exige_antirrabica',
      'exige_vermifugacao',
      'aceita_nao_castrado',
      'aceita_femea_no_cio',
      'aceita_agressivos',
      'aceita_idosos_ou_especiais',
      'aceita_medicacao_continua',
    ];
    for (const k of keys) {
      if (!(d[k] === 'sim' || d[k] === 'nao')) {
        return 'Para publicar, responda Sim ou Não em todas as políticas de segurança e comportamento.';
      }
    }
    return null;
  }

  parseNullableInt(s: string): number | null {
    const x = String(s || '').trim();
    if (!x) return null;
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
  }

  addGaleriaUrlRow(): void {
    this.draft.update((z) => ({ ...z, galeria_urls: [...z.galeria_urls, ''] }));
  }

  removeGaleriaUrlRow(i: number): void {
    this.draft.update((z) => ({ ...z, galeria_urls: z.galeria_urls.filter((_, j) => j !== i) }));
  }

  onCapaFile(ev: Event): void {
    const inp = ev.target as HTMLInputElement;
    const f = inp.files && inp.files[0];
    this.localFilesCapa.set(f || null);
  }

  onGaleriaFiles(ev: Event): void {
    const inp = ev.target as HTMLInputElement;
    const fs = inp.files ? Array.from(inp.files) : [];
    this.localFilesGaleria.set(fs);
  }

  dismiss(): void {
    this.dismissed.emit();
  }

  async submit(): Promise<void> {
    for (let s = 1; s <= 7; s++) {
      const e = this.validateStep(s);
      if (e) {
        this.setStep(s);
        this.formError.set(e);
        return;
      }
    }
    const d = this.draft();
    const ve = this.validateVitrine(d);
    if (ve) {
      this.setStep(7);
      this.formError.set(ve);
      return;
    }

    const leitoExist = this.leito();

    try {
      this.saving.set(true);
      this.formError.set(null);

      const fd = new FormData();
      fd.append('nome', d.nome.trim());
      fd.append('capacidade', String(Math.max(1, Math.trunc(d.capacidade))));
      fd.append('acomodacao_tipos', JSON.stringify(d.acomodacao_slugs));
      fd.append('servicos_oferta', JSON.stringify(d.servicos_slugs));
      fd.append('infra_slugs', JSON.stringify(d.infra_slugs));
      const pq = this.parseNullableInt(d.capacidade_pequeno);
      const pm = this.parseNullableInt(d.capacidade_medio);
      const pg = this.parseNullableInt(d.capacidade_grande);
      if (pq != null) fd.append('capacidade_pequeno', String(pq));
      if (pm != null) fd.append('capacidade_medio', String(pm));
      if (pg != null) fd.append('capacidade_grande', String(pg));
      fd.append(
        'convivencia',
        JSON.stringify({
          pode_misturar: triToBackend(d.pode_misturar),
          apenas_mesma_familia: triToBackend(d.apenas_mesma_familia),
          isolamento_obrigatorio: triToBackend(d.isolamento_obrigatorio),
        }),
      );
      fd.append(
        'saude_perfil',
        JSON.stringify({
          exige_polivalente_v8_v10: triToBackend(d.exige_polivalente_v8_v10),
          exige_antirrabica: triToBackend(d.exige_antirrabica),
          exige_vermifugacao: triToBackend(d.exige_vermifugacao),
          aceita_nao_castrado: triToBackend(d.aceita_nao_castrado),
          aceita_femea_no_cio: triToBackend(d.aceita_femea_no_cio),
          aceita_agressivos: triToBackend(d.aceita_agressivos),
          aceita_idosos_ou_especiais: triToBackend(d.aceita_idosos_ou_especiais),
          aceita_medicacao_continua: triToBackend(d.aceita_medicacao_continua),
        }),
      );
      fd.append(
        'regras_operacionais',
        JSON.stringify({
          check_in_hora: d.chk_in_hora?.trim() || null,
          check_out_hora: d.chk_out_hora?.trim() || null,
          politica_adaptacao: d.politica_adaptacao?.trim() || null,
          limite_estadia_dias:
            String(d.limite_estadia || '').trim() === '' ? null : Number(d.limite_estadia.trim()),
          politica_cancelamento: d.politica_cancelamento?.trim() || null,
          taxa_comportamento_agressivo: d.taxa_agressivo?.trim() || null,
        }),
      );
      fd.append(
        'galeria_urls',
        JSON.stringify(
          d.galeria_urls.map((x) => x.trim()).filter((u) => /^https?:\/\//i.test(u)),
        ),
      );
      if (d.video_url.trim()) fd.append('video_url', d.video_url.trim());
      if (d.nivel_conforto) fd.append('nivel_conforto', d.nivel_conforto);
      if (d.ambiente) fd.append('ambiente', d.ambiente);
      fd.append('exibir_na_vitrine', d.vitrine_exibir ? '1' : '0');
      fd.append('vitrine_nivel', d.vitrine_nivel);
      fd.append('vitrine_selos_snapshot', JSON.stringify(d.vitrine_selos));
      fd.append(
        'preco_diaria',
        d.vitrine_exibir && d.vitrine_precio != null ? String(Number(d.vitrine_precio)) : '',
      );

      const capa = this.localFilesCapa();
      if (capa) fd.append('foto', capa, capa.name);
      else if (leitoExist?.foto_url) fd.append('foto_url', String(leitoExist.foto_url));
      const extras = this.localFilesGaleria();
      for (const f of extras) fd.append('fotos', f, f.name);

      let saved: HotelLeitoRow | null = null;
      if (leitoExist?.id) {
        saved = await this.agendaApi.updateHotelLeito(leitoExist.id, fd);
      } else {
        saved = await this.agendaApi.createHotelLeito(fd);
      }
      if (!saved) {
        this.formError.set('Não foi possível salvar o espaço.');
        return;
      }
      this.saved.emit(saved);
      this.dismissed.emit();
    } catch (e: unknown) {
      let msg = 'Falha ao salvar o espaço.';
      if (e instanceof HttpErrorResponse) {
        if (e.status === 402)
          msg = 'Saldo de créditos insuficiente para o nível Destaque ou Top.';
        else if (e.error && typeof e.error === 'object' && 'error' in e.error && (e.error as { error?: string }).error)
          msg = String((e.error as { error: string }).error);
      }
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  toggleVitrineSelo(slug: string, on: boolean): void {
    this.draft.update((z) => {
      const s = new Set(z.vitrine_selos || []);
      if (on) s.add(slug);
      else s.delete(slug);
      return { ...z, vitrine_selos: [...s] };
    });
  }

  patchSaudeField(key: string, value: Tripolicy): void {
    this.draft.update((d) => ({ ...d, [key]: value } as EspacoWizardDraft));
  }

  isSeloOn(slug: string): boolean {
    return (this.draft().vitrine_selos || []).includes(slug);
  }
}
