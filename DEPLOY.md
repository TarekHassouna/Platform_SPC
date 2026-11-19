# Guide de déploiement — Platform SPC (pour vos 600 élèves)

## 1. Base de données & Stockage (Supabase)
Dans votre projet Supabase (**SQL Editor**), exécutez dans l'ordre :
1. `supabase/schema.sql` (tables relationnelles + RLS + RPC `join_class_by_code`)
2. `supabase/seed.sql` (compétences officielles Seconde / Première / Terminale + prérequis)
3. `supabase/storage.sql` (bucket privé `student-photos` + droits d'écriture `concept_mastery`)

Vérifiez ensuite `/api/db/health` → doit retourner `{"connected": true, "schemaReady": true}`.

## 2. Déployer le site Web sur Vercel (Gratuit pour démarrer / Pro en production)
1. Poussez votre code sur GitHub (`TarekHassouna/Platform_SPC`).
2. Sur **https://vercel.com** → **Add New Project** → importez `TarekHassouna/Platform_SPC`.
3. Ajoutez les variables d'environnement (**Settings → Environment Variables**) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` *(ou `GEMINI_API_KEY`)* pour activer le Tuteur IA, l'OCR photo et le générateur d'exercices
   - `EVALUATION_SERVICE_URL` *(URL Railway/Render de l'étape 3)*
4. Cliquez sur **Deploy**.
5. Dans **Supabase → Authentication → URL Configuration**, ajoutez votre URL Vercel :
   - **Site URL** : `https://votre-domaine.vercel.app`
   - **Redirect URLs** : `https://votre-domaine.vercel.app/auth/callback`

## 3. Déployer le moteur physique Python (SymPy + Pint)
Le dossier `evaluation-service/` contient un `Dockerfile` prêt à l'emploi :
- **Sur Railway ou Render** : créez un nouveau service Web pointant vers le dépôt GitHub, **Root Directory = `evaluation-service`**, build via **Dockerfile**, port `8000`.
- Copiez l'URL publique (ex : `https://spc-evaluator.up.railway.app`) dans `EVALUATION_SERVICE_URL` sur Vercel.
- Testez `GET /health` → `{"status":"ok","engine":"sympy_pint"}`.

## 4. Protection des coûts IA (600 élèves)
Le serveur applique automatiquement des quotas quotidiens par élève dans `src/lib/ai-provider.ts` :
- **Tuteur IA** : 30 messages / élève / jour
- **Photo manuscrite (Vision)** : 10 photos / élève / jour
- **Correction clavier (SymPy + Pint)** : **Illimité** (coût IA = 0 €)
