# Icesi Live Arena — Sistema Distribuido de Reserva de Boletas

Proyecto final de **Computación en Internet I** (09810 - TIC, NRC 12378), período 2026-2.
Universidad Icesi — Facultad de Ingeniería, Diseño y Ciencias Aplicadas.

**Autor:** Felipe Cuadros Muñoz — A00410604

---

## Descripción

Sistema distribuido de venta de boletería para un auditorio de 90 sillas. El backend en
Java expone un servicio RPC con ZeroC Ice sobre dos canales simultáneos, y el frontend es
una SPA en JavaScript vainilla que se conecta por WebSocket.

El problema central del dominio es la **consistencia bajo concurrencia**: varios usuarios
compiten por las mismas sillas, y el sistema debe garantizar que una silla nunca quede
asignada a dos compradores a la vez.

## Arquitectura

```
┌─────────────────────────┐                    ┌──────────────────────────────┐
│  Navegador              │   ws://host:10002  │  Servidor Java               │
│  SPA Vanilla JS         │ ─────────────────► │  ZeroC Ice 3.7.10            │
│  (Webpack 5)            │                    │  Ice.ThreadPool.Server = 10  │
└─────────────────────────┘                    │                              │
                                               │  Inventario: 90 sillas       │
┌─────────────────────────┐   tcp://host:10000 │  protegido por ReentrantLock │
│  Cliente Java de prueba │ ─────────────────► │                              │
│  (pruebas de estrés)    │                    └──────────────────────────────┘
└─────────────────────────┘
```

Ambos canales exponen el mismo objeto remoto, con identidad `BookingService`, definido
en el contrato Slice `BookingService.ice`.

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | JavaScript ES6+ (sin frameworks) + Webpack 5 | Plano de sillas, carrito, temporizador, checkout |
| Transporte web | WebSocket, `ice@3.7.100` | Llamadas RPC desde el navegador |
| Transporte nativo | TCP, `com.zeroc:ice:3.7.10` | Cliente de escritorio y pruebas automatizadas |
| Backend | Java 17 + ZeroC Ice 3.7.10 | Inventario, bloqueo temporal y venta |

### Aforo

| Zona | Filas | Sillas | Precio |
|---|---|---|---|
| VIP | A, B | 20 | $120.000 |
| Platea | C, D, E | 30 | $75.000 |
| General | F, G, H, I | 40 | $45.000 |

Los precios que muestra la interfaz se leen del `EventInfo` remoto, no de constantes
locales: el servidor es la única autoridad sobre la tarifa.

### Ciclo de vida de una silla

```
AVAILABLE ──lockSeat──► LOCKED ──confirmBooking──► BOOKED
    ▲                     │
    └──releaseSeat────────┘
    └──expiración 90 s────┘
```

## Estructura del repositorio

```
.
├── codigo_base/                      Backend Java (Gradle multi-proyecto)
│   ├── common/src/main/slice/
│   │   └── BookingService.ice        Contrato RPC compartido
│   ├── server/src/main/java/co/icesi/booking/server/
│   │   ├── BookingServerApp.java     Arranque, adaptador y endpoints
│   │   └── BookingServiceImpl.java   Lógica de inventario (thread-safe)
│   └── client/src/main/java/co/icesi/booking/client/
│       └── BookingClientApp.java     Cliente de pruebas y estrés
│
└── client-js/                        Frontend SPA
    ├── package.json
    ├── webpack.config.js
    └── src/
        ├── index.js                  Arranque e inyección de dependencias
        ├── index.html                Plantilla (solo el nodo raíz)
        ├── config/appConfig.js       Constantes: endpoint, aforo, política de bloqueo
        ├── core/                     Infraestructura propia
        │   ├── Component.js            Clase base: ciclo de vida y limpieza
        │   ├── EventBus.js             Publicador/suscriptor
        │   ├── Store.js                Estado observable e inmutable
        │   └── events.js               Catálogo de eventos
        ├── domain/                   Modelo independiente del transporte
        │   ├── Seat.js                 Normalización y predicados
        │   ├── SeatState.js
        │   ├── SeatZone.js
        │   └── seatCatalog.js
        ├── services/                 Capa de datos
        │   ├── BookingClient.js        Contrato abstracto
        │   ├── IceBookingClient.js     Implementación RPC real
        │   ├── MockBookingClient.js    Implementación simulada
        │   ├── ClientIdentity.js       Identificador de sesión
        │   └── errors.js               Errores del dominio
        ├── generated/                Código generado por slice2js
        │   ├── BookingService.js       Stubs del contrato
        │   └── bookingApp.js           Puente con los módulos ES
        ├── state/                    Estado de la aplicación
        │   ├── appState.js
        │   └── selectors.js            Datos derivados
        ├── components/               Componentes de interfaz
        │   ├── App.js                  Raíz y único controlador
        │   ├── EventHeader/            Metadatos y contadores
        │   ├── SeatMap/                Plano interactivo
        │   ├── CartPanel/              Carrito y acciones
        │   ├── CountdownTimer/         Cuenta regresiva
        │   ├── CheckoutModal/          Formulario y comprobante
        │   ├── MyBookings/             Historial de compras
        │   └── Toast/                  Notificaciones
        ├── utils/                    Formato y validación
        └── styles/main.css           Tokens de diseño y reset
```

## Requisitos

- JDK 17
- Node.js 20 o superior
- Para **regenerar** los stubs de Slice: `slice2js` 3.7.x instalado globalmente
  (no hace falta para compilar ni ejecutar: el código generado está versionado)

## Ejecución

### 1. Servidor Java

```bash
cd codigo_base
./gradlew runServer
```

Levanta los dos canales: TCP en `10000` y WebSocket en `10002`.

### 2. Cliente web

En otra terminal:

```bash
cd client-js
npm install
npm start
```

Abre `http://localhost:3000`.

### 3. Bundle de producción

```bash
npm run build
```

Genera `client-js/dist/` con el HTML y el bundle con hash de contenido.

### 4. Prueba de concurrencia

Con el servidor corriendo:

```bash
cd codigo_base
./gradlew :client:runClient --args="--test-concurrency"
```

Lanza 10 hilos compitiendo por la silla `A-1`.

> El `--args` debe ir sobre `:client:runClient` y no sobre la tarea `runClient` de la
> raíz, porque esa última es un `Task` envoltorio y no un `JavaExec`.

### 5. Regenerar los stubs (opcional)

```bash
cd client-js
npm run slice
```

## La vulnerabilidad de concurrencia

El código base entregado tenía una condición de carrera del tipo *comprobar y actuar*
en `lockSeat()`: se verificaba la disponibilidad de la silla y después se escribía su
nuevo estado, sin exclusión mutua entre ambos pasos. Con un grupo de 10 hilos de
despacho, los 10 pasaban la verificación antes de que alguno escribiera.

**Antes de la corrección:**

```
Peticiones que creyeron ganar el bloqueo : 10
Peticiones correctamente rechazadas      : 0
[VULNERABILIDAD CONFIRMADA]: ¡CONDICIÓN DE CARRERA DETECTADA!
```

**Después:**

```
Peticiones que creyeron ganar el bloqueo : 1
Peticiones correctamente rechazadas      : 9
[SIN CONDICIÓN DE CARRERA]: Solo 1 hilo obtuvo el bloqueo. Servidor seguro.
```

La solución aplicada en `BookingServiceImpl.java`:

1. Un **`ReentrantLock` privado** que protege todo el estado mutable. Las operaciones
   compuestas se ejecutan completas dentro de la región crítica, lo que garantiza
   exclusión mutua y, al leer y escribir siempre bajo el mismo cerrojo, también
   visibilidad entre hilos.
2. **Copias defensivas** en los valores de retorno. Ice serializa la respuesta después
   de que el método termina, fuera de la región crítica; devolver las instancias vivas
   permitiría que otro hilo las modificara durante la serialización.
3. **Liberación de bloqueos vencidos** al inicio de cada operación, de modo que las
   consultas reflejen el inventario real.
4. **`confirmBooking` atómico**: valida todas las sillas antes de modificar ninguna, bajo
   el mismo cerrojo. O se venden todas, o no se vende ninguna.

## Etapas de desarrollo

| Etapa | Commit | Contenido |
|---|---|---|
| Sesión 1 · Tooling | `feat(tooling)` | `client-js/` con Webpack 5, loaders y dev-server en el puerto 3000 |
| Sesión 1 · Arquitectura | `feat(frontend)` | Componentes, estado central, selectores y flujo de reserva |
| Sesión 1 · Identidad visual | `style(ui)` | Paleta institucional y tratamiento de sala de teatro |
| Sesión 2 · RPC | `feat(rpc)` | Stubs de Slice, `IceBookingClient` y sustitución del simulador |
| Sesión 2 · Concurrencia | `fix(concurrency)` | Exclusión mutua sobre el inventario |
| Cierre | `feat(bookings)` | Historial de compras y precios tomados del servidor |

## Cobertura de requerimientos

| Req. | Descripción | Dónde |
|---|---|---|
| RF-1 | Aforo y precios en tiempo real | `EventHeader`, `SeatMap`, sondeo cada 3 s |
| RF-2 | Bloqueo temporal exclusivo | `lockSeat` + `ReentrantLock` del servidor |
| RF-3 | Temporizador y desbloqueo automático | `CountdownTimer`, `purgeExpiredLocks` |
| RF-4 | Carrito y liberación manual | `CartPanel` → `releaseSeat` |
| RF-5 | Checkout y código de reserva | `CheckoutModal` → `confirmBooking` |
| RF-6 | Consulta de reservas del cliente | `MyBookings` → `getMyBookings` |
| RF-7 | Manejo resiliente de excepciones | `IceBookingClient#translate`, `ToastHost` |
| RNF-1 | Thread-safety | `BookingServiceImpl` |
| RNF-2 | Vanilla JS, componentes desacoplados | `core/`, `components/` |
| RNF-3 | npm y Webpack | `package.json`, `webpack.config.js` |
| RNF-4 | Solo WebSocket desde el navegador | `IceBookingClient#connect` |

## Decisiones de diseño

**El carrito no se almacena, se deriva.** Las sillas del carrito se calculan a partir de
las que el servidor reporta como bloqueadas por este cliente (`selectMySeats`). Guardarlo
aparte crearía dos fuentes de verdad que podrían divergir ante una expiración.

**El temporizador guarda el instante de vencimiento, no los segundos restantes.** Si
guardara un contador, el navegador podría ralentizarlo en una pestaña de segundo plano y
mostrar más tiempo del que realmente queda.

**El identificador de sesión vive en `sessionStorage`, no en `localStorage`.** Así cada
pestaña es un cliente distinto, que es justamente lo que permite probar la concurrencia
abriendo varias pestañas.

**La capa de datos está detrás de una abstracción.** Los componentes dependen de
`BookingClient`, no de Ice. Cambiar del simulador al cliente RPC real fueron dos líneas
en `index.js`, sin tocar un solo componente.

**Un oyente de clic para 90 sillas.** `SeatMap` usa delegación de eventos en lugar de
registrar un oyente por butaca.

## Notas de entorno

- El paquete npm `ice` usa una numeración propia: Ice 3.7.10 corresponde a `ice@3.7.100`.
  Instalar `ice@3.7.10` falla porque esa versión no existe en el registro.
- El código que genera `slice2js` detecta el entorno en tiempo de ejecución. Dentro de un
  bundle de Webpack `process` no existe, así que toma su rama de navegador: busca `Ice` en
  `window` y publica allí el módulo `BookingApp`. De eso se encarga `generated/bookingApp.js`.
- `webpack.config.js` declara `resolve.fallback` para `net` y `fs` porque la librería de Ice
  los referencia dentro de guardas de entorno que Webpack intenta resolver al compilar.
- `slice2js@3.7.100` se compila con node-gyp. En Windows con Visual Studio 2026 hace falta
  `node-gyp` 12.1.0 o superior, porque las versiones anteriores no reconocen esa versión de
  Visual Studio.

## Video demostrativo

https://youtu.be/XgKKBnwTMOc

## Licencia

Proyecto académico. Uso educativo.