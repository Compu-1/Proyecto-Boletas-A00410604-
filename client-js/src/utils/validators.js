const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

export function isValidName(value) {
  return typeof value === 'string' && value.trim().length >= 3;
}

/**
 * Valida el formulario de checkout (RF-5).
 * @returns {Object} mapa de errores; vacío si los datos son correctos.
 */
export function validateCheckoutForm({ customerName, customerEmail }) {
  const errors = {};

  if (!isValidName(customerName)) {
    errors.customerName = 'Ingrese su nombre completo (mínimo 3 caracteres).';
  }

  if (!isValidEmail(customerEmail)) {
    errors.customerEmail = 'Ingrese un correo electrónico válido.';
  }

  return errors;
}