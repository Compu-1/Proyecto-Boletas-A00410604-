import './styles/main.css';

import { Store } from '@/core/Store.js';
import { EventBus } from '@/core/EventBus.js';
import { App } from '@/components/App.js';
import { IceBookingClient } from '@/services/IceBookingClient.js';
import { getClientId } from '@/services/ClientIdentity.js';
import { createInitialState } from '@/state/appState.js';

/**
 * Arranque de la aplicación.
 *
 * Aquí se decide qué implementación de BookingClient se inyecta. El cambio
 * del simulador al cliente RPC real fue exactamente esta línea: ningún
 * componente de la interfaz tuvo que modificarse.
 */
function bootstrap() {
  const root = document.getElementById('app');
  if (!root) throw new Error('No se encontró el nodo raíz #app en el documento.');

  const clientId = getClientId();
  const store = new Store(createInitialState(clientId));
  const bus = new EventBus();
  const bookingClient = new IceBookingClient();

  const app = new App({ store, bus, bookingClient });
  app.mount(root);

  window.addEventListener('beforeunload', () => app.destroy());
  console.info(`[Icesi Live Arena] Cliente iniciado con identificador ${clientId}`);
}

document.addEventListener('DOMContentLoaded', bootstrap);