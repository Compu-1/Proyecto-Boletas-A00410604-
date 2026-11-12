import './EventHeader.css';
import logoIcesi from '@/assets/logo-icesi.png';
import { Component } from '@/core/Component.js';
import { ConnectionStatus } from '@/state/appState.js';

const STATUS_LABEL = Object.freeze({
  [ConnectionStatus.CONNECTING]: 'Conectando',
  [ConnectionStatus.ONLINE]: 'En línea',
  [ConnectionStatus.OFFLINE]: 'Sin conexión'
});

/** Encabezado con metadatos del evento y contadores en tiempo real (RF-1). */
export class EventHeader extends Component {
  #subtitleEl = null;
  #statusEl = null;
  #counters = {};

  render() {
    const header = document.createElement('header');
    header.className = 'event-header';
    header.innerHTML = `
      <div class="event-header__identity">
        <img class="event-header__logo" src="${logoIcesi}" alt="Universidad Icesi" />
        <div class="event-header__text">
          <h1 class="event-header__title">Icesi Live Arena</h1>
          <p class="event-header__subtitle">Cargando información del evento…</p>
        </div>
      </div>

      <div class="event-header__metrics">
        <div class="metric"><span class="metric__label">Disponibles</span><strong class="metric__value" data-metric="available">—</strong></div>
        <div class="metric"><span class="metric__label">Retenidas</span><strong class="metric__value" data-metric="locked">—</strong></div>
        <div class="metric"><span class="metric__label">Vendidas</span><strong class="metric__value" data-metric="booked">—</strong></div>
        <div class="metric metric--status">
          <span class="metric__label">Estado</span>
          <strong class="metric__value connection"><i class="connection__dot"></i><span class="connection__text">—</span></strong>
        </div>
      </div>`;

    this.#subtitleEl = header.querySelector('.event-header__subtitle');
    this.#statusEl = header.querySelector('.connection');
    this.#counters = {
      available: header.querySelector('[data-metric="available"]'),
      locked: header.querySelector('[data-metric="locked"]'),
      booked: header.querySelector('[data-metric="booked"]')
    };
    return header;
  }

  onMounted() {
    this.addCleanup(this.props.store.subscribe(() => this.#refresh()));
    this.#refresh();
  }

  #refresh() {
    const { eventInfo, connectionStatus } = this.props.store.getState();

    this.#statusEl.className = `metric__value connection connection--${connectionStatus}`;
    this.#statusEl.querySelector('.connection__text').textContent = STATUS_LABEL[connectionStatus];

    if (!eventInfo) return;

    this.#subtitleEl.textContent =
      `${eventInfo.name} · ${eventInfo.venue} · ${eventInfo.date} · Aforo total: ${eventInfo.totalSeats} sillas`;
    this.#counters.available.textContent = eventInfo.availableSeats;
    this.#counters.locked.textContent = eventInfo.lockedSeats;
    this.#counters.booked.textContent = eventInfo.bookedSeats;
  }
}