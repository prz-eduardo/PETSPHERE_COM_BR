import type { AlphaValidSdkError } from '../types/sdk';

function mapGetUserMediaError(err: unknown): AlphaValidSdkError {
  const anyErr = err as { name?: string; message?: string };
  const name = anyErr?.name;

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { code: 'CAMERA_PERMISSION_DENIED', message: 'Permissão de câmera negada pelo usuário.', cause: err };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return { code: 'CAMERA_NOT_FOUND', message: 'Nenhuma câmera disponível no dispositivo.', cause: err };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return { code: 'CAMERA_NOT_READABLE', message: 'Não foi possível acessar a câmera (pode estar em uso por outro app).', cause: err };
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return { code: 'CAMERA_OVERCONSTRAINED', message: 'Restrições de câmera não suportadas para este dispositivo.', cause: err };
  }
  if (name === 'NotSupportedError') {
    return { code: 'CAMERA_NOT_SUPPORTED', message: 'Navegador/dispositivo não suporta captura de câmera.', cause: err };
  }

  return {
    code: 'CAMERA_UNKNOWN',
    message: anyErr?.message || 'Erro desconhecido ao abrir a câmera.',
    cause: err
  };
}

export interface CameraHandle {
  video: HTMLVideoElement;
  stream: MediaStream;
  stop: () => void;
}

export async function startUserCamera(container: HTMLElement): Promise<CameraHandle> {
  let stream: MediaStream;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw { name: 'NotSupportedError' };
    }
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }
    });
  } catch (err) {
    throw mapGetUserMediaError(err);
  }

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;

  // Make it fill container; user can override via CSS
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';

  // Front camera UX: mirror the preview (like selfies). This only affects display, not the underlying pixels.
  video.style.transform = 'scaleX(-1)';
  video.style.transformOrigin = 'center';

  container.appendChild(video);

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      resolve();
    };
    const onError = () => {
      video.removeEventListener('error', onError);
      reject(new Error('Failed to load camera stream into video element'));
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });

  const stop = () => {
    stream.getTracks().forEach((t) => t.stop());
    try {
      (video as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null;
    } catch {
      // ignore
    }
    if (video.parentElement) video.parentElement.removeChild(video);
  };

  return { video, stream, stop };
}

export async function captureVideoFrameToJpegBlob(video: HTMLVideoElement, quality = 0.9): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  ctx?.drawImage(video, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to capture image blob'));
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}
