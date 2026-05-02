import {
  Component,
  OnDestroy,
  AfterViewInit,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../../constants/loja-public';
import { SessionService } from '../../../services/session.service';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-kyc-motorista-global',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './kyc-motorista-global.component.html',
  styleUrls: ['./kyc-motorista-global.component.scss'],
})
export class KycMotoristaGlobalComponent implements AfterViewInit, OnDestroy {
  readonly marca = MARCA_NOME;

  @ViewChild('cameraHost', { static: false }) cameraHost?: ElementRef<HTMLDivElement>;

  motorista: Record<string, unknown> | null = null;
  motoristaErro = false;
  busy = false;
  sdkErro: string | null = null;
  selfiePronta = false;
  cnhFile: File | null = null;
  envioMsg: string | null = null;
  envioErro: string | null = null;

  private sdk: import('petsphere-kyc-sdk').AlphaValid | null = null;
  private selfieBlob: Blob | null = null;
  private cameraStarted = false;

  constructor(
    private title: Title,
    private session: SessionService,
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngAfterViewInit(): void {
    this.title.setTitle(`KYC motorista — ${this.marca}`);
    this.carregarMotorista().then(() => {
      if (this.motorista && isPlatformBrowser(this.platformId)) {
        this.iniciarCamera();
      }
    });
  }

  ngOnDestroy(): void {
    void this.pararSdk();
  }

  get token(): string | null {
    return this.session.getBackendToken();
  }

  carregarMotorista(): Promise<void> {
    const t = this.token;
    if (!t) return Promise.resolve();
    this.motoristaErro = false;
    return new Promise((resolve) => {
      this.api.getClienteTransportePetGlobalMotoristaMe(t).subscribe({
        next: (r) => {
          this.motorista = r.motorista_global;
          resolve();
        },
        error: () => {
          this.motorista = null;
          this.motoristaErro = true;
          resolve();
        },
      });
    });
  }

  enroll(): void {
    const t = this.token;
    if (!t) return;
    this.busy = true;
    this.envioErro = null;
    this.api.enrollClienteTransportePetGlobalMotorista(t, { tier: 'free' }).subscribe({
      next: (r) => {
        this.motorista = r.motorista_global;
        this.busy = false;
        if (isPlatformBrowser(this.platformId)) this.iniciarCamera();
      },
      error: (e) => {
        this.busy = false;
        this.envioErro = e?.error?.error || e?.message || 'Não foi possível concluir a inscrição.';
      },
    });
  }

  private async pararSdk(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.stop();
      } catch {
        /* noop */
      }
      this.sdk = null;
    }
    this.cameraStarted = false;
  }

  private async iniciarCamera(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.cameraStarted) return;
    const host = this.cameraHost?.nativeElement;
    if (!host) return;

    this.sdkErro = null;
    this.selfiePronta = false;
    this.selfieBlob = null;
    await this.pararSdk();

    try {
      const { AlphaValid } = await import('petsphere-kyc-sdk');
      this.sdk = new AlphaValid();

      await this.sdk.start({
        container: host,
        modelsPath: '/assets/kyc-face-models',
        uiMode: 'Mobile',
        userPreview: true,
        captureButton: { enabled: false },
        liveness: { challenges: [{ type: 'lookForward' }] },
        autoCapture: {
          enabled: true,
          stableMs: 600,
          onCapture: () => {},
        },
        onUserPreviewConfirm: (blob: Blob) => {
          this.selfieBlob = blob;
          this.selfiePronta = true;
        },
        onError: () => {},
      });
      this.cameraStarted = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.sdkErro = msg.includes('Models')
        ? 'Modelos faciais não encontrados. Rode npm install na raiz do app e confira public/assets/kyc-face-models.'
        : msg || 'Não foi possível abrir a câmera.';
    }
  }

  onCnhChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    this.cnhFile = f || null;
  }

  podeEnviar(): boolean {
    return !!(this.selfieBlob && this.cnhFile && this.token && this.motorista && !this.busy);
  }

  enviarKyc(): void {
    const t = this.token;
    if (!t || !this.selfieBlob || !this.cnhFile || !this.motorista) return;
    const fd = new FormData();
    fd.append('selfie', this.selfieBlob, 'selfie.jpg');
    fd.append('cnh', this.cnhFile, this.cnhFile.name || 'cnh.jpg');
    this.busy = true;
    this.envioMsg = null;
    this.envioErro = null;
    this.api.submitClienteTransportePetGlobalMotoristaKyc(t, fd).subscribe({
      next: (r) => {
        this.motorista = r.motorista_global;
        this.busy = false;
        this.envioMsg =
          'Documentação enviada. Seu cadastro ficará pendente até a análise da equipe PetSphere.';
        this.selfiePronta = false;
        this.selfieBlob = null;
        this.cnhFile = null;
        void this.pararSdk();
        setTimeout(() => this.iniciarCamera(), 0);
      },
      error: (e) => {
        this.busy = false;
        this.envioErro = e?.error?.error || e?.message || 'Falha no envio.';
      },
    });
  }

  novaSelfie(): void {
    this.selfiePronta = false;
    this.selfieBlob = null;
    void this.pararSdk();
    setTimeout(() => this.iniciarCamera(), 0);
  }
}
