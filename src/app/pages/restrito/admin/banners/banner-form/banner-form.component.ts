import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { BannerDto } from '../../../../../services/admin-api.service';
import { BannerImageEditorComponent } from '../../../../../shared/banner-image-editor/banner-image-editor.component';
import {
  BANNER_POSITIONS,
  BannerPosition,
  BannerPositionOption,
  getBannerPosition,
} from '../../../../../shared/banner/banner-positions';

export interface BannerFormSubmitPayload {
  values: {
    nome: string;
    link: string | null;
    alt: string | null;
    posicao: BannerPosition;
    ordem: number;
    inicio: string | null;
    fim: string | null;
    ativo: 0 | 1;
    target_blank: 0 | 1;
  };
  desktopBlob: Blob | null;
  mobileBlob: Blob | null;
}

@Component({
  selector: 'app-banner-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BannerImageEditorComponent],
  templateUrl: './banner-form.component.html',
  styleUrls: ['./banner-form.component.scss'],
})
export class BannerFormComponent implements OnInit, OnChanges {
  @Input() banner: BannerDto | null = null;
  @Input() submitting = false;
  /** Subconjunto de posições (ex.: painel parceiro). Vazio/null = catálogo completo. */
  @Input() positionOptions: BannerPositionOption[] | null = null;
  /** Valor inicial da posição ao criar novo banner. */
  @Input() defaultPosicao: BannerPosition = 'home_hero';
  /** Se false, não permite gravar/remover (ex.: colaborador não-master). */
  @Input() allowMutations = true;

  @Output() submitted = new EventEmitter<BannerFormSubmitPayload>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() removed = new EventEmitter<BannerDto>();

  @ViewChild('desktopEditor') desktopEditor?: BannerImageEditorComponent;
  @ViewChild('mobileEditor') mobileEditor?: BannerImageEditorComponent;

  readonly positions = BANNER_POSITIONS;

  get positionsForSelect(): BannerPositionOption[] {
    return this.positionOptions?.length ? this.positionOptions : BANNER_POSITIONS;
  }

  form!: FormGroup;
  activeTab = signal<'desktop' | 'mobile'>('desktop');

  desktopFile: File | null = null;
  mobileFile: File | null = null;
  desktopPreview: string | null = null;
  mobilePreview: string | null = null;
  desktopWarn = signal<string | null>(null);
  mobileWarn = signal<string | null>(null);

  desktopRatio = 16 / 5;
  mobileRatio = 4 / 5;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.buildForm();
    this.applyBanner();
    this.syncFormDisabled();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) this.buildForm();
    if (changes['banner']) this.applyBanner();
    if (changes['allowMutations'] || changes['banner']) this.syncFormDisabled();
  }

  private syncFormDisabled(): void {
    if (!this.form) return;
    if (this.allowMutations) this.form.enable();
    else this.form.disable();
  }

  get isEdit(): boolean {
    return !!this.banner?.id;
  }

  get hasDesktopImage(): boolean {
    return !!(this.desktopFile || this.desktopPreview);
  }

  get hasMobileImage(): boolean {
    return !!(this.mobileFile || this.mobilePreview);
  }

  get canSubmit(): boolean {
    if (!this.allowMutations) return false;
    if (!this.form || this.form.invalid) return false;
    if (!this.hasDesktopImage || !this.hasMobileImage) return false;
    return !this.submitting;
  }

  private buildForm() {
    this.form = this.fb.group({
      nome: ['', [Validators.required, Validators.minLength(2)]],
      link: [''],
      alt: [''],
      posicao: [this.defaultPosicao, [Validators.required]],
      ordem: [1],
      inicio: [''],
      fim: [''],
      ativo: [1],
      target_blank: [1],
    }, { validators: this.dateRangeValidator });

    this.form.get('posicao')?.valueChanges.subscribe((v) => this.updateRatios(v));
  }

  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const inicio = group.get('inicio')?.value;
    const fim = group.get('fim')?.value;
    if (!inicio || !fim) return null;
    return new Date(inicio).getTime() <= new Date(fim).getTime()
      ? null
      : { dateRange: true };
  }

  private applyBanner() {
    const b = this.banner;
    this.desktopFile = null;
    this.mobileFile = null;
    this.desktopWarn.set(null);
    this.mobileWarn.set(null);
    this.activeTab.set('desktop');

    if (!b) {
      const def = this.defaultPosicao;
      this.form?.reset({
        nome: '',
        link: '',
        alt: '',
        posicao: def,
        ordem: 1,
        inicio: '',
        fim: '',
        ativo: 1,
        target_blank: 1,
      });
      this.desktopPreview = null;
      this.mobilePreview = null;
      this.updateRatios(def);
      return;
    }

    this.form.patchValue({
      nome: b.nome || '',
      link: b.link || '',
      alt: b.alt || '',
      posicao: (b.posicao as BannerPosition) || this.defaultPosicao,
      ordem: b.ordem ?? 1,
      inicio: b.inicio ? this.toDateTimeLocal(b.inicio) : '',
      fim: b.fim ? this.toDateTimeLocal(b.fim) : '',
      ativo: b.ativo ?? 1,
      target_blank: b.target_blank ?? 1,
    });
    this.desktopPreview = b.desktop_image_url || null;
    this.mobilePreview = b.mobile_image_url || null;
    this.updateRatios(b.posicao as BannerPosition);
  }

  private updateRatios(pos: BannerPosition | string | null | undefined) {
    const meta = getBannerPosition(pos as string) ?? getBannerPosition(this.defaultPosicao);
    if (!meta) return;
    this.desktopRatio = meta.desktopRatio;
    this.mobileRatio = meta.mobileRatio;
  }

  toggleTab(tab: 'desktop' | 'mobile') {
    this.activeTab.set(tab);
  }

  positionDescription(): string {
    const v = this.form?.get('posicao')?.value;
    const meta = getBannerPosition(v) ?? this.positionsForSelect.find((p) => p.value === v) ?? null;
    return meta ? meta.description : '';
  }

  /** Permite que o host (app-admin-crud) dispare o submit a partir do footer padrão. */
  submitFromHost(): void {
    this.onSubmit();
  }

  async onSubmit() {
    if (!this.canSubmit) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.value;
    const values = {
      nome: String(raw.nome || '').trim(),
      link: raw.link ? String(raw.link).trim() : null,
      alt: raw.alt ? String(raw.alt).trim() : null,
      posicao: raw.posicao as BannerPosition,
      ordem: Number(raw.ordem || 0) || 0,
      inicio: raw.inicio ? new Date(raw.inicio).toISOString() : null,
      fim: raw.fim ? new Date(raw.fim).toISOString() : null,
      ativo: (Number(raw.ativo) ? 1 : 0) as 0 | 1,
      target_blank: (Number(raw.target_blank) ? 1 : 0) as 0 | 1,
    };

    let desktopBlob: Blob | null = null;
    let mobileBlob: Blob | null = null;

    if (this.desktopFile && this.desktopEditor) {
      desktopBlob = await this.desktopEditor.exportCroppedBlob().catch(() => null);
    }
    if (this.mobileFile && this.mobileEditor) {
      mobileBlob = await this.mobileEditor.exportCroppedBlob().catch(() => null);
    }

    this.submitted.emit({ values, desktopBlob, mobileBlob });
  }

  onCancel() {
    this.cancelled.emit();
  }

  onRemove() {
    if (!this.banner) return;
    this.removed.emit(this.banner);
  }

  private toDateTimeLocal(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
