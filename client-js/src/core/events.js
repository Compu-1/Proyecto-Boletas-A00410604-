/**
 * Catálogo de eventos de aplicación.
 * Centralizarlos evita cadenas mágicas repartidas por los componentes.
 */
export const AppEvent = Object.freeze({
  SEAT_TOGGLE: 'seat:toggle',
  SEAT_RELEASE: 'seat:release',
  CART_RELEASE_ALL: 'cart:release-all',
  CHECKOUT_OPEN: 'checkout:open',
  CHECKOUT_CLOSE: 'checkout:close',
  CHECKOUT_SUBMIT: 'checkout:submit',
  LOCK_EXPIRED: 'lock:expired',
  TOAST_SHOW: 'toast:show'
});

export const ToastLevel = Object.freeze({
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error'
});