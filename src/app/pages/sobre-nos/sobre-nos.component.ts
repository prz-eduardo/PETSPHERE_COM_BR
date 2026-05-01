import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MARCA_NOME } from '../../constants/loja-public';

interface Pilar {
  emoji: string;
  title: string;
  lead: string;
  items: string[];
  footer?: string;
  accent: 'yellow' | 'mint' | 'rose';
}

interface Etapa {
  icon: string;
  title: string;
  lead: string;
  items: string[];
}

@Component({
  selector: 'app-sobre-nos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sobre-nos.component.html',
  styleUrls: ['./sobre-nos.component.scss'],
})
export class SobreNosComponent {
  readonly marcaNome = MARCA_NOME;

  scrollToSection(id: string, event: Event): void {
    event.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  readonly ecossistemaImgPath = '/imagens/petsphere-ecossistema.png';

  readonly pilares: Pilar[] = [
    {
      emoji: '🧩',
      title: 'Gestao de estabelecimentos',
      lead: 'Tudo que um petshop ou clinica precisa para operar com menos atrito e mais controle.',
      items: [
        'Agenda de atendimentos e serviços',
        'Cadastro de clientes e pets',
        'Histórico completo de atendimentos',
        'Organização de procedimentos',
        'Gestão operacional do dia a dia',
      ],
      footer: 'Menos bagunca, mais controle para a operação crescer com previsibilidade.',
      accent: 'yellow',
    },
    {
      emoji: '📍',
      title: 'Marketplace e visibilidade',
      lead: 'Seja encontrado por novos clientes na sua regiao com presenca digital integrada a plataforma.',
      items: [
        'Presença no mapa com busca por serviços',
        'Vitrine de produtos e serviços',
        'Divulgação local automatizada',
        'Destaque para aumentar visibilidade',
      ],
      accent: 'mint',
    },
    {
      emoji: '🐾',
      title: 'Perfil inteligente do pet',
      lead: 'Cada pet com um histórico organizado para dar contexto a tutores e profissionais.',
      items: [
        'Informações de saúde',
        'Alergias e restrições',
        'Preferências e comportamento',
        'Histórico de atendimentos',
      ],
      footer: 'Melhor experiência para tutores e profissionais em cada novo atendimento.',
      accent: 'rose',
    },
  ];

  readonly etapas: Etapa[] = [
    {
      icon: 'fa-solid fa-shop',
      title: 'Organize sua operação',
      lead: 'Centralize o que hoje costuma ficar espalhado entre planilhas, WhatsApp e cadernos.',
      items: [
        'Cadastre clientes, pets, serviços e rotinas',
        'Mantenha agenda e histórico acessíveis no mesmo fluxo',
        'Ganhe previsibilidade para a equipe operar melhor',
      ],
    },
    {
      icon: 'fa-solid fa-map-location-dot',
      title: 'Ganhe presença digital',
      lead: 'A PetSphere transforma sua estrutura em vitrine, mapa e ponto de descoberta local.',
      items: [
        'Apareça para clientes buscando serviços na região',
        'Exiba produtos e serviços em um ambiente integrado',
        'Use destaque e presença digital para ampliar alcance',
      ],
    },
    {
      icon: 'fa-solid fa-paw',
      title: 'Atenda com mais contexto',
      lead: 'Cada novo atendimento pode começar com mais informação e menos retrabalho.',
      items: [
        'Consulte dados de saúde, restrições e comportamento do pet',
        'Mantenha um histórico vivo de interações e atendimentos',
        'Entregue uma experiência melhor para tutor e profissional',
      ],
    },
  ];
}
