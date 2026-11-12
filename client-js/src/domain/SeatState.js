/**
 * Estados del ciclo de vida de una silla (sección 2.2 del enunciado).
 * Espejo del enum SeatState definido en BookingService.ice.
 */
export const SeatState = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  LOCKED: 'LOCKED',
  BOOKED: 'BOOKED'
});

export const SEAT_STATE_LABELS = Object.freeze({
  [SeatState.AVAILABLE]: 'Disponible',
  [SeatState.LOCKED]: 'Bloqueada',
  [SeatState.BOOKED]: 'Vendida'
});

export function isSeatState(value) {
  return Object.hasOwn(SeatState, value);
}