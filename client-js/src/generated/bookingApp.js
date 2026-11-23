import { Ice } from 'ice';

/**
 * Puente entre el código que genera slice2js y los módulos ES del proyecto.
 *
 * slice2js emite un archivo con detección de entorno en tiempo de ejecución.
 * Dentro de un bundle de Webpack la variable `process` no existe, de modo que
 * el archivo toma su rama de navegador: busca Ice en `window` y publica allí
 * el módulo `BookingApp` en lugar de exportarlo por CommonJS. Por eso hay que
 * dejar Ice en `window` ANTES de cargarlo y recoger el resultado desde `window`.
 */
if (typeof window !== 'undefined' && window.Ice === undefined) {
  window.Ice = Ice;
}

require('./BookingService.js');

const loaded = typeof window !== 'undefined' ? window.BookingApp : undefined;

if (!loaded || typeof loaded.BookingServicePrx !== 'function') {
  throw new Error(
    'No se pudo cargar el módulo Slice BookingApp. ' +
    'Ejecute "npm run slice" para generar src/generated/BookingService.js.'
  );
}

export const BookingApp = loaded;
export { Ice };