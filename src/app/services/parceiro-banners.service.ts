import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BannerDto, Paged } from './admin-api.service';
import { ParceiroAuthService } from './parceiro-auth.service';

@Injectable({ providedIn: 'root' })
export class ParceiroBannersService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(ParceiroAuthService);
  private readonly base = `${environment.apiBaseUrl}/parceiro/banners`;

  listBanners(params?: {
    q?: string;
    page?: number;
    pageSize?: number;
    active?: 0 | 1;
    posicao?: string;
  }): Observable<Paged<BannerDto>> {
    let httpParams = new HttpParams();
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.page != null) httpParams = httpParams.set('page', String(params.page));
    if (params?.pageSize != null) httpParams = httpParams.set('pageSize', String(params.pageSize));
    if (params?.active === 0 || params?.active === 1) httpParams = httpParams.set('active', String(params.active));
    if (params?.posicao) httpParams = httpParams.set('posicao', params.posicao);
    return this.http.get<Paged<BannerDto>>(this.base, { headers: this.auth.getAuthHeaders(), params: httpParams });
  }

  getBanner(id: string | number): Observable<BannerDto> {
    return this.http.get<BannerDto>(`${this.base}/${id}`, { headers: this.auth.getAuthHeaders() });
  }

  createBanner(body: Partial<BannerDto> | FormData): Observable<BannerDto> {
    return this.http.post<BannerDto>(this.base, body as FormData, { headers: this.auth.getAuthHeaders() });
  }

  updateBanner(id: string | number, body: Partial<BannerDto> | FormData): Observable<BannerDto> {
    return this.http.put<BannerDto>(`${this.base}/${id}`, body as FormData, { headers: this.auth.getAuthHeaders() });
  }

  deleteBanner(id: string | number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`, { headers: this.auth.getAuthHeaders() });
  }
}
