import './styles/main.css';

/**
 * Punto de arranque de la SPA.
 * En este commit solo se valida el empaquetado con Webpack;
 * el montaje de los componentes se implementa en el siguiente commit.
 */
function bootstrap() {
  const root = document.getElementById('app');

  if (!root) {
    throw new Error('No se encontró el nodo raíz #app en el documento.');
  }

  root.innerHTML = `
    <main style="padding: 32px; text-align: center;">
      <h1>Icesi Live Arena</h1>
      <p>Entorno de desarrollo operativo en el puerto 3000.</p>
    </main>
  `;

  console.log('[Icesi Live Arena] Bundle cargado correctamente.');
}

document.addEventListener('DOMContentLoaded', bootstrap);