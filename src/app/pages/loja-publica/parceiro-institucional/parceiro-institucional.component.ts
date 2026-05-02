import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TenantLojaService } from '../../../services/tenant-loja.service';
import { LojaSitePublicService } from '../../../services/loja-site-public.service';
import { SiteSection } from '../../../services/parceiro-site-builder.service';
import { BlogPostSummary } from '../../../services/parceiro-blog.service';

@Component({
  selector: 'app-parceiro-institucional',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-institucional.component.html',
  styleUrls: ['./parceiro-institucional.component.scss'],
})
export class ParceiroInstitucionalComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);
  private publicSvc = inject(LojaSitePublicService);
  readonly tenant = inject(TenantLojaService);

  sections = signal<SiteSection[]>([]);
  blogPosts = signal<BlogPostSummary[]>([]);
  hasBlog = signal(false);
  loadingSections = signal(true);

  readonly titulo = computed(() => this.tenant.profile()?.nome || 'Institucional');

  readonly legacyCorpo = computed(() => {
    const raw = this.tenant.profile()?.texto_institucional || this.tenant.profile()?.descricao || '';
    return String(raw || '');
  });

  ngOnInit(): void {
    const slug = this.tenant.profile()?.loja_slug ?? this.tenant.lojaSlug?.();
    if (slug) {
      void this.loadSections(slug);
      void this.loadBlogPreview(slug);
    } else {
      this.loadingSections.set(false);
    }
  }

  private async loadSections(slug: string): Promise<void> {
    try {
      const res = await this.publicSvc.getSections(slug).toPromise();
      this.sections.set(res?.data ?? []);
    } catch {
      this.sections.set([]);
    } finally {
      this.loadingSections.set(false);
    }
  }

  private async loadBlogPreview(slug: string): Promise<void> {
    try {
      const res = await this.publicSvc.getBlogPosts(slug, { page: 1, pageSize: 3 }).toPromise();
      const posts = res?.data ?? [];
      this.blogPosts.set(posts);
      this.hasBlog.set(posts.length > 0);
    } catch {
      this.hasBlog.set(false);
    }
  }

  safeHtml(html: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }

  whatsappLink(section: SiteSection): string {
    const tel = String(section.config['telefone'] || '').replace(/\D/g, '');
    const msg = encodeURIComponent(String(section.config['mensagem'] || ''));
    return `https://wa.me/${tel}${msg ? '?text=' + msg : ''}`;
  }
}
