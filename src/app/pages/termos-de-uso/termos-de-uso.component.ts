import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-termos-de-uso',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './termos-de-uso.component.html',
  styleUrls: ['./termos-de-uso.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermosDeUsoComponent {}
