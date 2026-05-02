import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LojaSitePublicService } from '../../../services/loja-site-public.service';
import { BlogPostSummary } from '../../../services/parceiro-blog.service';
import { TenantLojaService } from '../../../services/tenant-loja.service';

@Component({
  selector: 'app-parceiro-blog-publico',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-blog-publico.component.html',
  styleUrls: ['./parceiro-blog-publico.component.scss'],
})
export class ParceiroBlogPublicoComponent implements OnInit {
  posts = signal<BlogPostSummary[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 9;
  loading = signal(true);
  lojaSlug = signal('');

  constructor(
    private svc: LojaSitePublicService,
    private tenant: TenantLojaService,
  ) {}

  ngOnInit(): void {
    const slug = this.tenant.profile()?.loja_slug ?? this.tenant.lojaSlug?.() ?? '';
    this.lojaSlug.set(slug);
    if (slug) void this.load();
    else this.loading.set(false);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.svc.getBlogPosts(this.lojaSlug(), {
        page: this.page(),
        pageSize: this.pageSize,
      }).toPromise();
      this.posts.set(res?.data ?? []);
      this.total.set(res?.total ?? 0);
    } finally {
      this.loading.set(false);
    }
  }

  totalPages(): number { return Math.ceil(this.total() / this.pageSize) || 1; }
  goPage(p: number): void { this.page.set(p); void this.load(); }
}
