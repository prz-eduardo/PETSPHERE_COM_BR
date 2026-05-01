import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';

interface ValorHotelCard {
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
  selector: 'app-parceiro-hotel-creche',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-hotel-creche.component.html',
  styleUrls: ['../parceiro-landing-shared/parceiro-landing-shared.scss'],
})
export class ParceiroHotelCrecheComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`Hotel, creche e day use · ${this.marca}`);
  }

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly heroTrust: { icon: string; strong: string; text: string }[] = [
    {
      icon: 'fa-solid fa-bed',
      strong: 'Ocupação sob controle',
      text: `Reserve baias e acompanhe diárias e períodos na mesma lógica de hospedagem e creche do painel parceiro.`,
    },
    {
      icon: 'fa-solid fa-sun',
      strong: 'Hotel, creche ou os dois',
      text: `Oferta flexível para pernoite, day use ou operação mista — alinhado a como você vende na ${MARCA_NOME}.`,
    },
    {
      icon: 'fa-solid fa-bell',
      strong: 'Menos fantasma na agenda',
      text: `Lembretes e automações nos planos pagos ajudam a confirmar entrada e retirada sem esticar sua equipe no WhatsApp.`,
    },
  ];

  readonly operacao: ValorHotelCard[] = [
    {
      icon: 'fa-solid fa-calendar-days',
      title: 'Reservas e períodos',
      lead:
        'Cadastre serviços e regras de ocupação pensando em estadias, diárias e encaixes — menos planilhas paralelas e menos overbooking inadvertido.',
    },
    {
      icon: 'fa-solid fa-vector-square',
      title: 'Baias e acomodações',
      lead:
        'Organize sua capacidade física junto aos agendamentos, para saber onde cada pet dorme ou usa o espaço na creche.',
    },
    {
      icon: 'fa-solid fa-dog',
      title: 'Segmentação hotel / daycare',
      lead:
        'Quando faz sentido para o seu negócio, separe ofertas de pernoite, creche diurna ou pacotes combinados.',
    },
    {
      icon: 'fa-solid fa-store',
      title: 'Vitrine parceira',
      lead:
        'Tutores encontram hospedagem e creche no mapa e no marketplace junto aos outros prestadores PetSphere.',
    },
  ];

  readonly modos: ModoCard[] = [
    {
      icon: 'fa-solid fa-moon',
      title: 'Hotel / pernoite',
      text: 'Estadias com check-in e check-out claros para o tutor; operação pensada para lotação por vaga.',
    },
    {
      icon: 'fa-solid fa-cloud-sun',
      title: 'Creche e day use',
      text: 'Períodos diurnos, socialização supervisada ou day use quando for o foco da unidade.',
    },
    {
      icon: 'fa-solid fa-layer-group',
      title: 'Operação mista',
      text: 'Unidades que combinam hotel e creche mantêm comunicação única com o tutor e Agenda alinhada.',
    },
  ];

  readonly comunicacao: ComunicacaoCard[] = [
    {
      icon: 'fa-brands fa-whatsapp',
      title: 'WhatsApp automático',
      text: 'Confirmações e lembretes no canal preferido dos tutores; reduza faltas e imprevistos de última hora.',
    },
    {
      icon: 'fa-solid fa-robot',
      title: 'IA para dúvidas frequentes',
      text: 'Políticas, horários e tipos de serviço respondidos 24h enquanto sua equipe cuida dos pets.',
    },
    {
      icon: 'fa-solid fa-calendar-check',
      title: 'Agenda inteligente',
      text: 'Bloqueios, encaixes e regras para equipe multiplicam ocupação sem confusão no balcão.',
    },
    {
      icon: 'fa-solid fa-map-location-dot',
      title: 'Destaque local',
      text: 'Apareça na busca por região — essencial quando o tutor viaja ou troca de bairro.',
    },
  ];

  readonly faq: FaqItem[] = [
    {
      q: 'Preciso de dois cadastros para hotel e para loja física?',
      a: 'O fluxo de parceiro da PetSphere cobre diferentes tipos de operação no mesmo ecossistema. Detalhes de configuração ficam no painel após o cadastro.',
    },
    {
      q: 'O que muda entre plano Free e Pro para hotel?',
      a: 'O Free já oferece agenda com confirmação manual, vitrine e mapa básico. Planos pagos liberam WhatsApp automático, IA, e-mail segmentado e agenda inteligente — veja sempre a página de planos atualizada.',
    },
    {
      q: 'Consigo só day use sem pernoite?',
      a: 'Sim. Você comunica sua oferta (creche/diurna, day use, hotel ou combinações) conforme configurar os serviços e a operação.',
    },
    {
      q: 'Tutores reservam sozinhos?',
      a: 'A plataforma evolui com automações e agendamentos integrados aos planos da PetSphere; use a página de planos como referência do que já está disponível ao parceiro.',
    },
  ];
}
