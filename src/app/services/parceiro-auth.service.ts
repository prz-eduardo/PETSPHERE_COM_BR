import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Colaborador, SessionColaborador, RoleColaborador, PartnerType } from '../types/agenda.types';

function slugToPartnerType(slug: string | null | undefined): PartnerType {
  const s = (slug || '').toLowerCase();
  if (s === 'clinic') return 'CLINIC';
  if (s === 'sitter') return 'SITTER';
  if (s === 'hotel') return 'HOTEL';
  if (s === 'creche' || s === 'daycare') return 'DAYCARE';
  return 'PETSHOP';
}
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'parceiro_token';
const API_BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class ParceiroAuthService {
  private session: SessionColaborador | null = null;
  private cachedPartnerTipo: PartnerType | null = null;

  constructor(private http: HttpClient) {
    this.loadSessionFromStorage();
  }

  /**
   * Realiza login com email e senha
   * POST /parceiro/auth/login
   */
  async login(email: string, senha: string): Promise<{ token: string; colaborador: Colaborador }> {
    try {
      const response = await lastValueFrom(
        this.http.post<{ token: string; colaborador: Colaborador }>(
          `${API_BASE}/parceiro/auth/login`,
          { email, senha }
        )
      );

      // Cria sessão com 8 horas de expiração
      this.session = {
        colaborador: response.colaborador,
        token: response.token,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      };

      // Salva no localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));

      void this.refreshPartnerProfile();

      return response;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  /**
   * Solicita uma sessão JWT de veterinário vinculada ao colaborador logado.
   * Usada para liberar recursos da área-vet no contexto do painel parceiro.
   */
  async getVetSession(): Promise<{
    allowed: boolean;
    token: string;
    vet: { id: number; nome: string; email: string; crmv?: string | null };
  }> {
    return await lastValueFrom(
      this.http.get<{
        allowed: boolean;
        token: string;
        vet: { id: number; nome: string; email: string; crmv?: string | null };
      }>(`${API_BASE}/parceiro/auth/vet-session`, { headers: this.getAuthHeaders() })
    );
  }

  /**
   * Faz logout
   */
  logout(): void {
    this.session = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Retorna o colaborador atualmente autenticado
   */
  getCurrentColaborador(): Colaborador | null {
    if (!this.session) return null;
    if (this.session.expiresAt < Date.now()) {
      this.logout();
      return null;
    }
    return this.session.colaborador;
  }

  /**
   * Sincroniza tipo de estabelecimento a partir de GET /parceiro/auth/me.
   */
  async refreshPartnerProfile(): Promise<void> {
    if (!this.getToken()) {
      this.cachedPartnerTipo = null;
      return;
    }
    try {
      const response = await lastValueFrom(
        this.http.get<{ colaborador: Colaborador }>(
          `${API_BASE}/parceiro/auth/me`,
          { headers: this.getAuthHeaders() }
        )
      );
      if (this.session) {
        this.session.colaborador = { ...this.session.colaborador, ...response.colaborador };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
        } catch {
          /* ignore */
        }
      }
      const slug = (response.colaborador as Colaborador).parceiroTipoSlug;
      this.cachedPartnerTipo = slugToPartnerType(slug);
    } catch {
      this.cachedPartnerTipo = null;
    }
  }

  /**
   * Retorna informações do parceiro atual (para compatibilidade com shell)
   */
  getCurrentParceiro(): { tipo: PartnerType } | null {
    return { tipo: this.cachedPartnerTipo ?? 'PETSHOP' };
  }

  /**
   * Retorna o token JWT
   */
  getToken(): string | null {
    if (!this.session) return null;
    if (this.session.expiresAt < Date.now()) {
      this.logout();
      return null;
    }
    return this.session.token;
  }

  /**
   * Retorna headers para requisições autenticadas
   */
  getAuthHeaders(): { Authorization: string } | {} {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Verifica se está autenticado
   */
  isLoggedIn(): boolean {
    return this.getCurrentColaborador() !== null;
  }

  /**
   * Retorna role do colaborador
   */
  getRole(): RoleColaborador | null {
    return this.getCurrentColaborador()?.role ?? null;
  }

  /**
   * Verifica se é master
   */
  isMaster(): boolean {
    return this.getRole() === 'master';
  }

  /**
   * Carrega sessão do localStorage se existir
   */
  private loadSessionFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const session: SessionColaborador = JSON.parse(raw);
      if (session.expiresAt < Date.now()) {
        this.logout();
      } else {
        this.session = session;
        void this.refreshPartnerProfile();
      }
    } catch {
      // Sessão corrompida, limpa
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
