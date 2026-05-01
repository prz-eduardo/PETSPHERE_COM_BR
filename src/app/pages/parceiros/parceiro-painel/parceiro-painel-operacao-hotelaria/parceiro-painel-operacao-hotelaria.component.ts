import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  AgendaApiService,
  HotelResumoRow,
} from '../../agenda/services/agenda-api.service';

@Component({
  selector: 'app-parceiro-painel-operacao-hotelaria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './parceiro-painel-operacao-hotelaria.component.html',
  styleUrls: ['./parceiro-painel-operacao-hotelaria.component.scss'],
})
export class ParceiroPainelOperacaoHotelariaComponent implements OnInit {
  loading = true;
  error: string | null = null;
  resumo: HotelResumoRow | null = null;

  constructor(
    private agendaApi: AgendaApiService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.resumo = await this.agendaApi.getHotelResumo();
    } catch {
      this.error = 'Não foi possível carregar o resumo de hospedagem. Tente de novo mais tarde.';
      this.resumo = null;
    } finally {
      this.loading = false;
    }
  }

  abrirReservas(): void {
    void this.router.navigate(['/parceiros/hospedagem']);
  }
}
