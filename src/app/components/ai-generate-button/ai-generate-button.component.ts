import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-ai-generate-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-generate-button.component.html',
  styleUrls: ['./ai-generate-button.component.scss'],
})
export class AiGenerateButtonComponent {
  @Input() label = 'Gerar com IA';
  @Input() loadingLabel = 'Gerando…';
  @Input() loading = false;
  @Input() disabled = false;
  @Output() pressed = new EventEmitter<void>();

  get isBlocked(): boolean {
    return this.loading || this.disabled;
  }

  onClick(): void {
    if (this.isBlocked) return;
    this.pressed.emit();
  }
}
