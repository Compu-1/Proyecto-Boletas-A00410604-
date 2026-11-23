import './App.css';
import { Component } from '@/core/Component.js';
import { APP_CONFIG } from '@/config/appConfig.js';
import { AppEvent, ToastLevel } from '@/core/events.js';
import { ConnectionStatus } from '@/state/appState.js';
import { selectMySeats } from '@/state/selectors.js';
import { isLockedByClient } from '@/domain/Seat.js';
import { BookingError, ConnectionError } from '@/services/errors.js';

import { EventHeader } from '@/components/EventHeader/EventHeader.js';
import { SeatMap } from '@/components/SeatMap/SeatMap.js';
import { CartPanel } from '@/components/CartPanel/CartPanel.js';
import { CheckoutModal } from '@/components/CheckoutModal/CheckoutModal.js';
import { MyBookings } from '@/components/MyBookings/MyBookings.js';
import { ToastHost } from '@/components/Toast/ToastHost.js';

/**
 * Componente raíz y único controlador de la aplicación.
 *
 * Los componentes de presentación no invocan el servicio remoto: emiten
 * intenciones por el bus de eventos y App las traduce en llamadas al
 * BookingClient. El resultado se escribe en el Store y los componentes
 * reaccionan. Ese flujo unidireccional es lo que mantiene un único punto
 * de contacto con la capa RPC.
 */
export class App extends Component {
  #modal = null;
  #syncTimerId = null;

  render() {
    const root = document.createElement('div');
    root.className = 'app';
    root.innerHTML = `
      <div class="app__header"></div>
      <main class="app__main">
        <div class="app__map"></div>
        <div class="app__side">
          <div class="app__cart"></div>
          <div class="app__bookings"></div>
        </div>
      </main>
      <div class="app__modal"></div>
      <div class="app__toasts"></div>`;
    return root;
  }

  onMounted() {
    const { store, bus } = this.props;
    const deps = { store, bus };

    this.addChild(new EventHeader(deps)).mount(this.element.querySelector('.app__header'));
    this.addChild(new SeatMap(deps)).mount(this.element.querySelector('.app__map'));
    this.addChild(new CartPanel(deps)).mount(this.element.querySelector('.app__cart'));
    this.addChild(new MyBookings(deps)).mount(this.element.querySelector('.app__bookings'));

    this.#modal = this.addChild(new CheckoutModal(deps));
    this.#modal.mount(this.element.querySelector('.app__modal'));

    this.addChild(new ToastHost(deps)).mount(this.element.querySelector('.app__toasts'));

    this.#bindActions();
    this.#start();
  }

  // --------------------------- Enlace de acciones ---------------------------

  #bindActions() {
    const { bus } = this.props;

    this.addCleanup(bus.on(AppEvent.SEAT_TOGGLE, (seatId) => this.#toggleSeat(seatId)));
    this.addCleanup(bus.on(AppEvent.SEAT_RELEASE, (seatId) => this.#releaseSeat(seatId)));
    this.addCleanup(bus.on(AppEvent.CART_RELEASE_ALL, () => this.#releaseAll()));
    this.addCleanup(bus.on(AppEvent.CHECKOUT_OPEN, () => this.#openCheckout()));
    this.addCleanup(bus.on(AppEvent.CHECKOUT_CLOSE, () => this.#closeCheckout()));
    this.addCleanup(bus.on(AppEvent.CHECKOUT_SUBMIT, (data) => this.#confirmBooking(data)));
    this.addCleanup(bus.on(AppEvent.LOCK_EXPIRED, () => this.#handleExpiry()));
  }

  // ------------------------------ Ciclo de vida ------------------------------

  async #start() {
    const { store, bookingClient } = this.props;

    try {
      store.setState({ connectionStatus: ConnectionStatus.CONNECTING });
      await bookingClient.connect();
      store.setState({ connectionStatus: ConnectionStatus.ONLINE });

      await this.#sync();
      await this.#loadBookings();
      this.#startPolling();
      this.#notify('Conectado al servicio de reservas.', ToastLevel.SUCCESS);
    } catch (error) {
      this.#handleError(error);
    }
  }

  /**
   * Sondeo periódico del inventario.
   * Mantiene visibles los cambios provocados por otros clientes (RF-1).
   */
  #startPolling() {
    this.#syncTimerId = setInterval(() => {
      this.#sync().catch((error) => this.#handleError(error));
    }, APP_CONFIG.seats.syncIntervalMs);

    this.addCleanup(() => clearInterval(this.#syncTimerId));
  }

  /**
   * Historial de compras del cliente (RF-6).
   *
   * Se consulta al conectar y después de cada compra, no en cada sondeo:
   * las reservas confirmadas solo cambian cuando este mismo cliente compra.
   */
  async #loadBookings() {
    const { store, bookingClient } = this.props;
    const bookings = await bookingClient.getMyBookings(store.getState().clientId);
    store.setState({ bookings });
  }

  async #sync() {
    const { store, bookingClient } = this.props;
    const [seats, eventInfo] = await Promise.all([
      bookingClient.getAllSeats(),
      bookingClient.getEventInfo()
    ]);
    store.setState({ seats, eventInfo });
  }

  // ---------------------------- Acciones de silla ----------------------------

  async #toggleSeat(seatId) {
    const { store, bookingClient } = this.props;
    const state = store.getState();
    const seat = state.seats.find((candidate) => candidate.id === seatId);
    if (!seat) return;

    try {
      if (isLockedByClient(seat, state.clientId)) {
        await bookingClient.releaseSeat(seatId, state.clientId);
        this.#notify(`Silla ${seatId} liberada.`, ToastLevel.INFO);
      } else {
        await bookingClient.lockSeat(seatId, state.clientId);
        this.#notify(`Silla ${seatId} retenida por ${APP_CONFIG.seats.lockDurationSeconds} segundos.`, ToastLevel.SUCCESS);
      }
      await this.#sync();
    } catch (error) {
      this.#handleError(error);
      await this.#sync().catch(() => {});
    }
  }

  async #releaseSeat(seatId) {
    const { store, bookingClient } = this.props;
    const { clientId } = store.getState();

    try {
      await bookingClient.releaseSeat(seatId, clientId);
      this.#notify(`Silla ${seatId} liberada.`, ToastLevel.INFO);
      await this.#sync();
    } catch (error) {
      this.#handleError(error);
    }
  }

  async #releaseAll() {
    const { store, bookingClient } = this.props;
    const state = store.getState();
    const seats = selectMySeats(state);
    if (seats.length === 0) return;

    try {
      await Promise.all(seats.map((seat) => bookingClient.releaseSeat(seat.id, state.clientId)));
      this.#notify('Todas las sillas fueron liberadas.', ToastLevel.INFO);
      await this.#sync();
    } catch (error) {
      this.#handleError(error);
    }
  }

  // ------------------------------- Checkout ---------------------------------

  #openCheckout() {
    const { store } = this.props;
    if (selectMySeats(store.getState()).length === 0) {
      this.#notify('Seleccione al menos una silla antes de continuar.', ToastLevel.WARNING);
      return;
    }
    store.setState({ isCheckoutOpen: true, lastBooking: null });
  }

  #closeCheckout() {
    this.props.store.setState({ isCheckoutOpen: false, lastBooking: null });
    this.#modal.resetForm();
  }

  async #confirmBooking({ customerName, customerEmail }) {
    const { store, bookingClient } = this.props;
    const state = store.getState();
    const seatIds = selectMySeats(state).map((seat) => seat.id);

    store.setState({ isProcessing: true });

    try {
      const result = await bookingClient.confirmBooking(seatIds, state.clientId, customerName, customerEmail);
      store.setState({ isProcessing: false, lastBooking: result });
      this.#notify(`Reserva ${result.bookingCode} confirmada.`, ToastLevel.SUCCESS);
      await this.#sync();
      await this.#loadBookings();
    } catch (error) {
      store.setState({ isProcessing: false });
      this.#handleError(error);
      await this.#sync().catch(() => {});
    }
  }

  #handleExpiry() {
    this.#notify('La retención expiró y las sillas volvieron a estar disponibles.', ToastLevel.WARNING);
    this.props.store.setState({ isCheckoutOpen: false });
    this.#sync().catch((error) => this.#handleError(error));
  }

  // ----------------------------- Utilidades ---------------------------------

  #notify(message, level = ToastLevel.INFO) {
    this.props.bus.emit(AppEvent.TOAST_SHOW, { message, level });
  }

  /** Traduce cualquier fallo remoto a una notificación comprensible (RF-7). */
  #handleError(error) {
    if (error instanceof ConnectionError) {
      this.props.store.setState({ connectionStatus: ConnectionStatus.OFFLINE });
      this.#notify('Se perdió la conexión con el servidor de reservas.', ToastLevel.ERROR);
      return;
    }

    if (error instanceof BookingError) {
      this.#notify(error.message, ToastLevel.ERROR);
      return;
    }

    console.error('[App] Error no controlado:', error);
    this.#notify('Ocurrió un error inesperado. Intente nuevamente.', ToastLevel.ERROR);
  }
}