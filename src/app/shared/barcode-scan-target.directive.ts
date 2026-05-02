import { Directive, ElementRef, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';

/**
 * Marca campo ideal para foco do leitor USB (EAN/GTIN) e busca mista.
 * Scanners emitem teclas como teclado — sem dependência externa.
 */
@Directive({
  standalone: true,
  selector: '[appBarcodeScanTarget]',
})
export class BarcodeScanTargetDirective implements OnInit, OnChanges {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  /** `numeric` favorece teclado numérico em mobile; `search` é melhor para nomes + SKU mistos no POS. */
  @Input() barcodeInputMode: 'search' | 'numeric' = 'search';

  ngOnInit(): void {
    this.applyAttrs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['barcodeInputMode']) {
      this.applyAttrs();
    }
  }

  private applyAttrs(): void {
    const n = this.el.nativeElement;
    n?.setAttribute?.('autocomplete', 'off');
    n?.setAttribute?.('spellcheck', 'false');
    n?.setAttribute?.('inputmode', this.barcodeInputMode);
    n?.setAttribute?.('autocapitalize', 'off');
  }
}
