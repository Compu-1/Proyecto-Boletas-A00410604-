import { APP_CONFIG } from '@/config/appConfig.js';
import { createSeat } from '@/domain/Seat.js';
import { SeatState } from '@/domain/SeatState.js';

/**
 * Genera el aforo completo del auditorio: 90 sillas disponibles
 * (20 VIP en A-B, 30 Platea en C-D-E, 40 General en F-G-H-I).
 *
 * Solo lo usa el cliente simulado. Contra el servidor real, el catálogo
 * llega por RPC mediante getAllSeats().
 */
export function buildSeatCatalog() {
  const { seatsPerRow, zones } = APP_CONFIG.venue;
  const seats = [];

  zones.forEach((zone) => {
    zone.rows.forEach((row) => {
      for (let number = 1; number <= seatsPerRow; number += 1) {
        seats.push(
          createSeat({
            id: `${row}-${number}`,
            zone: zone.id,
            row,
            number,
            price: zone.price,
            state: SeatState.AVAILABLE
          })
        );
      }
    });
  });

  return seats;
}

/** Agrupa una lista de sillas por zona, respetando el orden de configuración. */
export function groupSeatsByZone(seats) {
  return APP_CONFIG.venue.zones.map((zone) => ({
    zone,
    rows: zone.rows.map((row) => ({
      row,
      seats: seats
        .filter((seat) => seat.row === row)
        .sort((a, b) => a.number - b.number)
    }))
  }));
}