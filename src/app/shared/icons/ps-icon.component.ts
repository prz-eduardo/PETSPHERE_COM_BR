import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Petsphere Icon Family
 *
 * Stroke 1.5px, geometria custom inspirada em Phosphor duotone.
 * Estados:
 *   - outline (inativo): contorno; opacity controlada por CSS no chamador.
 *   - filled  (ativo): preenchimento + glow Lime via filter no host.
 *
 * Uso:
 *   <ps-icon name="home" variant="filled" size="24"></ps-icon>
 *
 * Adicione ícones criando uma chave em ICON_PATHS abaixo. Cada ícone tem
 * `outline` e `filled` para suporte a morph entre estados.
 */
export type PsIconName =
  | 'home'
  | 'map'
  | 'shop'
  | 'person'
  | 'sphere'
  | 'paw'
  | 'stethoscope'
  | 'video'
  | 'calendar'
  | 'cart'
  | 'bed'
  | 'sparkle'
  | 'bell'
  | 'login'
  | 'logout';

export type PsIconVariant = 'outline' | 'filled';

@Component({
  selector: 'ps-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      [attr.aria-hidden]="ariaHidden ? 'true' : null"
      [attr.role]="ariaHidden ? null : 'img'"
      [attr.aria-label]="!ariaHidden ? name : null"
      class="ps-icon-svg"
      [class.ps-icon--filled]="variant === 'filled'"
      [class.ps-icon--outline]="variant === 'outline'"
    >
      <ng-container [ngSwitch]="name">
        <!-- HOME — esfera com horizonte (feed/Início) -->
        <g *ngSwitchCase="'home'">
          <path
            *ngIf="variant === 'outline'"
            d="M3.6 11.2 12 4l8.4 7.2v7.6a1.6 1.6 0 0 1-1.6 1.6h-3.4v-5.5a1.6 1.6 0 0 0-1.6-1.6h-3.6a1.6 1.6 0 0 0-1.6 1.6v5.5H5.2a1.6 1.6 0 0 1-1.6-1.6v-7.6Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <path
            *ngIf="variant === 'filled'"
            d="M3.6 11.2 12 4l8.4 7.2v7.6a1.6 1.6 0 0 1-1.6 1.6h-3.4v-5.5a1.6 1.6 0 0 0-1.6-1.6h-3.6a1.6 1.6 0 0 0-1.6 1.6v5.5H5.2a1.6 1.6 0 0 1-1.6-1.6v-7.6Z"
            fill="currentColor"
          />
        </g>

        <!-- MAP — pin geo com anel -->
        <g *ngSwitchCase="'map'">
          <path
            *ngIf="variant === 'outline'"
            d="M12 21s-6.5-5.4-6.5-10.3a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <circle *ngIf="variant === 'outline'" cx="12" cy="10.6" r="2.4" stroke="currentColor" stroke-width="1.5"/>
          <path
            *ngIf="variant === 'filled'"
            d="M12 21s-6.5-5.4-6.5-10.3a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Z"
            fill="currentColor"
          />
          <circle *ngIf="variant === 'filled'" cx="12" cy="10.6" r="2.2" fill="#0F0B2E"/>
        </g>

        <!-- SHOP — sacola com alça -->
        <g *ngSwitchCase="'shop'">
          <path
            *ngIf="variant === 'outline'"
            d="M5.2 9h13.6l-1 9.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5.2 9Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <path *ngIf="variant === 'outline'" d="M9 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path
            *ngIf="variant === 'filled'"
            d="M5.2 9h13.6l-1 9.4a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5.2 9Z"
            fill="currentColor"
          />
          <path *ngIf="variant === 'filled'" d="M9 9V7a3 3 0 0 1 6 0v2" stroke="#0F0B2E" stroke-width="1.5" stroke-linecap="round"/>
        </g>

        <!-- PERSON — Minha Esfera (perfil + halo) -->
        <g *ngSwitchCase="'person'">
          <circle *ngIf="variant === 'outline'" cx="12" cy="8.4" r="3.4" stroke="currentColor" stroke-width="1.5"/>
          <path
            *ngIf="variant === 'outline'"
            d="M4.5 19.6a7.5 7.5 0 0 1 15 0"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <circle *ngIf="variant === 'filled'" cx="12" cy="8.4" r="3.4" fill="currentColor"/>
          <path
            *ngIf="variant === 'filled'"
            d="M4.5 19.6a7.5 7.5 0 0 1 15 0v.4H4.5v-.4Z"
            fill="currentColor"
          />
        </g>

        <!-- SPHERE — núcleo de marca (FAB) -->
        <g *ngSwitchCase="'sphere'">
          <circle cx="12" cy="12" r="4.5" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.4" stroke="currentColor" stroke-width="1.5" transform="rotate(-22 12 12)"/>
          <ellipse cx="12" cy="12" rx="9" ry="3.4" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.55" transform="rotate(28 12 12)"/>
        </g>

        <!-- PAW — pata (pet ativo / Meus Pets) -->
        <g *ngSwitchCase="'paw'">
          <ellipse cx="6.4" cy="9.6" rx="1.7" ry="2.2" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <ellipse cx="9.8" cy="6.6" rx="1.6" ry="2.2" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <ellipse cx="14.2" cy="6.6" rx="1.6" ry="2.2" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <ellipse cx="17.6" cy="9.6" rx="1.7" ry="2.2" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <path
            d="M8.2 14.4c0-2.4 1.7-4 3.8-4s3.8 1.6 3.8 4c0 1.7-1.4 2.5-2.6 3.4-.6.5-1.2 1-1.2 1.6s-2.4-.5-2.4-1.8c0-.7-.7-1.5-1.4-2.3a3 3 0 0 1 0-1Z"
            [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </g>

        <!-- STETHOSCOPE — buscar vet -->
        <g *ngSwitchCase="'stethoscope'">
          <path
            d="M5.5 4.5v5a3.5 3.5 0 0 0 7 0v-5"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"
          />
          <path d="M9 13v2.5a4 4 0 0 0 4 4 4 4 0 0 0 4-4V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
          <circle cx="17" cy="11.5" r="1.8" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
        </g>

        <!-- VIDEO — telemedicina -->
        <g *ngSwitchCase="'video'">
          <rect x="3" y="6.5" width="13" height="11" rx="2.2" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 10.4 21 8v8l-5-2.4Z" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </g>

        <!-- CALENDAR — agendar -->
        <g *ngSwitchCase="'calendar'">
          <rect x="3.5" y="5.5" width="17" height="14" rx="2.2" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <path d="M3.5 10.2h17" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 3.5v3.4M16 3.5v3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </g>

        <!-- CART — carrinho -->
        <g *ngSwitchCase="'cart'">
          <path d="M3 5h2.4l2.6 11h10l1.6-7H7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <circle cx="9" cy="19.5" r="1.4" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="17" cy="19.5" r="1.4" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
        </g>

        <!-- BED — hospedagem -->
        <g *ngSwitchCase="'bed'">
          <path d="M3 8v10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M21 13v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M3 13h18v0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M3 13v-1.5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v1.5" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="8" cy="11" r="1.4" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
        </g>

        <!-- SPARKLE — destaque/promo -->
        <g *ngSwitchCase="'sparkle'">
          <path
            d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M5.6 18.4l2.5-2.5M15.9 8.1l2.5-2.5"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          />
          <circle cx="12" cy="12" r="3" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5"/>
        </g>

        <!-- BELL — alertas -->
        <g *ngSwitchCase="'bell'">
          <path d="M5.5 17h13l-1.4-1.4a2 2 0 0 1-.6-1.4V11a4.5 4.5 0 1 0-9 0v3.2c0 .5-.2 1-.6 1.4L5.5 17Z" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M10 19.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </g>

        <!-- LOGIN — entrar (guest) -->
        <g *ngSwitchCase="'login'">
          <path d="M11 4.5h6.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M14 12H4.5m0 0 3.2-3.2M4.5 12l3.2 3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'"/>
        </g>

        <!-- LOGOUT — sair -->
        <g *ngSwitchCase="'logout'">
          <path d="M13 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M10 12h9.5m0 0-3.2-3.2M19.5 12l-3.2 3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" [attr.fill]="variant === 'filled' ? 'currentColor' : 'none'"/>
        </g>
      </ng-container>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      color: currentColor;
      transition: filter 220ms var(--ps-ease-tap, cubic-bezier(.2,.8,.2,1)),
                  transform 220ms var(--ps-ease-tap, cubic-bezier(.2,.8,.2,1));
    }
    .ps-icon-svg { display: block; }
    .ps-icon-svg path,
    .ps-icon-svg circle,
    .ps-icon-svg ellipse,
    .ps-icon-svg rect {
      transition: fill 220ms var(--ps-ease-tap, cubic-bezier(.2,.8,.2,1)),
                  stroke 220ms var(--ps-ease-tap, cubic-bezier(.2,.8,.2,1));
    }
    @media (prefers-reduced-motion: reduce) {
      :host, .ps-icon-svg path, .ps-icon-svg circle, .ps-icon-svg ellipse, .ps-icon-svg rect {
        transition: none !important;
      }
    }
  `]
})
export class PsIconComponent {
  @Input() name: PsIconName = 'home';
  @Input() variant: PsIconVariant = 'outline';
  @Input() size: number | string = 24;
  @Input() ariaHidden = true;
}
