# Reglas del Proyecto (Cobro App)

## Control de Versiones (Git & GitHub)
- **Siempre subir cambios:** Al finalizar cualquier tarea, corrección de errores o nueva característica, debes hacer `git add`, `git commit` con un mensaje descriptivo y `git push` a GitHub (rama `main`).
- **Verificación:** Ejecuta siempre `npm.cmd run build` o `npx.cmd tsc --noEmit` para asegurar que el proyecto compila y no tiene errores de TypeScript antes de realizar el push.

## Buenas Prácticas y Restricciones (Supabase)
- **Consultas a Base de Datos:** Tienes estrictamente prohibido realizar consultas masivas (`SELECT *`) o ejecutar bucles iterativos que llamen repetidamente a la base de datos de Supabase.
- **Caché de Esquemas:** Si necesitas el esquema de una tabla, solicítalo una sola vez y guárdalo en tu contexto. 
- **Consumo de Red (Egress):** Minimiza el uso de la conexión activa para evitar consumir ancho de banda innecesario.
