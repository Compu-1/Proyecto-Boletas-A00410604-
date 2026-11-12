import './styles/main.css';

import { Store } from '@/core/Store.js';
import { EventBus } from '@/core/EventBus.js';
import { App } from '@/components/App.js';
import { MockBookingClient } from '@/services/MockBookingClient.js';
import { getClientId } from '@/services/ClientIdentity.js';
import { createInitialState } from '@/state/appState.js';

/**
 * Arranque de la aplicación.
 *
 * Aquí se decide qué implementación de BookingClient se inyecta. En la
 * sesión 2 basta sustituir MockBookingClient por IceBookingClient: ningún
 * componente cambia.
 */
function bootstrap() {
  const root = document.getElementById('app');
  if (!root) throw new Error('No se encontró el nodo raíz #app en el documento.');

  const clientId = getClientId();
  const store = new Store(createInitialState(clientId));
  const bus = new EventBus();
  const bookingClient = new MockBookingClient();

  const app = new App({ store, bus, bookingClient });
  app.mount(root);

  window.addEventListener('beforeunload', () => app.destroy());
  console.info(`[Icesi Live Arena] Cliente iniciado con identificador ${clientId}`);
}

document.addEventListener('DOMContentLoaded', bootstrap);