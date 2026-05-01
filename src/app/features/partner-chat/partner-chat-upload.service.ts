import { Injectable } from '@angular/core';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { supportStorage } from '../../firebase-config';

@Injectable({ providedIn: 'root' })
export class PartnerChatUploadService {
  /**
   * Caminho alinhado a `storage.rules`: partner_chats/{threadId}/{uid}/{fileName}
   */
  async uploadFile(threadId: string, uid: string, file: File): Promise<PartnerAttachmentDto> {
    const safe = (file.name || 'ficheiro').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const path = `partner_chats/${threadId}/${uid}/${Date.now()}_${safe}`;
    const storageRef = ref(supportStorage, path);
    const contentType = file.type || 'application/octet-stream';
    await uploadBytes(storageRef, file, { contentType });
    const url = await getDownloadURL(storageRef);
    return { url, name: file.name || safe, mime: contentType };
  }
}

export interface PartnerAttachmentDto {
  url: string;
  name: string;
  mime: string;
}
