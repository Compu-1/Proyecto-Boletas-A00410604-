import { SeatState } from '@/domain/SeatState.js';

const HIGH_WORD_FACTOR = 4294967296; // 2^32

/**
 * Normaliza un valor de 64 bits a milisegundos.
 *
 * Ice mapea el tipo `long` del Slice a un objeto Ice.Long con palabras
 * { high, low } y NO a un número de JavaScript. Esta función acepta las
 * dos representaciones para que el dominio sea independiente del
 * transporte: en pruebas recibe números, en producción recibe Ice.Long.
 */
export function toMillis(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();

  if (typeof value.high === 'number' && typeof value.low === 'number') {
    return value.high * HIGH_WORD_FACTOR + value.low;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Normaliza un enum.
 *
 * Los enums de Ice son objetos con un getter `name` ("AVAILABLE",
 * "ZONEVIP", ...). El dominio trabaja siempre con la cadena.
 */
export function toEnumName(value) {
  if (typeof value === 'string') return value.trim().toUpperCase();
  if (value && typeof value.name === 'string') return value.name;
  return '';
}

/**
 * Construye una silla inmutable del dominio a partir de datos crudos,
 * provengan del simulador o del servidor remoto.
 */
export function createSeat(raw = {}) {
  return Object.freeze({
    id: String(raw.id ?? ''),
    zone: toEnumName(raw.zone),
    row: String(raw.row ?? ''),
    number: Number(raw.number ?? 0),
    price: Number(raw.price ?? 0),
    state: toEnumName(raw.state) || SeatState.AVAILABLE,
    lockedByClientId: String(raw.lockedByClientId ?? ''),
    lockTimestamp: toMillis(raw.lockTimestamp),
    lockDurationSeconds: toMillis(raw.lockDurationSeconds)
  });
}

/** Devuelve una copia de la silla con los campos indicados modificados. */
export function withChanges(seat, changes) {
  return Object.freeze({ ...seat, ...changes });
}

// --------------------------- Predicados ---------------------------

export function isAvailable(seat) {
  return seat.state === SeatState.AVAILABLE;
}

export function isLocked(seat) {
  return seat.state === SeatState.LOCKED;
}

export function isBooked(seat) {
  return seat.state === SeatState.BOOKED;
}

/** Instante absoluto en que vence el bloqueo temporal. */
export function lockExpiresAt(seat) {
  if (!isLocked(seat) || seat.lockTimestamp === 0) return 0;
  return seat.lockTimestamp + seat.lockDurationSeconds * 1000;
}

export function isLockExpired(seat, nowMs = Date.now()) {
  const expiresAt = lockExpiresAt(seat);
  return expiresAt !== 0 && nowMs >= expiresAt;
}

export function isLockedByClient(seat, clientId) {
  return isLocked(seat) && seat.lockedByClientId === clientId;
}

export function isLockedByOther(seat, clientId) {
  return isLocked(seat) && seat.lockedByClientId !== clientId;
}