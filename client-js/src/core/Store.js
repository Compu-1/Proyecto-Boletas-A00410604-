import { EventBus } from '@/core/EventBus.js';

const CHANGE_EVENT = 'store:change';

/**
 * Contenedor de estado observable de la aplicación.
 *
 * El estado es inmutable hacia afuera: setState() reemplaza el objeto
 * completo en lugar de mutarlo, de modo que cualquier comparación por
 * referencia detecte el cambio de forma confiable.
 */
export class Store {
  #state;
  #bus = new EventBus();

  constructor(initialState = {}) {
    this.#state = Object.freeze({ ...initialState });
  }

  getState() {
    return this.#state;
  }

  /**
   * Actualiza el estado.
   * @param {Object|Function} patch objeto parcial, o función (estadoActual) => parcial.
   */
  setState(patch) {
    const previous = this.#state;
    const delta = typeof patch === 'function' ? patch(previous) : patch;

    if (!delta || typeof delta !== 'object') {
      throw new TypeError('setState() espera un objeto o una función que lo retorne.');
    }

    this.#state = Object.freeze({ ...previous, ...delta });
    this.#bus.emit(CHANGE_EVENT, this.#state, previous);
  }

  /**
   * Observa los cambios de estado.
   * @returns {Function} función para cancelar la suscripción.
   */
  subscribe(listener) {
    return this.#bus.on(CHANGE_EVENT, listener);
  }
}