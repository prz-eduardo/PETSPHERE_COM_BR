import { Directive, ElementRef, inject, OnInit } from '@angular/core';

/**
 * Marca campo ideal para foco do leitor USB (EAN/GTIN).
 * Ajustes de UX; scanners emitem teclas como teclado — sem dependência externa.
 */
@Directive({
  standalone: true,
  selector: '[appBarcodeScanTarget]',
})
export class BarcodeScanTargetDirective implements OnInit {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  ngOnInit(): void {
    const n = this.el.nativeElement;
    n?.setAttribute?.('autocomplete', 'off');
    n?.setAttribute?.('spellcheck', 'false');
    n?.setAttribute?.('inputmode', 'numeric');
  }
}
