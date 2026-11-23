package co.icesi.booking.server;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

import com.zeroc.Ice.Current;

import BookingApp.BookingException;
import BookingApp.BookingRecord;
import BookingApp.BookingResult;
import BookingApp.BookingService;
import BookingApp.EventInfo;
import BookingApp.InvalidBookingException;
import BookingApp.LockExpiredException;
import BookingApp.LockResult;
import BookingApp.Seat;
import BookingApp.SeatNotAvailableException;
import BookingApp.SeatNotFoundException;
import BookingApp.SeatState;
import BookingApp.SeatZone;

/**
 * Implementación del servicio de reservas.
 *
 * POLÍTICA DE CONCURRENCIA
 * ------------------------
 * El adaptador Ice despacha las peticiones sobre un grupo de hilos
 * (Ice.ThreadPool.Server.Size = 10), de modo que varias invocaciones se
 * ejecutan simultáneamente sobre esta misma instancia del sirviente.
 *
 * Todo el estado mutable (seatsMap, bookingsList y eventInfo) está protegido
 * por un único cerrojo privado, inventoryLock. Se cumplen dos invariantes:
 *
 *   1. Exclusión mutua: las operaciones compuestas de comprobar-y-actuar
 *      (leer el estado de una silla y después modificarlo) se ejecutan
 *      completas dentro de la región crítica, por lo que ningún otro hilo
 *      puede intercalarse entre la comprobación y la escritura.
 *
 *   2. Visibilidad: al leer y escribir siempre bajo el mismo cerrojo, se
 *      establece la relación «happens-before» del modelo de memoria de Java
 *      y ningún hilo puede observar valores obsoletos.
 *
 * Los objetos que se devuelven al cliente son COPIAS. Ice serializa el valor
 * de retorno después de que el método termina, es decir, fuera de la región
 * crítica; si se devolvieran las instancias vivas, otro hilo podría
 * modificarlas durante la serialización y el cliente recibiría una silla
 * inconsistente (por ejemplo, estado LOCKED con lockedByClientId vacío).
 *
 * Se eligió un cerrojo único y no uno por silla porque el aforo es pequeño
 * (90 sillas) y las operaciones son breves: la sección crítica más larga es
 * la de lockSeat, que retiene el cerrojo 25 ms y solo en el caso exitoso.
 */
public class BookingServiceImpl implements BookingService {

    public static final long DEFAULT_LOCK_DURATION_SECONDS = 90;

    /** Cerrojo privado: ningún código externo puede sincronizar sobre él. */
    private final ReentrantLock inventoryLock = new ReentrantLock();

    private final EventInfo eventInfo;
    private final Map<String, Seat> seatsMap = new HashMap<>();
    private final List<BookingRecord> bookingsList = new ArrayList<>();

    public BookingServiceImpl() {
        this.eventInfo = new EventInfo(
                "EVT-2026-LIVE",
                "Concierto Icesi Live Rock & Pop 2026",
                "2026-11-28 20:00",
                "Auditorio Manuelita - Universidad Icesi",
                90, 90, 0, 0,
                120000.0, 75000.0, 45000.0
        );
        initSeats();
    }

    // =====================================================================
    //  Estado interno. Todos estos métodos asumen que inventoryLock ya está
    //  retenido por el hilo que los invoca.
    // =====================================================================

    private void initSeats() {
        seatsMap.clear();
        bookingsList.clear();

        createSeatsForZone("A", 1, 10, SeatZone.ZONEVIP, 120000.0);
        createSeatsForZone("B", 1, 10, SeatZone.ZONEVIP, 120000.0);

        createSeatsForZone("C", 1, 10, SeatZone.ZONEPLATEA, 75000.0);
        createSeatsForZone("D", 1, 10, SeatZone.ZONEPLATEA, 75000.0);
        createSeatsForZone("E", 1, 10, SeatZone.ZONEPLATEA, 75000.0);

        createSeatsForZone("F", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("G", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("H", 1, 10, SeatZone.ZONEGENERAL, 45000.0);
        createSeatsForZone("I", 1, 10, SeatZone.ZONEGENERAL, 45000.0);

        updateEventCounters();
        System.out.printf("[INFO] Inventario inicializado con %d sillas en 3 zonas (VIP, Platea, General).%n", seatsMap.size());
    }

    private void createSeatsForZone(String row, int startNum, int endNum, SeatZone zone, double price) {
        for (int num = startNum; num <= endNum; num++) {
            String seatId = String.format("%s-%d", row, num);
            Seat seat = new Seat(
                    seatId,
                    zone,
                    row,
                    num,
                    price,
                    SeatState.AVAILABLE,
                    "",
                    0L,
                    DEFAULT_LOCK_DURATION_SECONDS
            );
            seatsMap.put(seatId, seat);
        }
    }

    private boolean isLockExpired(Seat seat) {
        if (seat.state != SeatState.LOCKED) return false;
        long elapsedSeconds = (System.currentTimeMillis() - seat.lockTimestamp) / 1000L;
        return elapsedSeconds > seat.lockDurationSeconds;
    }

    private void clearLock(Seat seat) {
        seat.state = SeatState.AVAILABLE;
        seat.lockedByClientId = "";
        seat.lockTimestamp = 0L;
        seat.lockDurationSeconds = DEFAULT_LOCK_DURATION_SECONDS;
    }

    /**
     * Libera los bloqueos vencidos (RF-3).
     *
     * Se invoca al comienzo de toda operación para que cualquier consulta
     * refleje el inventario real; de lo contrario una silla cuya retención
     * expiró seguiría apareciendo como bloqueada hasta que alguien
     * intentara tomarla.
     */
    private void purgeExpiredLocks() {
        for (Seat seat : seatsMap.values()) {
            if (seat.state == SeatState.LOCKED && isLockExpired(seat)) {
                System.out.printf("[LOCK-EXPIRED] El bloqueo de la silla %s expiró. Liberando.%n", seat.id);
                clearLock(seat);
            }
        }
    }

    private void updateEventCounters() {
        int avail = 0;
        int locked = 0;
        int booked = 0;
        for (Seat s : seatsMap.values()) {
            if (s.state == SeatState.BOOKED) {
                booked++;
            } else if (s.state == SeatState.LOCKED) {
                locked++;
            } else {
                avail++;
            }
        }
        eventInfo.totalSeats = seatsMap.size();
        eventInfo.availableSeats = avail;
        eventInfo.lockedSeats = locked;
        eventInfo.bookedSeats = booked;
    }

    // ------------------------- Copias defensivas -------------------------

    private static Seat copyOf(Seat s) {
        return new Seat(s.id, s.zone, s.row, s.number, s.price,
                s.state, s.lockedByClientId, s.lockTimestamp, s.lockDurationSeconds);
    }

    private static EventInfo copyOf(EventInfo e) {
        return new EventInfo(e.id, e.name, e.date, e.venue,
                e.totalSeats, e.availableSeats, e.lockedSeats, e.bookedSeats,
                e.vipPrice, e.plateaPrice, e.generalPrice);
    }

    private static BookingRecord copyOf(BookingRecord b) {
        return new BookingRecord(b.bookingCode, b.eventId, b.clientId,
                b.customerName, b.customerEmail, b.seatIds.clone(), b.totalAmount, b.timestamp);
    }

    private static Seat[] toSortedArray(List<Seat> seats) {
        seats.sort(Comparator.comparing((Seat s) -> s.row).thenComparingInt(s -> s.number));
        return seats.toArray(new Seat[0]);
    }

    // =====================================================================
    //  Operaciones remotas
    // =====================================================================

    @Override
    public EventInfo getEventInfo(Current current) {
        inventoryLock.lock();
        try {
            purgeExpiredLocks();
            updateEventCounters();
            return copyOf(eventInfo);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public Seat[] getAllSeats(Current current) {
        inventoryLock.lock();
        try {
            purgeExpiredLocks();
            List<Seat> list = new ArrayList<>(seatsMap.size());
            for (Seat s : seatsMap.values()) {
                list.add(copyOf(s));
            }
            return toSortedArray(list);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public Seat[] getSeatsByZone(SeatZone zone, Current current) {
        inventoryLock.lock();
        try {
            purgeExpiredLocks();
            List<Seat> list = new ArrayList<>();
            for (Seat s : seatsMap.values()) {
                if (s.zone == zone) {
                    list.add(copyOf(s));
                }
            }
            return toSortedArray(list);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public Seat getSeat(String seatId, Current current) throws SeatNotFoundException {
        inventoryLock.lock();
        try {
            purgeExpiredLocks();
            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no encontrada en inventario: " + seatId);
            }
            return copyOf(seat);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public LockResult lockSeat(String seatId, String clientId, Current current)
            throws SeatNotFoundException, SeatNotAvailableException {

        inventoryLock.lock();
        try {
            purgeExpiredLocks();

            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no encontrada: " + seatId);
            }

            if (seat.state != SeatState.AVAILABLE) {
                if (seat.state == SeatState.LOCKED && clientId.equals(seat.lockedByClientId)) {
                    // El mismo cliente renueva su propio bloqueo
                    seat.lockTimestamp = System.currentTimeMillis();
                    long renewedExpiry = seat.lockTimestamp + (seat.lockDurationSeconds * 1000L);
                    return new LockResult(true, seatId, "Bloqueo renovado con éxito.", renewedExpiry);
                }
                System.out.printf("[LOCK-DENIED] Silla %s solicitada por %s pero su estado es %s.%n",
                        seatId, clientId, seat.state);
                throw new SeatNotAvailableException(String.format(
                        "La silla %s ya no se encuentra disponible (Estado: %s).", seatId, seat.state));
            }

            // Simulación de latencia de red / I/O en base de datos (No remover).
            // Permanece DENTRO de la región crítica: representa la escritura de
            // la retención, y sacarla volvería a abrir la ventana de carrera
            // entre la comprobación de disponibilidad y la asignación.
            try {
                Thread.sleep(25);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            }

            seat.state = SeatState.LOCKED;
            seat.lockedByClientId = clientId;
            seat.lockTimestamp = System.currentTimeMillis();
            seat.lockDurationSeconds = DEFAULT_LOCK_DURATION_SECONDS;

            long expiresAt = seat.lockTimestamp + (DEFAULT_LOCK_DURATION_SECONDS * 1000L);
            System.out.printf("[LOCK-OK] Silla %s bloqueada exitosamente para cliente: %s (expira en %ds)%n",
                    seatId, clientId, DEFAULT_LOCK_DURATION_SECONDS);

            return new LockResult(true, seatId, "Silla bloqueada exitosamente.", expiresAt);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public boolean releaseSeat(String seatId, String clientId, Current current) throws SeatNotFoundException {
        inventoryLock.lock();
        try {
            Seat seat = seatsMap.get(seatId);
            if (seat == null) {
                throw new SeatNotFoundException("Silla no encontrada: " + seatId);
            }

            if (seat.state == SeatState.LOCKED
                    && (clientId.equals(seat.lockedByClientId) || isLockExpired(seat))) {
                clearLock(seat);
                System.out.printf("[RELEASE-OK] Silla %s liberada por cliente: %s%n", seatId, clientId);
                return true;
            }
            return false;
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public BookingResult confirmBooking(String[] seatIds, String clientId, String customerName, String customerEmail, Current current)
            throws InvalidBookingException, BookingException {

        // Validación de argumentos: no toca estado compartido, va fuera del cerrojo.
        if (seatIds == null || seatIds.length == 0) {
            throw new InvalidBookingException("Debe seleccionar al menos una silla para completar la reserva.");
        }
        if (customerName == null || customerName.trim().isEmpty()) {
            throw new InvalidBookingException("El nombre del comprador es obligatorio.");
        }
        if (customerEmail == null || !customerEmail.contains("@")) {
            throw new InvalidBookingException("El correo electrónico del comprador es inválido.");
        }

        inventoryLock.lock();
        try {
            purgeExpiredLocks();

            double totalAmount = 0.0;
            List<Seat> validatedSeats = new ArrayList<>(seatIds.length);

            // Paso 1: validar TODAS las sillas antes de modificar ninguna.
            for (String seatId : seatIds) {
                Seat seat = seatsMap.get(seatId);
                if (seat == null) {
                    throw new SeatNotFoundException("Silla no existe: " + seatId);
                }
                if (seat.state == SeatState.BOOKED) {
                    throw new BookingException("La silla " + seatId + " ya fue vendida definitivamente.");
                }
                if (seat.state == SeatState.AVAILABLE) {
                    throw new LockExpiredException("El bloqueo temporal de la silla " + seatId + " ha expirado.");
                }
                if (!clientId.equals(seat.lockedByClientId)) {
                    throw new BookingException("La silla " + seatId + " se encuentra bloqueada por otro comprador.");
                }
                totalAmount += seat.price;
                validatedSeats.add(seat);
            }

            // Paso 2: confirmar. Validación y escritura ocurren bajo el mismo
            // cerrojo, de modo que la operación completa es atómica: o se
            // venden todas las sillas, o no se vende ninguna.
            for (Seat s : validatedSeats) {
                s.state = SeatState.BOOKED;
                s.lockedByClientId = clientId;
                s.lockTimestamp = System.currentTimeMillis();
                s.lockDurationSeconds = 0L;
            }

            String bookingCode = "RES-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
            long now = System.currentTimeMillis();

            BookingRecord record = new BookingRecord(
                    bookingCode,
                    eventInfo.id,
                    clientId,
                    customerName.trim(),
                    customerEmail.trim(),
                    seatIds.clone(),
                    totalAmount,
                    now
            );
            bookingsList.add(record);
            updateEventCounters();

            System.out.printf("[BOOKING-CONFIRMED] Código: %s | Cliente: %s (%s) | %d sillas | Total: $%,.0f COP%n",
                    bookingCode, customerName, clientId, seatIds.length, totalAmount);

            return new BookingResult(
                    true,
                    bookingCode,
                    "Reserva confirmada con éxito. Disfrute del evento.",
                    seatIds.clone(),
                    totalAmount,
                    now
            );
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public Seat[] getMyLockedSeats(String clientId, Current current) {
        inventoryLock.lock();
        try {
            purgeExpiredLocks();
            List<Seat> list = new ArrayList<>();
            if (clientId != null && !clientId.isEmpty()) {
                for (Seat s : seatsMap.values()) {
                    if (s.state == SeatState.LOCKED && clientId.equals(s.lockedByClientId)) {
                        list.add(copyOf(s));
                    }
                }
            }
            return toSortedArray(list);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public BookingRecord[] getMyBookings(String clientId, Current current) {
        inventoryLock.lock();
        try {
            List<BookingRecord> list = new ArrayList<>();
            if (clientId != null && !clientId.isEmpty()) {
                for (BookingRecord b : bookingsList) {
                    if (clientId.equals(b.clientId)) {
                        list.add(copyOf(b));
                    }
                }
            }
            return list.toArray(new BookingRecord[0]);
        } finally {
            inventoryLock.unlock();
        }
    }

    @Override
    public void resetSeats(Current current) {
        inventoryLock.lock();
        try {
            initSeats();
            System.out.println("[RESET] Inventario y reservas reiniciadas a estado de fábrica.");
        } finally {
            inventoryLock.unlock();
        }
    }
}