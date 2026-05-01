import { Component, OnInit, Inject, OnDestroy, ElementRef, ViewChild, Renderer2 } from '@angular/core';
import { CommonModule, CurrencyPipe, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { StoreService, ShopProduct } from '../../services/store.service';
import { ApiService, Receita } from '../../services/api.service';
import { PrescriptionPickerComponent } from '../../components/prescription-picker/prescription-picker.component';
import { ProductCardV2Component } from '../../product-card-v2/product-card-v2.component';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BannerSlotComponent } from '../../shared/banner-slot/banner-slot.component';
import { LOJA_CEP, LOJA_ENDERECO_TEXTO, MARCA_NOME } from '../../constants/loja-public';
import { TenantLojaService } from '../../services/tenant-loja.service';

@Component({
  selector: 'app-carrinho',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, PrescriptionPickerComponent, FormsModule, ProductCardV2Component, BannerSlotComponent, RouterLink],
  templateUrl: './carrinho.component.html',
  styleUrls: ['./carrinho.component.scss']
})
export class CarrinhoComponent implements OnInit, OnDestroy {
  receitasDisponiveis: Receita[] = [];
  carregandoReceitas = false;
  // Pets do cliente
  pets: any[] = [];
  carregandoPets = false;
  selectedPetIds: number[] = [];
  // Highlights quando carrinho vazio
  loadingHighlights = false;
  highlights: ShopProduct[] = [];
  // Confirm remove modal state
  showConfirmRemove = false;
  confirmTargetId: number | null = null;
  confirmTargetName: string | null = null;
  // Validação de carrinho no backend
  validandoCarrinho = false;
  avisosCarrinho: string[] = [];
  validarTotals: { subtotal: number; discount_total: number; total: number; item_count: number } | null = null;
  validarErrors: string[] = [];
  // Totais normalizados (novo esquema)
  totalsNorm: { original_subtotal?: number; items_total?: number; discount_total?: number; grand_total?: number; item_count?: number; coupon_total?: number; frete_total?: number } | null = null;
  // Dados de validação por item (preço/linha/promo) indexados por produto_id
  validarPorItem = new Map<number, { price?: { unit: number; final: number; discountUnit?: number }, line?: { subtotal: number; discount: number }, promotion?: any }>();
  // Countdown
  nowTs = Date.now();
  private countdownTimer?: any;

  // Entrega/Retirada
  entregaModo: 'retirada' | 'entrega' = 'entrega';
  enderecos: any[] = [];
  enderecoSelecionado: any | null = null;
  mostrandoEnderecos = false; // modal
  mostrandoCadastroEndereco = false; // dentro do modal: alterna entre lista e form
  freteValor: number = 0;
  fretePrazo?: string;
  // Novo modelo de frete com múltiplas opções
  freteOpcoes: Array<{ servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }> = [];
  freteSelecionado?: { servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string };
  freteOrigem?: { cep: string; endereco?: string; cidade?: string; uf?: string };
  freteDestino?: { cep: string; city?: string; state?: string; neighborhood?: string; street?: string; fonte?: string };
  carregandoFrete = false;
  // Pedido e pagamento
  criandoPedido = false;
  pedidoCodigo?: string;
  pagamentoOpcoes: Array<{ metodo: string; label?: string; detalhes?: any }> = [
    { metodo: 'pix', label: 'PIX' }
  ];
  pagamentoMetodo: string = 'pix';
  pagando = false;
  pagamentoStatus?: 'pendente'|'pago'|'falhou';
  // CEP digitado para cálculo de frete
  cepInput: string = '';
  lojaInfo = {
    nome: MARCA_NOME,
    endereco: `${LOJA_ENDERECO_TEXTO} - Curitiba/PR`,
    cep: LOJA_CEP,
    horario: 'Seg a Sex 09:00–18:00, Sáb 09:00–13:00',
  };
  // Novo endereço (form)
  novoEndereco: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string; nome?: string; tipo?: string } = {
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', nome: 'Casa', tipo: 'casa'
  };

  // Revalidação do carrinho após mudanças de quantidade
  private revalidateTimer?: any;
  private needsRevalidate = false;

  @ViewChild('allergyPortal', { read: ElementRef }) allergyPortal?: ElementRef;
  portalAppended = false;
  // Auto-dismiss / fade handling for allergy toast
  private allergyAutoDismissTimer?: any;
  allergyClosing = false;
  private allergyAutoDismissDelayMs = 6000; // visible time before starting fade
  private allergyFadeDurationMs = 360; // fade animation duration (ms)

  constructor(
    public store: StoreService,
    private api: ApiService,
    public router: Router,
    private renderer: Renderer2,
    private tenantLoja: TenantLojaService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit() {
    await this.tenantLoja.ensureHostResolved();
    await this.loadReceitasDisponiveis();
    await this.loadHighlights();
    await this.validarCarrinhoComBackend();
    await this.loadPets();
    await this.loadEnderecos();
    // Se já estiver em modo entrega e há endereços, seleciona o primeiro e calcula
    if (this.entregaModo === 'entrega' && this.enderecos?.length) {
      this.enderecoSelecionado = this.enderecos[0];
      this.calcularFrete();
    }
    // Atualiza relógio para contagens regressivas de promoções (apenas no browser)
    if (isPlatformBrowser(this.platformId)) {
      this.countdownTimer = setInterval(() => { this.nowTs = Date.now(); }, 1000);
    }
    // Monitora o carrinho para limpar respostas de alergia caso o carrinho seja esvaziado
    try {
      this.cartSub = this.store.cart$.subscribe((cart: any[]) => {
        if (!cart || cart.length === 0) {
          try {
            if (this.portalAppended && this.allergyPortal && this.allergyPortal.nativeElement.parentNode === document.body) {
              this.renderer.removeChild(document.body, this.allergyPortal.nativeElement);
            }
            // cancel any pending auto-dismiss
            try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
          } catch {}
          this.portalAppended = false;
          this.petAllergyResponses.clear();
          this.selectedPetIds = [];
          this.showAllergyModal = false;
        }
      });
    } catch {}
  }
  ngOnDestroy() { 
    if (this.countdownTimer) clearInterval(this.countdownTimer); 
    try { if (this.cartSub) this.cartSub.unsubscribe(); } catch {}
    try {
      // clear auto-dismiss timer if present
      try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
      if (this.portalAppended && this.allergyPortal && this.allergyPortal.nativeElement.parentNode === document.body) {
        this.renderer.removeChild(document.body, this.allergyPortal.nativeElement);
        this.portalAppended = false;
      }
    } catch {}
  }
  private getToken(): string | undefined {
    if (!isPlatformBrowser(this.platformId)) return undefined;
    try {
      const t = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!t || t === 'undefined' || t === 'null') return undefined;
      return t;
    } catch { return undefined; }
  }
  private getUserType(): string | undefined {
    if (!isPlatformBrowser(this.platformId)) return undefined;
    try {
      return localStorage.getItem('userType') || sessionStorage.getItem('userType') || undefined;
    } catch { return undefined; }
  }

  // Conversa com o backend para validar preços/estoque do carrinho
  async validarCarrinhoComBackend() {
    try {
      this.validandoCarrinho = true;
  const token = this.getToken();
      const slug = this.tenantLoja.lojaSlug();
      const itens = this.store.cartSnapshot.map(ci => ({ id: ci.product.id, quantidade: ci.quantity, item_type: 'produto' as const }));
      if (!itens.length) return;
      const res = await this.api.validarCarrinho(token, { itens }, slug ? { parceiro_slug: slug } : undefined).toPromise();
      // Esperado do back (documentado pelo usuário):
      // ok, itens: [{ produto_id, nome, tipo, quantidade, price: { unit, final, discountUnit }, line: { subtotal, discount }, promotion, available, stockInfo, ok }],
      // totals: { subtotal, discount_total, total, item_count }, errors, timestamp
      const mapa = new Map<number, any>();
      (res?.itens || []).forEach((i: any) => mapa.set(Number(i.produto_id ?? i.id), i));
      // Atualiza cache de validação por item para UI rica
      this.validarPorItem.clear();
      for (const it of (res?.itens || [])) {
        const key = Number(it.produto_id ?? it.id);
        this.validarPorItem.set(key, {
          price: it.price ? { unit: Number(it.price.unit), final: Number(it.price.final), discountUnit: Number(it.price.discountUnit || 0) } : undefined,
          line: it.line ? { subtotal: Number(it.line.subtotal), discount: Number(it.line.discount || 0) } : undefined,
          promotion: it.promotion || null
        });
      }
      const updated = [] as typeof this.store.cartSnapshot;
      const removidos: string[] = [];
      for (const ci of this.store.cartSnapshot) {
        const v = mapa.get(ci.product.id);
        if (!v) { updated.push(ci); continue; }
        if (v.ok === false || v.available === false) {
          removidos.push(v.nome || ci.product.name || `#${ci.product.id}`);
          continue;
        }
        const novo: typeof ci = { ...ci };
        // Preço unitário final e desconto unitário
        const unit = Number(v?.price?.unit ?? ci.product.price);
        const finalUnit = Number(v?.price?.final ?? unit);
        const discountUnit = Number(v?.price?.discountUnit ?? 0);
        // Ajusta produto: price e promoPrice coerentes
        const newProduct = { ...novo.product };
        newProduct.price = unit;
        newProduct.promoPrice = finalUnit !== unit ? finalUnit : null;
        // Se o back mandou um desconto unitário, preserva promoPrice
        if (discountUnit > 0 && finalUnit === unit - discountUnit) {
          newProduct.promoPrice = finalUnit;
        }
        // Quantidade conforme validado
        const quantidade = Number(v.quantidade ?? novo.quantity);
        novo.quantity = Math.max(0, quantidade);
        novo.product = newProduct;
        updated.push(novo);
      }
      this.store.setCart(updated);
      // Totais e erros/avisos
  this.validarTotals = res?.totals || null;
  this.totalsNorm = this.normalizeTotals(res?.totals);
      this.validarErrors = Array.isArray(res?.errors) ? res.errors : [];
      const msgs = [] as string[];
      if (removidos.length) msgs.push(`Itens removidos por indisponibilidade: ${removidos.join(', ')}`);
      this.avisosCarrinho = msgs;
      // Não recalcula frete aqui para não quebrar UX enquanto valida; mantém dados atuais
    } catch {
      // silencioso; mantém carrinho local
    } finally {
      this.validandoCarrinho = false;
      // Se houve alteração durante a validação, dispara novamente
      if (this.needsRevalidate) {
        this.needsRevalidate = false;
        this.validarCarrinhoComBackend();
      }
    }
  }

  // Normaliza totalizações vindas do backend (aceita esquema antigo e novo)
  private normalizeTotals(t: any): { original_subtotal?: number; items_total?: number; discount_total?: number; grand_total?: number; item_count?: number; coupon_total?: number; frete_total?: number } | null {
    if (!t) return null;
    const num = (v: any) => (typeof v === 'number' ? v : (v != null ? Number(v) : undefined));
    const hasNew = (t.original_subtotal != null) || (t.items_total != null) || (t.grand_total != null);
    if (hasNew) {
      return {
        original_subtotal: num(t.original_subtotal),
        items_total: num(t.items_total),
        discount_total: num(t.discount_total),
        grand_total: num(t.grand_total),
        item_count: num(t.item_count),
        coupon_total: num(t.coupon_total ?? t.cupom_total),
        frete_total: num(t.frete_total)
      };
    }
    // Esquema antigo: { subtotal, total, discount_total, item_count }
    const subtotal = num(t.subtotal);
    const total = num(t.total);
    return {
      original_subtotal: subtotal,
      items_total: total ?? subtotal,
      discount_total: num(t.discount_total),
      grand_total: total ?? subtotal,
      item_count: num(t.item_count),
      coupon_total: num(t.coupon_total ?? t.cupom_total),
      frete_total: num(t.frete_total)
    };
  }

  // Helpers para UI de promoção/desconto
  getUnitPrices(prodId: number, fallbackPrice: number, fallbackPromo?: number | null) {
    const v = this.validarPorItem.get(prodId);
    const unit = v?.price?.unit ?? fallbackPrice;
    const final = v?.price?.final ?? (fallbackPromo ?? fallbackPrice);
    const discountUnit = Math.max(0, (v?.price?.discountUnit ?? (unit - final)) || 0);
    return { unit, final, discountUnit };
  }
  getLineDiscount(prodId: number, qty: number, unit: number, final: number) {
    const v = this.validarPorItem.get(prodId);
    if (v?.line?.discount != null) return Number(v.line.discount);
    const perUnit = Math.max(0, unit - final);
    return perUnit * qty;
  }
  getPromotion(prodId: number) {
    return this.validarPorItem.get(prodId)?.promotion;
  }
  promoEndsInMs(prodId: number): number | null {
    const promo = this.getPromotion(prodId);
    if (!promo?.fim) return null;
    const end = new Date(promo.fim).getTime();
    const diff = end - this.nowTs;
    return diff > 0 ? diff : 0;
  }
  fmtCountdown(ms: number | null) {
    if (ms == null) return '';
    if (ms <= 0) return 'terminou';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${ss}s`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  }

  async loadReceitasDisponiveis() {
    try {
      this.carregandoReceitas = true;
      const token = this.getToken();
      const userType = this.getUserType();
      if (!token || userType !== 'cliente') { this.receitasDisponiveis = []; return; }
      // Se o backend suportar, peça apenas receitas disponíveis e do cliente logado
      const me = await this.api.getClienteMe(token).toPromise();
      const clienteId = me?.user?.id;
      const resp = await this.api.getReceitas(token, { cliente_id: clienteId, availableOnly: true, context: 'carrinho', pageSize: 50, page: 1 }).toPromise();
      this.receitasDisponiveis = resp?.data || [];
    } catch {
      this.receitasDisponiveis = [];
    } finally {
      this.carregandoReceitas = false;
    }
  }

  // Carrega pets do cliente para permitir seleção antes do checkout
  async loadPets() {
    try {
      this.carregandoPets = true;
      const token = this.getToken();
      const userType = this.getUserType();
      if (!token || userType !== 'cliente') { this.pets = []; return; }
      const me = await this.api.getClienteMe(token).toPromise();
      const clienteId = Number(me?.user?.id ?? 0);
      if (!clienteId) { this.pets = []; return; }
      const resp: any = await this.api.getPetsByCliente(clienteId, token).toPromise();
      if (Array.isArray(resp)) this.pets = resp;
      else if (resp && Array.isArray(resp.data)) this.pets = resp.data;
      else this.pets = resp || [];
      // Se havia seleção em contexto de checkout, restaura
      const ctx = this.store.getCheckoutContext();
      if (ctx && Array.isArray(ctx.selectedPets)) {
        this.selectedPetIds = ctx.selectedPets.slice();
      }
      // Remove ids de pets excluídos para não deixar seleção órfã
      const validPetIds = new Set(
        (this.pets || []).map((p: any) => Number(p?.id)).filter((n) => !Number.isNaN(n))
      );
      this.selectedPetIds = (this.selectedPetIds || []).filter((id) => validPetIds.has(Number(id)));
      if (ctx) {
        this.store.setCheckoutContext({ ...ctx, selectedPets: this.selectedPetIds });
      }
    } catch {
      this.pets = [];
    } finally {
      this.carregandoPets = false;
    }
  }

  async loadHighlights() {
    try {
      this.loadingHighlights = true;
      this.highlights = await this.store.loadHomeHighlights();
    } finally {
      this.loadingHighlights = false;
    }
  }

  inc(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    if (item) { this.store.updateQuantity(id, item.quantity + 1); this.scheduleRevalidate(); }
  }
  dec(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    if (!item) return;
    if (item.quantity > 1) {
      this.store.updateQuantity(id, item.quantity - 1);
      this.scheduleRevalidate();
    } else {
      // quantity == 1: ask for confirmation to remove
      this.openConfirmRemove(item.product.id, item.product.name);
    }
  }
  onRequestRemove(id: number) {
    const item = this.store.cartSnapshot.find((ci: any) => ci.product.id === id);
    const name = item?.product?.name ?? '';
    this.openConfirmRemove(id, name);
  }
  private openConfirmRemove(id: number, name: string) {
    this.confirmTargetId = id;
    this.confirmTargetName = name;
    this.showConfirmRemove = true;
  }
  cancelRemove() {
    this.showConfirmRemove = false;
    this.confirmTargetId = null;
    this.confirmTargetName = null;
  }
  confirmRemoveNow() {
    if (this.confirmTargetId != null) {
      this.store.removeFromCart(this.confirmTargetId);
    }
    this.cancelRemove();
    this.scheduleRevalidate();
  }
  remove(id: number) { this.onRequestRemove(id); }
  clear() { 
    this.store.clearCart(); 
    // limpa estado relacionado a alergias e seleção de pets quando o carrinho é esvaziado via UI
    try { this.petAllergyResponses.clear(); } catch {}
    // cancel auto-dismiss and reset any closing state
    try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
    this.allergyClosing = false;
    this.selectedPetIds = [];
    this.showAllergyModal = false;
    this.scheduleRevalidate(); 
  }
  total() { return this.store.getCartTotals(); }

  private scheduleRevalidate(delayMs: number = 450) {
    this.needsRevalidate = true;
    if (this.revalidateTimer) clearTimeout(this.revalidateTimer);
    this.revalidateTimer = setTimeout(() => {
      if (this.validandoCarrinho) return; // aguardará finally para reexecutar
      this.needsRevalidate = false;
      this.validarCarrinhoComBackend();
    }, delayMs);
  }

  onAttachPrescriptionId(productId: number, value: string) {
    const id = value.trim();
    this.store.setItemPrescriptionById(productId, { prescriptionId: id || undefined, prescriptionFileName: undefined });
  }

  onSelectPrescription(productId: number, receitaId: number | undefined) {
    const id = receitaId != null ? String(receitaId) : undefined;
    this.store.setItemPrescriptionById(productId, { prescriptionId: id, prescriptionFileName: undefined });
  }

  onUploadPrescriptionFile(productId: number, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // For now, we only store the file name as a placeholder for the upload flow
    this.store.setItemPrescriptionById(productId, { prescriptionFileName: file.name, prescriptionId: undefined });
    // reset input so same file can be re-selected
    input.value = '';
  }

  onUploadPrescriptionFileDirect(productId: number, file: File) {
    if (!file) return;
    this.store.setItemPrescriptionById(productId, { prescriptionFileName: file.name, prescriptionId: undefined });
  }

  // Seleção de pets no carrinho (permite múltiplos)
  togglePetSelect(petId: number) {
    const i = this.selectedPetIds.indexOf(petId);
    if (i >= 0) {
      this.selectedPetIds.splice(i, 1);
    } else {
      this.selectedPetIds.push(petId);
      // Ao selecionar um pet, envia os ids dos produtos + id do pet para o backend
      this.sendProductsForPetAllergyCheck(petId);
    }
  }
  isPetSelected(petId: number) {
    return this.selectedPetIds.indexOf(petId) >= 0;
  }

  // Armazena respostas do backend sobre alergias por pet (usado futuramente para modal)
  petAllergyResponses: Map<number, any> = new Map();

  // UI state for allergy modal (non-blocking)
  showAllergyModal = false;
  private cartSub?: Subscription;

  private async sendProductsForPetAllergyCheck(petId: number) {
    try {
      const token = this.getToken();
      const produtoIds = (this.store.cartSnapshot || []).map((ci: any) => ci.product.id);
      if (!produtoIds || !produtoIds.length) return;
      const res = await this.api.checarAlergiasPet(petId, produtoIds, token).toPromise();
      // Guarda resposta para uso futuro (ex.: abrir modal com alergias)
      this.petAllergyResponses.set(petId, res);
      const hasWarnings = !!(res && Array.isArray(res.results) && res.results.some((r: any) => r.has_allergy === true || (r.matches && r.matches.length > 0)));
      if (hasWarnings) {
        this.openAllergyModal(petId, res);
      }
    } catch (e) {
      // Silencioso por ora — backend pode não existir ainda
    }
  }

  openAllergyModal(petId: number, res: any) {
    // ensure the map contains the latest response and show the toast area
    this.petAllergyResponses.set(petId, res);
    this.showAllergyModal = true;
    // Move portal element to document.body on next tick so it escapes any stacking context
    setTimeout(() => {
      try {
        if (typeof document !== 'undefined' && this.allergyPortal && !this.portalAppended) {
          this.renderer.appendChild(document.body, this.allergyPortal.nativeElement);
          this.portalAppended = true;
        }
        // restart auto-dismiss timer when modal opens / updates
        try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
        this.allergyClosing = false;
        this.startAllergyAutoDismiss();
      } catch {}
    }, 0);
  }

  closeAllergyModal() {
    this.closeAllAllergies();
  }

  // Returns active allergy entries grouped by pet
  getActiveAllergyEntries(): Array<{ petId: number; response: any }> {
    const out: Array<{ petId: number; response: any }> = [];
    for (const [petId, res] of this.petAllergyResponses.entries()) {
      const hasWarnings = !!(res && Array.isArray(res.results) && res.results.some((r: any) => r.has_allergy === true || (r.matches && r.matches.length > 0)));
      if (hasWarnings) out.push({ petId: Number(petId), response: res });
    }
    return out;
  }

  closeAllergyForPet(petId: number) {
    this.petAllergyResponses.delete(petId);
    if (!this.petAllergyResponses.size) {
      // cancel auto-dismiss and remove portal from body when no entries remain
      try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
      try {
        if (this.portalAppended && this.allergyPortal && this.allergyPortal.nativeElement.parentNode === document.body) {
          this.renderer.removeChild(document.body, this.allergyPortal.nativeElement);
          this.portalAppended = false;
        }
      } catch {}
      this.showAllergyModal = false;
      this.allergyClosing = false;
    } else {
      // if entries remain, restart auto-dismiss
      try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
      this.startAllergyAutoDismiss();
    }
  }

  closeAllAllergies() {
    // cancel auto-dismiss and remove portal immediately
    try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
    try {
      if (this.portalAppended && this.allergyPortal && this.allergyPortal.nativeElement.parentNode === document.body) {
        this.renderer.removeChild(document.body, this.allergyPortal.nativeElement);
        this.portalAppended = false;
      }
    } catch {}
    this.petAllergyResponses.clear();
    this.showAllergyModal = false;
    this.allergyClosing = false;
  }

  // Auto-dismiss helpers
  private startAllergyAutoDismiss() {
    try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
    this.allergyAutoDismissTimer = setTimeout(() => this.startAllergyFadeOut(), this.allergyAutoDismissDelayMs);
  }
  private startAllergyFadeOut() {
    try { if (this.allergyAutoDismissTimer) clearTimeout(this.allergyAutoDismissTimer); } catch {}
    if (this.allergyClosing) return;
    this.allergyClosing = true;
    setTimeout(() => {
      // perform final removal after fade completes
      try {
        if (this.portalAppended && this.allergyPortal && this.allergyPortal.nativeElement.parentNode === document.body) {
          this.renderer.removeChild(document.body, this.allergyPortal.nativeElement);
          this.portalAppended = false;
        }
      } catch {}
      this.petAllergyResponses.clear();
      this.showAllergyModal = false;
      this.allergyClosing = false;
    }, this.allergyFadeDurationMs);
  }

  // Returns a display name for a pet id (safe for template use)
  getPetDisplayName(petId: number | null): string {
    if (petId == null) return 'selecionado';
    const p = (this.pets || []).find(x => x.id === petId);
    return (p && (p.nome || p.name || p.pet_nome)) || 'selecionado';
  }

  // Endereços e frete
  async loadEnderecos() {
    try {
      const token = this.getToken();
      const userType = this.getUserType();
      if (!token || userType !== 'cliente') { this.enderecos = []; return; }
      this.enderecos = (await this.api.listEnderecosCliente(token).toPromise()) || [];
      if (this.enderecos?.length) {
        this.enderecoSelecionado = this.enderecos[0];
        this.cepInput = this.enderecos[0]?.cep || '';
        if (this.entregaModo === 'entrega') await this.calcularFrete();
      }
    } catch {
      this.enderecos = [];
    }
  }

  abrirModalEnderecos() { this.mostrandoEnderecos = true; this.mostrandoCadastroEndereco = !this.enderecos?.length; }
  fecharModalEnderecos() { this.mostrandoEnderecos = false; this.mostrandoCadastroEndereco = false; }
  mostrarFormNovoEndereco() {
    this.mostrandoCadastroEndereco = true;
    // Reset com defaults amigáveis
    this.novoEndereco = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', nome: 'Casa', tipo: 'casa' };
  }
  mostrarListaEnderecos() { this.mostrandoCadastroEndereco = false; }

  selecionarEndereco(e: any) {
    this.enderecoSelecionado = e;
    // Seleção aplicada imediatamente (sem botão)
    this.mostrandoEnderecos = false;
    // Alimenta input de CEP com o CEP do endereço
    this.cepInput = e?.cep || '';
    this.calcularFrete();
  }

  // Seleção inline (cards dentro da seção de entrega)
  selecionarEnderecoInline(e: any) {
    this.enderecoSelecionado = e;
    this.cepInput = e?.cep || '';
    this.calcularFrete();
  }

  onToggleEntregaModo(mode: 'retirada' | 'entrega') {
    this.entregaModo = mode;
    if (mode === 'retirada') {
      // Zera frete e destaca retirada
      const retiradaBase = { servico: 'retirada_loja', nome: 'Retirar na loja', prazo_dias: 0, valor: 0, observacao: this.lojaInfo.endereco };
      this.freteOpcoes = [retiradaBase];
      this.freteSelecionado = retiradaBase;
      this.freteValor = 0;
      this.fretePrazo = undefined;
    } else {
      // Garante um endereço e calcula
      if (!this.enderecoSelecionado && this.enderecos?.length) {
        this.enderecoSelecionado = this.enderecos[0];
        this.cepInput = this.enderecos[0]?.cep || '';
      }
      this.calcularFrete();
    }
  }

  async cadastrarEndereco(novo: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; estado: string; }) {
    try {
      const token = this.getToken() || '';
      const payload = { ...novo, cep: (novo.cep || '').replace(/\D/g, '') };
      const created = await this.api.createEnderecoCliente(token, payload).toPromise();
      this.enderecos = [created, ...this.enderecos];
      this.enderecoSelecionado = created;
      this.cepInput = created?.cep || this.cepInput;
      this.mostrandoEnderecos = false;
      this.calcularFrete();
    } catch {}
  }

  // Máscara e busca CEP no formulário de novo endereço
  onCepInputMask(ev: any) {
    const raw = (ev?.target?.value ?? '').toString();
    const dig = raw.replace(/\D/g, '').slice(0, 8);
    const masked = dig.length > 5 ? `${dig.slice(0,5)}-${dig.slice(5)}` : dig;
    this.novoEndereco.cep = masked;
  }

  async onCepBlurLookup() {
    const cep = (this.novoEndereco.cep || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      // Tenta ViaCEP
      const via = await this.api.buscarCepViaCep(cep).toPromise();
      if (via && !via.erro) {
        this.novoEndereco.logradouro = via.logradouro || this.novoEndereco.logradouro;
        this.novoEndereco.bairro = via.bairro || this.novoEndereco.bairro;
        this.novoEndereco.cidade = via.localidade || this.novoEndereco.cidade;
        this.novoEndereco.estado = via.uf || this.novoEndereco.estado;
        return;
      }
      // Fallback BrasilAPI
      const br = await this.api.buscarCepBrasilAPI(cep).toPromise();
      if (br) {
        this.novoEndereco.logradouro = br.street || this.novoEndereco.logradouro;
        this.novoEndereco.bairro = br.neighborhood || this.novoEndereco.bairro;
        this.novoEndereco.cidade = br.city || this.novoEndereco.cidade;
        this.novoEndereco.estado = br.state || this.novoEndereco.estado;
      }
    } catch {
      // silencioso; usuário pode preencher manualmente
    }
  }

  async calcularFrete() {
    const retiradaBase = { servico: 'retirada_loja', nome: 'Retirar na loja', prazo_dias: 0, valor: 0, observacao: this.lojaInfo.endereco };
    const prevSel = this.freteSelecionado;
    const prevOpcoes = (this.freteOpcoes || []).filter(o => o && o.servico !== 'retirada_loja');
    // Mostra imediatamente a opção de retirada e mantém as opções atuais enquanto carrega
    this.freteOpcoes = [retiradaBase, ...prevOpcoes];
    if (!prevSel) this.freteSelecionado = retiradaBase;
    this.carregandoFrete = true;
    try {
      if (this.entregaModo !== 'entrega') { this.carregandoFrete = false; return; }
      // Auto-seleciona o primeiro endereço se nenhum estiver selecionado
      if (!this.enderecoSelecionado && this.enderecos?.length) this.enderecoSelecionado = this.enderecos[0];
      // Define CEP a partir do input ou do endereço selecionado
      const cep = (this.cepInput || this.enderecoSelecionado?.cep || '').trim();
      if (!cep) { this.carregandoFrete = false; return; }
  const token = this.getToken();
      const slug = this.tenantLoja.lojaSlug();
  const itens = this.store.cartSnapshot.map(ci => ({ id: ci.product.id, qtd: ci.quantity, preco: this.store.getPriceWithDiscount(ci.product), item_type: 'produto' as const }));
      const resp = await this.api.cotarFrete(token, { cep, itens }, slug ? { parceiro_slug: slug } : undefined).toPromise();
      // Suporta tanto resposta antiga { valor, prazo } quanto nova com { origem, destino, pacote, opcoes }
      if (resp) {
        // Nova resposta com múltiplas opções
        if ((resp as any).opcoes && Array.isArray((resp as any).opcoes)) {
          const r: any = resp as any;
          this.freteOrigem = r.origem;
          this.freteDestino = r.destino;
          const opcoes = (r.opcoes || []) as Array<{ servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }>;
          // Garante retirada no topo
          const semRetirada = opcoes.filter(o => o.servico !== 'retirada_loja');
          this.freteOpcoes = [retiradaBase, ...semRetirada];
          // Mantém seleção anterior se ainda existir; senão, mantém a atual; como fallback, a mais barata
          const keep = prevSel && this.freteOpcoes.find(o => o.servico === prevSel.servico && o.nome === prevSel.nome);
          this.freteSelecionado = keep || prevSel || (this.freteOpcoes.slice().sort((a,b) => a.valor - b.valor)[0]);
          if (this.freteSelecionado) {
            this.freteValor = Math.max(0, this.freteSelecionado.valor);
            this.fretePrazo = this.freteSelecionado.prazo_dias != null ? `${this.freteSelecionado.prazo_dias} dia${this.freteSelecionado.prazo_dias === 1 ? '' : 's'}` : undefined;
          }
        } else if (typeof (resp as any).valor === 'number') {
          // Resposta antiga
          const antigo = { servico: 'entrega', nome: 'Entrega', prazo_dias: undefined as any, valor: Math.max(0, (resp as any).valor) };
          this.freteOpcoes = [retiradaBase, antigo as any];
          const keep = prevSel && this.freteOpcoes.find(o => o.servico === prevSel.servico && o.nome === prevSel.nome);
          this.freteSelecionado = (keep || antigo) as any;
          this.freteValor = Math.max(0, (this.freteSelecionado?.valor as number) || 0);
          this.fretePrazo = (resp as any).prazo;
        }
      }
    } catch {
      // Fallback genérico de frete se o endpoint não estiver disponível
      const subtotal = this.store.getCartTotals().subtotal;
      // Estimativa simples: 8% do subtotal, min 12, max 40
      const estimado = Math.min(40, Math.max(12, subtotal * 0.08));
      const estimativa = { servico: 'estimativa_entrega', nome: 'Entrega estimada', prazo_dias: undefined as any, valor: Math.round(estimado * 100) / 100 };
      this.freteOpcoes = [retiradaBase, estimativa as any];
      const keep = prevSel && this.freteOpcoes.find(o => o.servico === prevSel.servico && o.nome === prevSel.nome);
  this.freteSelecionado = (keep || estimativa) as any;
  this.freteValor = Math.max(0, (this.freteSelecionado?.valor as number) || 0);
      this.fretePrazo = '3–7 dias úteis';
    } finally {
      this.carregandoFrete = false;
    }
  }

  get totalComFrete() {
    const freteSel = this.freteSelecionado?.valor ?? this.freteValor;
    const items = this.totalsNorm?.items_total ?? this.store.getCartTotals().subtotal;
    const cupom = this.totalsNorm?.coupon_total ?? 0;
    return items + (this.entregaModo === 'entrega' ? (freteSel || 0) : 0) - (cupom || 0);
  }

  // Exibição do frete na UI: sempre prioriza a opção selecionada (evita mostrar 0,00 quando totals.frete_total=0)
  get freteValorDisplay(): number {
    if (this.entregaModo !== 'entrega') return 0;
    const v = this.freteSelecionado?.valor ?? this.freteValor;
    return typeof v === 'number' ? Math.max(0, v) : 0;
  }
  get freteNomeDisplay(): string {
    return this.freteSelecionado?.nome || 'Entrega';
  }
  get fretePrazoDias(): number | undefined {
    return this.freteSelecionado?.prazo_dias != null ? this.freteSelecionado.prazo_dias : undefined;
  }

  selecionarOpcaoFrete(opt: { servico: string; nome: string; prazo_dias: number; valor: number; observacao?: string }) {
    this.freteSelecionado = opt;
    this.freteValor = Math.max(0, opt?.valor || 0);
    this.fretePrazo = opt?.prazo_dias != null ? `${opt.prazo_dias} dia${opt.prazo_dias === 1 ? '' : 's'}` : undefined;
  }

  tipoEmoji(tipo?: string): string {
    const t = (tipo || '').toLowerCase().trim();
    switch (t) {
      case 'casa': return '🏠';
      case 'trabalho': return '💼';
      case 'entrega': return '📦';
      case 'cobranca': return '🧾';
      default: return '📍';
    }
  }

  // Ir para checkout: persiste contexto mínimo e navega
  irParaCheckout() {
    this.store.setCheckoutContext({
      entregaModo: this.entregaModo,
      enderecoSelecionado: this.enderecoSelecionado,
      freteSelecionado: this.freteSelecionado || (this.freteValor ? { valor: this.freteValor } : null),
      freteOpcoes: this.freteOpcoes,
      freteOrigem: this.freteOrigem,
      freteDestino: this.freteDestino,
      selectedPets: this.selectedPetIds
    });
    this.router.navigate(['/checkout']);
  }

  // Finaliza pedido direto do carrinho (POST) e aguarda resposta
  async finalizarPedido() {
    if (!this.store.isCheckoutAllowed()) return;
    try {
      this.criandoPedido = true;
  const token = this.getToken() || '';
      const itens = this.store.cartSnapshot.map(ci => ({
        produto_id: ci.product.id,
        nome: ci.product.name,
        quantidade: ci.quantity,
        preco_unit: this.store.getPriceWithDiscount(ci.product),
        prescriptionId: ci.prescriptionId,
        prescriptionFileName: ci.prescriptionFileName,
      }));
      // Modo e fallback
      let modo: 'retirada'|'entrega' = this.entregaModo;
      let endereco = this.enderecoSelecionado;
      let freteSel = this.freteSelecionado || (this.freteValor ? { servico: 'entrega', nome: 'Entrega', prazo_dias: undefined as any, valor: this.freteValor } : null);
      if (modo === 'entrega' && (!endereco || !freteSel)) {
        modo = 'retirada';
        endereco = null;
        freteSel = { servico: 'retirada_loja', nome: 'Retirar na loja', prazo_dias: 0, valor: 0, observacao: this.lojaInfo.endereco } as any;
      }
      const slug = this.tenantLoja.lojaSlug();
      const payload: any = {
        itens,
        ...(slug ? { loja_slug: slug } : {}),
        entrega: {
          modo,
          endereco,
          frete: freteSel,
          opcoes: this.freteOpcoes || [],
          origem: this.freteOrigem || undefined,
          destino: this.freteDestino || (endereco ? { cep: endereco?.cep, city: endereco?.cidade, state: endereco?.estado, neighborhood: endereco?.bairro, street: endereco?.logradouro } : undefined),
        },
        totais: {
          original_subtotal: this.totalsNorm?.original_subtotal ?? this.store.getCartTotals().subtotal,
          items_total: this.totalsNorm?.items_total ?? this.store.getCartTotals().subtotal,
          discount_total: this.totalsNorm?.discount_total ?? 0,
          coupon_total: this.totalsNorm?.coupon_total ?? 0,
          frete: modo === 'entrega' ? (freteSel?.valor || 0) : 0,
          grand_total: this.totalComFrete,
          item_count: this.totalsNorm?.item_count ?? this.store.getCartTotals().count,
        }
      };
      const res = await this.api.criarPedido(token, payload).toPromise();
      // Persiste o pedido criado e contexto de checkout; segue para checkout
      this.store.setCreatedOrder(res);
      this.store.setCheckoutContext({
        entregaModo: this.entregaModo,
        enderecoSelecionado: this.enderecoSelecionado,
        freteSelecionado: this.freteSelecionado || (this.freteValor ? { valor: this.freteValor } : null),
        freteOpcoes: this.freteOpcoes,
        freteOrigem: this.freteOrigem,
        freteDestino: this.freteDestino,
        selectedPets: this.selectedPetIds
      });
      this.router.navigate(['/checkout']);
    } catch (e) {
      // feedback simples; ToastService está disponível via StoreService? já utilizado em StoreService. Mantemos silencioso aqui ou integramos toast quando necessário.
    } finally {
      this.criandoPedido = false;
    }
  }
}
