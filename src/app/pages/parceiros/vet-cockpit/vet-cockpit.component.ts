import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AgendaApiService } from '../agenda/services/agenda-api.service';
import { AtendimentoPanoramaStorageService } from '../../restrito/area-vet/panorama-atendimento/atendimento-panorama-storage.service';
import { VetWizardSessionService, WizardSession } from '../../../services/vet-wizard-session.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import type { PanoramaAtendimento } from '../../restrito/area-vet/panorama-atendimento/atendimento-panorama.types';
import type { Agendamento } from '../../../types/agenda.types';

@Component({
  selector: 'app-vet-cockpit',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vet-cockpit.component.html',
  styleUrls: ['./vet-cockpit.component.scss'],
})
export class VetCockpitComponent implements OnInit, OnDestroy {
  atendimentosAtivos = signal<PanoramaAtendimento[]>([]);
  agendaHoje = signal<Agendamento[]>([]);
  wizardSession = signal<WizardSession | null>(null);
  carregandoAgenda = signal(false);
  erroAgenda = signal<string | null>(null);

  private sub = new Subscription();

  private readonly parceiroNs: string;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private panoramaStorage: AtendimentoPanoramaStorageService,
    private agendaApi: AgendaApiService,
    private wizardSvc: VetWizardSessionService,
    private parceiroAuth: ParceiroAuthService,
    private router: Router,
  ) {
    const colab = this.parceiroAuth.getCurrentColaborador();
    this.parceiroNs = colab?.estabelecimento_id ? `est_${colab.estabelecimento_id}` : 'default';
  }

  ngOnInit(): void {
    this._carregarAtendimentosAtivos();
    this._carregarAgendaHoje();
    this.sub.add(
      this.wizardSvc.session$.subscribe(s => this.wizardSession.set(s)),
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  iniciarNovoAtendimento(): void {
    this.router.navigate(['/parceiros/atendimento-wizard']);
  }

  retomarSessao(): void {
    this.router.navigate(['/parceiros/atendimento-wizard']);
  }

  encerrarSessao(): void {
    this.wizardSvc.encerrar();
  }

  stepLabel(step: string): string {
    const map: Record<string, string> = {
      'identificacao': 'Identificação',
      'clinica': 'Clínica',
      'finalizacao-clinica': 'Finalização clínica',
      'decisao': 'Decisão',
      'operacao': 'Operação',
      'ia': 'IA',
      'concluido': 'Concluído',
    };
    return map[step] ?? step;
  }

  private _carregarAtendimentosAtivos(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const todos = this.panoramaStorage.listar(this.parceiroNs);
    const ativos = todos.filter(
      (a) => a.status !== 'concluido' && a.status !== 'cancelado',
    );
    this.atendimentosAtivos.set(ativos);
  }

  private async _carregarAgendaHoje(): Promise<void> {
    this.carregandoAgenda.set(true);
    this.erroAgenda.set(null);
    try {
      const hoje = new Date();
      const dataStr = hoje.toISOString().split('T')[0];
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      const amanhaStr = amanha.toISOString().split('T')[0];

      const agendamentos = await this.agendaApi.getAgendamentos({
        data_inicio: dataStr,
        data_fim: amanhaStr,
      });

      const ordenados = [...agendamentos]
        .sort((a, b) => {
          const ia = a.data_hora_inicio ?? String(a.inicio ?? '');
          const ib = b.data_hora_inicio ?? String(b.inicio ?? '');
          return ia.localeCompare(ib);
        })
        .slice(0, 5);

      this.agendaHoje.set(ordenados);
    } catch {
      this.erroAgenda.set('Não foi possível carregar a agenda.');
    } finally {
      this.carregandoAgenda.set(false);
    }
  }
}
