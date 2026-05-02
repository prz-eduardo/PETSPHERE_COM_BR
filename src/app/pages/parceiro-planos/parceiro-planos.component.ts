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
  max_colaboradores?: number | null;
  max_recursos?: number | null;
  max_agendamentos_mes?: number | null;
  features?: Record<string, unknown> | null;
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

interface TierSnap {
  colab: string;
  rec: string;
  agd: string;
  credLabel: string;
  taxProd: string;
  taxServ: string;
  auto: boolean;
  sup: boolean;
}

interface TierCard {
  key: 'basic' | 'pro' | 'premium';
  badge?: string;
  nome: string;
  tagline: string;
  precoLabel: string;
  precoSub?: string;
  metaLines: string[];
  snap: TierSnap;
  benefits: string[];
  cta: { label: string; route: string; queryParams?: Record<string, string> | null };
  highlighted?: boolean;
}

interface CompareRow {
  feature: string;
  basic: string;
  pro: string;
  premium: string;
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
   * Basic / Pro / Premium: mapeia slugs reais da API (`basic`/`free`, `pro`, `premium`/`com-tudo`)
   * e preenche limites e taxas a partir de `features` + colunas numéricas, com fallback comercial.
   */
  tiers = computed<TierCard[]>(() => {
    const sorted = [...this.planos()].sort((a, b) => (a.preco_mensal || 0) - (b.preco_mensal || 0));
    const basicP = this.pickPlano(sorted, ['basic', 'free']);
    const proP = this.pickPlano(sorted, ['pro', 'pro-mensal']);
    const premP = this.pickPlano(sorted, ['premium', 'com-tudo', 'enterprise']);

    const snapB = this.buildTierSnap(basicP, {
      colab: 1,
      rec: 1,
      agd: 80,
      cred: 150,
      taxProd: 12,
      taxServ: 15,
      auto: false,
      sup: false,
    });
    const snapP = this.buildTierSnap(proP, {
      colab: 5,
      rec: 5,
      agd: 800,
      cred: 600,
      taxProd: 8,
      taxServ: 10,
      auto: true,
      sup: false,
    });
    const snapM = this.buildTierSnap(premP, {
      colab: null,
      rec: null,
      agd: null,
      cred: 2500,
      taxProd: 5,
      taxServ: 7,
      auto: true,
      sup: true,
    });

    const basicPrice = basicP ? Number(basicP.preco_mensal || 0) : 0;
    const proPriceNum = proP ? Number(proP.preco_mensal || 0) : 99;
    const premPriceNum = premP ? Number(premP.preco_mensal || 0) : 249;

    return [
      {
        key: 'basic',
        nome: basicP?.nome || 'Basic',
        tagline:
          'Comece a vender sem complicação. Ideal para quem está começando ou quer testar a plataforma.',
        precoLabel: basicPrice === 0 ? 'Grátis' : this.formatBRL(basicPrice),
        precoSub: basicPrice === 0 ? 'R$ 0/mês' : '/mês',
        metaLines: [
          `Inclui: ${snapB.colab} colaborador(es) · ${snapB.rec} recurso(s) · até ${snapB.agd} agendamentos/mês`,
          `Créditos mensais: ${snapB.credLabel} · Taxas: ${snapB.taxProd}% produtos · ${snapB.taxServ}% serviços`,
        ],
        snap: snapB,
        benefits: [
          'Loja dentro da PetSphere, produtos e serviços',
          'Receba agendamentos e gerencie clientes básicos',
          'Sem automações avançadas; sem destaque prioritário no marketplace',
        ],
        cta: {
          label: 'Começar grátis',
          route: '/parceiro/cadastrar',
          queryParams: { plano: basicP?.slug || 'basic' },
        },
      },
      {
        key: 'pro',
        badge: 'Principal',
        highlighted: true,
        nome: proP?.nome || 'Pro',
        tagline: 'Profissionalize seu negócio e venda mais. Para quem já atende clientes e quer crescer de verdade.',
        precoLabel: this.formatBRL(proPriceNum),
        precoSub: '/mês',
        metaLines: [
          `Até ${snapP.colab} colaboradores · ${snapP.rec} recursos · até ${snapP.agd} agendamentos/mês`,
          `Créditos mensais: ${snapP.credLabel} · Taxas: ${snapP.taxProd}% produtos · ${snapP.taxServ}% serviços`,
        ],
        snap: snapP,
        benefits: [
          'Tudo do Basic + loja mais completa e personalizável',
          'Automações: lembretes, WhatsApp e fluxos que reduzem no-show',
          'Melhor posicionamento no marketplace e experiência mais profissional',
        ],
        cta: {
          label: 'Quero crescer meu negócio',
          route: '/parceiro/cadastrar',
          queryParams: { plano: proP?.slug || 'pro' },
        },
      },
      {
        key: 'premium',
        nome: premP?.nome || 'Premium',
        tagline: 'Escala máxima e prioridade total. Para quem leva o negócio a sério e quer extrair o máximo da plataforma.',
        precoLabel: this.formatBRL(premPriceNum),
        precoSub: '/mês',
        metaLines: [
          'Colaboradores, recursos e agendamentos ilimitados',
          `Créditos mensais: ${snapM.credLabel} · Taxas mínimas: ${snapM.taxProd}% produtos · ${snapM.taxServ}% serviços`,
        ],
        snap: snapM,
        benefits: [
          'Tudo do Pro + uso praticamente ilimitado no dia a dia',
          'Suporte prioritário e melhor ranqueamento para alto volume',
          'Acesso ampliado a recursos atuais e novos conforme evoluem',
        ],
        cta: {
          label: 'Escalar meu negócio',
          route: '/parceiro/cadastrar',
          queryParams: { plano: premP?.slug || 'premium' },
        },
      },
    ];
  });

  comparisonRows = computed<CompareRow[]>(() => {
    const ts = this.tiers();
    const b = ts.find(t => t.key === 'basic')!;
    const p = ts.find(t => t.key === 'pro')!;
    const m = ts.find(t => t.key === 'premium')!;
    const yn = (v: boolean) => (v ? '✓' : '—');
    return [
      { feature: 'Loja na PetSphere', basic: '✓', pro: '✓', premium: '✓' },
      { feature: 'Agendamentos', basic: '✓', pro: '✓', premium: '✓' },
      { feature: 'Automações avançadas', basic: yn(b.snap.auto), pro: yn(p.snap.auto), premium: yn(m.snap.auto) },
      { feature: 'Colaboradores', basic: b.snap.colab, pro: p.snap.colab, premium: m.snap.colab },
      { feature: 'Recursos (agenda)', basic: b.snap.rec, pro: p.snap.rec, premium: m.snap.rec },
      { feature: 'Agendamentos / mês', basic: b.snap.agd, pro: p.snap.agd, premium: m.snap.agd },
      { feature: 'Créditos mensais (IA / automação)', basic: b.snap.credLabel, pro: p.snap.credLabel, premium: m.snap.credLabel },
      { feature: 'Taxa em produtos', basic: `${b.snap.taxProd}%`, pro: `${p.snap.taxProd}%`, premium: `${m.snap.taxProd}%` },
      { feature: 'Taxa em serviços', basic: `${b.snap.taxServ}%`, pro: `${p.snap.taxServ}%`, premium: `${m.snap.taxServ}%` },
      { feature: 'Suporte prioritário', basic: yn(b.snap.sup), pro: yn(p.snap.sup), premium: yn(m.snap.sup) },
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

  private pickPlano(plans: PublicPlano[], slugs: string[]): PublicPlano | null {
    const map = new Map(plans.map(p => [(p.slug || '').toLowerCase(), p]));
    for (const s of slugs) {
      const hit = map.get(s.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  private readFeatN(f: Record<string, unknown> | null | undefined, k: string, fallback: number): number {
    if (!f || !(k in f)) return fallback;
    const n = Number(f[k]);
    return Number.isFinite(n) ? n : fallback;
  }

  private readFeatBool(f: Record<string, unknown> | null | undefined, k: string, fallback: boolean): boolean {
    if (!f || !(k in f)) return fallback;
    const v = f[k];
    if (v === true || v === 1) return true;
    if (v === false || v === 0) return false;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      return s === 'true' || s === '1';
    }
    return fallback;
  }

  private limStr(n: number | null | undefined): string {
    if (n == null) return 'Ilimitado';
    const t = Math.trunc(Number(n));
    return Number.isFinite(t) ? String(t) : 'Ilimitado';
  }

  private creditTierLabel(credits: number): string {
    const n = Math.max(0, Math.trunc(Number(credits) || 0));
    if (n >= 2000) return 'Alto';
    if (n >= 400) return 'Médio';
    return 'Baixo';
  }

  private buildTierSnap(
    p: PublicPlano | null,
    defs: {
      colab: number | null;
      rec: number | null;
      agd: number | null;
      cred: number;
      taxProd: number;
      taxServ: number;
      auto: boolean;
      sup: boolean;
    }
  ): TierSnap {
    const f = p?.features || null;
    const credsRaw = p != null ? Number(p.creditos_mensais_inclusos || 0) : defs.cred;
    const creds = Number.isFinite(credsRaw) ? credsRaw : defs.cred;
    const taxProd = this.readFeatN(f, 'split_taxa_produto_pct', defs.taxProd);
    const taxServ = this.readFeatN(f, 'split_taxa_servico_pct', defs.taxServ);
    const colabN = p?.max_colaboradores != null ? p.max_colaboradores : defs.colab;
    const recN = p?.max_recursos != null ? p.max_recursos : defs.rec;
    const agdN = p?.max_agendamentos_mes != null ? p.max_agendamentos_mes : defs.agd;
    const auto = p != null ? !!p.permite_automacoes : defs.auto;
    const sup = this.readFeatBool(f, 'suporte_prioritario', defs.sup);
    return {
      colab: this.limStr(colabN),
      rec: this.limStr(recN),
      agd: this.limStr(agdN),
      credLabel: this.creditTierLabel(creds),
      taxProd: String(Math.trunc(taxProd)),
      taxServ: String(Math.trunc(taxServ)),
      auto,
      sup,
    };
  }
}
