const STORAGE_KEY = 'icesi-live-arena:clientId';

let cachedClientId = null;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web-${crypto.randomUUID()}`;
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // modo privado o almacenamiento bloqueado
  }
}

function writeStorage(value) {
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Se continúa solo con la copia en memoria.
  }
}

/**
 * Identificador de sesión del cliente, exigido por lockSeat, releaseSeat,
 * confirmBooking y getMyBookings.
 *
 * Se persiste en sessionStorage y NO en localStorage: sessionStorage está
 * aislado por pestaña, de modo que abrir varias ventanas produce clientes
 * distintos. Eso es precisamente lo que permite la prueba de concurrencia
 * del punto 5.2.5 del enunciado.
 */
export function getClientId() {
  if (cachedClientId) return cachedClientId;

  const stored = readStorage();
  cachedClientId = stored || generateId();

  if (!stored) writeStorage(cachedClientId);
  return cachedClientId;
}

/** Fuerza una identidad nueva. Útil para pruebas manuales. */
export function resetClientId() {
  cachedClientId = generateId();
  writeStorage(cachedClientId);
  return cachedClientId;
}