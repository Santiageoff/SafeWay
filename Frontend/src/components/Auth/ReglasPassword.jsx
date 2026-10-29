// Lista visible de los requisitos de la contraseña (ver utils/reglasPassword.js).
import { REGLAS_PASSWORD } from '../../utils/reglasPassword'

function ReglasPassword({ password }) {
  return (
    <ul className="-mt-2 mb-3.5 grid list-none grid-cols-2 gap-x-2 gap-y-0.5 p-0" aria-label="Requisitos de la contraseña">
      {REGLAS_PASSWORD.map(r => {
        const ok = r.cumple(password)
        return (
          <li key={r.id} className={`text-[11px] ${ok ? 'font-semibold text-texto' : 'text-texto-tenue'}`}>
            <span aria-hidden="true">{ok ? '✅' : '○'}</span> {r.texto}
          </li>
        )
      })}
    </ul>
  )
}

export default ReglasPassword
