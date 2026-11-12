import './ToastHost.css';
import { Component } from '@/core/Component.js';
import { APP_CONFIG } from '@/config/appConfig.js';
import { AppEvent, ToastLevel } from '@/core/events.js';

/**
 * Contenedor de notificaciones efímeras (RF-7).
 *
 * Cada temporizador se registra para ser cancelado en destroy(), de modo
 * que no queden callbacks pendientes sobre nodos ya eliminados.
 */
export class ToastHost extends Component {
  render() {
    const host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    return host;
  }

  onMounted() {
    this.addCleanup(
      this.props.bus.on(AppEvent.TOAST_SHOW, (payload) => this.#show(payload))
    );
  }

  #show({ message, level = ToastLevel.INFO }) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${level}`;
    toast.textContent = message;
    this.element.appendChild(toast);

    const timeoutId = setTimeout(() => {
      toast.classList.add('toast--leaving');
      setTimeout(() => toast.remove(), 200);
    }, APP_CONFIG.ui.toastDurationMs);

    this.addCleanup(() => clearTimeout(timeoutId));
  }
}