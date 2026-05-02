import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ParceiroAuthService } from './parceiro-auth.service';

export interface BlogPost {
  id: number;
  titulo: string;
  slug: string;
  conteudo: string | null;
  imagem_capa: string | null;
  publicado: boolean;
  publicado_em: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPostSummary {
  id: number;
  titulo: string;
  slug: string;
  imagem_capa: string | null;
  publicado: boolean;
  publicado_em: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPostsPage {
  data: BlogPostSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export type BlogPostUpsertDto = {
  titulo?: string;
  slug?: string;
  conteudo?: string | null;
  imagem_capa?: string | null;
  publicado?: boolean;
};

const BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class ParceiroBlogService {
  constructor(private http: HttpClient, private auth: ParceiroAuthService) {}

  private headers(): HttpHeaders {
    return new HttpHeaders(this.auth.getAuthHeaders() as Record<string, string>);
  }

  listPosts(params?: { q?: string; page?: number; pageSize?: number; publicado?: boolean | null }): Observable<BlogPostsPage> {
    let httpParams = new HttpParams();
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.pageSize != null) httpParams = httpParams.set('pageSize', String(params.pageSize));
    if (params?.publicado != null) httpParams = httpParams.set('publicado', params.publicado ? '1' : '0');
    return this.http.get<BlogPostsPage>(`${BASE}/parceiro/blog/posts`, {
      headers: this.headers(),
      params: httpParams,
    });
  }

  getPost(id: number): Observable<BlogPost> {
    return this.http.get<BlogPost>(`${BASE}/parceiro/blog/posts/${id}`, { headers: this.headers() });
  }

  createPost(dto: BlogPostUpsertDto): Observable<BlogPost> {
    return this.http.post<BlogPost>(`${BASE}/parceiro/blog/posts`, dto, { headers: this.headers() });
  }

  updatePost(id: number, dto: BlogPostUpsertDto): Observable<BlogPost> {
    return this.http.patch<BlogPost>(`${BASE}/parceiro/blog/posts/${id}`, dto, { headers: this.headers() });
  }

  deletePost(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${BASE}/parceiro/blog/posts/${id}`, { headers: this.headers() });
  }

  uploadCover(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string }>(`${BASE}/parceiro/blog/upload-cover`, form, {
      headers: new HttpHeaders(this.auth.getAuthHeaders() as Record<string, string>),
    });
  }
}
