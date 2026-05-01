import { Component, OnInit, inject, signal, NgZone, ChangeDetectorRef, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ButtonDirective, ButtonComponent } from '../../../../shared/button';
import { AdminApiService, ProdutoDto, TaxonomyType, UnitDto, ProductFormDto, EstoqueAtivoDto, PromocaoDto, FormulaAvailabilityResponse, OmniChannelDefDto, ProdutoOmniPublicacaoDto } from '../../../../services/admin-api.service';
import { EMBALAGENS } from '../../../../constants/embalagens';
import { ProductCardRendererComponent } from '../../../../product-cards/product-card-renderer.component';
import { ShopProduct, StoreService, StoreMeta } from '../../../../services/store.service';
import { DEFAULT_PRODUCT_CARD_WIDTH } from '../../../../constants/card.constants';
import { ParceiroComercialProdutosService } from '../../../../services/parceiro-comercial-produtos.service';
import { BarcodeScanTargetDirective } from '../../../../shared/barcode-scan-target.directive';

interface AtivoBasic { id: number | string; nome: string; descricao?: string }

@Component({
  selector: 'app-produto',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonDirective, ButtonComponent, ProductCardRendererComponent, BarcodeScanTargetDirective],
  templateUrl: './produto.component.html',
  styleUrls: ['./produto.component.scss']
})
export class ProdutoComponent implements OnInit {
  @Input() editItem: ProdutoDto | null = null;
  @Input() embedded = false;
  /** Wizard no painel parceiro: usa APIs `/parceiro/comercial/produtos` e oculta recursos só admin. */
  @Input() partnerMode = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<any>();
  private _pendingEditItem: any | null = null;
      public readonly defaultCardWidth = DEFAULT_PRODUCT_CARD_WIDTH;
    destaqueHome = false;
    imagemPrincipal: string | null = null;
    public hoveredImg: number | null = null;
    public isDragOver = false;
      showCategoryDropdown = false;
    toggleCategoryDropdown() {
      this.showCategoryDropdown = !this.showCategoryDropdown;
    }

    selectCategory(id: string | number, event: Event) {
      event.stopPropagation();
      this.form.patchValue({ categoryId: id });
      this.showCategoryDropdown = false;
    }
  private fb = inject(FormBuilder);
  private api = inject(AdminApiService);
  private route = inject(ActivatedRoute);
  public router = inject(Router);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private store = inject(StoreService);
  private parceiroProdutos = inject(ParceiroComercialProdutosService);

  storeMeta: StoreMeta | null = null;

  /** Exibir produto na vitrine da loja do parceiro (liga `parceiro_vitrine_produtos`). */
  partnerMostrarNaLoja = signal(true);

  form!: FormGroup;
  private imagesSub: Subscription | null = null;
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  // image upload constraints and feedback
  MAX_IMAGES = 3;
  MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
  ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  imageMessage = signal<string | null>(null);

  // stepper state — agora 8 passos
  step = signal(0);
  steps = [
    { key: 'midia', label: 'Mídia' },
    { key: 'identificacao', label: 'Identificação' },
    { key: 'comercial', label: 'Comercial' },
    { key: 'tecnico', label: 'Técnico' },
    { key: 'regulatorio', label: 'Regulatório' },
    { key: 'variantes', label: 'Variantes' },
    { key: 'seo', label: 'SEO' },
    { key: 'revisao', label: 'Revisão' }
  ];

  // taxonomias (agora vindas de customizacoes)
  categoriasList: Array<{ id: string | number; name: string }> = [];
  tagsList: Array<{ id: string | number; name: string }> = [];
  embalagensList: Array<{ id: string | number; name: string }> = [];
  dosagesList: Array<{ id: string | number; name: string }> = [];

  // modais
  showDosageModal = false;
  showPackagingModal = false;
  showTagModal = false;
  showCategoryModal = false;

  // Ativo flow removido; agora deriva de fórmula quando aplicável
  produtosExistentes: Array<ProdutoDto> = [];
  // config (novas tabelas)
  units: UnitDto[] = [];
  forms: ProductFormDto[] = [];
  estoqueLotes: EstoqueAtivoDto[] = [];
  estoqueSelecionado: EstoqueAtivoDto | null = null;
  // promoções
  promocoes: PromocaoDto[] = [];
  showPromoModal = false;
  promocaoSelecionada: PromocaoDto | null = null;
  showPromoDetail = false;
  promoDetalhe: PromocaoDto | null = null;
  loadingPromos = false;
  promoSearchQuery = '';
  private _docDragOverHandler: any = null;
  private _docDropHandler: any = null;
  /** Referência estável para remover o listener de clique no documento */
  private readonly onDocumentClick = (e: MouseEvent) => this.handleClickOutsideDropdown(e);
  
  // fórmulas para produtos manipulados
  formulas: ProductFormDto[] = [];
  formulasSelect: Array<{ id: number; name: string }> = [];
  formulaQuery = signal('');
  formulasAll: Array<{ id: number; name: string; form_name?: string }> = [];
  formulasFiltered: Array<{ id: number; name: string; form_name?: string }> = [];
  formulaStatus: { missing: Array<{ ativo_id: number; ativo_nome?: string }>, items: Array<{ ativo_id: number; ativo_nome: string; required_per_unit: number; unit_code: string; available_converted: number; producible_units: number }>, lotsByAtivo: Record<string, EstoqueAtivoDto[]> } = { missing: [], items: [], lotsByAtivo: {} };
  // índice selecionado nas sugestões (-1 = 'Produto pronto')
  selectedFormulaIndex = -1;

  // Autocomplete state for taxonomias (category, tags, packaging)
  categoryQuery = signal('');
  categoriesFiltered: Array<{ id: string | number; name: string }> = [];
  selectedCategoryIndex: number = -1;

  tagQuery = signal('');
  tagsFiltered: Array<{ id: string | number; name: string }> = [];
  selectedTagIndex: number = -1;

  packagingQuery = signal('');
  packagingFiltered: Array<{ id: string | number; name: string }> = [];
  selectedPackagingIndex: number = -1;
  formulaEnabled = false;

  /** Omnichannel: canais disponíveis e publicações por produto */
  omniCanais = signal<OmniChannelDefDto[]>([]);
  omniPublicacoes = signal<ProdutoOmniPublicacaoDto[]>([]);
  omniMigrationsPending = signal(false);
  omniSyncing = signal(false);
  omniMessage = signal<string | null>(null);
  omniPick = signal<Record<string, boolean>>({});

  ngOnInit() {
      this.store.meta$.subscribe(m => this.storeMeta = m);
      // Inicializa destaqueHome e imagemPrincipal
      this.destaqueHome = false;
      this.imagemPrincipal = null;
      this.form = this.fb.group({
      id: [null],
      manipulado: [false], // novo toggle
      active: [1],
      formulaId: [null],
      name: ['', Validators.required],
      description: ['', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      image: [null],
      categoryId: [null, Validators.required],
      discount: [null],
      rating: [null],
      stock: [null],
      tags: this.fb.array<string>([]),
      weightValue: [null],
      weightUnit: ['g'],
      images: this.fb.array<string>([]),
      customizations: this.fb.group({
        dosage: this.fb.array<string>([]),
        packaging: this.fb.array<string>([])
      }),
      ativoId: [null],
      estoqueId: [null],
      // Identificação expandida
      sku: [null],
      marca: [null],
      codigoBarras: [null],
      // Técnico
      composicao: [null],
      modoUso: [null],
      indicacoes: [null],
      contraindicacoes: [null],
      // Regulatório
      exigeReceita: [false],
      validadeMeses: [null],
      armazenamento: [null],
      registroMapa: [null],
      // SEO
      slug: [null],
      metaTitle: [null],
      metaDescription: [null],
      ogImageUrl: [null],
      // Preço avançado
      precoCusto: [null],
      precoDe: [null],
      parcelasMax: [null],
      // Mídia extra
      videoUrl: [null],
      // Variantes e documentos (FormArrays dinâmicos)
      variantes: this.fb.array<FormGroup>([]),
      documentos: this.fb.array<FormGroup>([]),
      cardLayout: ['sales' as 'sales'],
      // Demo SaaS: quando false, este produto NÃO entra em carrinho/checkout.
      permiteCheckout: [true],
    });

    if (this.partnerMode) {
      this.form.patchValue({ manipulado: false, formulaId: null });
      this.formulaEnabled = false;
    } else {
      // initialize formula toggle based on any pre-filled form value
      this.formulaEnabled = !!(this.form?.value?.formulaId);
    }
    // sincroniza máscara/ dígitos do preço com o formulário (para edição)
    this.syncPrecoDigitsFromForm();

    // manter a imagem principal atualizada: selecionar automaticamente a primeira imagem quando houver
    this.imagesSub = this.imagesFA.valueChanges.subscribe((vals: string[]) => {
      if (Array.isArray(vals) && vals.length > 0) {
        if (!this.imagemPrincipal || !vals.includes(this.imagemPrincipal)) this.imagemPrincipal = vals[0];
      } else {
        const fromImageCtrl = this.form?.get('image')?.value;
        this.imagemPrincipal =
          typeof fromImageCtrl === 'string' && fromImageCtrl.trim() ? fromImageCtrl.trim() : null;
      }
    });

    const applyTaxonomies = (res: any) => {
      this.categoriasList = (res.categorias || []).map((c: any) => ({ id: c.id, name: c.nome || c.name }));
      this.tagsList = (res.tags || []).map((t: any) => ({ id: t.id, name: t.nome || t.name }));
      this.dosagesList = (res.dosages || []).map((d: any) => ({ id: d.id, name: d.nome || d.name }));
      const rspEmb = (res.embalagens || []).map((e: any, idx: number) => ({
        id: e.id ?? idx + 1,
        name: e.nome || e.name || e
      }));
      if (rspEmb && rspEmb.length > 0) {
        this.embalagensList = rspEmb;
      } else {
        this.embalagensList = EMBALAGENS.map((name, idx) => ({ id: idx + 1, name }));
      }
      this.refreshTaxonomyFiltersAfterLoad();
    };

    // Carregar taxonomias: parceiro = categorias do tenant + tags/doses/embalagens globais de apoio
    if (this.partnerMode) {
      this.parceiroProdutos.taxonomiasWizardParceiro().subscribe({
        next: ({ categorias, support }) => {
          applyTaxonomies({
            categorias,
            tags: support.tags || [],
            dosages: support.dosagens || [],
            embalagens: support.embalagens || [],
          });
        },
        error: () => applyTaxonomies({ categorias: [], tags: [], dosages: [], embalagens: [] }),
      });
    } else {
      this.api.getMarketplaceCustomizacoes().subscribe({
        next: applyTaxonomies,
        error: () => applyTaxonomies({ categorias: [], tags: [], dosages: [], embalagens: [] }),
      });
    }

    if (!this.partnerMode) {
      this.api.getConfigNewProductWithForms().subscribe({
        next: (res) => {
          this.forms = res.forms || [];
          this.units = res.units || [];
        },
        error: () => { this.forms = []; this.units = []; }
      });

      this.api.listFormulas({ page: 1, pageSize: 100 }).subscribe({
        next: (res) => {
          const items = res?.data || [];
          this.formulasSelect = items.map((f) => ({ id: f.id as number, name: f.name }));
          this.formulasAll = items.map((f) => ({
            id: f.id as number,
            name: f.name,
            form_name: (f as any).form_name
          }));
          this.applyFormulaFilter();
        },
        error: () => { this.formulasSelect = []; }
      });

      this.api.listOmniCanais().subscribe({
        next: (r) => this.omniCanais.set(r.data || []),
        error: () => this.omniCanais.set([]),
      });
    } else {
      this.forms = [];
      this.units = [];
      this.formulasSelect = [];
      this.formulasAll = [];
    }

    // editar produto se tiver id na rota (aplicar somente quando não estamos em modo embedded)
    const produtoId = this.route.snapshot.queryParamMap.get('produto_id');
    if (!this.editItem && produtoId) this.loadProduto(produtoId);
    // se editItem foi fornecido via @Input, aplica-o
    if (this.editItem) this.applyEditItem(this.editItem);

    if (this._pendingEditItem) { this.applyEditItem(this._pendingEditItem); this._pendingEditItem = null; }

    // ativo search removido
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['editItem']) {
      const val = changes['editItem'].currentValue;
      if (!val) {
        // se entramos em modo embedded com null -> reset form
        if (this.form) this.resetForm();
        return;
      }
      if (this.form) this.applyEditItem(val);
      else this._pendingEditItem = val;
    }
  }

  private refreshOmniPublicacoes(produtoId: number | string | null | undefined) {
    if (this.partnerMode) return;
    if (produtoId == null || produtoId === '') return;
    this.api.getProdutoOmniPublicacoes(produtoId).subscribe({
      next: (r) => {
        this.omniPublicacoes.set(r.data || []);
        this.omniMigrationsPending.set(!!r.meta?.migrationsPending);
      },
      error: () => {
        this.omniPublicacoes.set([]);
        this.omniMigrationsPending.set(false);
      },
    });
  }

  toggleOmniPick(canalId: string, ev: Event) {
    const checked = (ev.target as HTMLInputElement)?.checked ?? false;
    this.omniPick.update((m) => ({ ...m, [canalId]: checked }));
  }

  omniPubPorCanal(canalId: string): ProdutoOmniPublicacaoDto | undefined {
    return this.omniPublicacoes().find((p) => p.canal === canalId);
  }

  omniStatusLabel(canalId: string): string {
    const row = this.omniPubPorCanal(canalId);
    if (!row) return 'Não publicado';
    const map: Record<string, string> = {
      draft: 'Rascunho',
      queued: 'Na fila',
      syncing: 'Sincronizando',
      live: 'Publicado',
      error: 'Erro',
      disabled: 'Desativado',
    };
    return map[row.status] || row.status;
  }

  selectedOmniCanais(): string[] {
    const m = this.omniPick();
    return Object.keys(m).filter((k) => m[k]);
  }

  syncOmniCanais() {
    const id = this.form?.value?.id;
    if (!id) return;
    const canais = this.selectedOmniCanais();
    if (!canais.length) {
      this.omniMessage.set('Selecione ao menos um canal.');
      return;
    }
    this.omniSyncing.set(true);
    this.omniMessage.set(null);
    this.api.syncProdutoOmniCanais(id, canais).subscribe({
      next: (r) => {
        this.omniSyncing.set(false);
        const errs = (r.results || []).filter((x) => x.ok === false);
        if (errs.length) {
          this.omniMessage.set(errs.map((e) => `${e.canal}: ${e.error || 'falha'}`).join(' · '));
        } else {
          this.omniMessage.set('Sincronização concluída.');
        }
        this.refreshOmniPublicacoes(id);
      },
      error: (err) => {
        this.omniSyncing.set(false);
        const msg = err?.error?.error || err?.message || 'Falha ao sincronizar.';
        this.omniMessage.set(typeof msg === 'string' ? msg : 'Falha ao sincronizar.');
      },
    });
  }

  private applyEditItem(p: any) {
    try {
      const catId = (p as any).categoryId ?? this.categoriasList.find(c => c.name === (p as any).category)?.id ?? null;
      this.form.patchValue({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image ?? null,
        categoryId: catId,
        discount: p.discount ?? null,
        rating: p.rating ?? null,
        stock: p.stock ?? null,
        weightValue: p.weightValue ?? null,
        weightUnit: p.weightUnit ?? 'g',
        formulaId: (p as any).formId ?? (p as any).formula_id ?? null,
        manipulado: !!((p as any).formId || (p as any).formula_id || (p as any).tipo === 'manipulado'),
        active: p.active === 0 || p.active === 1 ? p.active : ((p as any).ativo === 0 || (p as any).ativo === 1 ? (p as any).ativo : 1)
      });
      this.destaqueHome = p.destaque_home === 1 || (p as any).destaque_home === true;
      const pcRaw = (p as any).permite_checkout ?? (p as any).permiteCheckout;
      this.form.patchValue({ permiteCheckout: pcRaw == null ? true : !!Number(pcRaw) });
      this.formulaEnabled = !!(this.form?.get('formulaId')?.value);

      this.tagsFA.clear(); (p.tags || []).forEach((t: any) => this.tagsFA.push(this.fb.control<string>(t)));
      this.dosageFA.clear(); (p.customizations?.dosage || []).forEach((d: any) => this.dosageFA.push(this.fb.control<string>(d)));
      this.packagingFA.clear(); (p.customizations?.packaging || []).forEach((e: any) => this.packagingFA.push(this.fb.control<string>(e)));

      this.imagesFA.clear();
      const imgs: string[] = (p as any).images ?? [];
      const capa = (p.image as string | null) ?? ((p as any).imagem_principal as string | null) ?? (imgs[0] ?? null);
      if (imgs.length) {
        imgs.forEach((u: string) => this.imagesFA.push(this.fb.control<string>(u)));
      } else if (capa) {
        this.imagesFA.push(this.fb.control<string>(capa));
      }
      this.imagemPrincipal = capa;
      try { this.syncPrecoDigitsFromForm(); } catch(e) {}
      if (!this.partnerMode && p?.id) this.refreshOmniPublicacoes(p.id);
      if (this.partnerMode) {
        if ((p as any)?.mostrar_na_loja !== undefined) {
          this.partnerMostrarNaLoja.set(!!(p as any).mostrar_na_loja);
        } else if ((p as any)?.vitrine_ativo !== undefined) {
          this.partnerMostrarNaLoja.set(Number((p as any).vitrine_ativo) === 1);
        }
      }
    } catch (e) { console.error('applyEditItem error', e); }
  }

  private precoDigits = '';

    onPrecoKeydown(event: KeyboardEvent) {
      event.preventDefault();
      const key = event.key;
      // Permitir apenas números, backspace e delete
      if (/^\d$/.test(key)) {
        if (this.precoDigits.length < 9) this.precoDigits += key;
      } else if (key === 'Backspace') {
        this.precoDigits = this.precoDigits.slice(0, -1);
      } else if (key === 'Delete') {
        this.precoDigits = '';
      } else if (key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
        // permitir navegação
        return;
      } else {
        return;
      }
      // Atualiza valor
      let val = this.precoDigits || '0';
      const num = parseInt(val, 10);
      const reais = Math.floor(num / 100);
      const centavos = num % 100;
      this.form.patchValue({ price: num / 100 });
      this.priceMasked = {
        int: reais.toLocaleString('pt-BR'),
        dec: centavos.toString().padStart(2, '0')
      };
    }

    // Inicializa precoDigits e atualiza máscara ao abrir tela ou ao editar produto
    private syncPrecoDigitsFromForm() {
      const price = this.form?.value?.price;
      if (typeof price === 'number' && !isNaN(price)) {
        const num = Math.round(price * 100);
        this.precoDigits = num.toString();
        const reais = Math.floor(num / 100);
        const centavos = num % 100;
        this.priceMasked = {
          int: reais.toLocaleString('pt-BR'),
          dec: centavos.toString().padStart(2, '0')
        };
      } else {
        this.precoDigits = '';
        this.priceMasked = null;
      }
    }
  // Controle de edição do campo de preço
 


  editingPreco = false;


  enablePrecoEdit() {
    if (!this.editingPreco) {
      this.editingPreco = true;
      // Remove foco do input antigo, se houver
      setTimeout(() => {
        const wrapper = document.querySelector('.preco-input-wrapper') as HTMLElement;
        if (wrapper) wrapper.focus();
      }, 10);
    }
  }


  disablePrecoEdit() {
    this.editingPreco = false;
  }

    // Máscara de preço para exibição destacada
  priceMasked: { int: string, dec: string } | null = null;

  onPriceInput(event: any) {
    let val = event.target.value.replace(/\D/g, ''); // só números
    if (!val) val = '0';
    // Limite de 9 dígitos
    if (val.length > 9) val = val.slice(0, 9);
    // Formatar para centavos
    const num = parseInt(val, 10);
    const reais = Math.floor(num / 100);
    const centavos = num % 100;
    // Atualiza o campo do formulário
    this.form.patchValue({ price: num / 100 });
    // Atualiza a máscara para exibição
    this.priceMasked = {
      int: reais.toLocaleString('pt-BR'),
      dec: centavos.toString().padStart(2, '0')
    };
    // Atualiza o valor do input para manter só números
    event.target.value = val;
  }

  ngAfterViewInit() {
    // Inicializa a máscara se já houver valor
    const price = this.form?.value?.price;
    if (typeof price === 'number' && !isNaN(price)) {
      const num = Math.round(price * 100);
      const reais = Math.floor(num / 100);
      const centavos = num % 100;
      this.priceMasked = {
        int: reais.toLocaleString('pt-BR'),
        dec: centavos.toString().padStart(2, '0')
      };
    }
    // Listener para fechar dropdown de categoria ao clicar fora
    document.addEventListener('click', this.onDocumentClick);
    // Evitar que o navegador abra arquivos ao soltar fora da dropzone
    this._docDragOverHandler = (ev: any) => { try { ev.preventDefault(); } catch(e) {} };
    this._docDropHandler = (ev: any) => { try { ev.preventDefault(); } catch(e) {} };
    document.addEventListener('dragover', this._docDragOverHandler);
    document.addEventListener('drop', this._docDropHandler);
  }

  get tagsFA() { return this.form.get('tags') as FormArray; }
  get dosageFA() { return this.form.get(['customizations','dosage']) as FormArray; }
  get packagingFA() { return this.form.get(['customizations','packaging']) as FormArray; }
  get imagesFA() { return this.form.get('images') as FormArray; }
  get variantesFA() { return this.form.get('variantes') as FormArray; }
  get documentosFA() { return this.form.get('documentos') as FormArray; }

  addVariante() {
    this.variantesFA.push(this.fb.group({
      id: [null],
      nome: ['', Validators.required],
      sku: [null],
      preco: [null],
      preco_de: [null],
      estoque: [null],
      peso_g: [null],
      ativo: [true],
    }));
  }
  removeVariante(i: number) { this.variantesFA.removeAt(i); }

  addDocumento() {
    this.documentosFA.push(this.fb.group({
      id: [null],
      nome: ['', Validators.required],
      url: ['', Validators.required],
      tipo: ['outro'],
    }));
  }
  removeDocumento(i: number) { this.documentosFA.removeAt(i); }

  get previewProduct(): ShopProduct {
    const fv = this.form?.value || {};
    const price = Number(fv.price) || 0;
    const promo = this.discountedPriceValue();
    const precoDe = fv.precoDe != null ? Number(fv.precoDe) : null;
    const final = promo != null ? promo : price;
    let strikePrice: number | null = null;
    if (promo != null && promo < price - 0.009) strikePrice = price;
    else if (precoDe != null && precoDe > final + 0.009) strikePrice = precoDe;
    const img = this.imagemPrincipal || (this.imagesFA?.controls?.length ? this.imagesFA.controls[0].value : '/imagens/placeholder.png');
    const discount = (fv.discount && Number(fv.discount) > 0) ? Number(fv.discount) : (promo != null && price > 0 ? Math.round((1 - (promo / price)) * 100) : 0);
    return {
      id: Number(fv.id) || 0,
      name: fv.name || 'Nome do produto',
      description: fv.description || '',
      price: price,
      image: img,
      imageUrl: img,
      category: this.categoryNameById(fv.categoryId) || '',
      tipo: fv.manipulado ? 'manipulado' : 'pronto',
      discount: discount as any,
      rating: fv.rating ?? undefined,
      ratingsCount: undefined,
      stock: fv.stock ?? undefined,
      tags: fv.tags || [],
      weight: fv.weightValue ? `${fv.weightValue}${fv.weightUnit || 'g'}` : undefined,
      promoPrice: promo ?? null,
      inStock: fv.stock ?? null,
      images: (this.imagesFA?.controls || []).map((c: any, i: number) => ({ id: i + 1, url: c.value })),
      cardLayout: 'sales',
      strikePrice,
      marca: fv.marca || null,
      sku: fv.sku || null,
      precoDe: precoDe ?? undefined,
    } as ShopProduct;
  }

  /** Configuração do tema ativo da loja para o preview do card. */
  get previewThemeConfig(): Record<string, unknown> | null {
    return (this.storeMeta?.activeTheme?.config as Record<string, unknown> | undefined) ?? null;
  }

  // helpers for template display
  formulaNameById(id: number | null): string {
    if (!id) return '—';
    const f = this.formulasSelect.find(x => x.id === id);
    return f?.name || '—';
  }
  categoryNameById(id: number | string | null): string {
    if (id == null) return '—';
    const c = this.categoriasList.find(x => x.id === id);
    return c?.name || '—';
  }

  // Promo helpers
  promoLabel(): string {
    const p: any = this.promocaoSelecionada as any;
    if (!p) return '—';
    if (p.ui && p.ui.valor_label) return p.ui.valor_label;
    if (p.tipo === 'percentual') return `${p.valor}%`;
    if (p.tipo === 'valor') return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor) || 0);
    return '—';
  }

  promoStatusLabel(status?: string | null): string {
    if (!status) return '—';
    switch (status) {
      case 'active': return 'Ativa';
      case 'upcoming': return 'Agendada';
      case 'expired': return 'Expirada';
      case 'inactive': return 'Inativa';
      default: return status;
    }
  }

  discountedPriceValue(): number | null {
    const price = Number(this.form?.value?.price);
    if (isNaN(price)) return null;
    const p: any = this.promocaoSelecionada as any;
    if (p) {
      const valor = Number(p.valor);
      if (isNaN(valor)) return null;
      if (p.tipo === 'percentual') return Math.max(0, +((price * (1 - valor / 100))).toFixed(2));
      if (p.tipo === 'valor') return Math.max(0, +((price - valor)).toFixed(2));
      return null;
    }
    // fallback: form-level discount (coupon stored in form.discount)
    const d = this.form?.value?.discount;
    if (d == null || d === '') return null;
    const disc = Number(d);
    if (isNaN(disc)) return null;
    if (disc > 0 && disc <= 100) {
      return Math.max(0, +((price * (1 - disc / 100))).toFixed(2));
    } else {
      return Math.max(0, +((price - disc)).toFixed(2));
    }
  }

  // limpa o valor 0 quando o usuário foca o campo (UX)
  clearWeightIfZero() {
    const v = this.form.get('weightValue')?.value;
    if (v === 0 || v === '0') this.form.patchValue({ weightValue: null });
  }

  setWeightUnit(unit: string) {
    if (!this.form) return;
    this.form.get('weightUnit')?.setValue(unit);
  }

  // normaliza o valor de weightValue para número ou null (não retornar 0)
  private parseWeightValue(v: any): number | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const num = Number(trimmed.replace(',', '.'));
      if (isNaN(num)) return null;
      return num === 0 ? null : num;
    }
    if (typeof v === 'number') return v === 0 ? null : v;
    return null;
  }

  // footer next button label
  nextLabel(): string {
    return 'Avançar';
  }

  togglePartnerMostrarNaLoja(): void {
    this.partnerMostrarNaLoja.update((v) => !v);
  }

  // Removido: loadTaxonomy. Agora tudo vem de getMarketplaceCustomizacoes().

  private loadProduto(id: string | number) {
    this.loading.set(true);
    const obs$ = this.partnerMode ? this.parceiroProdutos.getFull(id) : this.api.getProduto(id);
    obs$.subscribe({
      next: (p) => {
        // categoriaId: preferir id retornado pelo backend quando disponível, senão tentar mapear por nome
        const catId = (p as any).categoryId ?? this.categoriasList.find(c => c.name === (p as any).category)?.id ?? null;
        const atv =
          p.active === 0 || p.active === 1
            ? p.active
            : (p as any).ativo === 0 || (p as any).ativo === 1
              ? (p as any).ativo
              : 1;
        this.form.patchValue({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          image: p.image ?? null,
          categoryId: catId,
          active: atv,
          discount: p.discount ?? null,
          rating: p.rating ?? null,
          stock: p.stock ?? null,
          weightValue: p.weightValue ?? null,
          weightUnit: p.weightUnit ?? 'g',
          formulaId: (p as any).formId ?? (p as any).formula_id ?? null,
          manipulado: !!((p as any).formId || (p as any).formula_id || (p as any).tipo === 'manipulado'),
          // Identificação expandida
          sku: (p as any).sku ?? null,
          marca: (p as any).marca ?? null,
          codigoBarras: (p as any).codigo_barras ?? null,
          // Técnico
          composicao: (p as any).composicao ?? null,
          modoUso: (p as any).modo_uso ?? null,
          indicacoes: (p as any).indicacoes ?? null,
          contraindicacoes: (p as any).contraindicacoes ?? null,
          // Regulatório
          exigeReceita: !!((p as any).exige_receita),
          validadeMeses: (p as any).validade_meses ?? null,
          armazenamento: (p as any).armazenamento ?? null,
          registroMapa: (p as any).registro_mapa ?? null,
          // SEO
          slug: (p as any).slug ?? null,
          metaTitle: (p as any).meta_title ?? null,
          metaDescription: (p as any).meta_description ?? null,
          ogImageUrl: (p as any).og_image_url ?? null,
          // Preço avançado
          precoCusto: (p as any).preco_custo ?? null,
          precoDe: (p as any).preco_de ?? null,
          parcelasMax: (p as any).parcelas_max ?? null,
          // Mídia extra
          videoUrl: (p as any).video_url ?? null,
          cardLayout: 'sales' as 'sales',
        });
        this.destaqueHome = p.destaque_home === 1 || (p as any).destaque_home === true;
        this.formulaEnabled = !!(this.form.get('formulaId')?.value);

        // Populate variantes e documentos (se presentes no GET)
        try {
          this.variantesFA.clear();
          const vs: any[] = (p as any).variantes || [];
          vs.forEach(v => this.variantesFA.push(this.fb.group({
            id: [v.id ?? null],
            nome: [v.nome ?? '', Validators.required],
            sku: [v.sku ?? null],
            preco: [v.preco ?? null],
            preco_de: [v.preco_de ?? null],
            estoque: [v.estoque ?? null],
            peso_g: [v.peso_g ?? null],
            ativo: [v.ativo !== false],
          })));
          this.documentosFA.clear();
          const docs: any[] = (p as any).documentos || [];
          docs.forEach(d => this.documentosFA.push(this.fb.group({
            id: [d.id ?? null],
            nome: [d.nome ?? '', Validators.required],
            url: [d.url ?? '', Validators.required],
            tipo: [d.tipo ?? 'outro'],
          })));
        } catch (_) { /* noop */ }

        // tags, dosages, packaging
        this.tagsFA.clear(); (p.tags || []).forEach((t: any) => this.tagsFA.push(this.fb.control<string>(t)));
        this.dosageFA.clear(); (p.customizations?.dosage || []).forEach((d: any) => this.dosageFA.push(this.fb.control<string>(d)));
        this.packagingFA.clear(); (p.customizations?.packaging || []).forEach((e: any) => this.packagingFA.push(this.fb.control<string>(e)));

        // imagens: popular FormArray e imagem principal (capa sozinha conta como mídia válida)
        try {
          this.imagesFA.clear();
          const imgs = (p as any).images ?? [];
          const capa = (p.image as string | null) ?? ((p as any).imagem_principal as string | null) ?? (imgs.length ? imgs[0] : null);
          if (imgs.length) {
            imgs.forEach((u: string) => this.imagesFA.push(this.fb.control<string>(u)));
          } else if (capa) {
            this.imagesFA.push(this.fb.control<string>(capa));
          }
          this.imagemPrincipal = capa ?? (imgs.length ? imgs[0] : null);
        } catch(e) { console.error('Erro ao popular imagens do produto', e); }

        // Pré-selecionar promoção ativa já vinculada ao produto (quando o
        // backend retorna `promotions` no payload do GET).
        try {
          const prs: any[] = (p as any).promotions || [];
          if (Array.isArray(prs) && prs.length) {
            this.promocaoSelecionada = prs[0] as PromocaoDto;
          } else {
            this.promocaoSelecionada = null;
          }
        } catch (_) { this.promocaoSelecionada = null; }

        // garantir que máscara/dígitos do preço reflitam o valor carregado
        try { this.syncPrecoDigitsFromForm(); } catch(e) { /* noop */ }

        if (this.partnerMode) {
          if ((p as any)?.mostrar_na_loja !== undefined) {
            this.partnerMostrarNaLoja.set(!!(p as any).mostrar_na_loja);
          } else if ((p as any)?.vitrine_ativo !== undefined) {
            this.partnerMostrarNaLoja.set(Number((p as any).vitrine_ativo) === 1);
          }
        }

        this.loading.set(false);
        if (!this.partnerMode) this.refreshOmniPublicacoes(p.id);
      },
      error: (err) => { console.error(err); this.loading.set(false); }
    });
  }

  // stepper helpers
  goToStep(i: number) {
    if (i < 0 || i >= this.steps.length) return;
    // only allow jumping forward if previous steps are valid
    for (let s = 0; s < i; s++) {
      if (!this.isStepValid(s)) { this.markStepTouched(s); return; }
    }
    this.closeAllModals();
    this.step.set(i);
  }
  nextStep() {
    const i = this.step();
    if (!this.isStepValid(i)) { this.markStepTouched(i); return; }
    if (i < this.steps.length - 1) {
      this.closeAllModals();
      this.step.set(i + 1);
    }
  }
  prevStep() {
    const i = this.step();
    if (i > 0) {
      this.closeAllModals();
      this.step.set(i - 1);
    }
  }
  isStepValid(i: number): boolean {
    switch (i) {
      case 0: { // Mídia
        const imgs = this.form.get('images') as FormArray;
        if (imgs && imgs.length > 0) return true;
        const capa = this.imagemPrincipal || (this.form.get('image')?.value as string | null);
        return typeof capa === 'string' && !!capa.trim();
      }
      case 1: { // Identificação
        const name = this.form.get('name');
        const desc = this.form.get('description');
        const cat = this.form.get('categoryId');
        return !!name && !!desc && !!cat && name.valid && desc.valid && cat.valid;
      }
      case 2: { // Comercial
        const price = this.form.get('price');
        return !!price && price.valid;
      }
      case 3: { // Técnico — opcional, sempre válido
        return true;
      }
      case 4: { // Regulatório — opcional, sempre válido
        return true;
      }
      case 5: { // Variantes — se existirem, cada linha precisa de nome
        const arr = this.variantesFA;
        for (let k = 0; k < arr.length; k++) {
          if (!arr.at(k)?.get('nome')?.valid) return false;
        }
        return true;
      }
      case 6: { // SEO — opcional, sempre válido
        return true;
      }
      default:
        return true;
    }
  }
  markStepTouched(i: number) {
    const mark = (path: string) => this.form.get(path)?.markAsTouched();
    switch (i) {
      case 0: mark('image'); break;
      case 1: mark('formulaId'); mark('name'); mark('description'); mark('categoryId'); break;
      case 2: mark('price'); break;
      case 5: this.variantesFA.controls.forEach(c => c.markAllAsTouched()); break;
    }
  }

  // Utility: close any open modals/overlays created by this component
  private closeAllModals() {
    // hide template-driven modals
    this.showTagModal = false;
    this.showCategoryModal = false;
    this.showPackagingModal = false;
    this.showDosageModal = false;
    this.showPromoModal = false;
    this.showPromoDetail = false;

    // clear suggestion lists (close autocompletes)
    this.tagsFiltered = [];
    this.categoriesFiltered = [];
    this.packagingFiltered = [];

  }


  // Mantém compatibilidade, mas não usada mais
  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    const { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } = this;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.imageMessage.set('Formato inválido. Use JPG, PNG ou WEBP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.imageMessage.set('Arquivo maior que 3MB.');
      event.target.value = '';
      return;
    }
    const remaining = this.MAX_IMAGES - this.imagesFA.length;
    if (remaining <= 0) {
      this.imageMessage.set('Limite de 3 imagens atingido.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.imagesFA.push(this.fb.control<string>(e.target.result));
      this.imageMessage.set(null);
      try { this.cdr.detectChanges(); } catch(e) { /* noop */ }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  onImagesSelected(event: any) {
    const files: FileList | undefined = event.target.files;
    if (!files || files.length === 0) return;
    const beforeLen = this.imagesFA.length;
    const maxToAdd = this.MAX_IMAGES - beforeLen;
    if (maxToAdd <= 0) {
      this.imageMessage.set('Limite de 3 imagens atingido.');
      event.target.value = '';
      return;
    }
    const arr = Array.from(files);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of arr) {
      if (accepted.length >= maxToAdd) break;
      if (!this.ALLOWED_IMAGE_TYPES.includes(f.type)) { rejected.push(`${f.name}: formato inválido`); continue; }
      if (f.size > this.MAX_FILE_SIZE) { rejected.push(`${f.name}: maior que 3MB`); continue; }
      accepted.push(f);
    }
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e: any) => this.imagesFA.push(this.fb.control<string>(e.target.result));
      reader.readAsDataURL(file);
    });
    const msgs: string[] = [];
    if (accepted.length > 0) msgs.push(`${accepted.length} imagem(ns) adicionada(s).`);
    if (rejected.length > 0) msgs.push(`Arquivos rejeitados: ${rejected.join(', ')}`);
    if (beforeLen + accepted.length >= this.MAX_IMAGES) msgs.push('Limite de 3 imagens atingido.');
    this.imageMessage.set(msgs.length ? msgs.join(' ') : null);
    event.target.value = '';
  }
  onDragEnter(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); this.isDragOver = true;
  }
  onDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation(); }
  onDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.isDragOver = false; }
  onDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); this.isDragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length) {
      // reuse existing file handler
      this.onImagesSelected({ target: { files } } as any);
    }
  }
  removeImageAt(i: number) { if (i>=0) this.imagesFA.removeAt(i); }
  moveImage(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= this.imagesFA.length) return;
    const current = this.imagesFA.at(i).value;
    const other = this.imagesFA.at(target).value;
    this.imagesFA.at(i).setValue(other);
    this.imagesFA.at(target).setValue(current);
  }

  // tags/dosagens/embalagens
  addTag(tag: string) { if (!tag) return; this.tagsFA.push(this.fb.control<string>(tag)); }
  removeTagAt(i: number) { this.tagsFA.removeAt(i); }
  addDosage(val: string) { if (!val) return; this.dosageFA.push(this.fb.control<string>(val)); this.showDosageModal = false; }
  removeDosageAt(i: number) { this.dosageFA.removeAt(i); }
  addPackaging(val: string) { if (!val) return; this.packagingFA.push(this.fb.control<string>(val)); }
  removePackagingAt(i: number) { this.packagingFA.removeAt(i); }

  // removed inline '+' handlers that opened taxonomy modals

  // toggles for selection chips
  toggleTagVal(name: string) {
    const idx = (this.tagsFA.value as any[]).findIndex((v: any) => v === name);
    if (idx > -1) this.removeTagAt(idx); else this.addTag(name);
  }
  toggleDosageVal(name: string) {
    const idx = (this.dosageFA.value as any[]).findIndex((v: any) => v === name);
    if (idx > -1) this.removeDosageAt(idx); else this.addDosage(name);
  }
  togglePackagingVal(name: string) {
    const idx = (this.packagingFA.value as any[]).findIndex((v: any) => v === name);
    if (idx > -1) this.removePackagingAt(idx); else this.addPackaging(name);
  }

  /** Reaplica filtros quando a API de customizações termina depois do usuário já interagir com o campo. */
  private refreshTaxonomyFiltersAfterLoad() {
    if (typeof document === 'undefined') return;
    const ae = document.activeElement as HTMLElement | null;
    const qCat = (this.categoryQuery() || '').trim();
    const qTag = (this.tagQuery() || '').trim();
    const qPack = (this.packagingQuery() || '').trim();
    if (qCat || ae?.id === 'categoryInput') this.applyCategoryFilter();
    if (qTag || ae?.id === 'tagInput') this.applyTagFilter();
    if (qPack || ae?.id === 'packInput') this.applyPackagingFilter();
  }

  onFormulaFieldFocus() {
    if (this.form?.get('formulaId')?.value) return;
    this.applyFormulaFilter();
  }

  // Autocomplete helpers for Categoria
  onCategoryQueryInput(q: string) {
    this.categoryQuery.set(q || '');
    this.applyCategoryFilter();
  }
  applyCategoryFilter() {
    const q = (this.categoryQuery() || '').toLowerCase();
    if (!q) {
      this.categoriesFiltered = this.categoriasList.slice(0, 50);
      this.selectedCategoryIndex = this.categoriesFiltered.length ? 0 : -1;
      return;
    }
    this.categoriesFiltered = this.categoriasList.filter(c => (c.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.selectedCategoryIndex = this.categoriesFiltered.length ? 0 : -1;
  }
  onCategoryKeydown(event: KeyboardEvent) {
    const len = (this.categoriesFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedCategoryIndex = -1; }
      else { this.selectedCategoryIndex = this.selectedCategoryIndex < len - 1 ? this.selectedCategoryIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedCategoryIndex = -1; }
      else { this.selectedCategoryIndex = this.selectedCategoryIndex === -1 ? len - 1 : (this.selectedCategoryIndex > 0 ? this.selectedCategoryIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedCategoryIndex === -1) this.selectCategoryById(null);
      else {
        const c = this.categoriesFiltered[this.selectedCategoryIndex];
        if (c) this.selectCategoryById(c.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      this.categoryQuery.set(''); this.categoriesFiltered = []; this.selectedCategoryIndex = -1;
      return;
    }
  }
  setCategoryIndex(i: number) { this.selectedCategoryIndex = i; }
  selectCategoryById(id: number | string | null) {
    this.form.patchValue({ categoryId: id });
    this.categoryQuery.set('');
    this.categoriesFiltered = [];
    this.selectedCategoryIndex = -1;
  }

  selectCategoryModal(id: number | string | null) {
    this.form.patchValue({ categoryId: id });
    this.categoryQuery.set('');
    this.categoriesFiltered = [];
    this.selectedCategoryIndex = -1;
  }

  // Autocomplete helpers for Tags (multi)
  onTagQueryInput(q: string) {
    this.tagQuery.set(q || '');
    this.applyTagFilter();
  }
  applyTagFilter() {
    const q = (this.tagQuery() || '').toLowerCase();
    if (!q) { this.tagsFiltered = this.tagsList.slice(0, 50); this.selectedTagIndex = this.tagsFiltered.length ? 0 : -1; return; }
    this.tagsFiltered = this.tagsList.filter(t => (t.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.selectedTagIndex = this.tagsFiltered.length ? 0 : -1;
  }
  onTagKeydown(event: KeyboardEvent) {
    const len = (this.tagsFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedTagIndex = -1; }
      else { this.selectedTagIndex = this.selectedTagIndex < len - 1 ? this.selectedTagIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedTagIndex = -1; }
      else { this.selectedTagIndex = this.selectedTagIndex === -1 ? len - 1 : (this.selectedTagIndex > 0 ? this.selectedTagIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedTagIndex >= 0) {
        const t = this.tagsFiltered[this.selectedTagIndex]; if (t) this.pickTag(t.name);
      }
      return;
    }
    if (event.key === 'Escape') { this.tagQuery.set(''); this.tagsFiltered = []; this.selectedTagIndex = -1; return; }
  }
  setTagIndex(i: number) { this.selectedTagIndex = i; }
  pickTag(name: string) { const idx = (this.tagsFA.value as any[]).findIndex(v => v === name); if (idx > -1) this.removeTagAt(idx); else this.addTag(name); this.tagQuery.set(''); this.tagsFiltered = []; this.selectedTagIndex = -1; }

  // Autocomplete helpers for Packaging (multi)
  onPackagingQueryInput(q: string) { this.packagingQuery.set(q || ''); this.applyPackagingFilter(); }
  applyPackagingFilter() {
    const q = (this.packagingQuery() || '').toLowerCase();
    if (!q) { this.packagingFiltered = this.embalagensList.slice(0, 50); this.selectedPackagingIndex = this.packagingFiltered.length ? 0 : -1; return; }
    this.packagingFiltered = this.embalagensList.filter(p => (p.name || '').toLowerCase().includes(q)).slice(0, 50);
    this.selectedPackagingIndex = this.packagingFiltered.length ? 0 : -1;
  }
  onPackagingKeydown(event: KeyboardEvent) {
    const len = (this.packagingFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedPackagingIndex = -1; }
      else { this.selectedPackagingIndex = this.selectedPackagingIndex < len - 1 ? this.selectedPackagingIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedPackagingIndex = -1; }
      else { this.selectedPackagingIndex = this.selectedPackagingIndex === -1 ? len - 1 : (this.selectedPackagingIndex > 0 ? this.selectedPackagingIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedPackagingIndex >= 0) {
        const p = this.packagingFiltered[this.selectedPackagingIndex]; if (p) this.pickPackaging(p.name);
      }
      return;
    }
    if (event.key === 'Escape') { this.packagingQuery.set(''); this.packagingFiltered = []; this.selectedPackagingIndex = -1; return; }
  }
  setPackagingIndex(i: number) { this.selectedPackagingIndex = i; }
  pickPackaging(name: string) { const idx = (this.packagingFA.value as any[]).findIndex(v => v === name); if (idx > -1) this.removePackagingAt(idx); else this.addPackaging(name); this.packagingQuery.set(''); this.packagingFiltered = []; this.selectedPackagingIndex = -1; }

  onPackagingSelectChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const selected = Array.from(select.selectedOptions).map(o => o.value);
    // If user chose 'Outro', open modal for free-text and remove the marker
    if (selected.includes('__outro')) {
      const filtered = selected.filter(v => v !== '__outro');
      this.packagingFA.clear();
      filtered.forEach(val => { if (val) this.packagingFA.push(this.fb.control<string>(val)); });
      this.showPackagingModal = true;
      // Deselect the '__outro' option to avoid stuck selection
      setTimeout(() => { const opt = Array.from(select.options).find(o => o.value === '__outro'); if (opt) (opt as HTMLOptionElement).selected = false; }, 10);
      return;
    }
    this.packagingFA.clear();
    selected.forEach(val => { if (val) this.packagingFA.push(this.fb.control<string>(val)); });
  }

  editarProdutoExistente(p: ProdutoDto) {
    this.router.navigate(['/restrito/produto'], { queryParams: { produto_id: p.id } });
  }

  // helpers para template
  hasTag(name: string) { return this.tagsFA.controls.some(c => c.value === name); }

  // Fecha dropdown ao clicar fora
  // (Removido: duplicidade de ngAfterViewInit)

  ngOnDestroy() {
    try { document.removeEventListener('click', this.onDocumentClick); } catch(e) {}
    try { if (this._docDragOverHandler) document.removeEventListener('dragover', this._docDragOverHandler); } catch(e) {}
    try { if (this._docDropHandler) document.removeEventListener('drop', this._docDropHandler); } catch(e) {}
    if (this.imagesSub) { this.imagesSub.unsubscribe(); this.imagesSub = null; }
  }

  openPreviewPage() {
    try {
      const data = this.previewProduct;
      if (typeof window !== 'undefined' && window && window.localStorage) {
        window.localStorage.setItem('admin:product_preview', JSON.stringify(data));
        window.open('/restrito/admin/produto-preview', '_blank');
      } else {
        this.router.navigate(['/restrito/admin/produto-preview']);
      }
    } catch (err) {
      console.error('openPreviewPage error', err);
      try { this.router.navigate(['/restrito/admin/produto-preview']); } catch(e) { /* noop */ }
    }
  }

  handleClickOutsideDropdown(event: MouseEvent) {
    const el = event.target as HTMLElement | null;
    if (el && el.closest && el.closest('.menu')) return;
    const dropdown = document.querySelector('.custom-dropdown');
    if (dropdown && !dropdown.contains(event.target as Node)) {
      this.showCategoryDropdown = false;
    }
    // Fechar autocompletes ao clicar fora
    if (!(el && (el.closest('.formula-search-group') || el.closest('.sugestao-list')))) {
      this.categoriesFiltered = [];
      this.tagsFiltered = [];
      this.packagingFiltered = [];
      this.formulasFiltered = [];
      this.selectedFormulaIndex = -1;
    }
  }
  hasDosage(name: string) { return this.dosageFA.controls.some(c => c.value === name); }
  hasPackaging(name: string) { return this.packagingFA.controls.some(c => c.value === name); }

  reativarProdutoExistente(p: ProdutoDto) {
    // Placeholder: depende do backend ter campo status/active; por ora, navegar para edição
    this.editarProdutoExistente(p);
  }

  // Fórmula: seleção e derivação de estoques a partir dos ativos da fórmula
  onFormulaChange(formulaId: number | null) {
    // Define manipulado conforme presença de fórmula
    this.form.patchValue({ manipulado: !!formulaId });
    this.estoqueSelecionado = null; this.form.patchValue({ estoqueId: null, ativoId: null });
    this.estoqueLotes = [];
    if (!formulaId) return;
    // Backend fornece lotes e faltas diretamente, dado formula_id
    this.api.getFormulaAvailability(formulaId).subscribe({
      next: (res: FormulaAvailabilityResponse) => {
        // Guardar itens e lots por ativo
        this.formulaStatus.items = res.items || [];
        this.formulaStatus.missing = res.missing || [];
        this.formulaStatus.lotsByAtivo = res.lots || {};
        // Flaten todos os lotes para a seleção simples
        const flat: EstoqueAtivoDto[] = [];
        Object.values(this.formulaStatus.lotsByAtivo).forEach(arr => flat.push(...(arr || [])));
        this.estoqueLotes = flat;
      },
      error: () => { this.estoqueLotes = []; this.formulaStatus.missing = []; this.formulaStatus.items = []; this.formulaStatus.lotsByAtivo = {}; }
    });
  }

  onFormulaQueryInput(q: string) {
    this.formulaQuery.set(q || '');
    this.applyFormulaFilter();
  }
  applyFormulaFilter() {
    const q = (this.formulaQuery() || '').toLowerCase();
    if (!q) {
      this.formulasFiltered = this.formulasAll.slice(0, 50);
      this.selectedFormulaIndex = this.formulasFiltered.length > 0 ? 0 : -1;
      return;
    }
    this.formulasFiltered = this.formulasAll.filter(ff => ((ff.name + ' ' + (ff.form_name || '')).toLowerCase().includes(q))).slice(0, 50);
    this.selectedFormulaIndex = this.formulasFiltered.length > 0 ? 0 : -1;
  }

  toggleFormulaEnabled() {
    this.formulaEnabled = !this.formulaEnabled;
    if (!this.formulaEnabled) {
      this.selectFormula(null);
    } else {
      setTimeout(() => {
        const el = document.getElementById('formulaInput') as HTMLInputElement | null;
        el?.focus();
      }, 10);
    }
  }

  setFormulaIndex(i: number) { this.selectedFormulaIndex = i; }

  selectFormula(id: number | null) {
    this.form.patchValue({ formulaId: id });
    this.onFormulaChange(id);
    this.formulaQuery.set('');
    this.formulasFiltered = [];
    this.selectedFormulaIndex = -1;
  }

  onFormulaKeydown(event: KeyboardEvent) {
    const len = (this.formulasFiltered?.length || 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (len === 0) { this.selectedFormulaIndex = -1; }
      else { this.selectedFormulaIndex = this.selectedFormulaIndex < len - 1 ? this.selectedFormulaIndex + 1 : -1; }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (len === 0) { this.selectedFormulaIndex = -1; }
      else { this.selectedFormulaIndex = this.selectedFormulaIndex === -1 ? len - 1 : (this.selectedFormulaIndex > 0 ? this.selectedFormulaIndex - 1 : -1); }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedFormulaIndex === -1) this.selectFormula(null);
      else {
        const f = this.formulasFiltered[this.selectedFormulaIndex];
        if (f) this.selectFormula(f.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      this.formulaQuery.set(''); this.formulasFiltered = []; this.selectedFormulaIndex = -1;
      return;
    }
  }
  missingLabel(): string {
    const arr = this.formulaStatus?.missing || [];
    if (!arr.length) return '';
    return arr.map(m => m.ativo_nome || ('#' + m.ativo_id)).join(', ');
  }
  selecionarLote(lote: EstoqueAtivoDto) {
    this.estoqueSelecionado = lote;
    this.form.patchValue({ estoqueId: lote.id });
  }
  openPromoModal() {
    try {
      // Carrega promoções (se necessário) e abre o modal do template
      if (!this.promocoes || this.promocoes.length === 0) {
        this.loadingPromos = true;
        this.api.listPromocoes({ active: 1, page: 1, pageSize: 50 }).subscribe({
          next: (res) => { this.promocoes = res.data || []; this.loadingPromos = false; try { this.cdr.detectChanges(); } catch (e) { /* noop */ } },
          error: () => { this.promocoes = []; this.loadingPromos = false; try { this.cdr.detectChanges(); } catch (e) { /* noop */ } }
        });
      }
      this.zone.run(() => {
        this.showPromoModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openPromoModal error', err);
    }
  }

  openCategoryModal(event?: Event) {
    try {
      try { this.removeStrayOverlays(); } catch(e) { /* noop */ }
      console.log('openCategoryModal called', event);
      event?.stopPropagation();
      this.zone.run(() => {
        this.showCategoryModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openCategoryModal error', err);
    }
  }

  openTagModal(event?: Event) {
    try {
      try { this.removeStrayOverlays(); } catch(e) { /* noop */ }
      console.log('openTagModal called', event);
      event?.stopPropagation();
      this.zone.run(() => {
        this.showTagModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openTagModal error', err);
    }
  }

  openPackagingModal(event?: Event) {
    try {
      try { this.removeStrayOverlays(); } catch(e) { /* noop */ }
      console.log('openPackagingModal called', event);
      event?.stopPropagation();
      this.zone.run(() => {
        this.showPackagingModal = true;
        try { this.cdr.detectChanges(); } catch (e) { /* noop */ }
      });
    } catch (err) {
      console.error('openPackagingModal error', err);
    }
  }

  // (legacy) - no-op mantido para compatibilidade caso algum template referencie
  private removeStrayOverlays() { /* overlays dinâmicos removidos do fluxo */ }

  selectPackagingModal(item: any) {
    try {
      const name = item?.name || item;
      // use existing pickPackaging logic to toggle and clear filters
      this.pickPackaging(name);
      this.zone.run(() => {
        try { this.cdr.detectChanges(); } catch(e) { /* noop */ }
      });
    } catch (e) { console.error('selectPackagingModal error', e); }
  }

  selectTagModal(item: any) {
    try {
      const name = item?.name || item;
      this.pickTag(name);
      this.zone.run(() => { try { this.cdr.detectChanges(); } catch(e) { /* noop */ } });
    } catch (e) { console.error('selectTagModal error', e); }
  }

  // When a promo is selected from modal/list, set it on component and close modal
  pickPromo(p: PromocaoDto | null) {
    this.promocaoSelecionada = p;
    this.showPromoModal = false;
  }

  openPromoDetail(promoId?: number | string) {
    if (promoId == null) return;
    const id = Number(promoId);
    if (isNaN(id)) return;
    this.api.getPromocao(id).subscribe({
      next: (res) => { this.promoDetalhe = res; this.showPromoDetail = true; },
      error: () => { this.promoDetalhe = null; this.showPromoDetail = false; }
    });
  }
  // removido: carregamento de ativos públicos (agora vem via config-new-product)

  // categorias: criar/editar dentro da página
  createTaxonomia(tipo: TaxonomyType, name: string) {
    if (!name) return;
    this.api.createTaxonomia(tipo, name).subscribe({
      next: (res) => {
        // Atualização local da lista para refletir imediatamente a nova taxonomia
        if (tipo === 'categorias') {
          const r: any = res;
          const newCat = { id: r.id, name: (r.nome || r.name || name) };
          this.categoriasList = [newCat, ...this.categoriasList];
          this.form.patchValue({ categoryId: r.id });
          this.showCategoryModal = false;
        }
      }
    });
  }
  // Filtered promos for the template modal (uses promoSearchQuery)
  get promocoesFiltradas(): PromocaoDto[] {
    const q = (this.promoSearchQuery || '').toLowerCase().trim();
    if (!q) return this.promocoes || [];
    return (this.promocoes || []).filter(p => (p.nome || '').toLowerCase().includes(q) || (p.descricao || '').toLowerCase().includes(q));
  }

  updateTaxonomia(tipo: TaxonomyType, item: { id: number|string; name: string }, newName: string) {
    if (!newName) return;
    this.api.updateTaxonomia(tipo, item.id, newName).subscribe();
  }
  deleteTaxonomia(tipo: TaxonomyType, item: { id: number|string; name: string }) {
    this.api.deleteTaxonomia(tipo, item.id).subscribe();
  }

  // Mantém apenas a versão correta do resetForm
  // Atualizar resetForm para novo campo manipulado
  resetForm() {
    this.form.reset({ manipulado: false, active: 1, price: 0, weightValue: null, weightUnit: 'g', permiteCheckout: true });
    this.tagsFA.clear();
    this.dosageFA.clear();
    this.packagingFA.clear();
    this.imagesFA.clear();
    this.estoqueSelecionado = null;
    this.destaqueHome = false;
    this.imagemPrincipal = null;
    this.formulaEnabled = false;
    if (this.partnerMode) this.partnerMostrarNaLoja.set(true);
  }

  fixRating(event: any) {
    const v = parseFloat(event.target.value);
    const bounded = isNaN(v) ? null : Math.max(0, Math.min(5, v));
    this.form.patchValue({ rating: bounded });
  }

  submit() {
    // require all required steps valid before submit (check all except last review step)
    for (let s = 0; s < this.steps.length - 1; s++) {
      if (!this.isStepValid(s)) { this.markStepTouched(s); this.error.set('Preencha os campos obrigatórios.'); return; }
    }
    this.error.set(null);
    this.saving.set(true);
    const fv: any = this.form?.value || {};
    // map tags names -> ids
    const tagNameToId = new Map(this.tagsList.map(t => [t.name, t.id] as [string, number | string]));
    const tag_ids = (this.tagsFA.value as string[] || [])
      .map(n => tagNameToId.get(n))
      .filter((v): v is number | string => v != null);
    const categoria_ids = fv.categoryId ? [fv.categoryId] : [];
    // imagens com posição: primeira do array é capa (posicao 0); se houver 'image' single, insere como capa antes da galeria
    const gallery: string[] = (this.imagesFA?.value || []) as string[];
    const imagens: Array<{ data: string; posicao: number }> = [];
    const cover = fv.image as string | null;
    let pos = 0;
    if (cover) { imagens.push({ data: cover as string, posicao: pos++ }); }
    gallery.forEach(img => { if (typeof img === 'string') imagens.push({ data: img, posicao: pos++ }); });

    const tipo: 'pronto' | 'manipulado' = this.partnerMode ? 'pronto' : (fv.manipulado ? 'manipulado' : 'pronto');
    const parsedWeight = this.parseWeightValue(fv.weightValue);
    const variantes = (this.variantesFA.value || []).map((v: any, idx: number) => ({
      id: v.id ?? undefined,
      nome: v.nome,
      sku: v.sku ?? null,
      preco: v.preco != null ? Number(v.preco) : null,
      preco_de: v.preco_de != null ? Number(v.preco_de) : null,
      estoque: v.estoque != null ? Number(v.estoque) : null,
      peso_g: v.peso_g != null ? Number(v.peso_g) : null,
      ativo: v.ativo ? 1 : 0,
      posicao: idx,
    }));
    const documentos = (this.documentosFA.value || []).map((d: any, idx: number) => ({
      id: d.id ?? undefined,
      nome: d.nome,
      url: d.url,
      tipo: d.tipo ?? 'outro',
      posicao: idx,
    }));

    const body: any = {
      nome: fv.name,
      descricao: fv.description,
      preco: fv.price,
      tipo,
      ativo: fv.active ?? 1,
      destaque_home: this.partnerMode ? 0 : (this.destaqueHome ? 1 : 0),
      // Demo SaaS: 0 = sem checkout (vitrine institucional), 1 = produto vendável.
      permite_checkout: fv.permiteCheckout === false ? 0 : 1,
      imagem_principal: this.imagemPrincipal,
      categoria_ids,
      tag_ids,
      imagens,
      customizations: {
        dosage: this.dosageFA.value ?? [],
        packaging: this.packagingFA.value ?? []
      },
      stock: fv.stock ?? null,
      weightValue: parsedWeight,
      weightUnit: fv.weightUnit ?? null,
      // discount / rating / estoque_id: não persistidos pelo marketplace full (promoções, avaliacoes_produto, lote).
      // Identificação expandida
      sku: fv.sku ?? null,
      marca: fv.marca ?? null,
      codigo_barras: fv.codigoBarras ?? null,
      // Técnico
      composicao: fv.composicao ?? null,
      modo_uso: fv.modoUso ?? null,
      indicacoes: fv.indicacoes ?? null,
      contraindicacoes: fv.contraindicacoes ?? null,
      // Regulatório
      exige_receita: fv.exigeReceita ? 1 : 0,
      validade_meses: fv.validadeMeses != null ? Number(fv.validadeMeses) : null,
      armazenamento: fv.armazenamento ?? null,
      registro_mapa: fv.registroMapa ?? null,
      // SEO
      slug: fv.slug ?? null,
      meta_title: fv.metaTitle ?? null,
      meta_description: fv.metaDescription ?? null,
      og_image_url: fv.ogImageUrl ?? null,
      // Preço avançado
      preco_custo: fv.precoCusto != null ? Number(fv.precoCusto) : null,
      preco_de: fv.precoDe != null ? Number(fv.precoDe) : null,
      parcelas_max: fv.parcelasMax != null ? Number(fv.parcelasMax) : null,
      // Mídia extra
      video_url: fv.videoUrl ?? null,
      // Coleções
      variantes,
      documentos,
      card_layout: 'sales',
    };
    if (!this.partnerMode && tipo === 'manipulado') body.formula_id = fv.formulaId;
    if (this.partnerMode) body.mostrar_na_loja = this.partnerMostrarNaLoja();
    // Payload unificado em português para criação e edição (mesmo shape).
    const legacyId = fv.id;
    let req$: any;
    if (this.partnerMode) {
      if (legacyId) {
        req$ = this.parceiroProdutos.updateFull(legacyId, body);
      } else {
        req$ = this.parceiroProdutos.createFull(body);
      }
    } else if (legacyId) {
      console.debug('update produto payload (full):', body);
      req$ = this.api.updateMarketplaceProdutoFull(legacyId, body);
    } else {
      console.debug('create produto payload:', body);
      req$ = this.api.createMarketplaceProdutoFull(body);
    }
    req$.subscribe({
      next: (res: any) => {
        const newId = res?.id || legacyId;
        const hydrated = typeof res?.id !== 'undefined' ? this.api.normalizeMarketplaceProdutoPayload(res) : null;
        const promoId = this.promocaoSelecionada?.id;
        if (!this.partnerMode && newId && promoId) {
          this.api.setPromocaoProdutos(promoId, [Number(newId)]).subscribe({
            next: () => {
              this.saving.set(false);
              this.success.set('Produto salvo e campanha aplicada.');
              this.form.patchValue({ id: newId });
              this.refreshOmniPublicacoes(newId);
              if (this.embedded) {
                try { this.saved.emit({ id: newId, ...this.form.value }); } catch(e) {}
              }
            },
            error: () => {
              this.saving.set(false);
              this.success.set('Produto salvo. Falha ao aplicar campanha.');
              this.form.patchValue({ id: newId });
              this.refreshOmniPublicacoes(newId);
              if (this.embedded) {
                try { this.saved.emit({ id: newId, ...this.form.value }); } catch(e) {}
              }
            }
          });
          return;
        }
        this.saving.set(false);
        this.success.set('Produto salvo com sucesso.');
        this.form.patchValue({ id: newId });
        if (!this.partnerMode) this.refreshOmniPublicacoes(res?.id ?? newId);
        if (this.embedded) {
          try { this.saved.emit(hydrated || res); } catch(e) { /* noop */ }
        }
      },
      error: (err: any) => {
        console.error(err);
        this.saving.set(false);
        // Se backend retornar 409 por existir produto com mesmo ativo, oferecemos reativar/editar
        if (err?.status === 409 && this.produtosExistentes.length) {
          const alvo = this.produtosExistentes[0]; // mais recente esperado primeiro pela API
          const wantReactivate = confirm('Já existe produto para este ativo. Deseja reativar o mais recente?');
          if (wantReactivate && alvo?.id != null) {
            this.saving.set(true);
            this.api.reativarProduto(alvo.id).subscribe({
              next: (r: any) => { this.saving.set(false); this.success.set('Produto reativado com sucesso.'); this.form.patchValue({ id: r.id }); },
              error: (e2: any) => { console.error(e2); this.saving.set(false); this.error.set('Falha ao reativar. Você pode editar o existente.'); }
            });
            return;
          } else {
            // Se não reativar, abre edição do encontrado
            if (alvo?.id != null) this.editarProdutoExistente(alvo);
            return;
          }
        }
        this.error.set('Erro ao salvar produto.');
      }
    });
  }

  onCloseClick() {
    if (this.embedded) {
      try { this.closed.emit(); } catch(e) {}
    } else {
      try { this.router.navigate(['/restrito/lista-produtos']); } catch(e) {}
    }
  }

}
