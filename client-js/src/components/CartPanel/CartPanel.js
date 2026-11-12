import './CartPanel.css';
import { Component } from '@/core/Component.js';
import { CountdownTimer } from '@/components/CountdownTimer/CountdownTimer.js';
import { AppEvent } from '@/core/events.js';
import { getZoneLabel } from '@/domain/SeatZone.js';
import { selectMySeats, selectCartTotal, selectCanCheckout } from '@/state/selectors.js';
import { formatCurrency } from '@/utils/formatters.js';

/**
 * Panel de carrito y acciones de compra (RF-4, RF-5).
 */
export class CartPanel extends Component {
  #listEl = null;
  #countEl = null;
  #totalEl = null;
  #confirmBtn = null;
  #releaseBtn = null;

  render() {
    const aside = document.createElement('aside');
    aside.className = 'cart';
    aside.innerHTML = `
      <h2 class="cart__title">Resumen de Selección</h2>
      <div class="cart__timer"></div>
      <p class="cart__count">Sin sillas retenidas</p>
      <ul class="cart__list"></ul>
      <div class="cart__total">
        <span>Total a pagar</span>
        <strong class="cart__total-value">${formatCurrency(0)}</strong>
      </div>
      <button type="button" class="btn btn--primary" data-action="checkout">Confirmar Reserva</button>
      <button type="button" class="btn btn--outline" data-action="release-all">Liberar Sillas</button>`;

    this.#listEl = aside.querySelector('.cart__list');
    this.#countEl = aside.querySelector('.cart__count');
    this.#totalEl = aside.querySelector('.cart__total-value');
    this.#confirmBtn = aside.querySelector('[data-action="checkout"]');
    this.#releaseBtn = aside.querySelector('[data-action="release-all"]');
    return aside;
  }

  onMounted() {
    const { store, bus } = this.props;

    const timer = this.addChild(new CountdownTimer({ store, bus }));
    timer.mount(this.element.querySelector('.cart__timer'));

    this.listen(this.element, 'click', (event) => this.#handleClick(event));
    this.addCleanup(store.subscribe(() => this.#refresh()));
    this.#refresh();
  }

  #handleClick(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.disabled) return;

    const { bus } = this.props;
    const { action, seatId } = trigger.dataset;

    if (action === 'remove') bus.emit(AppEvent.SEAT_RELEASE, seatId);
    if (action === 'checkout') bus.emit(AppEvent.CHECKOUT_OPEN);
    if (action === 'release-all') bus.emit(AppEvent.CART_RELEASE_ALL);
  }

  #refresh() {
    const state = this.props.store.getState();
    const seats = selectMySeats(state);

    this.#countEl.textContent = seats.length === 0
      ? 'Sin sillas retenidas'
      : `Sillas en retención (${seats.length})`;

    this.#listEl.replaceChildren(...seats.map((seat) => this.#renderItem(seat)));
    this.#totalEl.textContent = formatCurrency(selectCartTotal(state));

    const canCheckout = selectCanCheckout(state);
    this.#confirmBtn.disabled = !canCheckout;
    this.#releaseBtn.disabled = seats.length === 0 || state.isProcessing;
  }

  #renderItem(seat) {
    const item = document.createElement('li');
    item.className = 'cart__item';
    item.innerHTML = `
      <span class="cart__item-name">Silla ${seat.id}<small>${getZoneLabel(seat.zone)}</small></span>
      <span class="cart__item-price">${formatCurrency(seat.price)}</span>
      <button type="button" class="cart__item-remove" data-action="remove"
              data-seat-id="${seat.id}" aria-label="Liberar silla ${seat.id}">&times;</button>`;
    return item;
  }
}