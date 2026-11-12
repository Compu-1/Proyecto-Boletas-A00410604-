import './CountdownTimer.css';
import { Component } from '@/core/Component.js';
import { APP_CONFIG } from '@/config/appConfig.js';
import { AppEvent } from '@/core/events.js';
import { selectEarliestExpiry } from '@/state/selectors.js';
import { formatCountdown, secondsUntil } from '@/utils/formatters.js';

/**
 * Cuenta regresiva reactiva del bloqueo temporal (RF-3).
 *
 * No almacena los segundos restantes: los recalcula a partir del instante
 * absoluto de vencimiento que reporta el servidor. Así la pestaña sigue
 * mostrando el valor correcto aunque el navegador haya ralentizado los
 * temporizadores en segundo plano.
 */
export class CountdownTimer extends Component {
  #valueEl = null;
  #intervalId = null;
  #expiryNotified = false;

  render() {
    const box = document.createElement('div');
    box.className = 'countdown';
    box.innerHTML = `
      <span class="countdown__label">Tiempo de retención</span>
      <span class="countdown__value" role="timer" aria-live="polite">--:--</span>`;
    this.#valueEl = box.querySelector('.countdown__value');
    return box;
  }

  onMounted() {
    this.addCleanup(this.props.store.subscribe(() => this.#refresh()));

    this.#intervalId = setInterval(() => this.#refresh(), 1000);
    this.addCleanup(() => clearInterval(this.#intervalId));

    this.#refresh();
  }

  #refresh() {
    const expiresAt = selectEarliestExpiry(this.props.store.getState());

    if (expiresAt === 0) {
      this.element.classList.remove('countdown--active', 'countdown--warning');
      this.#valueEl.textContent = '--:--';
      this.#expiryNotified = false;
      return;
    }

    const remaining = secondsUntil(expiresAt);
    this.#valueEl.textContent = formatCountdown(remaining);
    this.element.classList.add('countdown--active');
    this.element.classList.toggle(
      'countdown--warning',
      remaining <= APP_CONFIG.seats.warningThresholdSeconds
    );

    if (remaining === 0 && !this.#expiryNotified) {
      this.#expiryNotified = true;
      this.props.bus.emit(AppEvent.LOCK_EXPIRED);
    }
  }
}