import { APP_CONFIG } from '@/config/appConfig.js';

const currencyFormatter = new Intl.NumberFormat(APP_CONFIG.ui.locale, {
  style: 'currency',
  currency: APP_CONFIG.ui.currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

/** Formatea un valor numérico como moneda colombiana. */
export function formatCurrency(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? currencyFormatter.format(value) : '—';
}

/** Convierte segundos a la representación mm:ss del temporizador. */
export function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/**
 * Segundos restantes hasta una marca de tiempo absoluta.
 * El servidor envía expiresAt en milisegundos; el cliente solo resta.
 */
export function secondsUntil(expiresAtMs, nowMs = Date.now()) {
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

/** Etiqueta visible de una silla, equivalente a su identificador remoto. */
export function formatSeatLabel(seat) {
  return `${seat.row}-${seat.number}`;
}