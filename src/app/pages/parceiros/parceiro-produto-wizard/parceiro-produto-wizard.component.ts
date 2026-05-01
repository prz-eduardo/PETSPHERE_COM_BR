import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProdutoComponent } from '../../restrito/admin/produto/produto.component';

@Component({
  selector: 'app-parceiro-produto-wizard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProdutoComponent],
  template: `
    <div class="wrap">
      <nav class="back">
        <a routerLink="/parceiros/petshop-online" class="back-link">&larr; Petshop online</a>
        <a routerLink="/parceiros/inventario-pos" class="back-link muted">Inventário / POS</a>
      </nav>
      <app-produto [embedded]="true" [partnerMode]="true"></app-produto>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 1100px;
        margin: 0 auto;
        padding: 1rem 1.25rem 2rem;
      }
      .back {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1rem;
        font-size: 0.92rem;
      }
      .back-link {
        color: var(--parceiro-link, #0d6efd);
        text-decoration: none;
      }
      .muted {
        color: #64748b;
      }
      .back-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class ParceiroProdutoWizardComponent {}
