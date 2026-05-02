import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LojaSitePublicService } from '../../../services/loja-site-public.service';
import { BlogPost } from '../../../services/parceiro-blog.service';
import { TenantLojaService } from '../../../services/tenant-loja.service';

@Component({
  selector: 'app-parceiro-blog-post-publico',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-blog-post-publico.component.html',
  styleUrls: ['./parceiro-blog-post-publico.component.scss'],
})
export class ParceiroBlogPostPublicoComponent implements OnInit {
  post = signal<BlogPost | null>(null);
  loading = signal(true);
  notFound = signal(false);

  private sanitizer = inject(DomSanitizer);
  private svc = inject(LojaSitePublicService);
  private tenant = inject(TenantLojaService);
  private route = inject(ActivatedRoute);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    const lojaSlug = this.tenant.profile()?.loja_slug ?? this.tenant.lojaSlug?.() ?? '';
    if (!lojaSlug || !slug) { this.notFound.set(true); this.loading.set(false); return; }
    void this.loadPost(lojaSlug, slug);
  }

  private async loadPost(lojaSlug: string, slug: string): Promise<void> {
    try {
      const post = await this.svc.getBlogPost(lojaSlug, slug).toPromise();
      this.post.set(post ?? null);
    } catch {
      this.notFound.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  safeHtml(html: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html || '');
  }
}
