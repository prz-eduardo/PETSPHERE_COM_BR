import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
  selector: 'app-parceiro-modulo-em-breve',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-modulo-em-breve.component.html',
  styleUrls: ['./parceiro-modulo-em-breve.component.scss'],
})
export class ParceiroModuloEmBreveComponent implements OnInit {
  private route = inject(ActivatedRoute);

  title = 'Em breve';
  description = '';
  bullets: string[] = [];

  ngOnInit(): void {
    const d = this.route.snapshot.data as Record<string, unknown>;
    this.title = (d['title'] as string) || this.title;
    this.description = (d['description'] as string) || '';
    this.bullets = Array.isArray(d['bullets']) ? (d['bullets'] as string[]) : [];
  }
}
