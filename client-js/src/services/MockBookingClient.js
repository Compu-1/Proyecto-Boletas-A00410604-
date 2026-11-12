import { APP_CONFIG } from '@/config/appConfig.js';
import { BookingClient } from '@/services/BookingClient.js';
import { buildSeatCatalog } from '@/domain/seatCatalog.js';
import { SeatState } from '@/domain/SeatState.js';
import {
  withChanges,
  isAvailable,
  isLocked,
  isLockExpired,
  isLockedByClient
} from '@/domain/Seat.js';
import {
  SeatNotFoundError,
  SeatNotAvailableError,
  InvalidBookingError,
  ConnectionError
} from '@/services/errors.js';

const SIMULATED_LATENCY_MS = 120;
const BOOKING_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

const delay = (ms = SIMULATED_LATENCY_MS) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function generateBookingCode() {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += BOOKING_CODE_ALPHABET[Math.floor(Math.random() * BOOKING_CODE_ALPHABET.length)];
  }
  return `RES-${suffix}`;
}

/**
 * Implementación simulada del contrato BookingClient.
 *
 * Reproduce el comportamiento del backend ZeroC Ice en memoria para poder
 * construir y validar toda la interfaz antes de la integración RPC.
 * Se reemplaza por IceBookingClient en la sesión 2 sin tocar los componentes.
 */
export class MockBookingClient extends BookingClient {
  #seats = new Map();
  #bookings = [];
  #connected = false;

  async connect() {
    await delay();
    this.#loadCatalog();
    this.#connected = true;
  }

  async disconnect() {
    this.#connected = false;
    this.#seats.clear();
  }

  isConnected() {
    return this.#connected;
  }

  // --------------------------- Estado interno ---------------------------

  #loadCatalog() {
    this.#seats = new Map(buildSeatCatalog().map((seat) => [seat.id, seat]));
    this.#bookings = [];
  }

  #assertConnected() {
    if (!this.#connected) {
      throw new ConnectionError('No hay conexión activa con el servicio de reservas.');
    }
  }

  /**
   * Libera los bloqueos vencidos. El servidor real lo hace de forma
   * perezosa en cada operación; aquí se replica esa misma política.
   */
  #expireLocks(nowMs = Date.now()) {
    this.#seats.forEach((seat, id) => {
      if (isLocked(seat) && isLockExpired(seat, nowMs)) {
        this.#seats.set(
          id,
          withChanges(seat, {
            state: SeatState.AVAILABLE,
            lockedByClientId: '',
            lockTimestamp: 0,
            lockDurationSeconds: 0
          })
        );
      }
    });
  }

  #requireSeat(seatId) {
    const seat = this.#seats.get(seatId);
    if (!seat) {
      throw new SeatNotFoundError(`La silla ${seatId} no existe.`, { seatId });
    }
    return seat;
  }

  // ------------------------------ Consultas ------------------------------

  async getEventInfo() {
    this.#assertConnected();
    await delay();
    this.#expireLocks();

    const seats = [...this.#seats.values()];
    const countBy = (state) => seats.filter((seat) => seat.state === state).length;
    const [vip, platea, general] = APP_CONFIG.venue.zones;

    return {
      id: 'EVT-001',
      name: 'Concierto Anual',
      date: '2026-12-05 20:00',
      venue: APP_CONFIG.venue.name,
      totalSeats: seats.length,
      availableSeats: countBy(SeatState.AVAILABLE),
      lockedSeats: countBy(SeatState.LOCKED),
      bookedSeats: countBy(SeatState.BOOKED),
      vipPrice: vip.price,
      plateaPrice: platea.price,
      generalPrice: general.price
    };
  }

  async getAllSeats() {
    this.#assertConnected();
    await delay();
    this.#expireLocks();
    return [...this.#seats.values()];
  }

  async getSeatsByZone(zone) {
    const seats = await this.getAllSeats();
    return seats.filter((seat) => seat.zone === zone);
  }

  async getSeat(seatId) {
    this.#assertConnected();
    await delay();
    this.#expireLocks();
    return this.#requireSeat(seatId);
  }

  // ------------------------- Operaciones de reserva -------------------------

  async lockSeat(seatId, clientId) {
    this.#assertConnected();
    await delay();

    const now = Date.now();
    this.#expireLocks(now);
    const seat = this.#requireSeat(seatId);

    // Renovación: el mismo cliente vuelve a bloquear una silla que ya retiene.
    const renewable = isLockedByClient(seat, clientId);

    if (!isAvailable(seat) && !renewable) {
      throw new SeatNotAvailableError(
        `La silla ${seatId} no está disponible en este momento.`,
        { seatId }
      );
    }

    const duration = APP_CONFIG.seats.lockDurationSeconds;
    this.#seats.set(
      seatId,
      withChanges(seat, {
        state: SeatState.LOCKED,
        lockedByClientId: clientId,
        lockTimestamp: now,
        lockDurationSeconds: duration
      })
    );

    return {
      success: true,
      seatId,
      message: renewable ? 'Bloqueo renovado.' : 'Silla bloqueada temporalmente.',
      expiresAt: now + duration * 1000
    };
  }

  async releaseSeat(seatId, clientId) {
    this.#assertConnected();
    await delay();
    this.#expireLocks();

    const seat = this.#requireSeat(seatId);
    if (!isLockedByClient(seat, clientId)) return false;

    this.#seats.set(
      seatId,
      withChanges(seat, {
        state: SeatState.AVAILABLE,
        lockedByClientId: '',
        lockTimestamp: 0,
        lockDurationSeconds: 0
      })
    );
    return true;
  }

  async confirmBooking(seatIds, clientId, customerName, customerEmail) {
    this.#assertConnected();
    await delay(SIMULATED_LATENCY_MS * 2);

    const now = Date.now();
    this.#expireLocks(now);

    if (!Array.isArray(seatIds) || seatIds.length === 0) {
      throw new InvalidBookingError('No hay sillas seleccionadas para confirmar.');
    }

    // Validación previa: o se confirman todas, o no se confirma ninguna.
    const seats = seatIds.map((seatId) => {
      const seat = this.#requireSeat(seatId);
      if (!isLockedByClient(seat, clientId)) {
        throw new InvalidBookingError(
          `El bloqueo de la silla ${seatId} expiró o pertenece a otro cliente.`,
          { seatId }
        );
      }
      return seat;
    });

    const totalAmount = seats.reduce((sum, seat) => sum + seat.price, 0);
    const bookingCode = generateBookingCode();

    seats.forEach((seat) => {
      this.#seats.set(
        seat.id,
        withChanges(seat, {
          state: SeatState.BOOKED,
          lockedByClientId: clientId,
          lockTimestamp: now,
          lockDurationSeconds: 0
        })
      );
    });

    const record = {
      bookingCode,
      eventId: 'EVT-001',
      clientId,
      customerName,
      customerEmail,
      seatIds: [...seatIds],
      totalAmount,
      timestamp: now
    };
    this.#bookings.push(record);

    return {
      success: true,
      bookingCode,
      message: 'Reserva confirmada con éxito.',
      seatIds: [...seatIds],
      totalAmount,
      timestamp: now
    };
  }

  // --------------------------- Consultas por cliente ------------------------

  async getMyLockedSeats(clientId) {
    const seats = await this.getAllSeats();
    return seats.filter((seat) => isLockedByClient(seat, clientId));
  }

  async getMyBookings(clientId) {
    this.#assertConnected();
    await delay();
    return this.#bookings.filter((booking) => booking.clientId === clientId);
  }

  // ------------------------------- Utilidad --------------------------------

  async resetSeats() {
    this.#assertConnected();
    await delay();
    this.#loadCatalog();
  }
}