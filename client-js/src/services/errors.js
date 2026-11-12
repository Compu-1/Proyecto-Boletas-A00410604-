/** Error base del dominio de reservas. Espejo de BookingException. */
export class BookingError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = new.target.name;
    this.cause = options.cause;
    this.seatId = options.seatId ?? null;
  }
}

export class SeatNotFoundError extends BookingError {}
export class SeatNotAvailableError extends BookingError {}
export class LockExpiredError extends BookingError {}
export class InvalidBookingError extends BookingError {}

/** Falla de transporte: servidor caído o conexión perdida. */
export class ConnectionError extends BookingError {}