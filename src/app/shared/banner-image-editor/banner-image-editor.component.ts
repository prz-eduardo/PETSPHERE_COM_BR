import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';

  @Component({
    selector: 'app-banner-image-editor',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './banner-image-editor.component.html',
    styleUrls: ['./banner-image-editor.component.scss']
  })
  export class BannerImageEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
    @Input() label?: string;
    @Input() expectedRatio: number = 16 / 9;
    @Input() initialImage: string | null = null;
    @Input() maxFileSize = 5 * 1024 * 1024;

    @Output() previewChange = new EventEmitter<string | null>();
    @Output() fileChange = new EventEmitter<File | null>();
    @Output() warnChange = new EventEmitter<string | null>();

    @ViewChild('frame', { static: true }) frameRef!: ElementRef<HTMLDivElement>;
    @ViewChild('imgEl') imgRef?: ElementRef<HTMLImageElement>;
    @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

    imageSrc: string | null = null;
    previewData: string | null = null;
    warning: string | null = null;
    fileObj: File | null = null;

    naturalW = 0;
    naturalH = 0;
    scale = 1;
    minScale = 0.1;
    maxScale = 8;
    posX = 0;
    posY = 0;
    displayW = 0;
    displayH = 0;
    frameHeight = 0;

    private dragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private startPosX = 0;
    private startPosY = 0;
    private currentPointerId: number | null = null;

    private resizeObserver: ResizeObserver | null = null;
    private boundPointerMove = (e: PointerEvent) => this._onPointerMove(e);
    private boundPointerUp = (e: PointerEvent) => this._onPointerUp(e);

    constructor(private ngZone: NgZone) {}

    ngAfterViewInit(): void {
      // compute frame size and observe changes
      setTimeout(() => {
        this.computeFrameSize();
        try {
          this.resizeObserver = new ResizeObserver(() => this.computeFrameSize());
          this.resizeObserver.observe(this.frameRef.nativeElement);
        } catch (e) {}
        if (this.initialImage) this.setImage(this.initialImage).catch(() => {});
      }, 0);
    }

    ngOnChanges(changes: SimpleChanges): void {
      if (changes['initialImage'] && !changes['initialImage'].firstChange) {
        if (this.initialImage) this.setImage(this.initialImage).catch(() => {});
        else this.clearImage();
      }
      if (changes['expectedRatio']) setTimeout(() => this.computeFrameSize(), 0);
    }

    ngOnDestroy(): void {
      try { this.resizeObserver?.disconnect(); } catch {}
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
    }

    private computeFrameSize() {
      const rect = this.frameRef?.nativeElement?.getBoundingClientRect();
      if (!rect) return;
      const fw = rect.width || 300;
      this.frameHeight = Math.max(24, Math.round(fw / this.safeRatio()));
      if (this.naturalW && this.naturalH) this.fitImageToFrame();
    }

    onFileSelected(e: Event) {
      const input = e.target as HTMLInputElement;
      const file = input?.files?.[0] ?? null;
      if (!file) return;
      this.processFile(file);
    }

    private processFile(file: File) {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        this._setWarning('Arquivo selecionado não é uma imagem.');
        this.fileChange.emit(null);
        return;
      }
      if (file.size > this.maxFileSize) {
        this._setWarning('Arquivo muito grande.');
        this.fileChange.emit(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = String(reader.result);
        this.fileObj = file;
        this.fileChange.emit(file);
        try { await this.setImage(dataUrl); } catch { this._setWarning('Falha ao carregar a imagem.'); this.fileChange.emit(null); }
      };
      reader.readAsDataURL(file);
    }

    onFrameDragOver(ev: DragEvent) {
      ev.preventDefault(); ev.stopPropagation(); try { this.frameRef.nativeElement.classList.add('dragover'); } catch {}
    }

    onFrameDragLeave(ev: DragEvent) {
      ev.preventDefault(); ev.stopPropagation(); try { this.frameRef.nativeElement.classList.remove('dragover'); } catch {}
    }

    onFrameDrop(ev: DragEvent) {
      ev.preventDefault(); ev.stopPropagation(); try { this.frameRef.nativeElement.classList.remove('dragover'); } catch {}
      const files = ev.dataTransfer?.files; if (files && files.length) { this.processFile(files[0]); }
    }

    onFrameClick(_ev: MouseEvent) {
      // Open file picker only when there is no image (clicking the image is used for panning)
      if (this.imageSrc) return;
      try { this.fileInputRef?.nativeElement?.click(); } catch {}
    }

    async setImage(dataUrl: string): Promise<void> {
      this.imageSrc = dataUrl;
      this._setWarning(null);
    // Evita estado transitório (null) durante a mesma detecção de mudanças no pai.
    this.previewData = null;
      const img = await this._loadImageElement(dataUrl);
      if (!img) { this._setWarning('Falha ao carregar imagem.'); return; }
      this.naturalW = img.naturalWidth || img.width;
      this.naturalH = img.naturalHeight || img.height;
      this.fitImageToFrame();
      this.updatePreview();
    }

    clearImage() {
      this.imageSrc = null; this.previewData = null; this.warning = null; this.fileObj = null;
      this.previewChange.emit(null); this.fileChange.emit(null); this.warnChange.emit(null);
      try { if (this.fileInputRef?.nativeElement) this.fileInputRef.nativeElement.value = ''; } catch {}
    }

    private fitImageToFrame() {
      const rect = this.frameRef.nativeElement.getBoundingClientRect();
      const fw = rect.width || 300;
      const fh = this.frameHeight || Math.round(fw / this.safeRatio());
      const coverScale = Math.max(fw / Math.max(1, this.naturalW), fh / Math.max(1, this.naturalH));
      /* Começa cobrindo o quadro (crop); permite zoom menor para aparecer “sobra” —
         na exportação as áreas vazias usam média das bordas da imagem. */
      this.minScale = Math.max(0.03, coverScale * 0.06);
      this.maxScale = Math.max(coverScale * 4, coverScale + 0.1);
      this.scale = Math.max(coverScale, 0.0001);
      this.displayW = Math.round(this.naturalW * this.scale);
      this.displayH = Math.round(this.naturalH * this.scale);
      this.posX = Math.round((fw - this.displayW) / 2);
      this.posY = Math.round((fh - this.displayH) / 2);
      this._clampPosition();
    }

    private _clampPosition() {
      const rect = this.frameRef.nativeElement.getBoundingClientRect();
      const fw = rect.width || 300;
      const fh = this.frameHeight || Math.round(fw / this.safeRatio());
      if (this.displayW > fw) {
        const minX = fw - this.displayW;
        this.posX = Math.min(Math.max(this.posX, minX), 0);
      } else {
        this.posX = Math.round((fw - this.displayW) / 2);
      }
      if (this.displayH > fh) {
        const minY = fh - this.displayH;
        this.posY = Math.min(Math.max(this.posY, minY), 0);
      } else {
        this.posY = Math.round((fh - this.displayH) / 2);
      }
    }

    // pointer drag
    onPointerDown(ev: PointerEvent) {
      if (!this.imageSrc) return;
      // Use the frame element for pointer capture so dragging works regardless
      try { this.frameRef?.nativeElement?.setPointerCapture?.(ev.pointerId); this.currentPointerId = ev.pointerId; } catch {}
      this.dragging = true;
      this.frameRef?.nativeElement?.classList.add('dragging');
      this.dragStartX = ev.clientX; this.dragStartY = ev.clientY;
      this.startPosX = this.posX; this.startPosY = this.posY;
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
    }

    private _onPointerMove(e: PointerEvent) {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX; const dy = e.clientY - this.dragStartY;
      this.posX = Math.round(this.startPosX + dx); this.posY = Math.round(this.startPosY + dy);
      this._clampPosition(); this.updatePreview();
    }

    private _onPointerUp(e: PointerEvent) {
      if (!this.dragging) return;
      try { if (this.currentPointerId != null) this.frameRef?.nativeElement?.releasePointerCapture?.(this.currentPointerId); } catch {}
      this.currentPointerId = null;
      this.dragging = false; this.frameRef?.nativeElement?.classList.remove('dragging'); window.removeEventListener('pointermove', this.boundPointerMove); window.removeEventListener('pointerup', this.boundPointerUp);
    }

    // wheel zoom
    onWheel(ev: WheelEvent) {
      if (!this.imageSrc) return;
      // Zoom only when CTRL is pressed
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      const rect = this.frameRef.nativeElement.getBoundingClientRect();
      const px = ev.clientX - rect.left; const py = ev.clientY - rect.top;
      const factor = ev.deltaY < 0 ? 1.12 : 0.88;
      this._zoomAt(px, py, factor);
    }

    zoomIn() { const r = this.frameRef.nativeElement.getBoundingClientRect(); this._zoomAt(r.width/2, this.frameHeight/2, 1.12); }
    zoomOut() { const r = this.frameRef.nativeElement.getBoundingClientRect(); this._zoomAt(r.width/2, this.frameHeight/2, 0.88); }

    private _zoomAt(px: number, py: number, factor: number) {
      const oldScale = this.scale; const newScale = Math.max(this.minScale, Math.min(this.maxScale, oldScale * factor));
      const imgX = (px - this.posX) / oldScale; const imgY = (py - this.posY) / oldScale;
      this.scale = newScale; this.displayW = Math.round(this.naturalW * this.scale); this.displayH = Math.round(this.naturalH * this.scale);
      this.posX = Math.round(px - imgX * newScale); this.posY = Math.round(py - imgY * newScale);
      this._clampPosition(); this.updatePreview();
    }

    private updatePreview() {
      if (!this.imageSrc || !this.naturalW || !this.naturalH) { this.previewData = null; this.previewChange.emit(null); return; }
      const frameRect = this.frameRef.nativeElement.getBoundingClientRect();
      const fw = frameRect.width || 300;
      const fh = this.frameHeight || Math.round(fw / this.safeRatio());
      const destW = 320;
      const destH = Math.max(1, Math.round(destW / this.safeRatio()));
      const canvas = document.createElement('canvas');
      canvas.width = destW;
      canvas.height = destH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { this.previewData = null; this.previewChange.emit(null); return; }
      const draw = () => {
        try {
          const imgEl = this.imgRef?.nativeElement;
          if (!imgEl?.naturalWidth) throw new Error('no img');
          this._composeEditorFrame(ctx, destW, destH, imgEl, fw, fh);
          this.previewData = canvas.toDataURL('image/png');
          this.previewChange.emit(this.previewData);
        } catch {
          this._loadImageElement(this.imageSrc!).then((fallback) => {
            if (!fallback) { this.previewData = null; this.previewChange.emit(null); return; }
            try {
              this._composeEditorFrame(ctx, destW, destH, fallback, fw, fh);
              this.previewData = canvas.toDataURL('image/png');
              this.previewChange.emit(this.previewData);
            } catch {
              this.previewData = null;
              this.previewChange.emit(null);
            }
          });
        }
      };
      draw();
    }

    public async exportCroppedBlob(outW?: number, outH?: number): Promise<Blob | null> {
      if (!this.imageSrc || !this.naturalW || !this.naturalH) return null;
      const frameRect = this.frameRef.nativeElement.getBoundingClientRect();
      const fw = frameRect.width || 300;
      const fh = this.frameHeight || Math.round(fw / this.safeRatio());
      let destW: number;
      let destH: number;
      if (outW && outH) { destW = outW; destH = outH; }
      else if (outW) { destW = outW; destH = Math.round(outW / this.safeRatio()); }
      else { destW = 1600; destH = Math.max(1, Math.round(destW / this.safeRatio())); }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, destW);
      canvas.height = Math.max(1, destH);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      let img: HTMLImageElement | null = null;
      const imgEl = this.imgRef?.nativeElement;
      if (imgEl?.complete && imgEl.naturalWidth) img = imgEl;
      else img = await this._loadImageElement(this.imageSrc);
      if (!img) return null;
      try {
        this._composeEditorFrame(ctx, canvas.width, canvas.height, img, fw, fh);
      } catch {
        return null;
      }
      return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88));
    }

    /** Média RGB das faixas de borda (amostragem reduzida para custo razoável). */
    private _sampleBorderMeanColor(img: HTMLImageElement): string {
      const w0 = img.naturalWidth;
      const h0 = img.naturalHeight;
      if (w0 < 2 || h0 < 2) return '#0b1220';
      const maxSide = 640;
      const sc = Math.min(1, maxSide / Math.max(w0, h0));
      const w = Math.max(2, Math.round(w0 * sc));
      const h = Math.max(2, Math.round(h0 * sc));
      const strip = Math.max(1, Math.round(2 * sc));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const sctx = c.getContext('2d', { willReadFrequently: true });
      if (!sctx) return '#0b1220';
      try {
        sctx.drawImage(img, 0, 0, w0, h0, 0, 0, w, h);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        const add = (d: ImageData) => {
          const p = d.data;
          for (let i = 0; i < p.length; i += 4) {
            r += p[i];
            g += p[i + 1];
            b += p[i + 2];
            n++;
          }
        };
        add(sctx.getImageData(0, 0, w, strip));
        add(sctx.getImageData(0, h - strip, w, strip));
        add(sctx.getImageData(0, 0, strip, h));
        add(sctx.getImageData(w - strip, 0, strip, h));
        if (!n) return '#0b1220';
        return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
      } catch {
        return '#0b1220';
      }
    }

    /**
     * Exporta exatamente a moldura fw×fh para destW×destH: primeiro preenche com cor das bordas,
     * depois desenha a imagem inteira na mesma escala/translação do editor (sem “esticar” só o recorte).
     */
    private _composeEditorFrame(
      ctx: CanvasRenderingContext2D,
      destW: number,
      destH: number,
      img: HTMLImageElement,
      fw: number,
      fh: number,
    ): void {
      ctx.fillStyle = this._sampleBorderMeanColor(img);
      ctx.fillRect(0, 0, destW, destH);
      const kx = destW / Math.max(1e-6, fw);
      const ky = destH / Math.max(1e-6, fh);
      const dx = this.posX * kx;
      const dy = this.posY * ky;
      const dImgW = this.displayW * kx;
      const dImgH = this.displayH * ky;
      ctx.drawImage(img, 0, 0, this.naturalW, this.naturalH, dx, dy, dImgW, dImgH);
    }

    private _setWarning(msg: string | null) { this.warning = msg; this.warnChange.emit(msg); }
    private safeRatio(): number { return Number.isFinite(this.expectedRatio) && this.expectedRatio > 0 ? this.expectedRatio : (16 / 9); }

    private _loadImageElement(src: string | null): Promise<HTMLImageElement | null> {
      return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
      });
    }
  }
