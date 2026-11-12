import './CheckoutModal.css';
import { Component } from '@/core/Component.js';
import { AppEvent } from '@/core/events.js';
import { selectMySeats, selectCartTotal, selectEarliestExpiry } from '@/state/selectors.js';
import { formatCurrency, formatCountdown, secondsUntil } from '@/utils/formatters.js';
import { validateCheckoutForm } from '@/utils/validators.js';

/**
 * Modal de checkout y comprobante de reserva (RF-5).
 *
 * El formulario se construye una sola vez y nunca se re-renderiza: solo se
 * actualizan el resumen y los mensajes de error. Reconstruirlo en cada
 * cambio de estado haría perder el foco y el texto mientras se escribe.
 */
export class CheckoutModal extends Component {
  #dialogEl = null;
  #summaryEl = null;
  #formEl = null;
  #receiptEl = null;
  #submitBtn = null;
  #wasOpen = false;

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="modal__backdrop" data-action="close"></div>
      <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        <header class="modal__header">
          <h2 id="checkout-title">Datos del Comprador</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Cerrar">&times;</button>
        </header>

        <p class="modal__summary"></p>

        <form class="modal__form" novalidate>
          <label class="field">
            <span class="field__label">Nombre completo</span>
            <input class="field__input" name="customerName" type="text" autocomplete="name" required />
            <span class="field__error" data-error="customerName"></span>
          </label>

          <label class="field">
            <span class="field__label">Correo electrónico</span>
            <input class="field__input" name="customerEmail" type="email" autocomplete="email" required />
            <span class="field__error" data-error="customerEmail"></span>
          </label>

          <button type="submit" class="btn btn--primary">Finalizar y Pagar</button>
          <button type="button" class="btn btn--outline" data-action="close">Volver al Plano</button>
        </form>

        <section class="receipt" hidden>
          <span class="receipt__seal" aria-hidden="true">&check;</span>
          <h3 class="receipt__title">Comprobante generado</h3>
          <p class="receipt__message">Reserva confirmada con éxito</p>
          <p class="receipt__code"></p>
          <p class="receipt__detail"></p>
          <button type="button" class="btn btn--outline" data-action="close">Cerrar</button>
        </section>
      </div>`;

    this.#dialogEl = overlay.querySelector('.modal__dialog');
    this.#summaryEl = overlay.querySelector('.modal__summary');
    this.#formEl = overlay.querySelector('.modal__form');
    this.#receiptEl = overlay.querySelector('.receipt');
    this.#submitBtn = overlay.querySelector('button[type="submit"]');
    return overlay;
  }

  onMounted() {
    const { store, bus } = this.props;

    this.listen(this.element, 'click', (event) => {
      if (event.target.closest('[data-action="close"]')) bus.emit(AppEvent.CHECKOUT_CLOSE);
    });

    this.listen(this.#formEl, 'submit', (event) => this.#handleSubmit(event));

    this.listen(document, 'keydown', (event) => {
      if (event.key === 'Escape' && !this.element.hidden) bus.emit(AppEvent.CHECKOUT_CLOSE);
    });

    this.addCleanup(store.subscribe(() => this.#refresh()));
    this.#refresh();
  }

  #handleSubmit(event) {
    event.preventDefault();

    const data = {
      customerName: this.#formEl.elements.customerName.value.trim(),
      customerEmail: this.#formEl.elements.customerEmail.value.trim()
    };

    const errors = validateCheckoutForm(data);
    this.#paintErrors(errors);

    if (Object.keys(errors).length === 0) {
      this.props.bus.emit(AppEvent.CHECKOUT_SUBMIT, data);
    }
  }

  #paintErrors(errors) {
    this.#formEl.querySelectorAll('[data-error]').forEach((node) => {
      const message = errors[node.dataset.error] ?? '';
      node.textContent = message;
      node.closest('.field').classList.toggle('field--invalid', Boolean(message));
    });
  }

  #refresh() {
    const state = this.props.store.getState();
    const isOpen = state.isCheckoutOpen;

    this.element.hidden = !isOpen;
    document.body.classList.toggle('is-modal-open', isOpen);

    if (!isOpen) {
      this.#wasOpen = false;
      return;
    }

    const showReceipt = Boolean(state.lastBooking);
    this.#formEl.hidden = showReceipt;
    this.#receiptEl.hidden = !showReceipt;
    this.#summaryEl.hidden = showReceipt;
    this.#submitBtn.disabled = state.isProcessing;
    this.#submitBtn.textContent = state.isProcessing ? 'Procesando…' : 'Finalizar y Pagar';

    if (showReceipt) {
      const booking = state.lastBooking;
      this.#receiptEl.querySelector('.receipt__code').textContent = `Código: ${booking.bookingCode}`;
      this.#receiptEl.querySelector('.receipt__detail').textContent =
        `Sillas ${booking.seatIds.join(', ')} · Total ${formatCurrency(booking.totalAmount)}`;
    } else {
      const seats = selectMySeats(state);
      const remaining = secondsUntil(selectEarliestExpiry(state));
      this.#summaryEl.textContent = seats.length === 0
        ? 'No hay sillas retenidas.'
        : `Sillas ${seats.map((s) => s.id).join(', ')} · Total ${formatCurrency(selectCartTotal(state))} · Retención: ${formatCountdown(remaining)}`;
    }

    // Enfoca el primer campo solo al abrirse, no en cada refresco.
    if (!this.#wasOpen) {
      this.#wasOpen = true;
      this.#paintErrors({});
      if (!showReceipt) this.#formEl.elements.customerName.focus();
    }
  }

  /** Limpia el formulario tras una compra exitosa. */
  resetForm() {
    this.#formEl.reset();
    this.#paintErrors({});
  }
}