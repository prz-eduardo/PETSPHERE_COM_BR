import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import {
  Recurso,
  Agendamento,
  Colaborador,
  ColaboradorInvite,
  PermissaoRecurso,
  AgendaStatus,
  ParceiroServico,
} from '../../../../types/agenda.types';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { environment } from '../../../../../environments/environment';

const API_BASE = environment.apiBaseUrl;
/** Rotas canônicas pet-friendly (aliases no backend para o mesmo controller hotel_*). */
const PARCEIRO_HOSPEDAGEM = `${API_BASE}/parceiro/hospedagem`;

@Injectable({ providedIn: 'root' })
export class AgendaApiService {
  constructor(
    private http: HttpClient,
    private authService: ParceiroAuthService
  ) {}

  private getHeaders() {
    return {
      ...this.authService.getAuthHeaders(),
    };
  }

  // ===========================================================================
  // RECURSOS
  // ===========================================================================

  /**
   * GET /parceiro/recursos — lista recursos acessíveis
   */
  async getRecursos(): Promise<Recurso[]> {
    const response = await lastValueFrom(
      this.http.get<{ recursos: Recurso[] }>(
        `${API_BASE}/parceiro/recursos`,
        { headers: this.getHeaders() }
      )
    );
    return response.recursos || [];
  }

  /**
   * GET /parceiro/recursos/:id — obter recurso específico
   */
  async getRecurso(id: number): Promise<Recurso> {
    const response = await lastValueFrom(
      this.http.get<{ recurso: Recurso }>(
        `${API_BASE}/parceiro/recursos/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.recurso;
  }

  /**
   * POST /parceiro/recursos — criar novo recurso (master only)
   */
  async createRecurso(data: {
    nome: string;
    tipo: 'INDIVIDUAL' | 'COMPARTILHADO';
    owner_colaborador_id?: number;
  }): Promise<Recurso> {
    const response = await lastValueFrom(
      this.http.post<{ recurso: Recurso }>(
        `${API_BASE}/parceiro/recursos`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.recurso;
  }

  /**
   * PUT /parceiro/recursos/:id — atualizar recurso (master only)
   */
  async updateRecurso(
    id: number,
    data: Partial<{ nome: string; tipo: string; owner_colaborador_id: number | null }>
  ): Promise<Recurso> {
    const response = await lastValueFrom(
      this.http.put<{ recurso: Recurso }>(
        `${API_BASE}/parceiro/recursos/${id}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.recurso;
  }

  /**
   * DELETE /parceiro/recursos/:id — soft delete recurso (master only)
   */
  async deleteRecurso(id: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/recursos/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  // ===========================================================================
  // AGENDAMENTOS
  // ===========================================================================

  /**
   * GET /parceiro/agendamentos — lista agendamentos com filtros
   */
  async getAgendamentos(filters?: {
    recurso_id?: number;
    data_inicio?: string;
    data_fim?: string;
  }): Promise<Agendamento[]> {
    const params: any = {};
    if (filters?.recurso_id) params.recurso_id = filters.recurso_id;
    if (filters?.data_inicio) params.data_inicio = filters.data_inicio;
    if (filters?.data_fim) params.data_fim = filters.data_fim;

    const response = await lastValueFrom(
      this.http.get<{ agendamentos: Agendamento[] }>(
        `${API_BASE}/parceiro/agendamentos`,
        { headers: this.getHeaders(), params }
      )
    );
    return response.agendamentos || [];
  }

  /**
   * GET /parceiro/agendamentos/:id — obter agendamento específico
   */
  async getAgendamento(id: number): Promise<Agendamento> {
    const response = await lastValueFrom(
      this.http.get<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  /**
   * POST /parceiro/agendamentos — criar novo agendamento
   */
  async createAgendamento(data: {
    agenda_id?: number;
    cliente_id?: number;
    pet_id?: number;
    servico_id?: number;
    recurso_id: number;
    cliente_nome?: string;
    cliente_telefone?: string;
    pet_nome?: string;
    inicio?: string | Date;
    fim?: string | Date;
    data_hora_inicio?: string | Date;
    data_hora_fim?: string | Date;
    observacoes?: string;
  }): Promise<Agendamento> {
    const inicioValue = data.data_hora_inicio ?? data.inicio;
    const fimValue = data.data_hora_fim ?? data.fim;
    const payload = {
      ...data,
      data_hora_inicio: inicioValue instanceof Date ? inicioValue.toISOString() : inicioValue,
      data_hora_fim: fimValue instanceof Date ? fimValue.toISOString() : fimValue,
    };

    const response = await lastValueFrom(
      this.http.post<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos`,
        payload,
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  /**
   * PUT /parceiro/agendamentos/:id — atualizar agendamento
   */
  async updateAgendamento(
    id: number,
    data: Partial<{
      agenda_id: number;
      cliente_id: number | null;
      pet_id: number | null;
      servico_id: number | null;
      cliente_nome: string;
      cliente_telefone: string | null;
      pet_nome: string | null;
      inicio: string | Date;
      fim: string | Date;
      data_hora_inicio: string | Date;
      data_hora_fim: string | Date;
      observacoes: string | null;
    }>
  ): Promise<Agendamento> {
    const payload = { ...data };
    if (payload.inicio instanceof Date) payload.inicio = payload.inicio.toISOString();
    if (payload.fim instanceof Date) payload.fim = payload.fim.toISOString();
    if (payload.data_hora_inicio instanceof Date) payload.data_hora_inicio = payload.data_hora_inicio.toISOString();
    if (payload.data_hora_fim instanceof Date) payload.data_hora_fim = payload.data_hora_fim.toISOString();

    const response = await lastValueFrom(
      this.http.put<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos/${id}`,
        payload,
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  /**
   * PATCH /parceiro/agendamentos/:id/status — transicionar status
   */
  async patchStatus(
    id: number,
    status: AgendaStatus
  ): Promise<Agendamento> {
    const response = await lastValueFrom(
      this.http.patch<{ agendamento: Agendamento }>(
        `${API_BASE}/parceiro/agendamentos/${id}/status`,
        { status },
        { headers: this.getHeaders() }
      )
    );
    return response.agendamento;
  }

  // ===========================================================================
  // TELEMEDICINA
  // ===========================================================================

  async getTelemedicinaByAgendamento(agendamentoId: number) {
    return await lastValueFrom(
      this.http.get<{ consulta: any }>(
        `${API_BASE}/parceiro/telemedicina/agendamentos/${agendamentoId}`,
        { headers: this.getHeaders() }
      )
    );
  }

  async createTelemedicinaConsulta(data: {
    agendamento_id: number;
    cliente_id?: number | null;
    veterinario_id?: number | null;
    telemedicina_habilitada?: boolean;
    janela_inicio?: string | Date;
    janela_fim?: string | Date;
    observacoes?: string;
    criar_video_chamada?: boolean;
  }) {
    const payload = {
      ...data,
      janela_inicio: data.janela_inicio instanceof Date ? data.janela_inicio.toISOString() : data.janela_inicio,
      janela_fim: data.janela_fim instanceof Date ? data.janela_fim.toISOString() : data.janela_fim,
    };
    return await lastValueFrom(
      this.http.post<{ consulta: any; video_chamada?: any }>(
        `${API_BASE}/parceiro/telemedicina/consultas`,
        payload,
        { headers: this.getHeaders() }
      )
    );
  }

  async joinTelemedicinaConsulta(consultaId: number) {
    return await lastValueFrom(
      this.http.post<{
        consulta_id: number;
        sala_codigo: string;
        signaling_event: string;
        signaling_channel: string;
      }>(
        `${API_BASE}/parceiro/telemedicina/consultas/${consultaId}/entrar`,
        {},
        { headers: this.getHeaders() }
      )
    );
  }

  // ===========================================================================
  // SERVIÇOS DO PARCEIRO (cadastro — agenda / loja)
  // ===========================================================================

  async getServicos(): Promise<ParceiroServico[]> {
    const response = await lastValueFrom(
      this.http.get<{ servicos: ParceiroServico[] }>(
        `${API_BASE}/parceiro/servicos`,
        { headers: this.getHeaders() }
      )
    );
    return response.servicos || [];
  }

  async getServico(id: number): Promise<ParceiroServico> {
    const response = await lastValueFrom(
      this.http.get<{ servico: ParceiroServico }>(
        `${API_BASE}/parceiro/servicos/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.servico;
  }

  async createServico(data: {
    nome: string;
    duracao_minutos: number;
    preco?: number;
    ativo?: boolean;
  }): Promise<ParceiroServico> {
    const response = await lastValueFrom(
      this.http.post<{ servico: ParceiroServico }>(
        `${API_BASE}/parceiro/servicos`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.servico;
  }

  async updateServico(
    id: number,
    data: Partial<{ nome: string; duracao_minutos: number; preco: number; ativo: boolean }>
  ): Promise<ParceiroServico> {
    const response = await lastValueFrom(
      this.http.put<{ servico: ParceiroServico }>(
        `${API_BASE}/parceiro/servicos/${id}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.servico;
  }

  async deleteServico(id: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/servicos/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  // ===========================================================================
  // COLABORADORES (master only)
  // ===========================================================================

  /**
   * GET /parceiro/colaboradores — listar colaboradores
   */
  async getColaboradores(): Promise<Colaborador[]> {
    const response = await lastValueFrom(
      this.http.get<{ colaboradores: Colaborador[] }>(
        `${API_BASE}/parceiro/colaboradores`,
        { headers: this.getHeaders() }
      )
    );
    return response.colaboradores || [];
  }

  /**
   * GET /parceiro/colaboradores/:id — obter colaborador específico
   */
  async getColaborador(id: number): Promise<Colaborador> {
    const response = await lastValueFrom(
      this.http.get<{ colaborador: Colaborador }>(
        `${API_BASE}/parceiro/colaboradores/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.colaborador;
  }

  /**
   * POST /parceiro/colaboradores — criar novo colaborador
   */
  async createColaborador(data: {
    nome: string;
    email: string;
    senha: string;
    role: 'master' | 'colaborador';
    desvincularParceiroAtual?: boolean;
  }): Promise<Colaborador> {
    const response = await lastValueFrom(
      this.http.post<{ colaborador: Colaborador }>(
        `${API_BASE}/parceiro/colaboradores`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.colaborador;
  }

  /**
   * PUT /parceiro/colaboradores/:id — atualizar colaborador
   */
  async updateColaborador(
    id: number,
    data: Partial<{ nome: string; email: string; role: 'master' | 'colaborador' }>
  ): Promise<Colaborador> {
    const response = await lastValueFrom(
      this.http.put<{ colaborador: Colaborador }>(
        `${API_BASE}/parceiro/colaboradores/${id}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.colaborador;
  }

  /**
   * DELETE /parceiro/colaboradores/:id — soft delete colaborador
   */
  async deleteColaborador(id: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/colaboradores/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  async getColaboradorInvites(): Promise<ColaboradorInvite[]> {
    const response = await lastValueFrom(
      this.http.get<{ invites: ColaboradorInvite[] }>(
        `${API_BASE}/parceiro/colaboradores/invites`,
        { headers: this.getHeaders() }
      )
    );
    return response.invites || [];
  }

  async inviteColaborador(data: {
    email: string;
    nome?: string;
    role: 'master' | 'colaborador';
    com_vet?: boolean;
    expiresInHours?: number;
  }): Promise<{ invite: ColaboradorInvite; inviteLink: string }> {
    return await lastValueFrom(
      this.http.post<{ invite: ColaboradorInvite; inviteLink: string }>(
        `${API_BASE}/parceiro/colaboradores/invites`,
        data,
        { headers: this.getHeaders() }
      )
    );
  }

  async cancelInvite(inviteId: number): Promise<{ ok: boolean }> {
    return await lastValueFrom(
      this.http.delete<{ ok: boolean }>(
        `${API_BASE}/parceiro/colaboradores/invites/${inviteId}`,
        { headers: this.getHeaders() }
      )
    );
  }

  // ===========================================================================
  // PERMISSÕES (master only)
  // ===========================================================================

  /**
   * GET /parceiro/recursos/:recurso_id/permissoes — listar permissões
   */
  async getPermissoes(recursoId: number): Promise<PermissaoRecurso[]> {
    const response = await lastValueFrom(
      this.http.get<{ permissoes: PermissaoRecurso[] }>(
        `${API_BASE}/parceiro/recursos/${recursoId}/permissoes`,
        { headers: this.getHeaders() }
      )
    );
    return response.permissoes || [];
  }

  /**
   * PUT /parceiro/recursos/:recurso_id/permissoes/:colaborador_id
   * Upsert de permissões
   */
  async upsertPermissao(
    recursoId: number,
    colaboradorId: number,
    data: Partial<{
      pode_visualizar: boolean;
      pode_criar: boolean;
      pode_editar: boolean;
      pode_cancelar: boolean;
    }>
  ): Promise<PermissaoRecurso> {
    const response = await lastValueFrom(
      this.http.put<{ permissao: PermissaoRecurso }>(
        `${API_BASE}/parceiro/recursos/${recursoId}/permissoes/${colaboradorId}`,
        data,
        { headers: this.getHeaders() }
      )
    );
    return response.permissao;
  }

  /**
   * DELETE /parceiro/recursos/:recurso_id/permissoes/:colaborador_id
   */
  async deletePermissao(recursoId: number, colaboradorId: number): Promise<{ message: string }> {
    return await lastValueFrom(
      this.http.delete<{ message: string }>(
        `${API_BASE}/parceiro/recursos/${recursoId}/permissoes/${colaboradorId}`,
        { headers: this.getHeaders() }
      )
    );
  }

  // PERMISSÕES DE DADOS (clientes)
  // ===========================================================================

  async listPermissoesDados(): Promise<PermissaoDadosRow[]> {
    const response = await lastValueFrom(
      this.http.get<{ permissoes: PermissaoDadosRow[] }>(
        `${API_BASE}/parceiro/permissoes-dados`,
        { headers: this.getHeaders() }
      )
    );
    return response.permissoes || [];
  }

  async discoverClientes(q: string): Promise<DiscoveryCandidateRow[]> {
    const response = await lastValueFrom(
      this.http.get<{ candidates: DiscoveryCandidateRow[] }>(
        `${API_BASE}/parceiro/clientes/discovery`,
        { headers: this.getHeaders(), params: { q } }
      )
    );
    return response.candidates || [];
  }

  async postConviteCliente(body: {
    cliente_id?: number;
    cliente_email?: string;
    escopo?: 'dados_basicos' | 'pets' | 'completo';
    days_valid?: number;
  }): Promise<{ convite: ConviteClienteRow | null }> {
    return await lastValueFrom(
      this.http.post<{ convite: ConviteClienteRow | null }>(
        `${API_BASE}/parceiro/convites-clientes`,
        body,
        { headers: this.getHeaders() }
      )
    );
  }

  async inviteClient(data: {
    cliente_id?: number;
    cliente_email?: string;
    escopo?: 'dados_basicos' | 'pets' | 'completo';
    days_valid?: number;
  }): Promise<ConviteClienteRow | null> {
    const response = await this.postConviteCliente(data);
    return response.convite;
  }

  // ===========================================================================
  // HOTEL / RESERVAS (multi-tenant)
  // ===========================================================================

  async listHotelReservas(filters?: {
    status?: string;
    data_inicio?: string;
    data_fim?: string;
    search?: string;
  }): Promise<HotelReservaRow[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    if (filters?.data_inicio) params['data_inicio'] = filters.data_inicio;
    if (filters?.data_fim) params['data_fim'] = filters.data_fim;
    if (filters?.search) params['search'] = filters.search;

    const response = await lastValueFrom(
      this.http.get<{ reservas: HotelReservaRow[] }>(
        `${PARCEIRO_HOSPEDAGEM}/reservas`,
        { headers: this.getHeaders(), params }
      )
    );
    return response.reservas || [];
  }

  async getHotelReserva(id: number): Promise<HotelReservaRow | null> {
    const response = await lastValueFrom(
      this.http.get<{ reserva: HotelReservaRow | null }>(
        `${PARCEIRO_HOSPEDAGEM}/reservas/${id}`,
        { headers: this.getHeaders() }
      )
    );
    return response.reserva || null;
  }

  async createHotelReserva(body: {
    leito_id?: number | null;
    cliente_id?: number | null;
    pet_id?: number | null;
    cliente_nome_snapshot?: string | null;
    pet_nome_snapshot?: string | null;
    check_in: string | Date;
    check_out: string | Date;
    status?: HotelReservaStatus;
    valor_total?: number | null;
    observacoes?: string | null;
    cuidados_especiais?: string | null;
    alimentacao_obs?: string | null;
  }): Promise<HotelReservaRow | null> {
    const payload: {
      leito_id?: number | null;
      cliente_id?: number | null;
      pet_id?: number | null;
      cliente_nome_snapshot?: string | null;
      pet_nome_snapshot?: string | null;
      check_in: string | Date;
      check_out: string | Date;
      status?: HotelReservaStatus;
      valor_total?: number | null;
      observacoes?: string | null;
      cuidados_especiais?: string | null;
      alimentacao_obs?: string | null;
    } = {
      ...body,
      check_in: body.check_in instanceof Date ? body.check_in.toISOString() : body.check_in,
      check_out: body.check_out instanceof Date ? body.check_out.toISOString() : body.check_out,
    };
    const response = await lastValueFrom(
      this.http.post<{ reserva: HotelReservaRow | null }>(
        `${PARCEIRO_HOSPEDAGEM}/reservas`,
        payload,
        { headers: this.getHeaders() }
      )
    );
    return response.reserva || null;
  }

  async updateHotelReserva(
    id: number,
    body: Partial<{
      leito_id: number | null;
      cliente_id: number | null;
      pet_id: number | null;
      cliente_nome_snapshot: string | null;
      pet_nome_snapshot: string | null;
      check_in: string | Date;
      check_out: string | Date;
      status: HotelReservaStatus;
      valor_total: number | null;
      observacoes: string | null;
      cuidados_especiais: string | null;
      alimentacao_obs: string | null;
    }>
  ): Promise<HotelReservaRow | null> {
    const payload = { ...body };
    if (payload.check_in instanceof Date) payload.check_in = payload.check_in.toISOString();
    if (payload.check_out instanceof Date) payload.check_out = payload.check_out.toISOString();
    const response = await lastValueFrom(
      this.http.put<{ reserva: HotelReservaRow | null }>(
        `${PARCEIRO_HOSPEDAGEM}/reservas/${id}`,
        payload,
        { headers: this.getHeaders() }
      )
    );
    return response.reserva || null;
  }

  async listHotelLeitos(): Promise<HotelLeitoRow[]> {
    const response = await lastValueFrom(
      this.http.get<{ leitos: HotelLeitoRow[] }>(
        `${PARCEIRO_HOSPEDAGEM}/leitos`,
        { headers: this.getHeaders() }
      )
    );
    return response.leitos || [];
  }

  async getHotelOfertaCatalog(): Promise<HotelOfertaCatalogEntry[]> {
    const response = await lastValueFrom(
      this.http.get<{ catalog: HotelOfertaCatalogEntry[] }>(
        `${PARCEIRO_HOSPEDAGEM}/catalogo-ofertas`,
        { headers: this.getHeaders() }
      )
    );
    return response.catalog || [];
  }

  async createHotelLeito(
    body:
      | FormData
      | {
          nome: string;
          tipo?: string;
          capacidade?: number;
          foto_url?: string | null;
          exibir_na_vitrine?: boolean | number;
          preco_diaria?: number | null;
          ativo?: boolean | number;
          servicos_oferta?: string[];
        }
  ): Promise<HotelLeitoRow | null> {
    const response = await lastValueFrom(
      this.http.post<{ leito: HotelLeitoRow | null }>(
        `${PARCEIRO_HOSPEDAGEM}/leitos`,
        body,
        { headers: this.getHeaders() }
      )
    );
    return response.leito || null;
  }

  async updateHotelLeito(
    id: number,
    body:
      | FormData
      | Partial<{
          nome: string;
          tipo: string;
          capacidade: number;
          foto_url: string | null;
          exibir_na_vitrine: boolean | number;
          preco_diaria: number | null;
          ativo: boolean | number;
          servicos_oferta: string[];
        }>
  ): Promise<HotelLeitoRow | null> {
    const response = await lastValueFrom(
      this.http.put<{ leito: HotelLeitoRow | null }>(
        `${PARCEIRO_HOSPEDAGEM}/leitos/${id}`,
        body,
        { headers: this.getHeaders() }
      )
    );
    return response.leito || null;
  }

  async getHotelResumo(): Promise<HotelResumoRow | null> {
    const response = await lastValueFrom(
      this.http.get<{ resumo: HotelResumoRow | null }>(
        `${PARCEIRO_HOSPEDAGEM}/resumo`,
        { headers: this.getHeaders() }
      )
    );
    return response.resumo || null;
  }
}

export interface PermissaoDadosRow {
  id: number;
  cliente_id: number;
  parceiro_id: number;
  status: string;
  escopo: string;
  cliente_nome?: string | null;
  cliente_email?: string | null;
}

export interface ConviteClienteRow {
  id: number;
  parceiro_id: number;
  cliente_email: string;
  token: string;
  status: string;
  escopo?: string | null;
  data_expiracao?: string | null;
}

export interface DiscoveryCandidateRow {
  cliente_id: number;
  nome_masked: string;
  email_masked?: string | null;
  telefone_masked?: string | null;
  cpf_masked?: string | null;
  permissao_status?: string | null;
  permissao_escopo?: string | null;
  convite_pendente_id?: number | null;
}

export type HotelReservaStatus =
  | 'pendente'
  | 'confirmada'
  | 'checkin_hoje'
  | 'em_hospedagem'
  | 'checkout_concluido'
  | 'cancelada';

export interface HotelReservaRow {
  id: number;
  parceiro_id: number;
  agendamento_v2_id?: number | null;
  leito_id?: number | null;
  cliente_id?: number | null;
  pet_id?: number | null;
  cliente_nome_snapshot?: string | null;
  pet_nome_snapshot?: string | null;
  check_in: string;
  check_out: string;
  status: HotelReservaStatus;
  valor_total?: number | null;
  observacoes?: string | null;
  cuidados_especiais?: string | null;
  alimentacao_obs?: string | null;
  created_at?: string;
  updated_at?: string;
  leito_nome?: string | null;
  leito_tipo?: string | null;
}

export interface HotelOfertaCatalogEntry {
  slug: string;
  label_pt: string;
  scope: 'leito' | 'parceiro' | 'both';
}

export interface HotelLeitoRow {
  id: number;
  nome: string;
  tipo: string;
  capacidade: number;
  foto_url?: string | null;
  exibir_na_vitrine?: number | boolean;
  preco_diaria?: number | null;
  servico_id?: number | null;
  /** Slugs canônicos validados no backend */
  servicos_oferta?: string[];
  ativo: number | boolean;
  ocupado: number | boolean;
  proxima_reserva?: string | null;
}

export interface HotelResumoRow {
  total_leitos: number;
  leitos_ocupados: number;
  ocupacao_percentual: number;
  checkins_hoje: number;
  reservas_pendentes: number;
  reservas_confirmadas: number;
}
