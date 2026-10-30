# Política de seguridad

SafeWay maneja datos sensibles: reportes de robo, ubicación aproximada y
consentimientos bajo la Ley 1581 de 2012. Si encuentras una vulnerabilidad,
gracias por avisar con responsabilidad.

## Cómo reportar una vulnerabilidad

- **No abras un issue público.** Usa el reporte privado de GitHub:
  pestaña **Security → Report a vulnerability** de este repositorio.
- Cuenta qué encontraste, cómo reproducirlo y qué datos podrían quedar expuestos.
- Respondemos en un máximo de 7 días. Es un proyecto académico, sin recompensas.

## Qué está protegido hoy

| Capa | Medida |
|---|---|
| Transporte | HTTPS obligatorio con HSTS en la app (Vercel) y en la API (Render) |
| Navegador | Content Security Policy, anti-clickjacking, Permissions-Policy (nota A+ en securityheaders.com) |
| API | CORS por lista blanca, límite de peticiones por IP, cuerpo máximo de 32 kB, errores 500 sin detalles internos |
| Base de datos | RLS en todas las tablas, vistas con `security_invoker`, funciones privilegiadas en un esquema que la API no expone; `npm run verify:rls` lo comprueba (71 pruebas) |
| Cuentas | Confirmación de correo, contraseñas con minúsculas, mayúsculas, números y símbolos, límite de intentos de Supabase Auth |
| Privacidad | Nunca se guarda la dirección escrita; robos a vivienda difuminados ~300 m; derecho de supresión desde el perfil |
| Dependencias | Dependabot semanal y `npm audit` de dependencias de producción en cada PR |
| Secretos | Los `.env` no se suben; la llave secreta de Supabase solo vive en Render y en el `.env` local |

## Versiones con soporte

Solo la rama `main` (lo que está publicado en https://safe-way-one.vercel.app).
