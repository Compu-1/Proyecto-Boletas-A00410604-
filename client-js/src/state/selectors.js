import { isLockedByClient, lockExpiresAt } from '@/domain/Seat.js';
import { groupSeatsByZone } from '@/domain/seatCatalog.js';

/**
 * Funciones derivadas del estado.
 *
 * El carrito NO se almacena: se deriva de las sillas que el servidor
 * reporta como bloqueadas por este cliente. Así el servidor es la única
 * fuente de verdad y la interfaz no puede quedar desincronizada.
 */
export function selectMySeats(state) {
  return state.seats
    .filter((seat) => isLockedByClient(seat, state.clientId))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function selectCartTotal(state) {
  return selectMySeats(state).reduce((sum, seat) => sum + seat.price, 0);
}

/** Vencimiento más próximo entre las sillas retenidas por este cliente. */
export function selectEarliestExpiry(state) {
  const expiries = selectMySeats(state).map(lockExpiresAt).filter((value) => value > 0);
  return expiries.length > 0 ? Math.min(...expiries) : 0;
}

export function selectSeatsGroupedByZone(state) {
  return groupSeatsByZone(state.seats);
}

export function selectCanCheckout(state) {
  return selectMySeats(state).length > 0 && !state.isProcessing;
}