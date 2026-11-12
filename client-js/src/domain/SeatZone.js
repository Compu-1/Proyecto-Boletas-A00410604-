import { APP_CONFIG } from '@/config/appConfig.js';

/**
 * Zonas del recinto. Espejo del enum SeatZone de BookingService.ice.
 */
export const SeatZone = Object.freeze({
  ZONEVIP: 'ZONEVIP',
  ZONEPLATEA: 'ZONEPLATEA',
  ZONEGENERAL: 'ZONEGENERAL'
});

// Índice construido una sola vez a partir de la configuración.
const ZONE_BY_ID = new Map(APP_CONFIG.venue.zones.map((zone) => [zone.id, zone]));

const ZONE_BY_ROW = new Map(
  APP_CONFIG.venue.zones.flatMap((zone) => zone.rows.map((row) => [row, zone]))
);

export function listZones() {
  return APP_CONFIG.venue.zones;
}

export function getZoneDefinition(zoneId) {
  return ZONE_BY_ID.get(zoneId) ?? null;
}

export function getZoneLabel(zoneId) {
  return getZoneDefinition(zoneId)?.label ?? 'Zona desconocida';
}

export function getZonePrice(zoneId) {
  return getZoneDefinition(zoneId)?.price ?? 0;
}

export function getZoneByRow(row) {
  return ZONE_BY_ROW.get(row) ?? null;
}