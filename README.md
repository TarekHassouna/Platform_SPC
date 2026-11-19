# Platform SPC — AI Learning Platform for Physique-Chimie

An AI-powered learning platform for French secondary-school *physique-chimie* (Seconde, Première, Terminale) that doesn't just mark answers right or wrong — it explains **why**, identifies the exact skill gap, grades handwritten work, and adapts practice until students master the concept.

## Key Features

- **4 Dedicated Role Portals**
  - **Student** (`/dashboard`, `/exercises`, `/progress`, `/tutor`, `/photo`) — interactive exercises, mastery map, Socratic AI tutor, handwritten photo submission (`J'ai une question`, `Corrige-moi`, `Note-moi`)
  - **Teacher / Private Tutor** (`/teacher/dashboard`, `/teacher/classes`, `/teacher/exercises`, `/teacher/create`, `/teacher/results`, `/teacher/grading`) — unlimited multi-class management with invite codes, AI-assisted exercise generation & verification, Student × Skill Heatmap with 1-click remediation, batch handwritten copy pre-grading
  - **Parent** (`/parent/dashboard`, `/parent/subscription`, `/parent/settings`) — child weekly progress, AI quota meters, invoices, GDPR minor consent & photo retention controls
  - **Organization Admin** (`/org/dashboard`, `/org/teachers`, `/org/seats`, `/org/billing`) — school-level analytics by grade, teacher invitations, student seat pool with volume tiers, DPA & billing
- **Flexible Physics Evaluation Engine** (`evaluation-service/` + `/api/evaluate`)
  - Algebraic equivalence checking (**SymPy**)
  - Physical quantity & unit conversion checking (**Pint**)
  - Significant figures, partial credit, known misconception tagging (`formule_inversee`, `conversion_unites`), and unreadable input handling
- **Supabase Auth + Relational PostgreSQL Schema** (`supabase/schema.sql`, `supabase/seed.sql`)
  - `@supabase/ssr` cookie middleware & route protection
  - 18 relational tables (`profiles`, `organizations`, `memberships`, `parent_child_links`, `classes`, `class_members`, `concepts`, `concept_prerequisites`, `exercises`, `exercise_versions`, `assignments`, `submissions`, `evaluation_results`, `error_records`, `concept_mastery`, `tutor_sessions`, `subscriptions`, `audit_logs`) with Row-Level Security (RLS)

## Getting Started

### 1. Install & configure Next.js app
```bash
npm install
cp .env.example .env.local
```
Add your Supabase Project URL and Publishable/Anon Key in `.env.local`, then run:
```bash
npm run dev
```

### 2. Initialize Supabase Database
In your Supabase **SQL Editor**, run:
1. `supabase/schema.sql`
2. *(Optional)* `supabase/seed.sql`

Then verify at `http://localhost:3000/api/db/health`.

### 3. Run the Python FastAPI Evaluation Service (optional)
```bash
cd evaluation-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
