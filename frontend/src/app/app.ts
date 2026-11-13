import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly deviceService = inject(DeviceService);

  ngOnInit(): void {
    const username = this.auth.username();
    if (username) {
//       void this.deviceService.register(username);
    }
  }

  protected logout(): void {
    this.auth.logout();
  }
}
