# Evaluación de Defensa – Proyecto de Título TIHI84

Aplicación web para que la comisión evaluadora de Proyecto de Título (Ingeniería en Informática, INACAP) evalúe en línea la
exposición final con dos instrumentos **separados**:

- **ES4 – Defensa del Proyecto** (35%)
- **ES3 – Demostración de la Implementación** (25%)

Cada evaluador valora cada indicador **por estudiante** con *Excelente / Bueno / Insatisfactorio*. El sistema muestra una
**rúbrica resultante por instrumento** (nunca mezcladas), con el promedio de puntos entre evaluadores y el nivel más
frecuente, sin conversión a nota. Cada rúbrica se puede imprimir o guardar como PDF.

**Stack:** React + Vite + TypeScript + Tailwind CSS · Supabase (PostgreSQL, Auth anónima, Realtime) · GitHub Pages.

## Funcionalidades

- **Ingreso con RUT** (validado con dígito verificador) — sin contraseña por ahora.
- **Selección del proyecto**: se sugiere la sesión más cercana a la fecha y hora actual.
- **Sesiones**: proyecto, fecha/hora, integrantes (3 por defecto, ±), Director de Carrera, comisión (Docente Guía,
  Director, acompañantes; 1 o más).
- **Cronómetro compartido**: el Docente Guía inicia/pausa/reinicia; toda la comisión ve el tiempo en tiempo real
  (defensa ≤ 12 min, demostración ≤ 8 min, referencia 20 min).
- **Evaluación** en pestañas separadas ES4 | ES3, por estudiante, con observaciones opcionales y guardado automático.
- **Avance de la comisión** en tiempo real para el Docente Guía.
- **Rúbricas resultantes** ES4 y ES3 por separado, imprimibles (A4 horizontal, una hoja por estudiante, con firmas).
- **Administración**: docentes (RUT, nombre, administrador) y puntajes por nivel de cada indicador.

### Permisos

| Acción | Docente Guía / creador / admin | Evaluador de la comisión | Otro docente |
|---|---|---|---|
| Ver la sesión | ✓ | ✓ | ✗ |
| Editar sesión, controlar cronómetro, finalizar | ✓ | ✗ | ✗ |
| Registrar sus propias valoraciones | ✓ (si integra la comisión) | ✓ | ✗ |
| Ver valoraciones de otros / rúbricas resultantes | ✓ (siempre) | ✓ (al finalizar la sesión) | ✗ |

## Puntajes por nivel (tabla base vigente)

| ES3 | Exc. | Bueno | Insat. | | ES4 | Exc. | Bueno | Insat. |
|---|---|---|---|---|---|---|---|---|
| 3.1.1.1 | 9 | 6 | 0 | | 3.1.3.1 | 6 | 4 | 0 |
| 3.1.1.2 | 12 | 8 | 0 | | 3.1.3.2 | 6 | 4 | 0 |
| 3.1.1.3 | 12 | 8 | 0 | | 3.1.3.3 | 6 | 4 | 0 |
| 3.1.2.4 | 9 | 6 | 0 | | 3.1.3.4 | 9 | 6 | 0 |
| 3.1.2.5 | 9 | 6 | 0 | | 3.1.3.5 | 9 | 6 | 0 |
| 3.1.2.6 | 9 | 6 | 0 | | 3.1.3.6 | 9 | 6 | 0 |
| **Máx.** | **60** | | | | 3.1.4.7 | 6 | 4 | 0 |
| | | | | | 3.1.4.8 | 9 | 6 | 0 |
| | | | | | **Máx.** | **60** | | |

Editables desde **Puntajes** (solo administradores).

## Configuración de Supabase

1. Crear un proyecto gratuito en <https://supabase.com>.
2. **Authentication → Sign In / Providers**: activar **Allow anonymous sign-ins**.
3. **SQL Editor**: ejecutar `supabase/schema.sql` y luego `supabase/seed.sql`.
4. Reemplazar el administrador inicial (RUT `11.111.111-1`) por el docente real:
   ```sql
   update teachers set rut = '12345678-5', full_name = 'Nombre Apellido' where rut = '11111111-1';
   ```
   (RUT sin puntos, con guion y DV en mayúscula.) Luego registrar al resto de los docentes desde la app.
5. **Project Settings → API**: copiar *Project URL* y *anon public key*.

## Desarrollo local

```bash
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173/evaluacion-tihi84/
npm test                     # pruebas de RUT, puntajes, cronómetro y sugerencia
npm run build
```

## Despliegue en GitHub Pages

1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: crear `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml` (tests + build + deploy).
   La app queda en `https://<usuario>.github.io/<repositorio>/`.

## Seguridad (estado actual)

El ingreso solo con RUT es deliberadamente simple: quien conozca el RUT de un docente registrado puede ingresar como él.
Las políticas RLS limitan el acceso a las sesiones donde el docente integra la comisión. El diseño (usuario de Supabase
vinculado a `teachers` mediante `teacher_logins`) permite agregar después contraseña o enlace mágico sin cambiar las
políticas.

## Estructura

```
supabase/schema.sql     tablas, funciones RPC, vista de resultados, RLS y Realtime
supabase/seed.sql       instrumentos, criterios, indicadores, ponderaciones y puntajes
src/lib/scoring.ts      consolidación (promedio, nivel modal, totales) — con tests
src/lib/rut.ts          validación y formato de RUT — con tests
src/lib/timer.ts        cronómetro compartido — con tests
src/lib/suggest.ts      sugerencia de sesión por fecha/hora — con tests
src/pages/              login, proyectos, sesión, evaluación, resultados, administración
```
