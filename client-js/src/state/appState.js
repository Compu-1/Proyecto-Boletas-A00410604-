/** Estados posibles del canal con el backend. */
export const ConnectionStatus = Object.freeze({
  CONNECTING: 'connecting',
  ONLINE: 'online',
  OFFLINE: 'offline'
});

/** Estado inicial de la aplicación. */
export function createInitialState(clientId) {
  return {
    clientId,
    connectionStatus: ConnectionStatus.CONNECTING,
    eventInfo: null,
    seats: [],
    isCheckoutOpen: false,
    isProcessing: false,
    lastBooking: null
  };
}