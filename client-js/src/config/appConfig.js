export const APP_CONFIG = Object.freeze({
  // Canal WebSocket del backend ZeroC Ice (RNF-4)
  rpc: {
    endpoint: 'ws://localhost:10002',
    proxyName: 'BookingService',
    invocationTimeoutMs: 10000
  },

  // Política de bloqueo temporal definida en la sección 2.2 del enunciado
  seats: {
    lockDurationSeconds: 90,
    warningThresholdSeconds: 15,
    syncIntervalMs: 3000
  },

  // Aforo del auditorio: 20 VIP + 30 Platea + 40 General = 90 sillas
  venue: {
    name: 'Auditorio Principal',
    seatsPerRow: 10,
    // priceField indica de qué campo de EventInfo se lee el precio vigente.
    // El precio local es solo respaldo mientras llega la respuesta remota.
    zones: [
      { id: 'ZONEVIP', label: 'Zona VIP', rows: ['A', 'B'], priceField: 'vipPrice', price: 120000 },
      { id: 'ZONEPLATEA', label: 'Zona Platea', rows: ['C', 'D', 'E'], priceField: 'plateaPrice', price: 75000 },
      { id: 'ZONEGENERAL', label: 'Zona General', rows: ['F', 'G', 'H', 'I'], priceField: 'generalPrice', price: 45000 }
    ]
  },

  ui: {
    locale: 'es-CO',
    currency: 'COP',
    toastDurationMs: 4000
  }
});