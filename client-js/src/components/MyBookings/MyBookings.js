import './MyBookings.css';
import { Component } from '@/core/Component.js';
import { formatCurrency } from '@/utils/formatters.js';

/**
 * Historial de compras confirmadas del cliente (RF-6).
 *
 * Los datos no se guardan en el navegador: se consultan al servidor con
 * getMyBookings(clientId), de modo que el historial sobrevive a una recarga
 * de la página mientras dure el identificador de sesión.
 */
export class MyBookings extends Component {
  #listEl = null;
  #emptyEl = null;
  #countEl = null;

  render() {
    const section = document.createElement('section');
    section.className = 'bookings';
    section.innerHTML = `
      <header class="bookings__header">
        <h2 class="bookings__title">Mis Reservas</h2>
        <span class="bookings__count">0</span>
      </header>
      <p class="bookings__empty">Aún no tienes compras confirmadas en esta sesión.</p>
      <ul class="bookings__list"></ul>`;

    this.#listEl = section.querySelector('.bookings__list');
    this.#emptyEl = section.querySelector('.bookings__empty');
    this.#countEl = section.querySelector('.bookings__count');
    return section;
  }

  onMounted() {
    this.addCleanup(this.props.store.subscribe(() => this.#refresh()));
    this.#refresh();
  }

  #refresh() {
    const { bookings } = this.props.store.getState();

    this.#countEl.textContent = bookings.length;
    this.#emptyEl.hidden = bookings.length > 0;

    const ordered = [...bookings].sort((a, b) => b.timestamp - a.timestamp);
    this.#listEl.replaceChildren(...ordered.map((booking) => this.#renderItem(booking)));
  }

  #renderItem(booking) {
    const item = document.createElement('li');
    item.className = 'bookings__item';

    const fecha = new Date(booking.timestamp).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });

    item.innerHTML = `
      <div class="bookings__row">
        <span class="bookings__code">${booking.bookingCode}</span>
        <span class="bookings__total">${formatCurrency(booking.totalAmount)}</span>
      </div>
      <div class="bookings__row bookings__row--meta">
        <span>Sillas ${booking.seatIds.join(', ')}</span>
        <span>${fecha}</span>
      </div>`;
    return item;
  }
}