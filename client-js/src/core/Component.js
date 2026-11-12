/**
 * Clase base abstracta de todos los componentes de la interfaz.
 *
 * Define el ciclo de vida común: render -> mount -> (update)* -> destroy.
 * Cada componente es dueño exclusivo del nodo que produce su render();
 * ningún componente manipula el DOM de otro.
 */
export class Component {
  #element = null;
  #children = [];
  #cleanups = [];

  constructor(props = {}) {
    if (new.target === Component) {
      throw new TypeError('Component es abstracta y no puede instanciarse directamente.');
    }
    this.props = props;
  }

  get element() {
    return this.#element;
  }

  /**
   * Construye y devuelve un único nodo del DOM.
   * Obligatorio en cada subclase.
   */
  render() {
    throw new Error(`${this.constructor.name} debe implementar el método render().`);
  }

  /** Inserta el componente dentro de un contenedor. */
  mount(container) {
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('mount() requiere un elemento HTML como contenedor.');
    }

    this.#element = this.render();
    container.appendChild(this.#element);
    this.onMounted();
    return this.#element;
  }

  /** Re-renderiza y reemplaza el nodo anterior en su misma posición. */
  update() {
    if (!this.#element) return;

    const next = this.render();
    this.#element.replaceWith(next);
    this.#element = next;
    this.onUpdated();
  }

  /** Registra un hijo para destruirlo en cascada junto al padre. */
  addChild(child) {
    this.#children.push(child);
    return child;
  }

  /**
   * Registra una tarea de limpieza (desuscripción, clearInterval, etc.)
   * que se ejecutará automáticamente al destruir el componente.
   */
  addCleanup(cleanupFn) {
    if (typeof cleanupFn === 'function') {
      this.#cleanups.push(cleanupFn);
    }
    return cleanupFn;
  }

  /** Escucha un evento del DOM con remoción automática en destroy(). */
  listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.addCleanup(() => target.removeEventListener(type, handler, options));
  }

  /** Libera hijos, listeners, temporizadores y suscripciones. */
  destroy() {
    this.#children.forEach((child) => child.destroy());
    this.#children = [];

    this.#cleanups.forEach((cleanupFn) => cleanupFn());
    this.#cleanups = [];

    if (this.#element) {
      this.#element.remove();
      this.#element = null;
    }

    this.onDestroyed();
  }

  // Ganchos opcionales del ciclo de vida
  onMounted() {}
  onUpdated() {}
  onDestroyed() {}
}