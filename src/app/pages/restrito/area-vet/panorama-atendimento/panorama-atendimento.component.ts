import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../services/auth.service';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { ApiService } from '../../../../services/api.service';
import { ToastService } from '../../../../services/toast.service';
import {
  AgendaApiService,
  PanoramaClientePermitidoPet,
  PermissaoDadosRow,
} from '../../../parceiros/agenda/services/agenda-api.service';
import { RouteDistanceService } from './route-distance.service';
import { AtendimentoPanoramaStorageService } from './atendimento-panorama-storage.service';
import type {
  PanoramaAtendimento,
  PanoramaAtendimentoStatus,
  PanoramaDefaults,
  PanoramaExame,
  PanoramaExameStatus,
  PanoramaExtraLinha,
} from './atendimento-panorama.types';

@Component({
  selector: 'app-panorama-atendimento',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './panorama-atendimento.component.html',
  styleUrls: ['./panorama-atendimento.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanoramaAtendimentoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapHost', { static: false }) mapHost?: ElementRef<HTMLElement>;

  itens: PanoramaAtendimento[] = [];
  selecionado: PanoramaAtendimento | null = null;
  mapaModo: 'origem' | 'destino' = 'destino';
  calculandoRota = false;
  msgRota = '';
  geocodingOrigem = false;
  geocodingDestino = false;
  carregandoPermissoes = false;
  carregandoTutorApi = false;
  permissoesConcedidas: PermissaoDadosRow[] = [];
  petsDaPermissao: PanoramaClientePermitidoPet[] = [];
  escopoPetsOk = false;

  /** Defaults do parceiro (API) para novos registros e hidratação de origem vazia. */
  parceiroDefaults: PanoramaDefaults | null = null;
  preferenciasSalvasNoBackend = false;
  bannerSemEnderecoCadastro = false;
  bannerOrigemSemCoordenadas = false;

  readonly panoramaStepIds: string[] = [
    'panorama-ident',
    'panorama-mapa',
    'panorama-valores',
    'panorama-exames',
    'panorama-notas',
  ];
  readonly panoramaStepLabels = ['Identificação', 'Deslocamento', 'Valores', 'Exames', 'Notas'] as const;
  readonly formaPagamentoPresets = ['Pix', 'Cartão', 'Convênio', 'Dinheiro'] as const;

  private map: import('leaflet').Map | null = null;
  private autoRotaTimer: ReturnType<typeof setTimeout> | null = null;
  private layerRota: import('leaflet').Layer | null = null;
  private mkOrigem: import('leaflet').Marker | null = null;
  private mkDestino: import('leaflet').Marker | null = null;
  private leaflet: typeof import('leaflet') | null = null;

  readonly statusLabels: Record<PanoramaAtendimentoStatus, string> = {
    rascunho: 'Rascunho',
    agendado: 'Agendado',
    deslocamento: 'Em deslocamento',
    em_atendimento: 'Em atendimento',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
  };

  readonly exameStatusLabels: Record<PanoramaExameStatus, string> = {
    solicitado: 'Solicitado',
    enviado_tutor: 'Enviado pelo tutor',
    recebido_lab: 'Recebido / lab',
    em_analise: 'Em análise',
    resultado_ok: 'Resultado OK',
    cancelado: 'Cancelado',
  };

  readonly exameStatusOptions: PanoramaExameStatus[] = [
    'solicitado',
    'enviado_tutor',
    'recebido_lab',
    'em_analise',
    'resultado_ok',
    'cancelado',
  ];

  readonly statusOptions: PanoramaAtendimentoStatus[] = [
    'rascunho',
    'agendado',
    'deslocamento',
    'em_atendimento',
    'concluido',
    'cancelado',
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private auth: AuthService,
    private parceiroAuth: ParceiroAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private routeDistance: RouteDistanceService,
    private storage: AtendimentoPanoramaStorageService,
    private agendaApi: AgendaApiService,
    private api: ApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  get ns(): string {
    const path = (this.router.url || '').split('?')[0];
    if (path.includes('/parceiros/')) {
      const c = this.parceiroAuth.getCurrentColaborador();
      return `p:${c?.vet_id ?? c?.id ?? c?.email ?? 'colab'}`;
    }
    try {
      const t = this.auth.getToken();
      if (!t) return 'vet:local';
      const p = JSON.parse(atob(String(t).split('.')[1]));
      return `v:${p?.id || p?.sub || 'vet'}`;
    } catch {
      return 'vet:local';
    }
  }

  get baseVetLink(): string {
    return (this.router.url || '').includes('/parceiros/') ? '/parceiros' : '';
  }

  get isParceiroShell(): boolean {
    return (this.router.url || '').includes('/parceiros/');
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    void this.bootstrapPanorama();
  }

  private getEffectiveToken(): string | null {
    try {
      const t = this.auth.getToken?.();
      if (t) return t;
    } catch {}
    try {
      const pt = this.parceiroAuth.getToken?.();
      if (pt) return pt;
    } catch {}
    return null;
  }

  private defaultsParaNovo(): PanoramaDefaults {
    return { ...(this.parceiroDefaults ?? {}) };
  }

  private async hidratarPorAtendimentoApi(atendimentoId: number): Promise<void> {
    const token = this.getEffectiveToken();
    if (!token) {
      this.toast.error('Faça login para carregar o atendimento.');
      return;
    }
    try {
      const d = await firstValueFrom(this.api.getAtendimentoDetalhe(atendimentoId, token));
      const duplicado = this.itens.find((x) => Number(x.linkedAtendimentoId) === atendimentoId);
      if (duplicado) {
        this.selecionar(duplicado);
        this.toast.success('Atendimento já está na lista do panorama.');
        return;
      }
      const tutorNome = String(d?.cliente_nome || '').trim();
      const petNome = String(d?.pet_nome || '').trim();
      const criado = this.storage.criar(
        this.ns,
        {
          tutorNome,
          petNome,
          petId: d?.pet_id != null ? Number(d.pet_id) : null,
          clienteIdPermitido: d?.cliente_id != null ? Number(d.cliente_id) : null,
          linkedAtendimentoId: atendimentoId,
          status: 'rascunho',
        },
        this.defaultsParaNovo()
      );
      this.recarregarLista();
      const row = this.itens.find((x) => x.id === criado.id);
      this.selecionar(row ?? criado);
      this.toast.success('Dados do atendimento carregados no panorama.');
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ||
        'Não foi possível carregar este atendimento.';
      this.toast.error(msg);
    }
  }

  private async bootstrapPanorama(): Promise<void> {
    this.recarregarLista();
    await this.carregarDefaultsParceiro();
    if (this.isParceiroShell && this.parceiroAuth.getCurrentColaborador()) {
      await this.carregarPermissoesConcedidas();
    }
    const aidRaw = this.route.snapshot.queryParamMap.get('atendimentoId');
    if (aidRaw) {
      const n = Number(aidRaw);
      if (Number.isFinite(n) && n > 0) {
        await this.hidratarPorAtendimentoApi(n);
      }
    }
    if (this.itens.length && !this.selecionado) {
      this.selecionar(this.itens[0]);
    } else {
      this.cdr.detectChanges();
      setTimeout(() => this.initMapa(), 50);
    }
  }

  ngOnDestroy(): void {
    if (this.autoRotaTimer) {
      clearTimeout(this.autoRotaTimer);
      this.autoRotaTimer = null;
    }
    this.destruirMapa();
  }

  async carregarPermissoesConcedidas(): Promise<void> {
    this.carregandoPermissoes = true;
    this.cdr.markForCheck();
    try {
      const rows = await this.agendaApi.listPermissoesDados();
      const concedidos = (Array.isArray(rows) ? rows : []).filter(
        (r) => String(r.status || '').toLowerCase() === 'concedido'
      );
      const byCliente = new Map<number, PermissaoDadosRow>();
      for (const r of concedidos) {
        const prev = byCliente.get(r.cliente_id);
        if (!prev || r.id > prev.id) {
          byCliente.set(r.cliente_id, r);
        }
      }
      this.permissoesConcedidas = [...byCliente.values()].sort((a, b) =>
        String(a.cliente_nome || '').localeCompare(String(b.cliente_nome || ''), 'pt', { sensitivity: 'base' })
      );
    } catch {
      this.permissoesConcedidas = [];
      this.toast.error('Não foi possível carregar os tutores com permissão para esta loja.');
    } finally {
      this.carregandoPermissoes = false;
      this.cdr.markForCheck();
    }
  }

  onClientePermitidoChangeRaw(ev: unknown): void {
    const id = ev == null || ev === '' ? NaN : Number(ev);
    void this.onClientePermitidoChange(Number.isFinite(id) && id > 0 ? id : null);
  }

  onPetPermitidoChangeRaw(ev: unknown): void {
    const id = ev == null || ev === '' ? NaN : Number(ev);
    this.onPetPermitidoChange(Number.isFinite(id) && id > 0 ? id : null);
  }

  async onClientePermitidoChange(clienteId: number | null): Promise<void> {
    const s = this.selecionado;
    if (!s) return;
    s.clienteIdPermitido = clienteId ?? null;
    if (!clienteId) {
      this.petsDaPermissao = [];
      this.escopoPetsOk = false;
      this.cdr.markForCheck();
      return;
    }
    await this.aplicarPanoramaPermitido(s, clienteId);
  }

  onPetPermitidoChange(petId: number | null): void {
    const s = this.selecionado;
    if (!s) return;
    s.petId = petId ?? null;
    const p = this.petsDaPermissao.find((x) => x.id === petId);
    if (p) {
      s.petNome = p.nome || '';
    }
    this.cdr.markForCheck();
  }

  private async aplicarPanoramaPermitido(s: PanoramaAtendimento, clienteId: number): Promise<void> {
    this.carregandoTutorApi = true;
    this.cdr.markForCheck();
    try {
      const data = await this.agendaApi.getClientePanoramaDados(clienteId);
      s.tutorNome = data.tutor?.nome || '';
      s.tutorTelefone = (data.tutor?.telefone || '').trim() || s.tutorTelefone;
      if (data.endereco_texto) {
        s.destinoEnderecoTexto = data.endereco_texto;
        await this.geocodificar('destino', { toastSuccess: false });
      }
      this.petsDaPermissao = Array.isArray(data.pets) ? data.pets : [];
      this.escopoPetsOk = !!data.escopo_pets;
      if (s.petId != null && !this.petsDaPermissao.some((p) => Number(p.id) === Number(s.petId))) {
        s.petId = null;
        s.petNome = '';
      }
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error ||
        'Não foi possível carregar os dados deste tutor.';
      this.toast.error(msg);
      s.clienteIdPermitido = null;
      this.petsDaPermissao = [];
      this.escopoPetsOk = false;
    } finally {
      this.carregandoTutorApi = false;
      this.cdr.markForCheck();
    }
  }

  private async carregarDefaultsParceiro(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.isParceiroShell) {
      this.parceiroDefaults = {};
      this.preferenciasSalvasNoBackend = false;
      this.bannerSemEnderecoCadastro = false;
      this.bannerOrigemSemCoordenadas = false;
      return;
    }
    const token = this.getEffectiveToken();
    if (!token) {
      this.parceiroDefaults = {};
      return;
    }
    try {
      const [addr, pref] = await Promise.all([
        firstValueFrom(this.api.getMeuEnderecoParceiro(token)),
        firstValueFrom(this.api.getPanoramaPreferencias(token)),
      ]);
      const d: PanoramaDefaults = {
        valorPorKm: pref.valor_por_km,
        valorConsulta: pref.valor_consulta,
        taxaAdicional: pref.taxa_adicional,
        descontoPercent: pref.desconto_percent,
        formaPagamento: pref.forma_pagamento ?? undefined,
      };
      if (addr.endereco_texto) {
        d.origemEnderecoTexto = addr.endereco_texto;
      }
      if (addr.latitude != null && addr.longitude != null) {
        d.origemLat = addr.latitude;
        d.origemLng = addr.longitude;
      }
      this.preferenciasSalvasNoBackend = pref.saved === true;
      this.bannerSemEnderecoCadastro = !addr.endereco_texto;
      this.bannerOrigemSemCoordenadas = !!(
        addr.endereco_texto &&
        (addr.latitude == null || addr.longitude == null)
      );

      if (this.bannerOrigemSemCoordenadas && addr.endereco_texto) {
        await this.enriquecerCoordsOrigemPorGeocode(d, addr.endereco_texto);
      }

      this.parceiroDefaults = d;
    } catch {
      this.parceiroDefaults = {};
      this.toast.error('Não foi possível carregar endereço ou preferências do parceiro.');
    }
    this.cdr.markForCheck();
  }

  private async enriquecerCoordsOrigemPorGeocode(d: PanoramaDefaults, texto: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.osmGeocodeAddress(texto.trim()));
      const hit = (res.results || []).find(
        (r) => r.lat != null && r.lon != null && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon))
      );
      if (hit) {
        d.origemLat = Number(hit.lat);
        d.origemLng = Number(hit.lon);
        this.bannerOrigemSemCoordenadas = false;
      }
    } catch {
      /* mantém banner */
    }
  }

  private hidratarOrigemParceiroSeVazio(s: PanoramaAtendimento): void {
    const d = this.parceiroDefaults;
    if (!d) return;
    if (!String(s.origemEnderecoTexto || '').trim() && d.origemEnderecoTexto) {
      s.origemEnderecoTexto = d.origemEnderecoTexto;
    }
    const coordsInvalidos =
      !Number.isFinite(s.origemLat) ||
      !Number.isFinite(s.origemLng) ||
      (s.origemLat === 0 && s.origemLng === 0);
    if (coordsInvalidos && d.origemLat != null && d.origemLng != null) {
      s.origemLat = d.origemLat;
      s.origemLng = d.origemLng;
    }
  }

  scrollParaPanoramaStep(id: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setStatusChip(st: PanoramaAtendimentoStatus): void {
    const s = this.selecionado;
    if (!s) return;
    s.status = st;
    this.cdr.markForCheck();
  }

  statusChipAtivo(st: PanoramaAtendimentoStatus): boolean {
    return this.selecionado?.status === st;
  }

  setFormaPagamentoChip(label: string): void {
    const s = this.selecionado;
    if (!s) return;
    s.formaPagamento = label;
    this.cdr.markForCheck();
  }

  formaPagamentoChipAtivo(label: string): boolean {
    return (this.selecionado?.formaPagamento || '').trim() === label;
  }

  formaPagamentoEhOutra(): boolean {
    const v = (this.selecionado?.formaPagamento || '').trim();
    return !v || !(this.formaPagamentoPresets as readonly string[]).includes(v);
  }

  onDestinoEnderecoBlur(): void {
    void this._geocodificar('destino', { toastSuccess: false });
  }

  focarFormaPagamentoOutra(): void {
    const s = this.selecionado;
    if (!s) return;
    s.formaPagamento = '';
    this.cdr.markForCheck();
  }

  async salvarComoPadrao(): Promise<void> {
    const s = this.selecionado;
    const token = this.getEffectiveToken();
    if (!s || !token || !this.isParceiroShell) return;
    try {
      await firstValueFrom(
        this.api.putPanoramaPreferencias(token, {
          valor_por_km: Number(s.valorPorKm) || 0,
          valor_consulta: Number(s.valorConsulta) || 0,
          taxa_adicional: Number(s.taxaAdicional) || 0,
          desconto_percent: Number(s.descontoPercent) || 0,
          forma_pagamento: s.formaPagamento?.trim() || null,
        })
      );
      this.preferenciasSalvasNoBackend = true;
      if (this.parceiroDefaults) {
        this.parceiroDefaults = {
          ...this.parceiroDefaults,
          valorPorKm: Number(s.valorPorKm) || 0,
          valorConsulta: Number(s.valorConsulta) || 0,
          taxaAdicional: Number(s.taxaAdicional) || 0,
          descontoPercent: Number(s.descontoPercent) || 0,
          formaPagamento: s.formaPagamento ?? undefined,
        };
      }
      this.toast.success('Valores salvos como padrão para novos atendimentos.');
      this.cdr.markForCheck();
    } catch {
      this.toast.error('Não foi possível salvar as preferências.');
    }
  }

  recarregarLista(): void {
    this.itens = this.storage.listar(this.ns);
    this.cdr.markForCheck();
  }

  novo(): void {
    const criado = this.storage.criar(this.ns, {}, this.defaultsParaNovo());
    this.recarregarLista();
    this.selecionar(criado);
    this.msgRota = '';
    this.petsDaPermissao = [];
    this.escopoPetsOk = false;
  }

  selecionar(row: PanoramaAtendimento): void {
    this.selecionado = { ...row };
    this.hidratarOrigemParceiroSeVazio(this.selecionado);
    this.msgRota = '';
    this.petsDaPermissao = [];
    this.escopoPetsOk = false;
    this.cdr.detectChanges();
    this.cdr.markForCheck();
    if (this.isParceiroShell && row.clienteIdPermitido) {
      void this.aplicarPanoramaPermitido(this.selecionado!, row.clienteIdPermitido);
    }
    setTimeout(() => this.initMapa(), 50);
  }

  salvar(): void {
    if (!this.selecionado) return;
    this.storage.atualizar(this.ns, this.selecionado);
    this.recarregarLista();
    const atual = this.itens.find((x) => x.id === this.selecionado!.id);
    if (atual) this.selecionado = { ...atual };
    this.cdr.markForCheck();
  }

  excluir(): void {
    if (!this.selecionado) return;
    if (!confirm('Excluir este registro do panorama?')) return;
    this.storage.remover(this.ns, this.selecionado.id);
    this.selecionado = null;
    this.recarregarLista();
    if (this.itens.length) this.selecionar(this.itens[0]);
    else {
      this.destruirMapa();
      this.cdr.detectChanges();
    }
    this.cdr.markForCheck();
  }

  kmLinhaRetaAtual(): number {
    const s = this.selecionado;
    if (!s) return 0;
    return this.routeDistance.haversineKm(s.origemLat, s.origemLng, s.destinoLat, s.destinoLng);
  }

  kmUsadoNaCobranca(): number {
    const s = this.selecionado;
    if (!s) return 0;
    if (s.kmManual != null && s.kmManual >= 0) return s.kmManual;
    if (s.kmRota != null && s.kmRota >= 0) return s.kmRota;
    return this.kmLinhaRetaAtual();
  }

  valorDeslocamento(): number {
    const s = this.selecionado;
    if (!s) return 0;
    return Math.round(this.kmUsadoNaCobranca() * (Number(s.valorPorKm) || 0) * 100) / 100;
  }

  somaExtras(): number {
    const s = this.selecionado;
    if (!s?.extras?.length) return 0;
    return Math.round(s.extras.reduce((a, x) => a + (Number(x.valor) || 0), 0) * 100) / 100;
  }

  subtotalBruto(): number {
    const s = this.selecionado;
    if (!s) return 0;
    const v =
      this.valorDeslocamento() +
      (Number(s.valorConsulta) || 0) +
      (Number(s.taxaAdicional) || 0) +
      this.somaExtras();
    return Math.round(v * 100) / 100;
  }

  valorDesconto(): number {
    const s = this.selecionado;
    if (!s) return 0;
    const p = Math.min(100, Math.max(0, Number(s.descontoPercent) || 0));
    return Math.round(this.subtotalBruto() * (p / 100) * 100) / 100;
  }

  totalLiquido(): number {
    return Math.round((this.subtotalBruto() - this.valorDesconto()) * 100) / 100;
  }

  private coordsValidas(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    );
  }

  private agendarAutoRota(): void {
    if (this.autoRotaTimer) clearTimeout(this.autoRotaTimer);
    this.autoRotaTimer = setTimeout(() => {
      this.autoRotaTimer = null;
      void this.tentarAutoCalcularRota();
    }, 1500);
  }

  private async tentarAutoCalcularRota(): Promise<void> {
    const s = this.selecionado;
    if (!s || this.calculandoRota) return;
    if (
      !this.coordsValidas(s.origemLat, s.origemLng) ||
      !this.coordsValidas(s.destinoLat, s.destinoLng)
    ) {
      return;
    }
    await this.calcularRota();
  }

  async calcularRota(): Promise<void> {
    const s = this.selecionado;
    if (!s) return;
    this.calculandoRota = true;
    this.msgRota = '';
    this.cdr.markForCheck();
    const ret = await this.routeDistance.distanciaPorRotaKm(
      s.origemLat,
      s.origemLng,
      s.destinoLat,
      s.destinoLng
    );
    s.kmRota = ret.km;
    s.kmLinhaReta = this.routeDistance.haversineKm(s.origemLat, s.origemLng, s.destinoLat, s.destinoLng);
    if (ret.erro) this.msgRota = ret.erro;
    else this.msgRota = ret.fonte === 'osrm' ? 'Rota calculada (malha viária).' : 'Distância em linha reta.';
    this.calculandoRota = false;
    this.desenharRotaNoMapa(ret.pathLatLng);
    this.cdr.markForCheck();
  }

  linhaRetaInfo(): void {
    const s = this.selecionado;
    if (!s) return;
    s.kmLinhaReta = this.kmLinhaRetaAtual();
    this.msgRota = `Linha reta: ${s.kmLinhaReta} km (não substitui a rota; use para referência).`;
    this.cdr.markForCheck();
  }

  async geocodificar(
    modo: 'origem' | 'destino',
    opts: { toastSuccess: boolean } = { toastSuccess: true },
  ): Promise<void> {
    await this._geocodificar(modo, opts);
  }

  private async _geocodificar(
    modo: 'origem' | 'destino',
    opts: { toastSuccess: boolean }
  ): Promise<void> {
    const s = this.selecionado;
    if (!s) return;
    const q =
      modo === 'origem'
        ? String(s.origemEnderecoTexto || '').trim()
        : String(s.destinoEnderecoTexto || '').trim();
    if (q.length < 4) {
      if (opts.toastSuccess) {
        this.toast.error('Digite o endereço completo (rua, número, cidade…) com ao menos 4 caracteres.');
      }
      return;
    }
    if (modo === 'origem') this.geocodingOrigem = true;
    else this.geocodingDestino = true;
    this.cdr.markForCheck();
    try {
      const res = await firstValueFrom(this.api.osmGeocodeAddress(q));
      const hit = (res.results || []).find(
        (r) => r.lat != null && r.lon != null && Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon))
      );
      if (!hit) {
        if (opts.toastSuccess) {
          this.toast.error('Nenhum resultado encontrado para este endereço. Ajuste o texto e tente de novo.');
        }
        return;
      }
      const lat = Number(hit.lat);
      const lng = Number(hit.lon);
      if (modo === 'origem') {
        s.origemLat = lat;
        s.origemLng = lng;
      } else {
        s.destinoLat = lat;
        s.destinoLng = lng;
      }
      this.msgRota = hit.display_name ? `Local encontrado: ${hit.display_name}` : 'Coordenadas atualizadas (OpenStreetMap).';
      this.refreshMapa();
      if (opts.toastSuccess) {
        this.toast.success('Endereço localizado no mapa.');
      }
      this.agendarAutoRota();
    } catch {
      if (opts.toastSuccess) {
        this.toast.error('Falha na geocodificação. Tente novamente em instantes.');
      }
    } finally {
      if (modo === 'origem') this.geocodingOrigem = false;
      else this.geocodingDestino = false;
      this.cdr.markForCheck();
    }
  }

  addExtra(): void {
    const s = this.selecionado;
    if (!s) return;
    const id = `ex_${Date.now()}`;
    s.extras = [...(s.extras || []), { id, descricao: 'Material / procedimento', valor: 0 }];
    this.cdr.markForCheck();
  }

  rmExtra(id: string): void {
    const s = this.selecionado;
    if (!s) return;
    s.extras = (s.extras || []).filter((x) => x.id !== id);
    this.cdr.markForCheck();
  }

  addExame(): void {
    const s = this.selecionado;
    if (!s) return;
    const id = `lab_${Date.now()}`;
    const ex: PanoramaExame = { id, nome: 'Novo exame', status: 'solicitado' };
    s.exames = [...(s.exames || []), ex];
    this.cdr.markForCheck();
  }

  rmExame(id: string): void {
    const s = this.selecionado;
    if (!s) return;
    s.exames = (s.exames || []).filter((x) => x.id !== id);
    this.cdr.markForCheck();
  }

  private async initMapa(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.mapHost?.nativeElement || !this.selecionado) {
      return;
    }
    this.destruirMapa();
    const L = await import('leaflet');
    this.leaflet = L.default;
    const el = this.mapHost.nativeElement;
    const s = this.selecionado;
    const center: [number, number] = [(s.origemLat + s.destinoLat) / 2, (s.origemLng + s.destinoLng) / 2];
    this.map = L.default.map(el, { zoomControl: true }).setView(center, 12);
    L.default
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      })
      .addTo(this.map);

    const dragO = L.default.marker([s.origemLat, s.origemLng], {
      draggable: true,
      title: 'Origem (clínica / saída)',
    }).addTo(this.map);
    const dragD = L.default.marker([s.destinoLat, s.destinoLng], {
      draggable: true,
      title: 'Destino (domicílio)',
    }).addTo(this.map);
    const iconHtml = (label: string, bg: string) =>
      `<div style="width:22px;height:22px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0f172a;">${label}</div>`;
    dragO.setIcon(
      L.default.divIcon({
        className: 'ps-pano-marker',
        html: iconHtml('O', '#38bdf8'),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
    );
    dragD.setIcon(
      L.default.divIcon({
        className: 'ps-pano-marker',
        html: iconHtml('D', '#f472b6'),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
    );

    dragO.on('dragend', () => {
      const ll = dragO.getLatLng();
      if (this.selecionado) {
        this.selecionado.origemLat = ll.lat;
        this.selecionado.origemLng = ll.lng;
        this.cdr.markForCheck();
        this.agendarAutoRota();
      }
    });
    dragD.on('dragend', () => {
      const ll = dragD.getLatLng();
      if (this.selecionado) {
        this.selecionado.destinoLat = ll.lat;
        this.selecionado.destinoLng = ll.lng;
        this.cdr.markForCheck();
        this.agendarAutoRota();
      }
    });

    this.mkOrigem = dragO;
    this.mkDestino = dragD;

    this.map.on('click', (ev: import('leaflet').LeafletMouseEvent) => {
      if (!this.selecionado) return;
      const { lat, lng } = ev.latlng;
      if (this.mapaModo === 'origem') {
        this.selecionado.origemLat = lat;
        this.selecionado.origemLng = lng;
        dragO.setLatLng([lat, lng]);
      } else {
        this.selecionado.destinoLat = lat;
        this.selecionado.destinoLng = lng;
        dragD.setLatLng([lat, lng]);
      }
      this.cdr.markForCheck();
      this.agendarAutoRota();
    });

    this.map.fitBounds(
      L.default.latLngBounds(
        L.default.latLng(s.origemLat, s.origemLng),
        L.default.latLng(s.destinoLat, s.destinoLng)
      ),
      { padding: [40, 40], maxZoom: 14 }
    );
  }

  refreshMapa(): void {
    void this.initMapa();
  }

  private desenharRotaNoMapa(path?: [number, number][]): void {
    if (!this.map || !this.leaflet) return;
    if (this.layerRota) {
      this.map.removeLayer(this.layerRota);
      this.layerRota = null;
    }
    const s = this.selecionado;
    if (!s) return;
    const L = this.leaflet;
    if (path && path.length > 1) {
      this.layerRota = L.polyline(path, { color: '#94a3b8', weight: 4, opacity: 0.9 }).addTo(this.map);
      this.map.fitBounds((this.layerRota as import('leaflet').Polyline).getBounds(), { padding: [36, 36], maxZoom: 14 });
    }
  }

  private destruirMapa(): void {
    try {
      this.map?.remove();
    } catch {
      /* */
    }
    this.map = null;
    this.layerRota = null;
    this.mkOrigem = null;
    this.mkDestino = null;
    this.leaflet = null;
  }
}
