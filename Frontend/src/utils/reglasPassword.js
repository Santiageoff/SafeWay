// Reglas de la contraseña, visibles mientras se escribe.
//
// Son las mismas que exige Supabase (Authentication → Email → Password
// requirements: minúsculas, mayúsculas, números y símbolos, mínimo 8). Si
// se cambian allá, hay que cambiarlas aquí. Mostrarlas antes evita que la
// persona se entere por un error en inglés después de enviar.

export const REGLAS_PASSWORD = [
  { id: 'largo', texto: 'Mínimo 8 caracteres', cumple: (p) => p.length >= 8 },
  { id: 'minuscula', texto: 'Una minúscula', cumple: (p) => /[a-z]/.test(p) },
  { id: 'mayuscula', texto: 'Una mayúscula', cumple: (p) => /[A-Z]/.test(p) },
  { id: 'numero', texto: 'Un número', cumple: (p) => /[0-9]/.test(p) },
  { id: 'simbolo', texto: 'Un símbolo (! @ # $ % …)', cumple: (p) => /[^A-Za-z0-9]/.test(p) }
]

export const cumpleReglas = (password) => REGLAS_PASSWORD.every(r => r.cumple(password))
