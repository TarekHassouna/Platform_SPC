"use client";
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CURRICULUM_EXERCISES } from "@/lib/curriculum-bank";

export type Level = "Seconde" | "Première" | "Terminale";

export interface StudentAttemptRecord {
  id: string;
  exerciseTitle: string;
  score: number;
  maxScore: number;
  pct: number;
  status: string;
  submittedAt: string;
  answers: Record<string, string>;
}

export interface StudentRecord {
  id: string;
  name: string;
  email: string;
  accuracy: number;
  exercisesDone: number;
  weakSkill: string;
  lastActive: string;
  status: "top" | "active" | "struggling";
  skills: Record<string, number>;
  recentAttempts: StudentAttemptRecord[];
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
  versionId?: string;
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
  questions: { prompt: string; type: string; expected: string; hint?: string; misconception?: string }[];
}

export interface AssignmentItem {
  id: string;
  title: string;
  classId: string;
  exerciseIds: string[];
  dueDate: string;
  mode: "Entraînement" | "Noté";
  allowRetry: boolean;
  allowHints: boolean;
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

interface TeacherStoreContextType {
  loading: boolean;
  refresh: () => Promise<void>;
  classes: TeacherClass[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  createClass: (name: string, level: Level) => Promise<TeacherClass | null>;
  addStudentToClass: (classId: string, name: string, email: string) => void;
  resolveAlert: (classId: string, alertId: string) => void;
  exercises: ExerciseItem[];
  addExercise: (ex: Omit<ExerciseItem, "id">) => Promise<ExerciseItem>;
  assignments: AssignmentItem[];
  addAssignment: (asg: Omit<AssignmentItem, "id" | "completedCount" | "totalStudents">) => Promise<void>;
  toggleAssignmentRetry: (assignmentId: string) => Promise<void>;
  toggleAssignmentHints: (assignmentId: string) => Promise<void>;
  copies: CopySubmission[];
  updateCopy: (copyId: string, updates: Partial<CopySubmission>) => void;
}

const TeacherStoreContext = createContext<TeacherStoreContextType | null>(null);

const CLASS_COLORS = [
  "from-indigo-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-500",
  "from-pink-500 to-rose-500",
  "from-cyan-500 to-blue-600",
];

const DEFAULT_SKILLS_BY_LEVEL: Record<Level, string[]> = {
  Seconde: ["Loi d'Ohm (U = R · I)", "Conversion d'unités SI (mA ↔ A, g ↔ kg)", "Chiffres significatifs"],
  Première: ["Tableau d'avancement & réactif limitant", "Conversion d'unités SI (mA ↔ A, g ↔ kg)", "Deuxième loi de Newton"],
  Terminale: [
    "Loi d'Ohm (U = R · I)",
    "Conversion d'unités SI (mA ↔ A, g ↔ kg)",
    "Deuxième loi de Newton",
    "Chute libre & chute avec frottements",
    "Titrages acido-basiques",
  ],
};

// Official verified exercises come directly from curriculum-bank.ts (real runnable exercises, not fake placeholders!)
const OFFICIAL_EXERCISES: ExerciseItem[] = CURRICULUM_EXERCISES.map((ex) => {
  const sample = ex.generate(0);
  return {
    id: ex.id,
    title: ex.title,
    level: ex.level,
    domain: ex.domain,
    chapter: ex.chapter,
    difficulty: ex.difficulty,
    source: "Officiel",
    status: "published",
    version: "v1.0",
    skills: ex.conceptCodes,
    statement: sample.statement,
    questions: sample.questions.map((q) => ({
      prompt: q.prompt,
      type: q.type === "expression" ? "Expression" : "Grandeur",
      expected: q.expected,
    })),
  };
});

function generateInviteCode(level: Level) {
  const prefix = level === "Terminale" ? "TS" : level === "Première" ? "1S" : "2D";
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PHY-2026-${prefix}${rand}`;
}

export function TeacherStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [exercises, setExercises] = useState<ExerciseItem[]>(OFFICIAL_EXERCISES);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [copies, setCopies] = useState<CopySubmission[]>([]);

  const loadFromSupabase = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!isSupabaseConfigured || !supabase || !user?.id) {
      setClasses([]);
      setAssignments([]);
      setCopies([]);
      setExercises(OFFICIAL_EXERCISES);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Load teacher's classes + enrolled student profiles
      const { data: dbClasses } = await supabase
        .from("classes")
        .select(
          "id, name, level, invite_code, color, class_members(student_id, joined_at, profiles(id, first_name, last_name, email))"
        )
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: true });

      const studentIds: string[] = [];
      (dbClasses || []).forEach((row: Record<string, unknown>) => {
        const members = (row.class_members as Array<Record<string, unknown>>) || [];
        members.forEach((m) => {
          if (m.student_id) studentIds.push(String(m.student_id));
        });
      });

      const uniqueStudentIds = Array.from(new Set(studentIds));

      // 2. Load real concept_mastery + real submissions for all enrolled students
      let masteryByStudent = new Map<string, Record<string, number>>();
      let subsByStudent = new Map<
        string,
        {
          count: number;
          avgPct: number;
          lastDate: string | null;
          exerciseSkills: Record<string, number>;
          recentAttempts: StudentAttemptRecord[];
        }
      >();
      const assignmentCompleters = new Map<string, Set<string>>();
      const realPhotoCopies: CopySubmission[] = [];

      if (uniqueStudentIds.length > 0) {
        const [{ data: masteryRows }, { data: subRows }] = await Promise.all([
          supabase
            .from("concept_mastery")
            .select("student_id, mastery_score, concepts(label)")
            .in("student_id", uniqueStudentIds),
          supabase
            .from("submissions")
            .select(
              "id, student_id, assignment_id, input_mode, rendered_params, raw_answers, created_at, evaluation_results(score, max_score, status, feedback_summary)"
            )
            .in("student_id", uniqueStudentIds)
            .order("created_at", { ascending: false }),
        ]);

        masteryByStudent = new Map();
        (masteryRows || []).forEach((m: Record<string, unknown>) => {
          const sid = String(m.student_id);
          const c = (Array.isArray(m.concepts) ? m.concepts[0] : m.concepts) as Record<string, string> | null;
          const label = c?.label || "Compétence";
          if (!masteryByStudent.has(sid)) masteryByStudent.set(sid, {});
          masteryByStudent.get(sid)![label] = Number(m.mastery_score || 0);
        });

        const accMap = new Map<
          string,
          {
            sumPct: number;
            count: number;
            lastDate: string | null;
            byExercise: Map<string, { sumPct: number; count: number }>;
            recentAttempts: StudentAttemptRecord[];
          }
        >();

        (subRows || []).forEach((s: Record<string, unknown>) => {
          const sid = String(s.student_id);
          const asgId = s.assignment_id ? String(s.assignment_id) : null;
          if (asgId) {
            if (!assignmentCompleters.has(asgId)) assignmentCompleters.set(asgId, new Set());
            assignmentCompleters.get(asgId)!.add(sid);
          }

          const ev = (Array.isArray(s.evaluation_results)
            ? s.evaluation_results[0]
            : s.evaluation_results) as Record<string, unknown> | null;
          const score = Number(ev?.score ?? 0);
          const maxScore = Number(ev?.max_score ?? 1);
          const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
          const rendered = (s.rendered_params as Record<string, unknown>) || {};
          const exTitle = String(rendered.exerciseTitle || "Exercice Physique-Chimie");
          const rawAnswersObj = (s.raw_answers as Record<string, unknown>) || {};
          const cleanAnswers: Record<string, string> = {};
          Object.entries(rawAnswersObj).forEach(([k, v]) => {
            if (typeof v === "string") cleanAnswers[k] = v;
          });

          if (!accMap.has(sid)) {
            accMap.set(sid, {
              sumPct: 0,
              count: 0,
              lastDate: String(s.created_at),
              byExercise: new Map(),
              recentAttempts: [],
            });
          }
          const entry = accMap.get(sid)!;
          entry.sumPct += pct;
          entry.count += 1;

          const exStat = entry.byExercise.get(exTitle) || { sumPct: 0, count: 0 };
          exStat.sumPct += pct;
          exStat.count += 1;
          entry.byExercise.set(exTitle, exStat);

          if (entry.recentAttempts.length < 12) {
            entry.recentAttempts.push({
              id: String(s.id),
              exerciseTitle: exTitle,
              score,
              maxScore,
              pct,
              status: String(ev?.status || "incorrect"),
              submittedAt: new Date(String(s.created_at)).toLocaleString("fr-FR"),
              answers: cleanAnswers,
            });
          }

          if (s.input_mode === "photo") {
            const rawAns = (s.raw_answers as Record<string, unknown>) || {};
            const rawLines = Array.isArray(rawAns.lines) ? rawAns.lines : [];
            const studentClass = (dbClasses || []).find((c: Record<string, unknown>) =>
              ((c.class_members as Array<Record<string, unknown>>) || []).some(
                (cm) => String(cm.student_id) === sid
              )
            );
            const memberRow = ((studentClass?.class_members as Array<Record<string, unknown>>) || []).find(
              (cm) => String(cm.student_id) === sid
            );
            const p = (Array.isArray(memberRow?.profiles)
              ? memberRow?.profiles[0]
              : memberRow?.profiles) as Record<string, string> | null;

            realPhotoCopies.push({
              id: String(s.id),
              studentName: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "Élève",
              classId: studentClass ? String(studentClass.id) : "",
              assignmentTitle: String(
                ((s.rendered_params as Record<string, unknown>)?.exerciseTitle as string) ||
                  "Copie manuscrite soumise"
              ),
              submittedAt: new Date(String(s.created_at)).toLocaleString("fr-FR"),
              status: "to_review",
              aiScore: Number((score * 10).toFixed(1)),
              maxScore: 20,
              teacherScore: Number((score * 10).toFixed(1)),
              confidence: "Haute",
              transcription: rawLines.map((line: Record<string, unknown>, idx: number) => ({
                step: idx + 1,
                latex: String(line.text || ""),
                verdict: line.confidence === "low" ? "uncertain" : "correct",
                note:
                  line.confidence === "low"
                    ? "Ligne incertaine à vérifier visuellement"
                    : "Transcrit et confirmé par l'élève",
              })),
              teacherComment: "",
            });
          }
        });

        subsByStudent = new Map();
        accMap.forEach((v, k) => {
          const exerciseSkills: Record<string, number> = {};
          v.byExercise.forEach((stat, title) => {
            exerciseSkills[title] = Math.round(stat.sumPct / stat.count);
          });
          subsByStudent.set(k, {
            count: v.count,
            avgPct: v.count > 0 ? Math.round(v.sumPct / v.count) : 0,
            lastDate: v.lastDate,
            exerciseSkills,
            recentAttempts: v.recentAttempts,
          });
        });
      }

      // 3. Build clean TeacherClass objects from real DB rows ONLY
      const mappedClasses: TeacherClass[] = (dbClasses || []).map(
        (row: Record<string, unknown>, idx: number) => {
          const lvl = (row.level as Level) || "Terminale";
          const members = (row.class_members as Array<Record<string, unknown>>) || [];

          const evaluatedSkills = new Set<string>();
          const students: StudentRecord[] = members.map((m) => {
            const sid = String(m.student_id);
            const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Record<
              string,
              string
            > | null;
            const subStats = subsByStudent.get(sid);
            // Merge official concept mastery + per-exercise scores so custom/AI exercises appear in heatmap!
            const sSkills: Record<string, number> = {
              ...(subStats?.exerciseSkills || {}),
              ...(masteryByStudent.get(sid) || {}),
            };
            Object.keys(sSkills).forEach((k) => evaluatedSkills.add(k));

            const accuracy = subStats ? subStats.avgPct : 0;
            const exercisesDone = subStats ? subStats.count : 0;

            const skillEntries = Object.entries(sSkills);
            const weakest =
              skillEntries.length > 0
                ? skillEntries.sort((a, b) => a[1] - b[1])[0]
                : null;

            const status: StudentRecord["status"] =
              exercisesDone === 0
                ? "active"
                : accuracy >= 80
                ? "top"
                : accuracy < 55
                ? "struggling"
                : "active";

            return {
              id: sid,
              name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "Élève",
              email: p?.email || "",
              accuracy,
              exercisesDone,
              weakSkill: weakest && weakest[1] < 70 ? weakest[0] : exercisesDone === 0 ? "Aucun exercice encore" : "Bonne maîtrise",
              lastActive: subStats?.lastDate
                ? new Date(subStats.lastDate).toLocaleDateString("fr-FR")
                : "Inscrit récemment",
              status,
              skills: sSkills,
              recentAttempts: subStats?.recentAttempts || [],
            };
          });

          // Show actually-evaluated skills/exercises FIRST; only append defaults when nothing evaluated yet
          const orderedSkills =
            evaluatedSkills.size > 0
              ? Array.from(evaluatedSkills)
              : DEFAULT_SKILLS_BY_LEVEL[lvl];

          // Generate real alerts ONLY from real student metrics
          const realAlerts: ClassAlert[] = [];
          const strugglingCount = students.filter((s) => s.status === "struggling").length;
          if (strugglingCount > 0) {
            realAlerts.push({
              id: `alert-struggle-${row.id}`,
              text: `${strugglingCount} élève(s) ont une moyenne inférieure à 55% dans cette classe.`,
              action: "Voir la heatmap",
              severity: "high",
            });
          }
          const classCopies = realPhotoCopies.filter((c) => c.classId === String(row.id));
          if (classCopies.length > 0) {
            realAlerts.push({
              id: `alert-copies-${row.id}`,
              text: `${classCopies.length} copie(s) manuscrite(s) en attente de validation.`,
              action: "Valider les copies",
              severity: "info",
            });
          }

          return {
            id: String(row.id),
            name: String(row.name),
            level: lvl,
            inviteCode: String(row.invite_code),
            color: String(row.color || CLASS_COLORS[idx % CLASS_COLORS.length]),
            skills: orderedSkills,
            alerts: realAlerts,
            students,
          };
        }
      );

      setClasses(mappedClasses);
      setCopies(realPhotoCopies);

      // 4. Load teacher's real assignments from Supabase
      const { data: dbAssignments } = await supabase
        .from("assignments")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      setAssignments(
        (dbAssignments || []).map((a: Record<string, unknown>) => {
          const cls = mappedClasses.find((c) => c.id === String(a.class_id));
          const isGraded = a.mode === "graded";
          const allowRetry =
            typeof a.allow_retry === "boolean" ? a.allow_retry : !isGraded;
          const allowHints =
            typeof a.allow_hints === "boolean" ? a.allow_hints : !isGraded;
          const realDone = assignmentCompleters.get(String(a.id))?.size || 0;
          return {
            id: String(a.id),
            title: String(a.title),
            classId: String(a.class_id),
            exerciseIds: [],
            dueDate: a.due_at
              ? new Date(String(a.due_at)).toLocaleDateString("fr-FR")
              : "Sans date limite",
            mode: isGraded ? "Noté" : "Entraînement",
            allowRetry,
            allowHints,
            completedCount: realDone,
            totalStudents: cls?.students.length || 0,
          };
        })
      );

      // 5. Load teacher's custom exercises from Supabase + append official curriculum exercises
      const { data: dbExRows } = await supabase
        .from("exercises")
        .select(
          "id, level, domain, chapter, difficulty, source, status, exercise_versions(id, version_number, title, statement_template, questions_schema)"
        )
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      const customExercises: ExerciseItem[] = (dbExRows || []).map((e: Record<string, unknown>) => {
        const versions = (e.exercise_versions as Array<Record<string, unknown>>) || [];
        const latest = versions[versions.length - 1] || {};
        const diffMap: Record<string, ExerciseItem["difficulty"]> = {
          guided: "Guidé",
          standard: "Standard",
          bac: "Type Bac",
        };
        const srcMap: Record<string, ExerciseItem["source"]> = {
          official: "Officiel",
          teacher: "Créé par moi",
          ai_approved: "IA approuvé",
        };
        return {
          id: String(e.id),
          versionId: latest.id ? String(latest.id) : undefined,
          title: String(latest.title || "Exercice personnalisé"),
          level: (e.level as Level) || "Terminale",
          domain: String(e.domain || "Physique-Chimie"),
          chapter: String(e.chapter || ""),
          difficulty: diffMap[String(e.difficulty)] || "Standard",
          source: srcMap[String(e.source)] || "Créé par moi",
          status: e.status === "published" ? "published" : "draft",
          version: `v${latest.version_number || 1}.0`,
          skills: [],
          statement: String(latest.statement_template || ""),
          questions: Array.isArray(latest.questions_schema)
            ? (latest.questions_schema as ExerciseItem["questions"])
            : [],
        };
      });

      setExercises([...customExercises, ...OFFICIAL_EXERCISES]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const createClass = async (name: string, level: Level): Promise<TeacherClass | null> => {
    const supabase = getSupabaseBrowserClient();
    const inviteCode = generateInviteCode(level);
    const color = CLASS_COLORS[classes.length % CLASS_COLORS.length];

    if (isSupabaseConfigured && supabase && user?.id) {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          teacher_id: user.id,
          name: name.trim(),
          level,
          invite_code: inviteCode,
          color,
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        console.error("Create class error:", error?.message);
        return null;
      }

      const created: TeacherClass = {
        id: data.id,
        name: name.trim(),
        level,
        inviteCode,
        color,
        skills: DEFAULT_SKILLS_BY_LEVEL[level],
        alerts: [],
        students: [],
      };
      setClasses((prev) => [...prev, created]);
      setSelectedClassId(created.id);
      return created;
    }
    return null;
  };

  // Manual roster preview note (real students join cleanly via class invite code!)
  const addStudentToClass = (classId: string, name: string, email: string) => {
    setClasses((prev) =>
      prev.map((cls) => {
        if (cls.id !== classId) return cls;
        const newStudent: StudentRecord = {
          id: `invited-${Date.now()}`,
          name: name.trim(),
          email: email.trim(),
          accuracy: 0,
          exercisesDone: 0,
          weakSkill: "Invitation en attente",
          lastActive: "Code à utiliser : " + cls.inviteCode,
          status: "active",
          skills: {},
          recentAttempts: [],
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

  const addExercise = async (ex: Omit<ExerciseItem, "id">): Promise<ExerciseItem> => {
    const supabase = getSupabaseBrowserClient();
    let newId = `ex-${Date.now()}`;

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
      const { data } = await supabase
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
        .single();

      let versionId: string | undefined;
      if (data?.id) {
        newId = data.id;
        const { data: verRow } = await supabase
          .from("exercise_versions")
          .insert({
            exercise_id: data.id,
            version_number: 1,
            title: ex.title,
            statement_template: ex.statement,
            questions_schema: ex.questions,
          })
          .select("id")
          .single();
        if (verRow?.id) versionId = String(verRow.id);
      }
      const created: ExerciseItem = { ...ex, id: newId, versionId };
      setExercises((prev) => [created, ...prev]);
      return created;
    }

    const created: ExerciseItem = { ...ex, id: newId };
    setExercises((prev) => [created, ...prev]);
    return created;
  };

  const addAssignment = async (
    asg: Omit<AssignmentItem, "id" | "completedCount" | "totalStudents">
  ) => {
    const supabase = getSupabaseBrowserClient();
    const cls = classes.find((c) => c.id === asg.classId);
    let newId = `asg-${Date.now()}`;

    // Resolve UUID exercise_version_ids for any custom/AI exercises being assigned
    const versionIds: string[] = [];
    for (const exId of asg.exerciseIds || []) {
      const found = exercises.find((e) => e.id === exId);
      if (found?.versionId) {
        versionIds.push(found.versionId);
      }
    }

    if (isSupabaseConfigured && supabase && user?.id) {
      const basePayload = {
        class_id: asg.classId,
        teacher_id: user.id,
        title: asg.title,
        exercise_version_ids: versionIds,
        mode: asg.mode === "Noté" ? "graded" : "practice",
      };
      const firstTry = await supabase
        .from("assignments")
        .insert({ ...basePayload, allow_retry: asg.allowRetry, allow_hints: asg.allowHints })
        .select("id")
        .single();

      if (firstTry.data?.id) {
        newId = firstTry.data.id;
      } else if (
        firstTry.error?.message?.includes("allow_retry") ||
        firstTry.error?.message?.includes("allow_hints")
      ) {
        const secondTry = await supabase
          .from("assignments")
          .insert({ ...basePayload, allow_retry: asg.allowRetry })
          .select("id")
          .single();
        if (secondTry.data?.id) {
          newId = secondTry.data.id;
        } else {
          const retryInsert = await supabase
            .from("assignments")
            .insert(basePayload)
            .select("id")
            .single();
          if (retryInsert.data?.id) newId = retryInsert.data.id;
        }
      }
    }

    const created: AssignmentItem = {
      ...asg,
      id: newId,
      completedCount: 0,
      totalStudents: cls?.students.length || 0,
    };
    setAssignments((prev) => [created, ...prev]);
  };

  const toggleAssignmentRetry = async (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    if (!target) return;
    const nextVal = !target.allowRetry;
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, allowRetry: nextVal } : a))
    );
    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase && user?.id) {
      await supabase
        .from("assignments")
        .update({ allow_retry: nextVal })
        .eq("id", assignmentId)
        .eq("teacher_id", user.id);
    }
  };

  const toggleAssignmentHints = async (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    if (!target) return;
    const nextVal = !target.allowHints;
    setAssignments((prev) =>
      prev.map((a) => (a.id === assignmentId ? { ...a, allowHints: nextVal } : a))
    );
    const supabase = getSupabaseBrowserClient();
    if (isSupabaseConfigured && supabase && user?.id) {
      await supabase
        .from("assignments")
        .update({ allow_hints: nextVal })
        .eq("id", assignmentId)
        .eq("teacher_id", user.id);
    }
  };

  const updateCopy = (copyId: string, updates: Partial<CopySubmission>) => {
    setCopies((prev) => prev.map((c) => (c.id === copyId ? { ...c, ...updates } : c)));
  };

  return (
    <TeacherStoreContext.Provider
      value={{
        loading,
        refresh: loadFromSupabase,
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
        toggleAssignmentRetry,
        toggleAssignmentHints,
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
