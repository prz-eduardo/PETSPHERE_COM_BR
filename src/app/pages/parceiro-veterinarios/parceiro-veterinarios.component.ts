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

interface ClinicaCard {
  icon: string;
  title: string;
  text: string;
}

interface AutomacaoCard {
  icon: string;
  title: string;
  text: string;
}

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-parceiro-veterinarios',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-veterinarios.component.html',
  styleUrls: ['../parceiro-landing-shared/parceiro-landing-shared.scss'],
})
export class ParceiroVeterinariosComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`Veterinários e clínicas · ${this.marca}`);
  }

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly heroTrust: { icon: string; strong: string; text: string }[] = [
    {
      icon: 'fa-solid fa-stethoscope',
      strong: 'Visibilidade para tutores',
      text: `Sua clínica pode ser encontrada no mapa e na vitrine da ${MARCA_NOME}, no mesmo ecossistema em que tutores já navegam.`,
    },
    {
      icon: 'fa-solid fa-file-prescription',
      strong: 'Fluxo clínico digital',
      text: 'Área do veterinário com receitas, histórico e pacientes ligados ao contexto do pet na plataforma.',
    },
    {
      icon: 'fa-solid fa-paw',
      strong: 'Continuidade de cuidados',
      text: 'Quando o tutor usa a plataforma, você reduz retrabalho e ganha consistência entre consulta e histórico.',
    },
  ];

  readonly valores: ValorCard[] = [
    {
      icon: 'fa-solid fa-map-location-dot',
      title: 'Descoberta e confiança',
      lead:
        'Perfil no mapa e presença na vitrine de parceiros: tutores buscam serviços por região e chegam até a sua clínica com mais contexto.',
    },
    {
      icon: 'fa-solid fa-comments',
      title: 'Relacionamento com tutores',
      lead:
        'Planos com automações por WhatsApp e e-mail ajudam em lembretes, confirmações e follow-up — com menos esforço manual da recepção.',
    },
    {
      icon: 'fa-solid fa-shop',
      title: 'Ecossistema da marca',
      lead:
        'A loja e o catálogo (incluindo linhas manipulado e pronto, quando aplicável) convivem com a jornada do tutor na mesma marca.',
    },
    {
      icon: 'fa-solid fa-shield-dog',
      title: 'Credenciais e papel do vet',
      lead:
        'A área veterinária existe para apoiar fluxos de receitas e pacientes dentro das regras da plataforma — o profissional continua sendo a referência clínica.',
    },
  ];

  readonly clinica: ClinicaCard[] = [
    {
      icon: 'fa-solid fa-user-doctor',
      title: 'Pacientes e pets',
      text: 'Liste e acompanhe pacientes com o vínculo ao pet e ao tutor quando eles estão na PetSphere.',
    },
    {
      icon: 'fa-solid fa-file-waveform',
      title: 'Receitas e histórico',
      text: 'Gere e consulte receitas e histórico no fluxo reservado ao veterinário — integrado à operação da plataforma.',
    },
    {
      icon: 'fa-solid fa-microscope',
      title: 'Alinhamento com o negócio',
      text: 'A mesma infraestrutura de parceiros (agenda, automações, marketplace) escala da clínica pequena ao grupo com mais demanda.',
    },
  ];

  readonly automacoes: AutomacaoCard[] = [
    {
      icon: 'fa-brands fa-whatsapp',
      title: 'WhatsApp automático',
      text: 'Lembretes e confirmações no canal que o tutor mais responde — reduz faltas e libera a equipe.',
    },
    {
      icon: 'fa-solid fa-robot',
      title: 'IA para atendimento',
      text: 'Respostas fora do horário e triagem de dúvidas comuns, mantendo o foco da equipe nos casos clínicos.',
    },
    {
      icon: 'fa-solid fa-calendar-check',
      title: 'Agenda inteligente',
      text: 'Consultas e encaixes com regras claras; combina com a operação da clínica sem depender só de planilhas.',
    },
    {
      icon: 'fa-solid fa-chart-line',
      title: 'Créditos sob demanda',
      text: 'Funcionalidades que consomem créditos acompanham o crescimento — veja pacotes e valores em Planos & créditos.',
    },
  ];

  readonly faq: FaqItem[] = [
    {
      q: 'A PetSphere substitui meu prontuário oficial?',
      a: 'Não. A plataforma oferece fluxos de receitas, pacientes e integração com a jornada do tutor. Critérios legais de prontuário e arquivo continuam sendo de responsabilidade da clínica e da legislação aplicável.',
    },
    {
      q: 'Como entramos na vitrine e no mapa?',
      a: 'Pelo fluxo de cadastro de parceiro e planos. O plano Free já inclui vitrine e mapa básico; planos pagos adicionam automações e mais destaque, conforme a página de planos.',
    },
    {
      q: 'E se eu só quiser indicar produtos aos tutores?',
      a: 'O ecossistema inclui loja com produtos manipulado e pronto. A combinação com a área do veterinário depende da operação configurada pela marca.',
    },
    {
      q: 'O que têm a ver passeadores com a minha clínica?',
      a: 'São outro tipo de prestador na mesma rede que tutores usam para buscar serviços. Isso reforça a ideia de “um só lugar” para o cuidado do pet — e pode direcionar tutores que ainda não conhecem sua clínica.',
    },
  ];
}
