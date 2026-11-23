import { APP_CONFIG } from '@/config/appConfig.js';
import { BookingApp, Ice } from '@/generated/bookingApp.js';
import { BookingClient } from '@/services/BookingClient.js';
import { createSeat, toMillis } from '@/domain/Seat.js';
import {
  BookingError,
  SeatNotFoundError,
  SeatNotAvailableError,
  LockExpiredError,
  InvalidBookingError,
  ConnectionError
} from '@/services/errors.js';

/**
 * Implementación del contrato BookingClient sobre ZeroC Ice (RNF-4).
 *
 * Es el único punto del frontend que conoce tipos de Ice: traduce las
 * estructuras y excepciones remotas a objetos y errores del dominio, de modo
 * que los componentes sigan sin depender del transporte.
 */
export class IceBookingClient extends BookingClient {
  #communicator = null;
  #proxy = null;

  // ---------------------- Ciclo de vida de la conexión ----------------------

  async connect() {
    if (this.#proxy) return;

    const { endpoint, proxyName, invocationTimeoutMs } = APP_CONFIG.rpc;

    try {
      const properties = Ice.createProperties();
      properties.setProperty('Ice.Default.InvocationTimeout', String(invocationTimeoutMs));

      const initData = new Ice.InitializationData();
      initData.properties = properties;
      this.#communicator = Ice.initialize(initData);

      // ws://localhost:10002  ->  "BookingService:ws -h localhost -p 10002"
      const { hostname, port } = new URL(endpoint);
      const base = this.#communicator.stringToProxy(`${proxyName}:ws -h ${hostname} -p ${port}`);

      // checkedCast comprueba contra el servidor que el objeto implementa
      // la interfaz; es la primera llamada remota real.
      const proxy = await BookingApp.BookingServicePrx.checkedCast(base);

      if (proxy === null) {
        throw new ConnectionError(`El servidor no expone un objeto "${proxyName}" con la interfaz BookingService.`);
      }

      this.#proxy = proxy;
    } catch (error) {
      await this.#destroyCommunicator();
      throw this.#translate(error);
    }
  }

  async disconnect() {
    this.#proxy = null;
    await this.#destroyCommunicator();
  }

  isConnected() {
    return this.#proxy !== null;
  }

  async #destroyCommunicator() {
    if (!this.#communicator) return;
    try {
      await this.#communicator.destroy();
    } catch {
      // Cerrar el comunicador nunca debe propagar un error al usuario.
    }
    this.#communicator = null;
  }

  #requireProxy() {
    if (!this.#proxy) {
      throw new ConnectionError('No hay conexión activa con el servicio de reservas.');
    }
    return this.#proxy;
  }

  /** Ejecuta una llamada remota traduciendo cualquier fallo al dominio. */
  async #invoke(operation) {
    try {
      return await operation(this.#requireProxy());
    } catch (error) {
      throw this.#translate(error);
    }
  }

  // ------------------------------ Consultas --------------------------------

  async getEventInfo() {
    const info = await this.#invoke((prx) => prx.getEventInfo());
    return {
      id: info.id,
      name: info.name,
      date: info.date,
      venue: info.venue,
      totalSeats: info.totalSeats,
      availableSeats: info.availableSeats,
      lockedSeats: info.lockedSeats,
      bookedSeats: info.bookedSeats,
      vipPrice: info.vipPrice,
      plateaPrice: info.plateaPrice,
      generalPrice: info.generalPrice
    };
  }

  async getAllSeats() {
    const seats = await this.#invoke((prx) => prx.getAllSeats());
    return seats.map((seat) => createSeat(seat));
  }

  async getSeatsByZone(zone) {
    const iceZone = BookingApp.SeatZone[zone];
    if (!iceZone) throw new BookingError(`Zona desconocida: ${zone}`);
    const seats = await this.#invoke((prx) => prx.getSeatsByZone(iceZone));
    return seats.map((seat) => createSeat(seat));
  }

  async getSeat(seatId) {
    const seat = await this.#invoke((prx) => prx.getSeat(seatId));
    return createSeat(seat);
  }

  // ------------------------- Operaciones de reserva -------------------------

  async lockSeat(seatId, clientId) {
    const result = await this.#invoke((prx) => prx.lockSeat(seatId, clientId));
    return {
      success: result.success,
      seatId: result.seatId,
      message: result.message,
      expiresAt: toMillis(result.expiresAt)
    };
  }

  async releaseSeat(seatId, clientId) {
    return this.#invoke((prx) => prx.releaseSeat(seatId, clientId));
  }

  async confirmBooking(seatIds, clientId, customerName, customerEmail) {
    const result = await this.#invoke((prx) =>
      prx.confirmBooking(seatIds, clientId, customerName, customerEmail)
    );
    return {
      success: result.success,
      bookingCode: result.bookingCode,
      message: result.message,
      seatIds: [...result.seatIds],
      totalAmount: result.totalAmount,
      timestamp: toMillis(result.timestamp)
    };
  }

  // --------------------------- Consultas por cliente ------------------------

  async getMyLockedSeats(clientId) {
    const seats = await this.#invoke((prx) => prx.getMyLockedSeats(clientId));
    return seats.map((seat) => createSeat(seat));
  }

  async getMyBookings(clientId) {
    const records = await this.#invoke((prx) => prx.getMyBookings(clientId));
    return records.map((record) => ({
      bookingCode: record.bookingCode,
      eventId: record.eventId,
      clientId: record.clientId,
      customerName: record.customerName,
      customerEmail: record.customerEmail,
      seatIds: [...record.seatIds],
      totalAmount: record.totalAmount,
      timestamp: toMillis(record.timestamp)
    }));
  }

  // ------------------------------- Utilidad --------------------------------

  async resetSeats() {
    await this.#invoke((prx) => prx.resetSeats());
  }

  // ------------------------- Traducción de errores --------------------------

  /**
   * Convierte una excepción de Ice en un error del dominio (RF-7).
   * Las excepciones derivadas se comprueban antes que BookingException,
   * que es su clase base en el contrato Slice.
   */
  #translate(error) {
    if (error instanceof BookingError) return error;

    if (error instanceof BookingApp.SeatNotFoundException) {
      return new SeatNotFoundError(error.reason || 'La silla solicitada no existe.', { cause: error });
    }
    if (error instanceof BookingApp.SeatNotAvailableException) {
      return new SeatNotAvailableError(error.reason || 'La silla no está disponible.', { cause: error });
    }
    if (error instanceof BookingApp.LockExpiredException) {
      return new LockExpiredError(error.reason || 'El bloqueo temporal expiró.', { cause: error });
    }
    if (error instanceof BookingApp.InvalidBookingException) {
      return new InvalidBookingError(error.reason || 'La reserva no es válida.', { cause: error });
    }
    if (error instanceof BookingApp.BookingException) {
      return new BookingError(error.reason || 'El servidor rechazó la operación.', { cause: error });
    }

    // Fallos de transporte: servidor caído, conexión perdida, tiempo agotado.
    if (error instanceof Ice.LocalException) {
      return new ConnectionError(
        'No fue posible comunicarse con el servidor de reservas. Verifique que esté en ejecución.',
        { cause: error }
      );
    }

    return new BookingError(error?.message || 'Error remoto desconocido.', { cause: error });
  }
}