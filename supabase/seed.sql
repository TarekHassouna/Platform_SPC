-- =============================================================================
-- Platform SPC — Initial Curriculum & Official Exercise Seed (Optional)
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.
-- =============================================================================

insert into public.concepts (subject, level, domain, chapter, code, label, lesson_markdown) values
  ('physique_chimie', 'Seconde', 'Métrologie', 'Mesures et incertitudes', 'conversion_unites', 'Conversion d''unités SI (mA ↔ A, g ↔ kg)', '1 mA = 10⁻³ A ; 1 g = 10⁻³ kg. Toujours convertir en unités SI avant l''application numérique.'),
  ('physique_chimie', 'Seconde', 'Métrologie', 'Mesures et incertitudes', 'chiffres_significatifs', 'Chiffres significatifs', 'Le résultat d''une multiplication ou division garde autant de chiffres significatifs que la donnée la moins précise.'),
  ('physique_chimie', 'Seconde', 'Électricité', 'Circuits électriques', 'loi_ohm', 'Loi d''Ohm (U = R · I)', 'Aux bornes d''un conducteur ohmique de résistance R (Ω), U (V) = R × I (A).'),
  ('physique_chimie', 'Première', 'Chimie', 'Suivi d''une transformation', 'tableau_avancement', 'Tableau d''avancement & réactif limitant', 'Le réactif limitant est celui pour lequel n_initial / coefficient stœchiométrique est le plus petit.'),
  ('physique_chimie', 'Terminale', 'Mécanique', 'Mouvement dans un champ uniforme', 'lois_newton', 'Deuxième loi de Newton', 'Dans un référentiel galiléen, ΣF_ext = m · a.'),
  ('physique_chimie', 'Terminale', 'Mécanique', 'Mouvement dans un champ uniforme', 'chute_libre', 'Chute libre & chute avec frottements', 'Projection sur un axe vertical : dv/dt + (k/m)v = g ⇒ v_lim = m·g/k.'),
  ('physique_chimie', 'Terminale', 'Chimie', 'Acido-basicité', 'acido_basicite', 'Titrages acido-basiques', 'À l''équivalence, les réactifs sont introduits dans les proportions stœchiométriques : C_A·V_A = C_B·V_E.')
on conflict (code) do nothing;

-- Prerequisite relationships (e.g., Loi d'Ohm & Chute libre depend on Conversion d'unités)
insert into public.concept_prerequisites (concept_id, prerequisite_id)
select c1.id, c2.id
from public.concepts c1, public.concepts c2
where (c1.code = 'loi_ohm' and c2.code = 'conversion_unites')
   or (c1.code = 'chute_libre' and c2.code = 'lois_newton')
   or (c1.code = 'chute_libre' and c2.code = 'conversion_unites')
   or (c1.code = 'acido_basicite' and c2.code = 'tableau_avancement')
on conflict do nothing;
