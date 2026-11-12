/**
 * Bus de eventos publicador/suscriptor.
 *
 * Permite que los componentes se comuniquen sin referencias directas entre
 * ellos, evitando el acoplamiento que exige el requerimiento RNF-2.
 */
export class EventBus {
  #listeners = new Map();

  /**
   * Suscribe un oyente a un evento.
   * @returns {Function} función para cancelar la suscripción.
   */
  on(eventName, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('El oyente debe ser una función.');
    }

    if (!this.#listeners.has(eventName)) {
      this.#listeners.set(eventName, new Set());
    }
    this.#listeners.get(eventName).add(listener);

    return () => this.off(eventName, listener);
  }

  /** Suscribe un oyente que se ejecuta una sola vez. */
  once(eventName, listener) {
    const unsubscribe = this.on(eventName, (...args) => {
      unsubscribe();
      listener(...args);
    });
    return unsubscribe;
  }

  off(eventName, listener) {
    const group = this.#listeners.get(eventName);
    if (!group) return;

    group.delete(listener);
    if (group.size === 0) {
      this.#listeners.delete(eventName);
    }
  }

  /**
   * Notifica a todos los oyentes del evento.
   * Un oyente que falle no debe impedir la ejecución de los demás.
   */
  emit(eventName, ...args) {
    const group = this.#listeners.get(eventName);
    if (!group) return;

    [...group].forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`[EventBus] Error en el oyente de "${eventName}":`, error);
      }
    });
  }

  clear() {
    this.#listeners.clear();
  }
}