import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface PublicPlano {
  id: number;
  nome: string;
  slug: string;
  descricao?: string | null;
  preco_mensal: number;
  creditos_mensais_inclusos: number;
  permite_automacoes: boolean;
}

interface PublicPacote {
  id: number;
  nome: string;
  slug: string;
  preco_reais: number;
  creditos_incluidos: number;
  bonus_creditos: number;
  descricao?: string | null;
  destaque: boolean;
}

interface TierCard {
  key: 'free' | 'pro' | 'enterprise';
  badge?: string;
  nome: string;
  tagline: string;
  precoLabel: string;
  precoSub?: string;
  benefits: string[];
  cta: { label: string; route: string; queryParams?: Record<string, string> | null };
  highlighted?: boolean;
}

interface BeneficioAutomacao {
  icon: string;
  titulo: string;
  descricao: string;
  metrica: string;
}

interface Passo {
  numero: string;
  titulo: string;
  descricao: string;
}

interface RotinaItem {
  icon: string;
  label: string;
}

@Component({
  selector: 'app-parceiro-planos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-planos.component.html',
  styleUrls: ['./parceiro-planos.component.scss'],
})
export class ParceiroPlanosComponent implements OnInit {
  private http = inject(HttpClient);
  private base = (environment as any).apiBaseUrl.replace(/\/$/, '');

  loading = signal(true);
  errorMsg = signal<string | null>(null);
  planos = signal<PublicPlano[]>([]);
  pacotes = signal<PublicPacote[]>([]);

  /**
   * Curadoria visual: o backend pode ter N planos, mas a página de venda
   * mostra SEMPRE 3 trilhas claras (Free / Pro / Enterprise) e mapeia o
   * plano real correspondente para preço e CTA.
   */
  tiers = computed<TierCard[]>(() => {
    const sorted = [...this.planos()].sort((a, b) => (a.preco_mensal || 0) - (b.preco_mensal || 0));
    const free = sorted.find(p => p.preco_mensal === 0) ?? null;
    const pagos = sorted.filter(p => p.preco_mensal > 0);
    const pro = pagos.find(p => p.permite_automacoes) ?? pagos[0] ?? null;
    const enterprise = pagos.length > 1 ? pagos[pagos.length - 1] : null;
    const enterpriseDistinct = enterprise && pro && enterprise.id !== pro.id ? enterprise : null;

    return [
      {
        key: 'free',
        nome: 'Free',
        tagline: 'Tire seu negócio do papel sem cartão de crédito.',
        precoLabel: 'Grátis',
        precoSub: 'para sempre',
        benefits: [
          'Agenda online com confirmação manual',
          'Vitrine pública no marketplace PetSphere',
          'Cadastro ilimitado de tutores e pets',
          'Mapa básico — apareça pra quem busca perto',
        ],
        cta: {
          label: 'Começar grátis',
          route: '/parceiro/cadastrar',
          queryParams: free ? { plano: free.slug } : null,
        },
      },
      {
        key: 'pro',
        badge: 'Mais escolhido',
        highlighted: true,
        nome: 'Pro',
        tagline: 'Tudo do Free + automações que devolvem dinheiro todo mês.',
        precoLabel: pro ? this.formatBRL(pro.preco_mensal) : 'Em breve',
        precoSub: pro ? '/mês — automações inclusas' : 'cadastre-se para liberar',
        benefits: [
          'WhatsApp automático: lembretes, confirmações e follow-up',
          'IA atendendo clientes 24/7 e descrevendo serviços',
          'E-mail segmentado para campanhas e fidelização',
          'Agenda inteligente com bloqueio anti no-show',
          'Destaque no mapa e no marketplace',
        ],
        cta: {
          label: 'Escalar meu negócio',
          route: '/parceiro/cadastrar',
          queryParams: pro ? { plano: pro.slug } : null,
        },
      },
      {
        key: 'enterprise',
        nome: enterpriseDistinct?.nome ?? 'Scale',
        tagline: 'Para redes, franquias e clínicas de alto volume.',
        precoLabel: enterpriseDistinct ? `a partir de ${this.formatBRL(enterpriseDistinct.preco_mensal)}` : 'Sob medida',
        precoSub: enterpriseDistinct ? '/mês — uso intensivo' : 'preço por demanda',
        benefits: [
          'Volume ilimitado de automações com pricing dedicado',
          'Integrações com ERP, sistemas de PMV e webhooks',
          'Onboarding guiado + gerente de sucesso dedicado',
          'SLA, contrato corporativo e suporte prioritário',
        ],
        cta: {
          label: 'Falar com especialista',
          route: '/parceiro/cadastrar',
          queryParams: enterpriseDistinct ? { plano: enterpriseDistinct.slug } : null,
        },
      },
    ];
  });

  /** Bloco "antes vs depois" — narrativa de transformação */
  rotinaAntes: RotinaItem[] = [
    { icon: 'fa-calendar-xmark', label: 'Agenda no caderno e no WhatsApp pessoal' },
    { icon: 'fa-user-slash', label: 'No-show de 30%+ comendo o faturamento' },
    { icon: 'fa-comments', label: 'Atendimento manual 12 horas por dia' },
    { icon: 'fa-bullhorn', label: 'Marketing improvisado, sem retorno claro' },
  ];

  rotinaDepois: RotinaItem[] = [
    { icon: 'fa-calendar-check', label: 'Agenda online com confirmação automática' },
    { icon: 'fa-bell', label: 'Lembretes em WhatsApp reduzem faltas em até 40%' },
    { icon: 'fa-robot', label: 'IA atendendo e fechando agendas 24/7' },
    { icon: 'fa-arrow-trend-up', label: 'Receita recorrente subindo mês a mês' },
  ];

  passos: Passo[] = [
    {
      numero: '01',
      titulo: 'Crie sua conta grátis',
      descricao: 'Cadastre seu negócio em 30 segundos. Agenda, vitrine e mapa liberados sem pagar nada.',
    },
    {
      numero: '02',
      titulo: 'Ative as automações',
      descricao: 'No plano Pro você liga WhatsApp, IA e e-mail em minutos. O atendimento começa a rodar sozinho.',
    },
    {
      numero: '03',
      titulo: 'Pague só pelo crescimento',
      descricao: 'Recursos avançados consomem créditos do seu plano. Sem surpresa: você só investe no que gera receita.',
    },
  ];

  automacoes: BeneficioAutomacao[] = [
    {
      icon: 'fa-brands fa-whatsapp',
      titulo: 'WhatsApp automático',
      descricao: 'Lembretes, confirmações e reagendamentos disparados na hora certa, no canal que o tutor responde.',
      metrica: 'Reduz faltas em até 40%',
    },
    {
      icon: 'fa-solid fa-robot',
      titulo: 'IA para atendimento',
      descricao: 'Agente próprio responde dúvidas, sugere serviços e fecha agendamentos enquanto você cuida dos pets.',
      metrica: 'Atende 24/7 sem custo de equipe',
    },
    {
      icon: 'fa-solid fa-calendar-check',
      titulo: 'Agenda inteligente',
      descricao: 'Encaixes otimizados, bloqueio de horários e regras por profissional. Lota a semana sem confusão.',
      metrica: 'Até 30% mais agendamentos',
    },
    {
      icon: 'fa-solid fa-map-location-dot',
      titulo: 'Destaque no mapa',
      descricao: 'Apareça primeiro para tutores buscando serviços perto. Mais cliques, mais visitas, mais clientes.',
      metrica: '3× mais visualizações no perfil',
    },
    {
      icon: 'fa-solid fa-envelope-open-text',
      titulo: 'E-mail segmentado',
      descricao: 'Campanhas, recompra e reativação automáticas com base no histórico de cada tutor.',
      metrica: 'Recupera clientes inativos',
    },
    {
      icon: 'fa-solid fa-plug-circle-bolt',
      titulo: 'Integrações & API',
      descricao: 'Conecte ERP, sistemas de PMV, marketplaces e webhooks. Sua operação inteira plugada à PetSphere.',
      metrica: 'Sem trabalho duplicado',
    },
  ];

  ngOnInit() {
    this.loading.set(true);
    Promise.all([
      this.http
        .get<{ data: PublicPlano[] }>(`${this.base}/public/planos`)
        .toPromise()
        .catch(() => ({ data: [] as PublicPlano[] })),
      this.http
        .get<{ data: PublicPacote[] }>(`${this.base}/public/creditos/pacotes`)
        .toPromise()
        .catch(() => ({ data: [] as PublicPacote[] })),
    ])
      .then(([p, c]) => {
        this.planos.set(p?.data || []);
        this.pacotes.set(c?.data || []);
        this.loading.set(false);
      })
      .catch(() => {
        this.errorMsg.set('Não foi possível carregar os planos agora. Tente novamente em instantes.');
        this.loading.set(false);
      });
  }

  trackById(_i: number, x: { id: number }) {
    return x.id;
  }

  trackByKey(_i: number, x: { key: string }) {
    return x.key;
  }

  totalCreditos(p: PublicPacote): number {
    return p.creditos_incluidos + (p.bonus_creditos || 0);
  }

  formatBRL(v: number): string {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
