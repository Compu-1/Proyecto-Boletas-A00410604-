import { Component } from '@/core/Component.js';
import { SeatState, SEAT_STATE_LABELS } from '@/domain/SeatState.js';
import { isLockedByClient } from '@/domain/Seat.js';
import { formatCurrency } from '@/utils/formatters.js';

const VARIANT_BY_STATE = Object.freeze({
  [SeatState.AVAILABLE]: 'seat--available',
  [SeatState.LOCKED]: 'seat--held',
  [SeatState.BOOKED]: 'seat--booked'
});

/**
 * Representación de una silla individual.
 *
 * No registra oyentes propios: el clic lo gestiona SeatMap por delegación,
 * de modo que 90 sillas cuestan un único oyente en lugar de noventa.
 */
export class SeatView extends Component {
  #seat;
  #clientId;

  constructor({ seat, clientId }) {
    super({ seat, clientId });
    this.#seat = seat;
    this.#clientId = clientId;
  }

  get seatId() {
    return this.#seat.id;
  }

  render() {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.seatId = this.#seat.id;
    button.textContent = String(this.#seat.number);
    this.#applyState(button);
    return button;
  }

  /** Actualiza el nodo existente en lugar de reconstruirlo. */
  sync(seat, clientId) {
    this.#seat = seat;
    this.#clientId = clientId;
    if (this.element) this.#applyState(this.element);
  }

  #applyState(node) {
    const seat = this.#seat;
    const mine = isLockedByClient(seat, this.#clientId);
    const variant = mine ? 'seat--mine' : VARIANT_BY_STATE[seat.state];

    node.className = `seat ${variant}`;
    node.disabled = seat.state === SeatState.BOOKED || (seat.state === SeatState.LOCKED && !mine);
    node.setAttribute('aria-pressed', String(mine));

    const estado = mine ? 'Retenida por usted' : SEAT_STATE_LABELS[seat.state];
    node.title = `Silla ${seat.id} · ${formatCurrency(seat.price)} · ${estado}`;
    node.setAttribute('aria-label', node.title);
  }
}