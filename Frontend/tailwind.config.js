// Tokens del diseño "Brutalista vivo" (opción D), documentados en
// docs/diseno/README.md. Centralizados aquí para no repetir valores sueltos
// en cada componente (issue #10 / #12).
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fondo: '#FFF4DE',
        superficie: '#FFFFFF',
        texto: '#111111',
        'texto-tenue': '#3A3A3A',
        barra: '#FFC800',
        acento: '#2F5BFF',
        enlace: '#1F45E0',
        riesgo: {
          bajo: '#00B86B',
          medio: '#FFC800',
          alto: '#FF3B30',
          'bajo-texto': '#00703F',
          'medio-texto': '#7A5A00',
          'alto-texto': '#C21F14',
        },
        ok: '#C8F5DC',
        aviso: '#FFD9D6',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'sans-serif'],
        sans: ['Archivo', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        tarjeta: '14px',
        boton: '12px',
        campo: '10px',
        pastilla: '999px',
      },
      boxShadow: {
        dura: '5px 5px 0 #111111',
        'dura-chica': '3px 3px 0 #111111',
      },
      borderWidth: {
        3: '3px',
      },
    },
  },
  plugins: [],
}
