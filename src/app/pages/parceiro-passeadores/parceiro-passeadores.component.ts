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
  selector: 'app-parceiro-passeadores',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-passeadores.component.html',
  styleUrls: ['../parceiro-landing-shared/parceiro-landing-shared.scss'],
})
export class ParceiroPasseadoresComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`Passeadores e dog walkers · ${this.marca}`);
  }

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly heroTrust: { icon: string; strong: string; text: string }[] = [
    {
      icon: 'fa-solid fa-route',
      strong: 'Rotas definidas por passeio',
      text: `Planeje trechos, paradas seguras e duração — sua equipe executa o mesmo roteiro que o tutor viu na contratação.`,
    },
    {
      icon: 'fa-solid fa-location-dot',
      strong: 'Tracking em tempo real',
      text: `Tutores acompanham onde está o pet durante o passeio, com atualização contínua no mapa — menos ansiedade, menos “já voltou?”.`,
    },
    {
      icon: 'fa-solid fa-users-line',
      strong: 'Equipe e agenda alinhadas',
      text: `Distribua pets entre passeadores sem perder de vista capacidade diária e conflitos de horário.`,
    },
  ];

  readonly operacao: ValorCard[] = [
    {
      icon: 'fa-solid fa-draw-polygon',
      title: 'Rotas e waypoints',
      lead:
        'Monte percursos padrão (parque, quarteirão calmo, hidratação) e reutilize entre clientes — consistência para o pet e previsibilidade para o tutor.',
    },
    {
      icon: 'fa-solid fa-satellite-dish',
      title: 'Live location para tutores',
      lead:
        'Posição aproximada em tempo real durante o passeio ativo, com estados claros: iniciado, em rota, pausa, concluído.',
    },
    {
      icon: 'fa-solid fa-bell',
      title: 'Alertas e lembretes',
      lead:
        'Combine notificações de início/fim de passeio com automações nos planos pagos — o mesmo pacote WhatsApp e IA descrito em Planos & créditos.',
    },
    {
      icon: 'fa-solid fa-store',
      title: 'Vitrine parceira',
      lead:
        'Dog walkers e passeadores aparecem no mapa e no marketplace junto a hotéis, vets e adestradores.',
    },
  ];

  readonly modos: ModoCard[] = [
    {
      icon: 'fa-solid fa-person-walking',
      title: 'Passeios individuais',
      text: 'Um profissional, um ou poucos pets — rota e tempo sob medida para quem paga premium.',
    },
    {
      icon: 'fa-solid fa-people-group',
      title: 'Grupo social',
      text: 'Roteiros pensados para socialização supervisionada, com limites claros de vagas por horário.',
    },
    {
      icon: 'fa-solid fa-sun',
      title: 'Pacotes recorrentes',
      text: 'Semanal ou mensal com slots fixos — agenda inteligente ajuda a não duplicar o mesmo passeador no mesmo intervalo.',
    },
  ];

  readonly comunicacao: ComunicacaoCard[] = [
    {
      icon: 'fa-brands fa-whatsapp',
      title: 'WhatsApp automático',
      text: 'Lembrete de horário, aviso de saída e resumo ao final — menos trabalho manual para a central.',
    },
    {
      icon: 'fa-solid fa-map-location-dot',
      title: 'Mapa compartilhado',
      text: 'O tutor abre o app e vê o trajeto e a posição atual — transparência como diferencial de confiança.',
    },
    {
      icon: 'fa-solid fa-camera-retro',
      title: 'Check-in visual (quando disponível)',
      text: 'Complemente tracking com registro de momentos do passeio conforme sua operação e plano.',
    },
    {
      icon: 'fa-solid fa-robot',
      title: 'IA na recepção digital',
      text: 'Dúvidas sobre política de chuva, equipamento ou raça respondidas 24h enquanto a equipe está na rua.',
    },
  ];

  readonly faq: FaqItem[] = [
    {
      q: 'O tracking substitui GPS dedicado de terceiros?',
      a: 'A PetSphere integra visão de rota e localização ao fluxo do passeio no app. Para requisitos regulatórios específicos, combine com as políticas da sua operação e jurisdição.',
    },
    {
      q: 'Consigo definir rota fixa por cliente?',
      a: 'Sim — rotas modelo e ajustes por contrato ajudam a padronizar o que o tutor espera ver no mapa.',
    },
    {
      q: 'Há demonstração para tutores?',
      a: 'Há uma página pública com exemplo de rota no mapa (conteúdo ilustrativo). O botão “Ver demo no mapa” nesta página leva até lá.',
    },
    {
      q: 'Passeio entra no mesmo plano que hotel?',
      a: 'Sim. Créditos, vitrine e automações seguem o ecossistema; compare limites na página de planos.',
    },
  ];
}
