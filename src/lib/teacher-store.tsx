"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type Level = "Seconde" | "Première" | "Terminale";

export interface StudentRecord {
  id: string;
  name: string;
  email: string;
  accuracy: number;
  exercisesDone: number;
  weakSkill: string;
  lastActive: string;
  status: "top" | "active" | "struggling";
  skills: Record<string, number>; // skillName -> 0..100
}

export interface ClassAlert {
  id: string;
  text: string;
  action: string;
  severity: "high" | "medium" | "info";
  resolved?: boolean;
}

export interface TeacherClass {
  id: string;
  name: string;
  level: Level;
  inviteCode: string;
  color: string;
  students: StudentRecord[];
  skills: string[];
  alerts: ClassAlert[];
}

export interface ExerciseItem {
  id: string;
  title: string;
  level: Level;
  domain: string;
  chapter: string;
  difficulty: "Guidé" | "Standard" | "Type Bac";
  source: "Officiel" | "Créé par moi" | "IA approuvé";
  status: "published" | "draft";
  version: string;
  skills: string[];
  statement: string;
  questions: { prompt: string; type: string; expected: string }[];
}

export interface AssignmentItem {
  id: string;
  title: string;
  classId: string;
  exerciseIds: string[];
  dueDate: string;
  mode: "Entraînement" | "Noté";
  completedCount: number;
  totalStudents: number;
}

export interface CopySubmission {
  id: string;
  studentName: string;
  classId: string;
  assignmentTitle: string;
  submittedAt: string;
  status: "to_review" | "published";
  aiScore: number;
  maxScore: number;
  teacherScore: number;
  confidence: "Haute" | "Moyenne" | "Faible";
  transcription: {
    step: number;
    latex: string;
    verdict: "correct" | "partial" | "error" | "uncertain";
    note: string;
  }[];
  teacherComment: string;
}

const DEFAULT_CLASSES: TeacherClass[] = [
  {
    id: "cls-term-1",
    name: "Terminale Spé 1",
    level: "Terminale",
    inviteCode: "PHY-2026-TS1",
    color: "from-indigo-500 to-violet-600",
    skills: ["Loi d'Ohm", "Conversion d'unités", "Lois de Newton", "Chute libre", "Acido-basicité", "Chiffres significatifs"],
    alerts: [
      { id: "a1", text: "68% de la classe a des difficultés sur la conversion d'unités (mA ↔ A)", action: "Envoyer remédiation", severity: "high" },
      { id: "a2", text: "Lina M. n'a pas pratiqué depuis 5 jours", action: "Envoyer un rappel", severity: "medium" },
      { id: "a3", text: "2 copies manuscrites pré-corrigées à valider", action: "Valider les copies", severity: "info" },
    ],
    students: [
      {
        id: "s1", name: "Amira Benali", email: "amira.b@lycee.fr", accuracy: 74, exercisesDone: 28,
        weakSkill: "Conversion d'unités", lastActive: "Il y a 2h", status: "active",
        skills: { "Loi d'Ohm": 92, "Conversion d'unités": 34, "Lois de Newton": 86, "Chute libre": 62, "Acido-basicité": 70, "Chiffres significatifs": 68 },
      },
      {
        id: "s2", name: "Karim Saidi", email: "karim.s@lycee.fr", accuracy: 88, exercisesDone: 35,
        weakSkill: "Chute libre", lastActive: "Il y a 4h", status: "top",
        skills: { "Loi d'Ohm": 95, "Conversion d'unités": 82, "Lois de Newton": 91, "Chute libre": 58, "Acido-basicité": 89, "Chiffres significatifs": 85 },
      },
      {
        id: "s3", name: "Lina Mansour", email: "lina.m@lycee.fr", accuracy: 45, exercisesDone: 11,
        weakSkill: "Conversion d'unités", lastActive: "Il y a 5j", status: "struggling",
        skills: { "Loi d'Ohm": 60, "Conversion d'unités": 25, "Lois de Newton": 48, "Chute libre": 35, "Acido-basicité": 42, "Chiffres significatifs": 38 },
      },
      {
        id: "s4", name: "Sara Toumi", email: "sara.t@lycee.fr", accuracy: 93, exercisesDone: 41,
        weakSkill: "Aucune lacune majeure", lastActive: "Il y a 1h", status: "top",
        skills: { "Loi d'Ohm": 98, "Conversion d'unités": 90, "Lois de Newton": 94, "Chute libre": 88, "Acido-basicité": 92, "Chiffres significatifs": 95 },
      },
      {
        id: "s5", name: "Mehdi Haddad", email: "mehdi.h@lycee.fr", accuracy: 56, exercisesDone: 19,
        weakSkill: "Chute libre", lastActive: "Hier", status: "struggling",
        skills: { "Loi d'Ohm": 74, "Conversion d'unités": 40, "Lois de Newton": 61, "Chute libre": 32, "Acido-basicité": 58, "Chiffres significatifs": 50 },
      },
    ],
  },
  {
    id: "cls-prem-2",
    name: "Première Spé B",
    level: "Première",
    inviteCode: "PHY-2026-P1B",
    color: "from-emerald-500 to-teal-600",
    skills: ["Tableau d'avancement", "Oxydoréduction", "Quantité de matière", "Forces & vecteurs", "Énergie cinétique"],
    alerts: [
      { id: "b1", text: "55% de la classe confond réactif limitant et stœchiométrie", action: "Envoyer remédiation", severity: "high" },
      { id: "b2", text: "1 copie de contrôle de chimie à vérifier", action: "Valider les copies", severity: "info" },
    ],
    students: [
      {
        id: "s6", name: "Omar Diallo", email: "omar.d@lycee.fr", accuracy: 67, exercisesDone: 22,
        weakSkill: "Tableau d'avancement", lastActive: "Il y a 3h", status: "active",
        skills: { "Tableau d'avancement": 48, "Oxydoréduction": 64, "Quantité de matière": 79, "Forces & vecteurs": 72, "Énergie cinétique": 70 },
      },
      {
        id: "s7", name: "Chloé Laurent", email: "chloe.l@lycee.fr", accuracy: 85, exercisesDone: 31,
        weakSkill: "Oxydoréduction", lastActive: "Aujourd'hui", status: "top",
        skills: { "Tableau d'avancement": 88, "Oxydoréduction": 66, "Quantité de matière": 92, "Forces & vecteurs": 85, "Énergie cinétique": 90 },
      },
      {
        id: "s8", name: "Nassim Khelifi", email: "nassim.k@lycee.fr", accuracy: 42, exercisesDone: 9,
        weakSkill: "Quantité de matière", lastActive: "Il y a 3j", status: "struggling",
        skills: { "Tableau d'avancement": 38, "Oxydoréduction": 35, "Quantité de matière": 30, "Forces & vecteurs": 52, "Énergie cinétique": 49 },
      },
      {
        id: "s9", name: "Inès Moreau", email: "ines.m@lycee.fr", accuracy: 76, exercisesDone: 24,
        weakSkill: "Tableau d'avancement", lastActive: "Hier", status: "active",
        skills: { "Tableau d'avancement": 55, "Oxydoréduction": 78, "Quantité de matière": 84, "Forces & vecteurs": 80, "Énergie cinétique": 81 },
      },
    ],
  },
  {
    id: "cls-sec-3",
    name: "Seconde 3",
    level: "Seconde",
    inviteCode: "PHY-2026-2DE3",
    color: "from-orange-500 to-amber-500",
    skills: ["Loi d'Ohm", "Masse volumique", "Notation scientifique", "Concentration massique", "Réfraction"],
    alerts: [
      { id: "c1", text: "La notation scientifique reste fragile chez 3 élèves", action: "Envoyer remédiation", severity: "medium" },
    ],
    students: [
      {
        id: "s10", name: "Yassine Amrani", email: "yassine.a@lycee.fr", accuracy: 41, exercisesDone: 12,
        weakSkill: "Notation scientifique", lastActive: "Hier", status: "struggling",
        skills: { "Loi d'Ohm": 48, "Masse volumique": 52, "Notation scientifique": 24, "Concentration massique": 40, "Réfraction": 45 },
      },
      {
        id: "s11", name: "Lucas Petit", email: "lucas.p@lycee.fr", accuracy: 82, exercisesDone: 27,
        weakSkill: "Réfraction", lastActive: "Aujourd'hui", status: "top",
        skills: { "Loi d'Ohm": 90, "Masse volumique": 86, "Notation scientifique": 80, "Concentration massique": 84, "Réfraction": 65 },
      },
      {
        id: "s12", name: "Maya Gharbi", email: "maya.g@lycee.fr", accuracy: 69, exercisesDone: 18,
        weakSkill: "Notation scientifique", lastActive: "Il y a 6h", status: "active",
        skills: { "Loi d'Ohm": 78, "Masse volumique": 74, "Notation scientifique": 44, "Concentration massique": 72, "Réfraction": 75 },
      },
    ],
  },
];

const DEFAULT_EXERCISES: ExerciseItem[] = [
  {
    id: "ex-1",
    title: "Loi d'Ohm & conversion mA/A",
    level: "Seconde",
    domain: "Électricité",
    chapter: "Circuits électriques",
    difficulty: "Standard",
    source: "Officiel",
    status: "published",
    version: "v1.2",
    skills: ["Loi d'Ohm", "Conversion d'unités"],
    statement: "Un conducteur ohmique de résistance R = {R} Ω est soumis à une tension U = {U} V.",
    questions: [
      { prompt: "Exprimer I en fonction de U et R.", type: "Expression", expected: "I = U / R" },
      { prompt: "Calculer I en mA avec 2 chiffres significatifs.", type: "Grandeur", expected: "(U / R) * 1000 mA" },
    ],
  },
  {
    id: "ex-2",
    title: "Chute libre avec frottements — Type Bac",
    level: "Terminale",
    domain: "Mécanique",
    chapter: "Mouvement dans un champ uniforme",
    difficulty: "Type Bac",
    source: "IA approuvé",
    status: "published",
    version: "v1.0",
    skills: ["Lois de Newton", "Chute libre"],
    statement: "Une bille de masse m = {m} g est lâchée sans vitesse initiale dans un fluide exerçant une force de frottement f = k·v.",
    questions: [
      { prompt: "Établir l'équation différentielle vérifiée par v(t).", type: "Expression", expected: "dv/dt + (k/m)*v = g" },
      { prompt: "Déterminer l'expression de la vitesse limite v_lim.", type: "Expression", expected: "m*g/k" },
      { prompt: "Calculer v_lim en m·s⁻¹.", type: "Grandeur", expected: "m*g/k m/s" },
    ],
  },
  {
    id: "ex-3",
    title: "Tableau d'avancement & réactif limitant",
    level: "Première",
    domain: "Chimie",
    chapter: "Suivi d'une transformation chimique",
    difficulty: "Guidé",
    source: "Officiel",
    status: "published",
    version: "v2.0",
    skills: ["Tableau d'avancement", "Quantité de matière"],
    statement: "On mélange n₁ = {n1} mol de Mg avec n₂ = {n2} mol d'ions H⁺ selon : Mg + 2 H⁺ → Mg²⁺ + H₂.",
    questions: [
      { prompt: "Identifier le réactif limitant en justifiant.", type: "Texte libre", expected: "Comparer n1 et n2/2" },
      { prompt: "Calculer l'avancement maximal x_max en mol.", type: "Grandeur", expected: "min(n1, n2/2) mol" },
    ],
  },
  {
    id: "ex-4",
    title: "Titrage acido-basique par pH-métrie",
    level: "Terminale",
    domain: "Chimie",
    chapter: "Acido-basicité",
    difficulty: "Type Bac",
    source: "Créé par moi",
    status: "published",
    version: "v1.1",
    skills: ["Acido-basicité", "Chiffres significatifs"],
    statement: "On titre un volume V_A = {VA} mL d'acide éthanoïque par de la soude de concentration C_B = {CB} mol·L⁻¹. L'équivalence est atteinte à V_E = {VE} mL.",
    questions: [
      { prompt: "Écrire l'équation de la réaction support du titrage.", type: "Expression", expected: "CH3COOH + HO- -> CH3COO- + H2O" },
      { prompt: "Calculer la concentration C_A de l'acide.", type: "Grandeur", expected: "CB * VE / VA mol/L" },
    ],
  },
];

const DEFAULT_ASSIGNMENTS: AssignmentItem[] = [
  {
    id: "asg-1",
    title: "DM #4 — Mécanique & Chute libre",
    classId: "cls-term-1",
    exerciseIds: ["ex-2"],
    dueDate: "24 nov. 2026",
    mode: "Noté",
    completedCount: 4,
    totalStudents: 5,
  },
  {
    id: "asg-2",
    title: "Remédiation — Conversions mA / A",
    classId: "cls-term-1",
    exerciseIds: ["ex-1"],
    dueDate: "22 nov. 2026",
    mode: "Entraînement",
    completedCount: 3,
    totalStudents: 5,
  },
  {
    id: "asg-3",
    title: "Entraînement — Tableau d'avancement",
    classId: "cls-prem-2",
    exerciseIds: ["ex-3"],
    dueDate: "25 nov. 2026",
    mode: "Entraînement",
    completedCount: 2,
    totalStudents: 4,
  },
];

const DEFAULT_COPIES: CopySubmission[] = [
  {
    id: "copy-1",
    studentName: "Amira Benali",
    classId: "cls-term-1",
    assignmentTitle: "DS #2 — Mouvement & Lois de Newton",
    submittedAt: "Aujourd'hui, 10:42",
    status: "to_review",
    aiScore: 14.5,
    maxScore: 20,
    teacherScore: 14.5,
    confidence: "Haute",
    transcription: [
      { step: 1, latex: "Système : {bille}, Référentiel : terrestre supposé galiléen", verdict: "correct", note: "Cadre correctement posé (+2/2)" },
      { step: 2, latex: "ΣF = m·a  ⇒  P + f = m·(dv/dt)", verdict: "correct", note: "2e loi de Newton exacte (+4/4)" },
      { step: 3, latex: "Projection sur Oz : m·g - k·v = m·(dv/dt)", verdict: "correct", note: "Projection correcte (+4/4)" },
      { step: 4, latex: "v_lim = m·g / k = 50 × 9,81 / 0,12 = 4087 m/s", verdict: "error", note: "Erreur d'unité : m = 50 g non converti en kg (0,050 kg → 4,1 m/s). Crédit partiel pour la formule (+4,5/10)." },
    ],
    teacherComment: "Très bonne démarche en mécanique ! Attention systématique à convertir les grammes en kilogrammes avant l'application numérique.",
  },
  {
    id: "copy-2",
    studentName: "Mehdi Haddad",
    classId: "cls-term-1",
    assignmentTitle: "DS #2 — Mouvement & Lois de Newton",
    submittedAt: "Aujourd'hui, 10:44",
    status: "to_review",
    aiScore: 11,
    maxScore: 20,
    teacherScore: 11,
    confidence: "Moyenne",
    transcription: [
      { step: 1, latex: "D'après la 2e loi de Newton : P = m·a", verdict: "partial", note: "Force de frottement f oubliée dans le bilan (+2/6)" },
      { step: 2, latex: "a = g = 9,81 m·s⁻²", verdict: "correct", note: "Cohérent avec l'étape 1 — non pénalisé deux fois (+4/4)" },
      { step: 3, latex: "v(t) = 3,5 × t  (ou 8,5 × t ?)", verdict: "uncertain", note: "Écriture manuscrite incertaine (3,5 vs 8,5) — à vérifier visuellement (+5/10)" },
    ],
    teacherComment: "Pense à faire le bilan de toutes les forces avant de projeter.",
  },
  {
    id: "copy-3",
    studentName: "Omar Diallo",
    classId: "cls-prem-2",
    assignmentTitle: "Contrôle — Quantité de matière",
    submittedAt: "Hier, 16:15",
    status: "to_review",
    aiScore: 16,
    maxScore: 20,
    teacherScore: 16,
    confidence: "Haute",
    transcription: [
      { step: 1, latex: "n(Mg) = m / M = 2,4 / 24,3 = 0,099 mol", verdict: "correct", note: "Calcul et chiffres significatifs exacts (+6/6)" },
      { step: 2, latex: "n(H⁺) / 2 = 0,15 / 2 = 0,075 mol < n(Mg)", verdict: "correct", note: "Réactif limitant H⁺ bien identifié (+6/6)" },
      { step: 3, latex: "x_max = 0,15 mol", verdict: "error", note: "Oubli du coefficient stœchiométrique 2 : x_max = 0,075 mol (+4/8)" },
    ],
    teacherComment: "Bonne comparaison à l'étape 2, n'oublie pas de reporter la valeur divisée par 2 pour x_max.",
  },
];

interface TeacherStoreContextType {
  classes: TeacherClass[];
  selectedClassId: string; // "all" or class.id
  setSelectedClassId: (id: string) => void;
  createClass: (name: string, level: Level) => TeacherClass;
  addStudentToClass: (classId: string, name: string, email: string) => void;
  resolveAlert: (classId: string, alertId: string) => void;
  exercises: ExerciseItem[];
  addExercise: (ex: Omit<ExerciseItem, "id">) => ExerciseItem;
  assignments: AssignmentItem[];
  addAssignment: (asg: Omit<AssignmentItem, "id" | "completedCount" | "totalStudents">) => void;
  copies: CopySubmission[];
  updateCopy: (copyId: string, updates: Partial<CopySubmission>) => void;
}

const TeacherStoreContext = createContext<TeacherStoreContextType | null>(null);

const STORAGE_KEY = "spc_teacher_store_v1";

const CLASS_COLORS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-500",
  "from-pink-500 to-rose-500",
  "from-cyan-500 to-blue-600",
];

function generateInviteCode(level: Level) {
  const prefix = level === "Terminale" ? "TS" : level === "Première" ? "1S" : "2D";
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `PHY-2026-${prefix}${rand}`;
}

export function TeacherStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[]>(DEFAULT_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [exercises, setExercises] = useState<ExerciseItem[]>(DEFAULT_EXERCISES);
  const [assignments, setAssignments] = useState<AssignmentItem[]>(DEFAULT_ASSIGNMENTS);
  const [copies, setCopies] = useState<CopySubmission[]>(DEFAULT_COPIES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = getSupabaseBrowserClient();
      if (isSupabaseConfigured && supabase && user?.id) {
        const { data: dbClasses } = await supabase
          .from("classes")
          .select("id, name, level, invite_code, color, class_members(student_id, profiles(id, first_name, last_name, email))")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: true });

        if (dbClasses && dbClasses.length > 0) {
          const defaultSkillsByLevel: Record<Level, string[]> = {
            Seconde: ["Loi d'Ohm", "Masse volumique", "Notation scientifique", "Concentration massique"],
            Première: ["Tableau d'avancement", "Oxydoréduction", "Quantité de matière", "Forces & vecteurs"],
            Terminale: ["Loi d'Ohm", "Conversion d'unités", "Lois de Newton", "Chute libre", "Acido-basicité"],
          };
          const mapped: TeacherClass[] = dbClasses.map((row: Record<string, unknown>, idx: number) => {
            const lvl = (row.level as Level) || "Terminale";
            const skills = defaultSkillsByLevel[lvl];
            const members = (row.class_members as Array<Record<string, unknown>>) || [];
            const students: StudentRecord[] = members.map((m) => {
              const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Record<string, string> | null;
              const skillsMap: Record<string, number> = {};
              skills.forEach((s) => (skillsMap[s] = 60));
              return {
                id: String(m.student_id),
                name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "Élève",
                email: p?.email || "",
                accuracy: 60,
                exercisesDone: 0,
                weakSkill: "À évaluer",
                lastActive: "Inscrit",
                status: "active",
                skills: skillsMap,
              };
            });
            return {
              id: String(row.id),
              name: String(row.name),
              level: lvl,
              inviteCode: String(row.invite_code),
              color: String(row.color || CLASS_COLORS[idx % CLASS_COLORS.length]),
              skills,
              alerts: [],
              students,
            };
          });
          setClasses(mapped);
          setHydrated(true);
          return;
        }
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.classes?.length) setClasses(parsed.classes);
          if (parsed.exercises?.length) setExercises(parsed.exercises);
          if (parsed.assignments?.length) setAssignments(parsed.assignments);
          if (parsed.copies?.length) setCopies(parsed.copies);
        }
      } catch {
        // ignore storage errors
      }
      setHydrated(true);
    }
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ classes, exercises, assignments, copies })
      );
    } catch {
      // ignore storage errors
    }
  }, [classes, exercises, assignments, copies, hydrated]);

  const createClass = (name: string, level: Level): TeacherClass => {
    const defaultSkillsByLevel: Record<Level, string[]> = {
      Seconde: ["Loi d'Ohm", "Masse volumique", "Notation scientifique", "Concentration massique"],
      Première: ["Tableau d'avancement", "Oxydoréduction", "Quantité de matière", "Forces & vecteurs"],
      Terminale: ["Loi d'Ohm", "Conversion d'unités", "Lois de Newton", "Chute libre", "Acido-basicité"],
    };
    const inviteCode = generateInviteCode(level);
    const color = CLASS_COLORS[classes.length % CLASS_COLORS.length];
    const newClass: TeacherClass = {
      id: `cls-${Date.now()}`,
      name: name.trim(),
      level,
      inviteCode,
      color,
      skills: defaultSkillsByLevel[level],
      alerts: [],
      students: [],
    };
    setClasses((prev) => [...prev, newClass]);
    setSelectedClassId(newClass.id);

    // Sync to Supabase PostgreSQL if configured
    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase && user?.id) {
      supabase
        .from("classes")
        .insert({
          teacher_id: user.id,
          name: newClass.name,
          level: newClass.level,
          invite_code: inviteCode,
          color,
        })
        .select("id")
        .single()
        .then(({ data }) => {
          if (data?.id) {
            setClasses((prev) =>
              prev.map((c) => (c.id === newClass.id ? { ...c, id: data.id } : c))
            );
            setSelectedClassId(data.id);
          }
        });
    }

    return newClass;
  };

  const addStudentToClass = (classId: string, name: string, email: string) => {
    setClasses((prev) =>
      prev.map((cls) => {
        if (cls.id !== classId) return cls;
        const skillsMap: Record<string, number> = {};
        cls.skills.forEach((sk) => {
          skillsMap[sk] = 50;
        });
        const newStudent: StudentRecord = {
          id: `stu-${Date.now()}`,
          name: name.trim(),
          email: email.trim() || `${name.toLowerCase().replace(/\s+/g, ".")}@lycee.fr`,
          accuracy: 50,
          exercisesDone: 0,
          weakSkill: "À évaluer",
          lastActive: "Vient d'être invité",
          status: "active",
          skills: skillsMap,
        };
        return { ...cls, students: [...cls.students, newStudent] };
      })
    );
  };

  const resolveAlert = (classId: string, alertId: string) => {
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id !== classId
          ? cls
          : {
              ...cls,
              alerts: cls.alerts.map((a) => (a.id === alertId ? { ...a, resolved: true } : a)),
            }
      )
    );
  };

  const addExercise = (ex: Omit<ExerciseItem, "id">): ExerciseItem => {
    const created: ExerciseItem = { ...ex, id: `ex-${Date.now()}` };
    setExercises((prev) => [created, ...prev]);

    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase && user?.id) {
      const diffMap: Record<ExerciseItem["difficulty"], string> = {
        Guidé: "guided",
        Standard: "standard",
        "Type Bac": "bac",
      };
      const srcMap: Record<ExerciseItem["source"], string> = {
        Officiel: "official",
        "Créé par moi": "teacher",
        "IA approuvé": "ai_approved",
      };
      supabase
        .from("exercises")
        .insert({
          author_id: user.id,
          level: ex.level,
          domain: ex.domain,
          chapter: ex.chapter,
          difficulty: diffMap[ex.difficulty] || "standard",
          source: srcMap[ex.source] || "teacher",
          status: "published",
        })
        .select("id")
        .single()
        .then(({ data }) => {
          if (data?.id) {
            supabase.from("exercise_versions").insert({
              exercise_id: data.id,
              version_number: 1,
              title: ex.title,
              statement_template: ex.statement,
              questions_schema: ex.questions,
            });
          }
        });
    }
    return created;
  };

  const addAssignment = (asg: Omit<AssignmentItem, "id" | "completedCount" | "totalStudents">) => {
    const cls = classes.find((c) => c.id === asg.classId);
    const created: AssignmentItem = {
      ...asg,
      id: `asg-${Date.now()}`,
      completedCount: 0,
      totalStudents: cls?.students.length || 0,
    };
    setAssignments((prev) => [created, ...prev]);

    const supabase = getSupabaseBrowserClient();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(asg.classId);
    if (isSupabaseConfigured && supabase && user?.id && isUuid) {
      supabase
        .from("assignments")
        .insert({
          class_id: asg.classId,
          teacher_id: user.id,
          title: asg.title,
          mode: asg.mode === "Noté" ? "graded" : "practice",
        })
        .then(() => {});
    }
  };

  const updateCopy = (copyId: string, updates: Partial<CopySubmission>) => {
    setCopies((prev) => prev.map((c) => (c.id === copyId ? { ...c, ...updates } : c)));
  };

  return (
    <TeacherStoreContext.Provider
      value={{
        classes,
        selectedClassId,
        setSelectedClassId,
        createClass,
        addStudentToClass,
        resolveAlert,
        exercises,
        addExercise,
        assignments,
        addAssignment,
        copies,
        updateCopy,
      }}
    >
      {children}
    </TeacherStoreContext.Provider>
  );
}

export function useTeacherStore() {
  const ctx = useContext(TeacherStoreContext);
  if (!ctx) throw new Error("useTeacherStore must be used inside TeacherStoreProvider");
  return ctx;
}
