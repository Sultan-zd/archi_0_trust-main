import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService } from '../api.service';
import { Decision, Station } from '../models';
import { errorMessage } from '../util';

@Component({
  selector: 'app-fleet-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fleet-dashboard.html',
  styleUrls: ['./fleet-dashboard.css'],
})
export class FleetDashboardPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  protected readonly stations = signal<Station[]>([]);
  protected readonly accessGranted = signal(false);
  protected readonly accessDenied = signal(false);
  protected readonly busy = signal(false);
  protected readonly stopBusy = signal<number | null>(null);
  protected readonly error = signal('');
  private timer?: ReturnType<typeof setInterval>;

  protected readonly buttonLabel = computed(() => this.busy() ? 'Vérification en cours…' : "Déverrouiller l'accès");
  protected readonly availableCount = () => this.stations().filter(s => s.available).length;
  protected readonly busyCount = () => this.stations().filter(s => !s.available).length;
  protected readonly stopButtonLabel = (id: number) => this.stopBusy() === id ? 'Arrêt…' : 'Arrêter la charge';

  ngOnInit(): void {}

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  protected async requestAccess(): Promise<void> {
    this.busy.set(true);
    this.accessDenied.set(false);
    try {
      const decision: Decision = await this.api.checkAccess('fleet:dashboard');
      if (decision.decision === 'ALLOW') {
        this.accessGranted.set(true);
        await this.loadStations();
        this.timer = setInterval(() => void this.loadStations(), 5000);
      } else {
        this.accessDenied.set(true);
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async loadStations(): Promise<void> {
    try {
      this.stations.set(await this.api.stations());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async stop(s: Station): Promise<void> {
    if (s.activeSessionId === null) return;
    this.stopBusy.set(s.id);
    try {
      await this.api.stopSession(s.activeSessionId);
      await this.loadStations();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.stopBusy.set(null);
    }
  }
}
