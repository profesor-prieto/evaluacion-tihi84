-- =====================================================================
-- Seed: instrumentos ES4 / ES3, criterios, indicadores y ponderaciones.
-- Ejecutar después de schema.sql. Es idempotente para instrumentos;
-- los criterios/indicadores se recrean solo si aún no existen.
-- =====================================================================

insert into instruments (code, name, weight, sort) values
  ('ES4', 'Defensa del Proyecto', 35, 1),
  ('ES3', 'Demostración de la Implementación', 25, 2)
on conflict (code) do update set name = excluded.name, weight = excluded.weight, sort = excluded.sort;

do $$
declare
  c uuid;
begin
  if exists (select 1 from rubric_criteria) then
    raise notice 'Rúbricas ya cargadas; se omite la precarga de criterios e indicadores.';
    return;
  end if;

  -- ---------------- ES4 · Defensa del Proyecto ----------------
  insert into rubric_criteria (instrument_code, code, description, sort) values
    ('ES4', '3.1.3', 'Argumenta las decisiones técnicas y de gestión de la solución implementada, asumiendo la ética en su actuar reflexionando respecto de sus decisiones e implicancias en los otros.', 1)
  returning id into c;
  insert into rubric_items (criterion_id, number, description, weight, sort) values
    (c, 1, 'Explica claramente cómo el problema se detectó mediante el análisis de las necesidades levantadas e identifica correctamente a los afectados e interesados en el proyecto.', 10, 1),
    (c, 2, 'La explicación del análisis realizado da cuenta de un correcto alcance que tendrá la solución e identifica debidamente sus restricciones.', 10, 2),
    (c, 3, 'La explicación de la solución implementada considera correctamente los procesos de negocio involucrados, mostrando un diagrama BPMN o lienzo CANVAS o Cadena de Valor, según corresponda.', 10, 3),
    (c, 4, 'Explica en forma clara y precisa cómo el objetivo general y los objetivos específicos resuelven efectivamente la problemática a partir de una solución que utiliza las tecnologías informáticas.', 15, 4),
    (c, 5, 'Muestra cómo será implementada la solución, explicando en forma clara y precisa los diagramas de arquitectura, infraestructura y metodología de desarrollo utilizada.', 15, 5),
    (c, 6, 'Fundamenta la factibilidad de la solución a partir de los resultados del análisis de la dimensión técnica, económica, legal, ambiental e implementativa, asociados con el diseño, desarrollo e implementación de la solución.', 15, 6);

  insert into rubric_criteria (instrument_code, code, description, sort) values
    ('ES4', '3.1.4', 'Retroalimentando eficazmente el desempeño grupal e individual de los miembros del equipo.', 2)
  returning id into c;
  insert into rubric_items (criterion_id, number, description, weight, sort) values
    (c, 7, 'Efectúa una sólida conclusión entregando juicios profesionales respecto del valor al negocio que aporta la solución a la organización, sustentada en los resultados del desarrollo de la solución y su implementación.', 10, 7),
    (c, 8, 'Responde correctamente las preguntas de la audiencia con argumentos sólidos, usando en todo momento lenguaje técnico y formal, acorde a la situación de la presente evaluación.', 15, 8);

  -- ---------------- ES3 · Demostración de la Implementación ----------------
  insert into rubric_criteria (instrument_code, code, description, sort) values
    ('ES3', '3.1.1', 'Considera las plataformas de soporte e implementación de la solución informática elaborada.', 1)
  returning id into c;
  insert into rubric_items (criterion_id, number, description, weight, sort) values
    (c, 1, 'El desarrollo presentado demuestra que las plataformas seleccionadas entregan una adecuada solución a las necesidades del negocio.', 15, 1),
    (c, 2, 'La presentación de la solución demuestra que las herramientas tecnológicas implementadas se complementan adecuadamente entre sí.', 20, 2),
    (c, 3, 'Demuestra que los principales procesos de negocio desarrollados son los que entregan una solución sustentable a la problemática planteada.', 20, 3);

  insert into rubric_criteria (instrument_code, code, description, sort) values
    ('ES3', '3.1.2', 'Demuestra la funcionalidad y sustentabilidad de la solución desarrollada en concordancia con los propósitos del proyecto de ingeniería elaborado.', 2)
  returning id into c;
  insert into rubric_items (criterion_id, number, description, weight, sort) values
    (c, 4, 'El desarrollo presentado demuestra innovación que lo diferencia de otras soluciones actualmente existentes.', 15, 4),
    (c, 5, 'La elaboración de la solución implementada cumple con argumentos de razonabilidad, tales como las buenas prácticas, normas y estándares de desarrollo, incluyendo las evaluaciones técnica, operativa, económica, legal y ambiental.', 15, 5),
    (c, 6, 'En el desarrollo se demuestra el buen uso de herramientas tecnológicas que entregan estabilidad, rendimiento y buen diseño en la construcción de dicha solución.', 15, 6);

end $$;

-- ---------------------------------------------------------------------
-- Puntajes por nivel de valoración (tabla base vigente).
-- Editables desde la app (Administración → Puntajes). No sobrescribe cambios ya hechos.
-- ES3 (máx. 60)                         ES4 (máx. 60)
--   3.1.1.1  9 / 6 / 0                    3.1.3.1  6 / 4 / 0
--   3.1.1.2 12 / 8 / 0                    3.1.3.2  6 / 4 / 0
--   3.1.1.3 12 / 8 / 0                    3.1.3.3  6 / 4 / 0
--   3.1.2.4  9 / 6 / 0                    3.1.3.4  9 / 6 / 0
--   3.1.2.5  9 / 6 / 0                    3.1.3.5  9 / 6 / 0
--   3.1.2.6  9 / 6 / 0                    3.1.3.6  9 / 6 / 0
--                                         3.1.4.7  6 / 4 / 0
--                                         3.1.4.8  9 / 6 / 0
-- ---------------------------------------------------------------------
insert into rubric_item_levels (item_id, level, points)
select i.id, v.level, case v.level when 'excelente' then p.excelente when 'bueno' then p.bueno else 0 end
from rubric_items i
join rubric_criteria c on c.id = i.criterion_id
join (values
  ('ES3', 1,  9, 6), ('ES3', 2, 12, 8), ('ES3', 3, 12, 8),
  ('ES3', 4,  9, 6), ('ES3', 5,  9, 6), ('ES3', 6,  9, 6),
  ('ES4', 1,  6, 4), ('ES4', 2,  6, 4), ('ES4', 3,  6, 4), ('ES4', 4, 9, 6),
  ('ES4', 5,  9, 6), ('ES4', 6,  9, 6), ('ES4', 7,  6, 4), ('ES4', 8, 9, 6)
) as p(instrument_code, number, excelente, bueno)
  on p.instrument_code = c.instrument_code and p.number = i.number
cross join (values ('excelente'::rubric_level), ('bueno'::rubric_level), ('insatisfactorio'::rubric_level)) as v(level)
on conflict (item_id, level) do nothing;

-- Docente administrador inicial (TODO: reemplazar por el RUT real del docente a cargo).
insert into teachers (rut, full_name, is_admin) values
  ('11111111-1', 'Administrador (cambiar)', true)
on conflict (rut) do nothing;
