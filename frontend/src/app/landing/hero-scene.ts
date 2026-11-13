import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

/**
 * Scène 3D du hero (CSS 3D, sans bibliothèque) : maquette d'une décision Zero Trust en perspective,
 * entourée de cartes flottantes à différentes profondeurs. La scène s'incline légèrement avec la souris.
 */
@Component({
  selector: 'app-hero-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.css',
  host: {
    '(pointermove)': 'onMove($event)',
    '(pointerleave)': 'reset()',
    '[style.--tilt-x.deg]': 'tiltX()',
    '[style.--tilt-y.deg]': 'tiltY()',
  },
})
export class HeroScene {
  protected readonly tiltX = signal(0);
  protected readonly tiltY = signal(0);

  private readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected onMove(event: PointerEvent): void {
    if (this.reducedMotion || event.pointerType === 'touch') return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    this.tiltX.set(Math.round(x * 16 * 10) / 10);
    this.tiltY.set(Math.round(-y * 10 * 10) / 10);
  }

  protected reset(): void {
    this.tiltX.set(0);
    this.tiltY.set(0);
  }
}
