import { Routes } from '@angular/router';
// import { HomeComponent } from './pages/home/home.component';
import { GaleriaPublicaComponent } from './pages/galeria-publica/galeria-publica.component';
import { LoginComponent } from './pages/restrito/login/login.component';
import { AdminComponent } from './pages/restrito/admin/admin.component';
import { ProdutoComponent } from './pages/restrito/admin/produto/produto.component';
import { ListaProdutosComponent } from './pages/restrito/admin/lista-produtos/lista-produtos.component';
import { AdminPedidosComponent } from './pages/restrito/admin/pedidos/pedidos.component';
import { authGuard } from './guards/auth.guard';
import { clienteSessionGuard } from './guards/cliente-session.guard';
import { vetGuard } from './guards/vet.guard';
import { parceiroGuard } from './guards/parceiro.guard';
import { parceiroVetGuard } from './guards/parceiro-vet.guard';
import { petsphereHubRootCanMatch, tenantLojaRootCanMatch } from './guards/tenant-root-can-match.guard';
import { tenantBlockPetsphereMarketingGuard } from './guards/tenant-block-petsphere-marketing.guard';

export const routes: Routes = [
  /** Vitrine do parceiro: raiz `/` só quando há tenant (subdomínio / host). */
  {
    path: '',
    loadChildren: () => import('./pages/loja/loja.module').then((m) => m.LojaModule),
    canMatch: [tenantLojaRootCanMatch],
  },
  /** Hub marca no domínio principal (sem tenant). */
  {
    path: '',
    loadComponent: () => import('./pages/home-hub/home-hub.component').then((m) => m.HomeHubComponent),
    canMatch: [petsphereHubRootCanMatch],
  },
  { path: 'institucional', redirectTo: 'sobre-nos', pathMatch: 'full' },
  {
    path: 'sobre-nos',
    canActivate: [tenantBlockPetsphereMarketingGuard],
    loadComponent: () => import('./pages/sobre-nos/sobre-nos.component').then(m => m.SobreNosComponent),
  },
  {
    path: 'adestramentos',
    canActivate: [tenantBlockPetsphereMarketingGuard],
    loadComponent: () => import('./pages/adestramentos/adestramentos.component').then((m) => m.AdestramentosComponent),
    data: { title: 'Adestramento e comportamento' },
  },
  {
    path: 'passeadores',
    canActivate: [tenantBlockPetsphereMarketingGuard],
    loadComponent: () =>
      import('./pages/passeadores-showcase/passeadores-showcase.component').then((m) => m.PasseadoresShowcaseComponent),
    data: { title: 'Passeio com seu pet' },
  },
  {
    path: 'politica-de-privacidade',
    loadComponent: () =>
      import('./pages/politica-privacidade/politica-privacidade.component').then(m => m.PoliticaPrivacidadeComponent)
  },
  {
    path: 'termos-de-uso',
    loadComponent: () =>
      import('./pages/termos-de-uso/termos-de-uso.component').then((m) => m.TermosDeUsoComponent),
  },
  { 
    path: 'meus-pedidos', 
    loadComponent: () => import('./pages/meus-pedidos/meus-pedidos.component').then(m => m.MeusPedidosComponent),
    children: [
      {
        path: 'consultar-pedidos',
        outlet: 'modal',
        loadComponent: () => import('./pages/restrito/area-cliente/consultar-pedidos/consultar-pedidos.component').then(m => m.ConsultarPedidosComponent)
      }
    ]
  },
    { path: 'mapa', loadComponent: () => import('./pages/mapa/mapa.component').then(m => m.MapaComponent) },
    { path: 'mapa/:slug', loadComponent: () => import('./pages/mapa/mapa.component').then(m => m.MapaComponent) },
    {
      path: 'parceiro/cadastrar',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () => import('./pages/parceiro-cadastro/parceiro-cadastro.component').then(m => m.ParceiroCadastroComponent),
    },
    {
      path: 'parceiro/planos',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () => import('./pages/parceiro-planos/parceiro-planos.component').then(m => m.ParceiroPlanosComponent),
      data: { title: 'Planos & créditos PetSphere' },
    },
    {
      path: 'parceiro/veterinarios',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () =>
        import('./pages/parceiro-veterinarios/parceiro-veterinarios.component').then(m => m.ParceiroVeterinariosComponent),
      data: { title: 'Veterinários e clínicas PetSphere' },
    },
    {
      path: 'parceiro/hotel-e-creche',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () =>
        import('./pages/parceiro-hotel-creche/parceiro-hotel-creche.component').then(m => m.ParceiroHotelCrecheComponent),
      data: { title: 'Hotel, creche e day use PetSphere' },
    },
    {
      path: 'parceiro/transporte-animal',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () =>
        import('./pages/parceiro-transporte-animal/parceiro-transporte-animal.component').then(
          (m) => m.ParceiroTransporteAnimalComponent,
        ),
      data: { title: 'Transporte animal PetSphere' },
    },
    {
      path: 'dirigir-petsphere',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () =>
        import('./pages/dirigir-petsphere/dirigir-petsphere.component').then((m) => m.DirigirPetsphereComponent),
      data: { title: 'Dirija na rede PetSphere' },
    },
    {
      path: 'parceiro/passeadores',
      canActivate: [tenantBlockPetsphereMarketingGuard],
      loadComponent: () =>
        import('./pages/parceiro-passeadores/parceiro-passeadores.component').then((m) => m.ParceiroPasseadoresComponent),
      data: { title: 'Passeadores e dog walkers PetSphere' },
    },
    { path: 'veterinarios', redirectTo: 'parceiro/veterinarios', pathMatch: 'full' },
    { path: 'hotel-creche', redirectTo: 'parceiro/hotel-e-creche', pathMatch: 'full' },
  { path: 'restrito', redirectTo: 'restrito/login', pathMatch: 'full' },
  { path: 'restrito/login', component: LoginComponent },
  {
    path: 'restrito/kyc-motorista-global',
    canActivate: [clienteSessionGuard],
    loadComponent: () =>
      import('./pages/restrito/kyc-motorista-global/kyc-motorista-global.component').then(
        (m) => m.KycMotoristaGlobalComponent
      ),
    data: { title: 'KYC motorista PetSphere' },
  },
  {
    path: 'restrito/motorista-global',
    canActivate: [clienteSessionGuard],
    loadComponent: () =>
      import('./pages/restrito/motorista-global-painel/motorista-global-painel.component').then(
        (m) => m.MotoristaGlobalPainelComponent
      ),
    data: { title: 'Painel motorista PetSphere' },
  },
  {
    path: 'restrito/transporte-pet-corridas',
    canActivate: [clienteSessionGuard],
    loadComponent: () =>
      import('./pages/restrito/transporte-pet-corridas-tutor/transporte-pet-corridas-tutor.component').then(
        (m) => m.TransportePetCorridasTutorComponent
      ),
    data: { title: 'Meus transportes pet' },
  },
  {
    path: 'restrito/admin',
    component: AdminComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadComponent: () => import('./pages/restrito/admin/dashboard/dashboard.component').then(m => m.DashboardAdminComponent), canActivate: [authGuard], data: { title: 'Dashboard' } },
      { path: 'meu-perfil-admin', loadComponent: () => import('./pages/restrito/admin/meu-perfil-admin/meu-perfil-admin.component').then(m => m.MeuPerfilAdminComponent), canActivate: [authGuard], data: { title: 'Meu Perfil (Admin)' } },
      {
        path: 'ferramentas/email-teste',
        loadComponent: () =>
          import('./pages/restrito/admin/admin-test-email/admin-test-email.component').then((m) => m.AdminTestEmailComponent),
        canActivate: [authGuard],
        data: { title: 'Teste de e-mail' },
      },
      { path: 'guia-ativos', loadComponent: () => import('./pages/restrito/admin/guia-ativos/guia-ativos.component').then(m => m.GuiaAtivosAdminComponent), canActivate: [authGuard], data: { title: 'Guia de Ativos' } },
      { path: 'estoque', loadComponent: () => import('./pages/restrito/admin/estoque/estoque.component').then(m => m.EstoqueAdminComponent), canActivate: [authGuard], data: { title: 'Estoque de Itens (Ativos e Insumos)' } },
      { path: 'formulas', loadComponent: () => import('./pages/restrito/admin/formulas/formulas.component').then(m => m.FormulasAdminComponent), canActivate: [authGuard], data: { title: 'Fórmulas' } },
      { path: 'cupons', loadComponent: async () => (await import('./pages/restrito/admin/cupons/cupons.component')).CuponsAdminComponent, canActivate: [authGuard], data: { title: 'Cupons' } },
      { path: 'promocoes', loadComponent: () => import('./pages/restrito/admin/promocoes/promocoes.component').then(m => m.AdminPromocoesComponent), canActivate: [authGuard], data: { title: 'Promoções' } },
      { path: 'banners', loadComponent: async () => (await import('./pages/restrito/admin/banners/banners.component')).BannersAdminComponent, canActivate: [authGuard], data: { title: 'Banners' } },
      { path: 'produto-preview', loadComponent: () => import('./pages/restrito/admin/produto-preview/produto-preview.component').then(m => m.ProdutoPreviewComponent), canActivate: [authGuard], data: { title: 'Pré-visualização (Admin)' } },
      { path: 'marketplace/customizacoes', redirectTo: 'marketplace/categorias', pathMatch: 'full' },
      { path: 'marketplace/categorias', loadComponent: () => import('./pages/restrito/admin/marketplace-categorias/marketplace-categorias.component').then(m => m.MarketplaceCategoriasAdminComponent), canActivate: [authGuard], data: { title: 'Categorias da vitrine' } },
      { path: 'marketplace/tags', loadComponent: () => import('./pages/restrito/admin/marketplace-tags/marketplace-tags.component').then(m => m.MarketplaceTagsAdminComponent), canActivate: [authGuard], data: { title: 'Tags da vitrine' } },
      { path: 'loja/temas', loadComponent: () => import('./pages/restrito/admin/loja-temas/loja-temas.component').then(m => m.LojaTemasAdminComponent), canActivate: [authGuard], data: { title: 'Temas da loja' } },
      { path: 'fornecedores', loadComponent: async () => (await import('./pages/restrito/admin/fornecedores/fornecedores.component')).FornecedoresAdminComponent, canActivate: [authGuard], data: { title: 'Gerenciar Fornecedores' } },
      { path: 'lista-produtos', component: ListaProdutosComponent, canActivate: [authGuard], data: { title: 'Lista de produtos' } },
      { path: 'parceiros', loadComponent: async () => (await import('./pages/restrito/admin/parceiros/parceiros.component')).ParceirosAdminComponent, canActivate: [authGuard], data: { title: 'Gerenciar Parceiros' } },
      { path: 'planos', loadComponent: async () => (await import('./pages/restrito/admin/planos/planos.component')).PlanosAdminComponent, canActivate: [authGuard], data: { title: 'Planos SaaS' } },
      { path: 'creditos', loadComponent: async () => (await import('./pages/restrito/admin/creditos/creditos.component')).CreditosAdminComponent, canActivate: [authGuard], data: { title: 'Créditos & consumo' } },
      {
        path: 'transporte-pet',
        loadComponent: () =>
          import('./pages/restrito/admin/admin-transporte-pet/admin-transporte-pet.component').then((m) => m.AdminTransportePetComponent),
        canActivate: [authGuard],
        data: { title: 'Transporte Pet' },
      },
      {
        path: 'pedidos-pos-venda',
        loadComponent: () =>
          import('./pages/restrito/admin/pedidos-pos-venda/pedidos-pos-venda.component').then((m) => m.AdminPedidosPosVendaComponent),
        canActivate: [authGuard],
        data: { title: 'Pós-venda / cancelamentos' },
      },
      { path: 'pedidos', component: AdminPedidosComponent, canActivate: [authGuard], data: { title: 'Pedidos' } },
      {
        path: 'atendimento',
        loadComponent: () =>
          import('./pages/restrito/admin/atendimento/atendimento.component').then((m) => m.AtendimentoAdminComponent),
        canActivate: [authGuard],
        data: { title: 'Atendimento' }
      },
      { path: 'ativos', loadComponent: async () => (await import('./pages/restrito/admin/ativos/ativos.component')).AtivosAdminComponent, canActivate: [authGuard], data: { title: 'Ativos' } },
      { path: 'usuarios', loadComponent: async () => (await import('./pages/restrito/admin/people/people.component')).PeopleAdminComponent, data: { tipo: 'admin', title: 'Gerenciar Usuários' }, canActivate: [authGuard] },
      { path: 'clientes', loadComponent: async () => (await import('./pages/restrito/admin/people/people.component')).PeopleAdminComponent, data: { tipo: 'cliente', title: 'Gerenciar Clientes' }, canActivate: [authGuard] },
      { path: 'veterinarios', loadComponent: async () => (await import('./pages/restrito/admin/people/people.component')).PeopleAdminComponent, data: { tipo: 'vet', title: 'Gerenciar Veterinários' }, canActivate: [authGuard] },
      {
        path: 'rastreio',
        loadChildren: () =>
          import('./pages/restrito/admin/rastreio/rastreio.routes').then((m) => m.RASTREIO_ROUTES),
        canActivate: [authGuard],
        data: { title: 'Atividade na loja' },
      },
      { path: 'rastreio-clientes', redirectTo: 'rastreio/eventos', pathMatch: 'full' },
      {
        path: 'pets-galeria',
        loadComponent: () =>
          import('./pages/restrito/admin/pets-galeria/pets-galeria.component').then((m) => m.PetsGaleriaAdminComponent),
        canActivate: [authGuard],
        data: { title: 'Pets / Galeria' },
      },
    ]
  },
  { path: 'restrito/produto', component: ProdutoComponent, canActivate: [authGuard] },
  { path: 'restrito/lista-produtos', redirectTo: 'restrito/admin/lista-produtos' },
  { path: 'restrito/usuarios', loadComponent: () => import('./pages/restrito/usuarios/usuarios.component').then(m => m.UsuariosComponent), canActivate: [authGuard] },
  { 
    path: 'area-cliente', 
    loadComponent: () => import('./pages/restrito/area-cliente/area-cliente.component').then(m => m.AreaClienteComponent),
    children: [
      {
        path: 'consultar-pedidos',
        outlet: 'modal',
        loadComponent: () => import('./pages/restrito/area-cliente/consultar-pedidos/consultar-pedidos.component').then(m => m.ConsultarPedidosComponent)
      }
    ]
  },
  { path: 'novo-pet', loadComponent: () => import('./pages/novo-pet/novo-pet.component').then(m => m.NovoPetComponent) },
  { path: 'editar-pet/:id', loadComponent: () => import('./pages/novo-pet/novo-pet.component').then(m => m.NovoPetComponent) },
  { path: 'area-vet', loadComponent: () => import('./pages/restrito/area-vet/area-vet.component').then(m => m.AreaVetComponent)},
  { path: 'gerar-receita', loadComponent: () => import('./pages/restrito/area-vet/gerar-receita/gerar-receita.component').then(m => m.GerarReceitaComponent), canActivate: [vetGuard] },
  {
    path: 'atendimento/clinico',
    redirectTo: 'gerar-receita',
    pathMatch: 'full',
  },
  {
    path: 'vet-atendimento-ia/:atendimentoId',
    loadComponent: () =>
      import('./pages/restrito/area-vet/vet-atendimento-ia/vet-atendimento-ia.component').then(
        (m) => m.VetAtendimentoIaComponent
      ),
    canActivate: [vetGuard],
  },
  { path: 'historico-receitas', loadComponent: () => import('./pages/restrito/area-vet/historico-receitas/historico-receitas.component').then(m => m.HistoricoReceitasComponent), canActivate: [vetGuard] },
  { path: 'historico-receitas/:id', loadComponent: () => import('./pages/restrito/area-vet/receita-detalhe/receita-detalhe.component').then(m => m.ReceitaDetalheComponent), canActivate: [vetGuard] },
  { path: 'pacientes', loadComponent: () => import('./pages/restrito/area-vet/pacientes/pacientes.component').then(m => m.PacientesComponent), canActivate: [vetGuard] },
  { path: 'pacientes/:petId', loadComponent: () => import('./pages/restrito/area-vet/paciente-detalhe/paciente-detalhe.component').then(m => m.PacienteDetalheComponent), canActivate: [vetGuard] },
  {
    path: 'panorama-atendimento',
    loadComponent: () =>
      import('./pages/restrito/area-vet/panorama-atendimento/panorama-atendimento.component').then((m) => m.PanoramaAtendimentoComponent),
    canActivate: [vetGuard],
  },
  { path: 'meus-pets', loadComponent: () => import('./pages/meus-pets/meus-pets.component').then(m => m.MeusPetsComponent)},
  {
    path: 'meus-agendamentos',
    loadComponent: () =>
      import('./pages/restrito/area-cliente/meus-agendamentos/meus-agendamentos.component').then(
        (m) => m.MeusAgendamentosComponent,
      ),
  },
  { path: 'galeria', component: GaleriaPublicaComponent },
  {
    path: 'institucional-loja',
    loadComponent: () =>
      import('./pages/loja-publica/parceiro-institucional/parceiro-institucional.component').then(
        (m) => m.ParceiroInstitucionalComponent
      ),
  },
  {
    path: 'galeria/pet/:id',
    loadComponent: () =>
      import('./pages/pet-perfil-publico/pet-perfil-publico.component').then((m) => m.PetPerfilPublicoComponent)
  },
  { path: 'meus-enderecos', loadComponent: () => import('./pages/meus-enderecos/meus-enderecos.component').then(m => m.MeusEnderecosComponent)},
  { path: 'meus-cartoes', loadComponent: () => import('./pages/restrito/area-cliente/meus-cartoes/meus-cartoes.component').then(m => m.MeusCartoesComponent)},
  { path: 'editar-perfil', loadComponent: () => import('./pages/perfil/perfil.component').then(m => m.PerfilComponent)},
  /** Loja global Petsphere (domínio principal). */
  { path: 'loja', loadChildren: () => import('./pages/loja/loja.module').then(m => m.LojaModule) },
  { path: 'produto/:id', loadComponent: () => import('./product-details/product-details.component').then(m => m.ProductDetailsComponent)},
  { path: 'favoritos', loadComponent: () => import('./pages/favoritos/favoritos.component').then(m => m.FavoritosComponent)},
  { path: 'carrinho', loadComponent: () => import('./pages/carrinho/carrinho.component').then(m => m.CarrinhoComponent)},
  // Checkout: página dedicada de pagamento/resumo após criação do pedido
  { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent)},

  // ── PetSphere Parceiros ────────────────────────────────────────────────
  { path: 'parceiros', redirectTo: 'parceiros/login', pathMatch: 'full' },
  {
    path: 'parceiros/login',
    loadComponent: () => import('./pages/parceiros/login-parceiro/login-parceiro.component').then(m => m.LoginParceiroComponent),
  },
  {
    path: 'parceiros/recuperar-senha',
    loadComponent: () => import('./pages/parceiros/recuperar-senha-parceiro/recuperar-senha-parceiro.component').then(m => m.RecuperarSenhaParceiroComponent),
  },
  {
    path: 'parceiros/convite/:token',
    loadComponent: () => import('./pages/parceiros/aceitar-convite/aceitar-convite.component').then(m => m.AceitarConviteComponent),
  },
  {
    path: 'convite-dados/:token',
    loadComponent: () => import('./pages/convite-dados-parceiro/convite-dados-parceiro.component').then(m => m.ConviteDadosParceiroComponent),
  },
  {
    path: 'agendar-notificacao',
    loadComponent: () =>
      import('./pages/agendar-notificacao/agendar-notificacao.component').then((m) => m.AgendarNotificacaoComponent),
  },
  {
    path: 'parceiros',
    loadComponent: () => import('./pages/parceiros/parceiro-shell/parceiro-shell.component').then(m => m.ParceiroShellComponent),
    canActivate: [parceiroGuard],
    children: [
      {
        path: 'painel',
        loadComponent: () => import('./pages/parceiros/parceiro-painel/parceiro-painel.component').then(m => m.ParceiroPainelComponent),
        data: { title: 'Painel do Parceiro' },
      },
      {
        path: 'agenda/regras',
        loadComponent: () =>
          import('./pages/parceiros/agenda/agenda-regras/agenda-regras.component').then(m => m.AgendaRegrasComponent),
        data: { title: 'Regras da agenda' },
      },
      {
        path: 'agenda',
        loadComponent: () => import('./pages/parceiros/agenda/agenda-shell/agenda-shell.component').then(m => m.AgendaShellComponent),
      },
      {
        path: 'telemedicina-emergencial',
        loadComponent: () =>
          import('./pages/parceiros/telemedicina-emergencial/telemedicina-emergencial.component').then(
            (m) => m.TelemedicinaEmergencialComponent
          ),
        data: { title: 'Telemedicina emergencial' },
      },
      {
        path: 'colaboradores',
        loadComponent: () => import('./pages/parceiros/colaboradores/colaboradores.component').then(m => m.ColaboradoresComponent),
      },
      {
        path: 'servicos',
        loadComponent: () =>
          import('./pages/parceiros/servicos-parceiro/servicos-parceiro.component').then(m => m.ServicosParceiroComponent),
        data: { title: 'Serviços' },
      },
      {
        path: 'meus-clientes',
        loadComponent: () =>
          import('./pages/parceiros/meus-clientes/meus-clientes.component').then(m => m.MeusClientesComponent),
        data: { title: 'Meus clientes' },
      },
      {
        path: 'gestao-tutores-aulas',
        loadComponent: () =>
          import('./pages/parceiros/gestao-tutores-aulas/gestao-tutores-aulas.component').then(
            (m) => m.ParceiroGestaoTutoresAulasComponent
          ),
        data: { title: 'Tutores, turmas & aulas' },
      },
      {
        path: 'mensagens',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-mensagens/parceiro-mensagens.component').then(
            (m) => m.ParceiroMensagensComponent
          ),
        data: { title: 'Mensagens com clientes' },
      },
      {
        path: 'mensagens/:clienteId',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-mensagens/parceiro-mensagens.component').then(
            (m) => m.ParceiroMensagensComponent
          ),
        data: { title: 'Mensagens com cliente' },
      },
      {
        path: 'chat/:clienteId',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-chat-cliente/parceiro-chat-cliente.component').then(
            (m) => m.ParceiroChatClienteComponent
          ),
        data: { title: 'Chat com cliente' },
      },
      {
        path: 'hospedagem',
        redirectTo: 'reservas-hotel',
        pathMatch: 'full',
      },
      {
        path: 'reservas-hotel',
        loadComponent: () =>
          import('./pages/parceiros/reservas-hotel/reservas-hotel.component').then(m => m.ReservasHotelComponent),
        data: { title: 'Hospedagem pet & creche' },
      },
      {
        path: 'transporte-pet',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-transporte-pet/parceiro-transporte-pet.component').then(m => m.ParceiroTransportePetComponent),
        data: { title: 'Transporte Pet' },
      },
      {
        path: 'configuracoes',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-minha-loja/parceiro-minha-loja.component').then(m => m.ParceiroMinhaLojaComponent),
        data: { title: 'Configurações' },
      },
      {
        path: 'minha-loja',
        redirectTo: 'configuracoes',
        pathMatch: 'full',
      },
      {
        path: 'petshop-online',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-petshop-online/parceiro-petshop-online.component').then(
            (m) => m.ParceiroPetshopOnlineComponent
          ),
        data: { title: 'Petshop online' },
      },
      {
        path: 'banners',
        loadComponent: () =>
          import('./pages/parceiros/banners-parceiro/banners-parceiro.component').then((m) => m.BannersParceiroComponent),
        data: { title: 'Banners da loja' },
      },
      {
        path: 'catalogo-produto',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-produto-wizard/parceiro-produto-wizard.component').then(
            (m) => m.ParceiroProdutoWizardComponent
          ),
        data: { title: 'Cadastro de produto' },
      },
      {
        path: 'inventario-pos',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-inventario-pos/parceiro-inventario-pos.component').then(
            (m) => m.ParceiroInventarioPosComponent
          ),
        data: { title: 'Inventário / POS' },
      },
      {
        path: 'caixa',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-caixa/parceiro-caixa.component').then((m) => m.ParceiroCaixaComponent),
        data: { title: 'Caixa' },
      },
      {
        path: 'gestao-clinica',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-modulo-em-breve/parceiro-modulo-em-breve.component').then(
            (m) => m.ParceiroModuloEmBreveComponent
          ),
        data: {
          title: 'Gestão da clínica',
          description:
            'Cadastro da unidade, responsável técnico, convênios e documentação administrativa — tudo no mesmo painel.',
          bullets: [
            'Dados cadastrais e filiais',
            'Responsável técnico e alvarás',
            'Convênios e tabelas de preço',
            'Integração com agenda e prontuário',
          ],
        },
      },
      {
        path: 'financeiro-parceiro',
        loadComponent: () =>
          import('./pages/parceiros/parceiro-modulo-em-breve/parceiro-modulo-em-breve.component').then(
            (m) => m.ParceiroModuloEmBreveComponent
          ),
        data: {
          title: 'Pagamentos e repasses',
          description:
            'Conciliação de recebíveis, repasses da plataforma e extratos — visão financeira para a gestão da clínica.',
          bullets: [
            'Extrato e histórico de repasses',
            'Conciliação com atendimentos e vendas',
            'Notas fiscais e comprovantes (quando aplicável)',
          ],
        },
      },
      {
        path: 'planos-assinatura',
        loadComponent: () =>
          import('./pages/parceiros/planos-assinatura/planos-assinatura.component').then(
            (m) => m.PlanosAssinaturaComponent
          ),
        data: { title: 'Plano, saldo e créditos' },
      },
      // ── Área Vet centralizada no painel parceiro ─────────────────────────
      {
        path: 'area-vet',
        loadComponent: () => import('./pages/restrito/area-vet/area-vet.component').then(m => m.AreaVetComponent),
      },
      {
        path: 'gerar-receita',
        loadComponent: () => import('./pages/restrito/area-vet/gerar-receita/gerar-receita.component').then(m => m.GerarReceitaComponent),
        canActivate: [parceiroVetGuard],
      },
      {
        path: 'atendimento/clinico',
        redirectTo: 'gerar-receita',
        pathMatch: 'full',
      },
      {
        path: 'historico-receitas',
        loadComponent: () => import('./pages/restrito/area-vet/historico-receitas/historico-receitas.component').then(m => m.HistoricoReceitasComponent),
        canActivate: [parceiroVetGuard],
      },
      {
        path: 'historico-receitas/:id',
        loadComponent: () => import('./pages/restrito/area-vet/receita-detalhe/receita-detalhe.component').then(m => m.ReceitaDetalheComponent),
        canActivate: [parceiroVetGuard],
      },
      {
        path: 'pacientes',
        loadComponent: () => import('./pages/restrito/area-vet/pacientes/pacientes.component').then(m => m.PacientesComponent),
        canActivate: [parceiroVetGuard],
      },
      {
        path: 'pacientes/:petId',
        loadComponent: () => import('./pages/restrito/area-vet/paciente-detalhe/paciente-detalhe.component').then(m => m.PacienteDetalheComponent),
        canActivate: [parceiroVetGuard],
      },
      {
        path: 'panorama-atendimento',
        loadComponent: () =>
          import('./pages/restrito/area-vet/panorama-atendimento/panorama-atendimento.component').then(
            (m) => m.PanoramaAtendimentoComponent
          ),
        canActivate: [parceiroVetGuard],
      },
      {
        path: 'vet-atendimento-ia/:atendimentoId',
        loadComponent: () =>
          import('./pages/restrito/area-vet/vet-atendimento-ia/vet-atendimento-ia.component').then(
            (m) => m.VetAtendimentoIaComponent
          ),
        canActivate: [parceiroVetGuard],
      },
      // ── Modo Vet — Painel único + Wizard de atendimento ──────────────────
      {
        path: 'vet-cockpit',
        loadComponent: () =>
          import('./pages/parceiros/vet-cockpit/vet-cockpit.component').then(
            (m) => m.VetCockpitComponent
          ),
        canActivate: [parceiroVetGuard],
        data: { title: 'Painel Vet' },
      },
      {
        path: 'atendimento-wizard',
        loadComponent: () =>
          import('./pages/parceiros/atendimento-wizard/atendimento-wizard.component').then(
            (m) => m.AtendimentoWizardComponent
          ),
        canActivate: [parceiroVetGuard],
        data: { title: 'Atendimento' },
      },
      { path: '', redirectTo: 'painel', pathMatch: 'full' },
    ],
  },

  { path: '**', redirectTo: '' }                        // Redireciona qualquer rota inválida pra home
];
