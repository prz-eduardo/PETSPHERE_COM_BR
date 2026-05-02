import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SiteSection } from './parceiro-site-builder.service';
import { BlogPostSummary, BlogPost } from './parceiro-blog.service';

const BASE = environment.apiBaseUrl;

@Injectable({ providedIn: 'root' })
export class LojaSitePublicService {
  constructor(private http: HttpClient) {}

  getSections(lojaSlug: string): Observable<{ data: SiteSection[] }> {
    return this.http.get<{ data: SiteSection[] }>(
      `${BASE}/public/loja/${encodeURIComponent(lojaSlug)}/site-sections`
    );
  }

  getBlogPosts(
    lojaSlug: string,
    params?: { page?: number; pageSize?: number }
  ): Observable<{ data: BlogPostSummary[]; total: number; page: number; pageSize: number }> {
    let httpParams = new HttpParams();
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.pageSize != null) httpParams = httpParams.set('pageSize', String(params.pageSize));
    return this.http.get<any>(
      `${BASE}/public/loja/${encodeURIComponent(lojaSlug)}/blog`,
      { params: httpParams }
    );
  }

  getBlogPost(lojaSlug: string, slug: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(
      `${BASE}/public/loja/${encodeURIComponent(lojaSlug)}/blog/${encodeURIComponent(slug)}`
    );
  }
}
