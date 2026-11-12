import './SeatMap.css';
import { Component } from '@/core/Component.js';
import { SeatView } from '@/components/SeatMap/SeatView.js';
import { AppEvent } from '@/core/events.js';
import { APP_CONFIG } from '@/config/appConfig.js';
import { selectSeatsGroupedByZone } from '@/state/selectors.js';
import { formatCurrency } from '@/utils/formatters.js';

/** Curvatura de las filas, en píxeles, en el extremo de cada fila. */
const ROW_ARC_PX = 12;

/**
 * Plano interactivo del recinto (RF-1, RF-2).
 *
 * Construye la cuadrícula una sola vez y a partir de ahí solo sincroniza
 * el estado de cada silla, evitando rehacer 90 nodos en cada refresco.
 */
export class SeatMap extends Component {
  #seatViews = new Map();
  #zonesHost = null;
  #statusEl = null;

  render() {
    const section = document.createElement('section');
    section.className = 'hall';
    section.innerHTML = `
      <div class="hall__glow" aria-hidden="true"></div>

      <header class="hall__header">
        <h2 class="hall__title">Distribución de Sillas</h2>
        <p class="hall__status">Cargando aforo…</p>
      </header>

      <div class="stage" aria-hidden="true">
        <div class="stage__beams">
          <span class="stage__beam"></span>
          <span class="stage__beam"></span>
          <span class="stage__beam"></span>
        </div>
        <div class="stage__platform">
          <span class="stage__label">Escenario</span>
        </div>
      </div>

      <div class="hall__zones"></div>

      <footer class="legend">
        <span class="legend__item"><i class="seat seat--available"></i>Disponible</span>
        <span class="legend__item"><i class="seat seat--mine"></i>Seleccionada</span>
        <span class="legend__item"><i class="seat seat--held"></i>Bloqueada por otro</span>
        <span class="legend__item"><i class="seat seat--booked"></i>Vendida</span>
      </footer>`;

    this.#zonesHost = section.querySelector('.hall__zones');
    this.#statusEl = section.querySelector('.hall__status');
    return section;
  }

  onMounted() {
    const { store } = this.props;
    this.addCleanup(store.subscribe(() => this.#syncFromStore()));
    this.listen(this.element, 'click', (event) => this.#handleClick(event));
    this.#syncFromStore();
  }

  #handleClick(event) {
    const button = event.target.closest('button[data-seat-id]');
    if (!button || button.disabled) return;
    this.props.bus.emit(AppEvent.SEAT_TOGGLE, button.dataset.seatId);
  }

  #syncFromStore() {
    const state = this.props.store.getState();
    if (state.seats.length === 0) return;

    if (this.#seatViews.size === 0) {
      this.#buildGrid(state);
    } else {
      state.seats.forEach((seat) => this.#seatViews.get(seat.id)?.sync(seat, state.clientId));
    }

    const info = state.eventInfo;
    this.#statusEl.textContent = info
      ? `${info.availableSeats} disponibles · ${info.lockedSeats} retenidas · ${info.bookedSeats} vendidas`
      : `${state.seats.length} sillas en el recinto`;
  }

  /**
   * Desplazamiento vertical de una silla para simular la curvatura de las
   * filas de un auditorio: las butacas de los extremos quedan más atrás
   * que las del centro, siguiendo una parábola.
   */
  #arcOffset(seatNumber) {
    const { seatsPerRow } = APP_CONFIG.venue;
    const center = (seatsPerRow + 1) / 2;
    const normalized = (seatNumber - center) / (center - 1);
    return (normalized * normalized * ROW_ARC_PX).toFixed(1);
  }

  #buildGrid(state) {
    const fragment = document.createDocumentFragment();
    const aisleAfter = APP_CONFIG.venue.seatsPerRow / 2;

    selectSeatsGroupedByZone(state).forEach(({ zone, rows }) => {
      const zoneEl = document.createElement('section');
      zoneEl.className = `zone zone--${zone.id.toLowerCase()}`;

      const title = document.createElement('h3');
      title.className = 'zone__title';
      title.innerHTML = `
        <span class="zone__name">${zone.label}</span>
        <span class="zone__rule"></span>
        <span class="zone__price">${formatCurrency(zone.price)}</span>`;
      zoneEl.appendChild(title);

      rows.forEach(({ row, seats }) => {
        const rowEl = document.createElement('div');
        rowEl.className = 'zone__row';

        const leftLabel = document.createElement('span');
        leftLabel.className = 'zone__row-label';
        leftLabel.textContent = row;
        rowEl.appendChild(leftLabel);

        seats.forEach((seat) => {
          const view = this.addChild(new SeatView({ seat, clientId: state.clientId }));
          view.mount(rowEl);
          view.element.style.setProperty('--arc-offset', `${this.#arcOffset(seat.number)}px`);
          this.#seatViews.set(seat.id, view);

          // Pasillo central del auditorio
          if (seat.number === aisleAfter) {
            const aisle = document.createElement('span');
            aisle.className = 'zone__aisle';
            aisle.setAttribute('aria-hidden', 'true');
            rowEl.appendChild(aisle);
          }
        });

        const rightLabel = document.createElement('span');
        rightLabel.className = 'zone__row-label';
        rightLabel.textContent = row;
        rowEl.appendChild(rightLabel);

        zoneEl.appendChild(rowEl);
      });

      fragment.appendChild(zoneEl);
    });

    this.#zonesHost.replaceChildren(fragment);
  }
}