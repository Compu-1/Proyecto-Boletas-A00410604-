/**
 * Contrato de acceso al servicio remoto de reservas.
 *
 * Replica la interfaz BookingService definida en BookingService.ice.
 * Los componentes dependen de esta abstracción y nunca de una
 * implementación concreta, de modo que sustituir el simulador por el
 * proxy real de ZeroC Ice no obliga a modificar la interfaz de usuario.
 */
export class BookingClient {
  constructor() {
    if (new.target === BookingClient) {
      throw new TypeError('BookingClient es abstracta: use una implementación concreta.');
    }
  }

  #notImplemented(method) {
    throw new Error(`${this.constructor.name} debe implementar ${method}().`);
  }

  // ---------------------- Ciclo de vida de la conexión ----------------------
  async connect() { this.#notImplemented('connect'); }
  async disconnect() { this.#notImplemented('disconnect'); }
  isConnected() { this.#notImplemented('isConnected'); }

  // ------------------------------ Consultas --------------------------------
  async getEventInfo() { this.#notImplemented('getEventInfo'); }
  async getAllSeats() { this.#notImplemented('getAllSeats'); }
  async getSeatsByZone(zone) { this.#notImplemented('getSeatsByZone'); }
  async getSeat(seatId) { this.#notImplemented('getSeat'); }

  // ------------------------- Operaciones de reserva -------------------------
  async lockSeat(seatId, clientId) { this.#notImplemented('lockSeat'); }
  async releaseSeat(seatId, clientId) { this.#notImplemented('releaseSeat'); }
  async confirmBooking(seatIds, clientId, customerName, customerEmail) {
    this.#notImplemented('confirmBooking');
  }

  // --------------------------- Consultas por cliente ------------------------
  async getMyLockedSeats(clientId) { this.#notImplemented('getMyLockedSeats'); }
  async getMyBookings(clientId) { this.#notImplemented('getMyBookings'); }

  // ------------------------------- Utilidad --------------------------------
  async resetSeats() { this.#notImplemented('resetSeats'); }
}