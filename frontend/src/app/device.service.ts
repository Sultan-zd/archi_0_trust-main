import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  get(): string {
    let id = localStorage.getItem('ztb_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem('ztb_device_id', id);
    }
    return id;
  }

  async register(_username: string): Promise<void> {
    // Désactivé : l'enregistrement se fait uniquement via le script de seed.
  }
}
