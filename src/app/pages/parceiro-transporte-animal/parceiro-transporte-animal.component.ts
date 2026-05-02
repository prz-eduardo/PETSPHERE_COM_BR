import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';

interface ValorCard {
  icon: string;
  title: string;
  lead: string;
}

interface ModoCard {
  icon: string;
  title: string;
  text: string;
}

interface ComunicacaoCard {
  icon: string;
  title: string;
  text: string;
}

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-parceiro-transporte-animal',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-transporte-animal.component.html',
  styleUrls: ['../parceiro-landing-shared/parceiro-landing-shared.scss'],
})
export class ParceiroTransporteAnimalComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`Transporte animal · ${this.marca}`);
  }

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly heroTrust: { icon: string; strong: string; text: string }[] = [
    {
      icon: 'fa-solid fa-truck-medical',
      strong: 'Trajeto e horários claros',
      text: `Combine coleta e entrega com janelas que o tutor entende — menos ligações pedindo “já saiu?” no meio do trânsito.`,
    },
    {
      icon: 'fa-solid fa-shield-dog',
      strong: 'Segurança no foco',
      text: `Caixas de transporte, contenção e protocolos alinhados ao que tutores esperam quando confiam o pet a terceiros.`,
    },
    {
      icon: 'fa-solid fa-location-crosshairs',
      strong: 'Visibilidade no mapa',
      text: `Apareça quando alguém busca transporte pet na região — no mesmo ecossistema em que hotéis e clínicas já operam.`,
    },
  ];

  readonly operacao: ValorCard[] = [
    {
      icon: 'fa-solid fa-calendar-day',
      title: 'Agenda de corridas',
      lead:
        'Encaixe múltiplos embarques no dia com regras de tempo e capacidade, reduzindo buracos na operação e overbooking de caixas.',
    },
    {
      icon: 'fa-solid fa-route',
      title: 'Rotas e prioridades',
      lead:
        'Planeje sequência de coletas e entregas com linguagem de rota — o tutor enxerga previsibilidade, você enxerga carga de trabalho.',
    },
    {
      icon: 'fa-solid fa-mobile-screen-button',
      title: 'Status para o tutor',
      lead:
        'Atualizações de “a caminho”, “pet a bordo” e conclusão alinhadas ao app — menos ansiedade e menos mensagens soltas no WhatsApp.',
    },
    {
      icon: 'fa-solid fa-store',
      title: 'Vitrine parceira',
      lead:
        'Transportadoras e motoristas parceiros entram no mapa e no marketplace junto aos demais prestadores da PetSphere.',
    },
  ];

  readonly modos: ModoCard[] = [
    {
      icon: 'fa-solid fa-house-chimney-medical',
      title: 'Ida e volta à clínica',
      text: 'Logística ponta a ponta quando o tutor não pode levar o pet ao veterinário ou ao pet center.',
    },
    {
      icon: 'fa-solid fa-plane-departure',
      title: 'Eventos e deslocamentos',
      text: 'Transfers para hotel, aeroporto ou mudança — comunicação única com quem paga o serviço.',
    },
    {
      icon: 'fa-solid fa-truck-ramp-box',
      title: 'Frota ou terceirizado',
      text: 'Unidades próprias ou rede de motoristas homologados: a narrativa no painel acompanha como você vende.',
    },
  ];

  readonly comunicacao: ComunicacaoCard[] = [
    {
      icon: 'fa-brands fa-whatsapp',
      title: 'WhatsApp automático',
      text: 'Confirmação de janela, lembrete de coleta e aviso de conclusão nos planos pagos — mesmo pacote documentado em Planos & créditos.',
    },
    {
      icon: 'fa-solid fa-satellite-dish',
      title: 'Transparência em tempo real',
      text: 'Combine atualização de status com a visão de mapa quando fizer sentido para o seu modelo — tutores confiam no que veem.',
    },
    {
      icon: 'fa-solid fa-clipboard-check',
      title: 'Checklist de embarque',
      text: 'Documente caixa, guia ou termos recorrentes para a equipe não depender da memória em cada corrida.',
    },
    {
      icon: 'fa-solid fa-map-location-dot',
      title: 'Descoberta local',
      text: 'Quem busca “transporte pet perto de mim” encontra seu cadastro no fluxo já usado por outros serviços.',
    },
  ];

  readonly faq: FaqItem[] = [
    {
      q: 'Preciso ter veículo próprio cadastrado?',
      a: 'Não necessariamente. Você descreve no painel como opera (frota própria, parceiros ou híbrido) para alinhar expectativas do tutor.',
    },
    {
      q: 'O tutor vê o veículo no mapa o tempo todo?',
      a: 'A plataforma evolui com recursos de localização e status; use a página de planos como referência do que já está disponível ao parceiro e o que está em roadmap.',
    },
    {
      q: 'Transporte entra no mesmo plano que hotel ou vet?',
      a: 'Sim — a lógica de créditos, vitrine e automações segue o ecossistema PetSphere. Detalhes de limites ficam sempre na página atualizada de planos.',
    },
    {
      q: 'Atendo só uma cidade. Faz sentido?',
      a: 'Sim. Transporte costuma ser hiperlocal; o mapa e filtros ajudam tutores a achar quem cobre o bairro ou a região.',
    },
  ];
}
