import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ParceiroAuthService } from './parceiro-auth.service';

export type SectionTipo = 'hero' | 'texto' | 'galeria' | 'servicos' | 'whatsapp';

export interface SectionImagem {
  url: string;
  alt?: string;
  legenda?: string;
}

export interface SiteSection {
  id: number;
  tipo: SectionTipo;
  titulo: string | null;
  subtitulo: string | null;
  conteudo: string | null;
  imagens: SectionImagem[];
  config: Record<string, unknown>;
  ordem: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SectionUpsertDto = Partial<Omit<SiteSection, 'id' | 'created_at' | 'updated_at'>>;

const BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class ParceirSiteBuilderService {
  constructor(private http: HttpClient, private auth: ParceiroAuthService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.getAuthHeaders() as Record<string, string>);
  }

  getSections(): Observable<{ data: SiteSection[] }> {
    return this.http.get<{ data: SiteSection[] }>(`${BASE}/parceiro/site-builder/sections`, {
      headers: this.headers(),
    });
  }

  createSection(dto: SectionUpsertDto): Observable<SiteSection> {
    return this.http.post<SiteSection>(`${BASE}/parceiro/site-builder/sections`, dto, {
      headers: this.headers(),
    });
  }

  updateSection(id: number, dto: SectionUpsertDto): Observable<SiteSection> {
    return this.http.patch<SiteSection>(`${BASE}/parceiro/site-builder/sections/${id}`, dto, {
      headers: this.headers(),
    });
  }

  reorderSections(ids: number[]): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(
      `${BASE}/parceiro/site-builder/sections/reorder`,
      { ids },
      { headers: this.headers() }
    );
  }

  deleteSection(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${BASE}/parceiro/site-builder/sections/${id}`, {
      headers: this.headers(),
    });
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string }>(`${BASE}/parceiro/site-builder/upload-image`, form, {
      headers: new HttpHeaders(this.auth.getAuthHeaders() as Record<string, string>),
    });
  }
}
