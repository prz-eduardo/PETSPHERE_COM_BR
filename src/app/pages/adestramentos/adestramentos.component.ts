import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';

interface DorCard {
  icon: string;
  title: string;
  text: string;
}

interface ServicoCard {
  icon: string;
  title: string;
  lead: string;
}

interface JornadaStep {
  n: string;
  title: string;
  text: string;
}

interface ProBenefit {
  icon: string;
  title: string;
  text: string;
}

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-adestramentos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './adestramentos.component.html',
  styleUrls: ['./adestramentos.component.scss'],
})
export class AdestramentosComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(private title: Title) {}

  ngOnInit(): void {
    this.title.setTitle(`Adestramento e comportamento · ${this.marca}`);
  }

  scrollTo(id: string, ev: Event): void {
    ev.preventDefault();
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  readonly dores: DorCard[] = [
    {
      icon: 'fa-solid fa-person-walking',
      title: 'Puxão na guia',
      text: 'Caminhar vira um treino de força em vez de um momento de lazer. O adestramento ajuda a construir concentração e calma na rua.',
    },
    {
      icon: 'fa-solid fa-volume-high',
      title: 'Latidos e excitação',
      text: 'Campainha, outros cães ou visitas podem disparar reações intensas. Com orientação, dá para ensinar limites sem medo de punição.',
    },
    {
      icon: 'fa-solid fa-shield-heart',
      title: 'Medo e reatividade',
      text: 'Animais tímidos ou que reagem por insegurança precisam de plano gradual. Um profissional adequa o ritmo ao seu pet.',
    },
  ];

  readonly servicos: ServicoCard[] = [
    {
      icon: 'fa-solid fa-user',
      title: 'Aula individual',
      lead: 'Atendimento um a um, foco total no seu objetivo e no ritmo do animal.',
    },
    {
      icon: 'fa-solid fa-users',
      title: 'Turma ou grupo',
      lead: 'Socialização supervisionada e exercícios em conjunto com outros tutores.',
    },
    {
      icon: 'fa-solid fa-paw',
      title: 'Filhotes',
      lead: 'Primeiras habilidades, rotina e hábitos saudáveis desde cedo.',
    },
    {
      icon: 'fa-solid fa-brain',
      title: 'Consultoria comportamental',
      lead: 'Casos mais específicos: medos, compulsões ou mudanças de ambiente.',
    },
  ];

  readonly jornada: JornadaStep[] = [
    {
      n: '1',
      title: 'Encontre no mapa',
      text: 'Veja adestradores e escolas na sua região, com contexto de serviços Petsphere.',
    },
    {
      n: '2',
      title: 'Conheça o perfil',
      text: 'Especialidades, experiência e como trabalham — antes de combinar a primeira conversa.',
    },
    {
      n: '3',
      title: 'Converse e agende',
      text: 'Contato direto com o profissional. Agendamento integrado à plataforma está em evolução neste mockup.',
    },
  ];

  readonly proBenefits: ProBenefit[] = [
    {
      icon: 'fa-solid fa-store',
      title: 'Vitrine e mapa',
      text: 'Seja encontrado por tutores que buscam adestramento perto de casa.',
    },
    {
      icon: 'fa-solid fa-calendar-check',
      title: 'Agenda e rotina',
      text: 'Menos troca de mensagens soltas: organize atendimentos no mesmo fluxo do negócio.',
    },
    {
      icon: 'fa-solid fa-notes-medical',
      title: 'Contexto do pet',
      text: 'Quando o tutor usa a plataforma, você ganha histórico útil sem recomeçar do zero.',
    },
    {
      icon: 'fa-solid fa-bolt',
      title: 'Automações',
      text: 'Lembretes e comunicação alinhados ao que já funciona para outros prestadores Petsphere.',
    },
  ];

  readonly faq: FaqItem[] = [
    {
      q: 'Qual idade mínima para começar?',
      a: 'Filhotes costumam iniciar socialização e hábitos básicos após a vacinação orientada pelo veterinário. Cada caso é único — o profissional indica o melhor momento.',
    },
    {
      q: 'Quanto tempo dura uma sessão típica?',
      a: 'Aulas individuais costumam ficar entre 45 minutos e 1 hora. Turmas podem ter duração própria. Combine sempre com o adestrador.',
    },
    {
      q: 'O que levar na primeira aula?',
      a: 'Guia, petiscos de alto valor, água, carteira de vacinação se pedirem, e brinquedo favorito em alguns casos. O profissional pode enviar uma lista antes.',
    },
    {
      q: 'Reforço positivo é obrigatório?',
      a: 'A maioria dos profissionais modernos prioriza métodos baseados em recompensa e bem-estar. Na dúvida, pergunte na primeira conversa.',
    },
    {
      q: 'Como escolher um adestrador?',
      a: 'Busque alinhamento de método, experiência com o tema que você precisa (filhote, medo, esporte) e transparência sobre expectativas. O mapa ajuda a filtrar por região.',
    },
  ];
}
