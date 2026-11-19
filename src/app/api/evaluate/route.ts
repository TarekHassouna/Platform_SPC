import { NextRequest, NextResponse } from "next/server";

interface MisconceptionRule {
  expr: string;
  code: string;
  explanation: string;
}

interface EvaluatePayload {
  question_type: "expression" | "quantity";
  student_answer: string;
  expected: string;
  unit?: string;
  tolerance?: number;
  sig_figs?: number;
  target_symbol?: string;
  misconceptions?: MisconceptionRule[];
}

const UNIT_FACTORS: Record<string, { base: string; factor: number }> = {
  // Current
  a: { base: "A", factor: 1 },
  ma: { base: "A", factor: 1e-3 },
  ua: { base: "A", factor: 1e-6 },
  "µa": { base: "A", factor: 1e-6 },
  ka: { base: "A", factor: 1e3 },
  // Voltage
  v: { base: "V", factor: 1 },
  mv: { base: "V", factor: 1e-3 },
  kv: { base: "V", factor: 1e3 },
  // Power
  w: { base: "W", factor: 1 },
  mw: { base: "W", factor: 1e-3 },
  kw: { base: "W", factor: 1e3 },
  // Energy
  j: { base: "J", factor: 1 },
  kj: { base: "J", factor: 1e3 },
  mj: { base: "J", factor: 1e6 },
  // Mass
  g: { base: "kg", factor: 1e-3 },
  kg: { base: "kg", factor: 1 },
  mg: { base: "kg", factor: 1e-6 },
  // Volume
  l: { base: "L", factor: 1 },
  ml: { base: "L", factor: 1e-3 },
  cm3: { base: "L", factor: 1e-3 },
  "cm^3": { base: "L", factor: 1e-3 },
  // Density
  "g/ml": { base: "g/mL", factor: 1 },
  "g/cm3": { base: "g/mL", factor: 1 },
  "g/cm^3": { base: "g/mL", factor: 1 },
  "kg/l": { base: "g/mL", factor: 1 },
  "kg/m3": { base: "g/mL", factor: 1e-3 },
  "kg/m^3": { base: "g/mL", factor: 1e-3 },
  // Mass concentration
  "g/l": { base: "g/L", factor: 1 },
  "g.l-1": { base: "g/L", factor: 1 },
  "g·l⁻¹": { base: "g/L", factor: 1 },
  "mg/l": { base: "g/L", factor: 1e-3 },
  // Amount of substance
  mol: { base: "mol", factor: 1 },
  mmol: { base: "mol", factor: 1e-3 },
  // Molar concentration
  "mol/l": { base: "mol/L", factor: 1 },
  "mol.l-1": { base: "mol/L", factor: 1 },
  "mol·l⁻¹": { base: "mol/L", factor: 1 },
  "mmol/l": { base: "mol/L", factor: 1e-3 },
  // Speed
  "m/s": { base: "m/s", factor: 1 },
  "m.s-1": { base: "m/s", factor: 1 },
  "m·s⁻¹": { base: "m/s", factor: 1 },
  "km/h": { base: "m/s", factor: 1 / 3.6 },
  // Time
  s: { base: "s", factor: 1 },
  ms: { base: "s", factor: 1e-3 },
  us: { base: "s", factor: 1e-6 },
  "µs": { base: "s", factor: 1e-6 },
  min: { base: "s", factor: 60 },
};

function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/⁰/g, "0")
    .replace(/¹/g, "1")
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/⁴/g, "4")
    .replace(/⁵/g, "5")
    .replace(/⁶/g, "6")
    .replace(/⁷/g, "7")
    .replace(/⁸/g, "8")
    .replace(/⁹/g, "9")
    .replace(/⁻/g, "-")
    .replace(/(\d(?:\.\d+)?)\s*\*\s*10\s*\^?\s*([+-]?\d+)/g, "$1e$2");
}

function countSigFigs(numStr: string): number {
  let s = numStr.trim().toLowerCase().split("e")[0].replace(/^[+-]/, "");
  if (s.includes(".")) {
    s = s.replace(/^0+/, "");
    if (s.startsWith(".")) s = s.slice(1).replace(/^0+/, "");
    else s = s.replace(".", "");
    return Math.max(s.length, 1);
  }
  s = s.replace(/^0+/, "").replace(/0+$/, "");
  return Math.max(s.length, 1);
}

function fallbackEvaluate(body: EvaluatePayload) {
  const raw = normalize(body.student_answer || "");
  const expectedDisplay = body.unit ? `${body.expected.replace(".", ",")} ${body.unit}` : body.expected;

  if (!raw) {
    return {
      status: "unreadable",
      score: 0,
      max_score: 1,
      explanation: "Ta réponse est vide. Saisis une réponse avant de valider.",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  if (body.question_type === "expression") {
    const compact = raw.replace(/\s+/g, "").toLowerCase();
    const expectedCompact = normalize(body.expected).replace(/\s+/g, "").toLowerCase();
    const target = (body.target_symbol || "").toLowerCase();

    const stripTarget = (s: string) => {
      if (target && s.startsWith(`${target}=`)) return s.slice(target.length + 1);
      if (target && s.endsWith(`=${target}`)) return s.slice(0, -(target.length + 1));
      return s;
    };

    const studentRhs = stripTarget(compact);
    const expectedRhs = stripTarget(expectedCompact);

    if (studentRhs === expectedRhs) {
      return {
        status: "correct",
        score: 1,
        max_score: 1,
        explanation: "Correct ! Expression littérale équivalente à la relation attendue.",
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }

    // Equivalent un-isolated equation check for Ohm's law
    if (
      expectedRhs === "u/r" &&
      ["u=r*i", "u=i*r", "u=ri", "u=ir", "r*i=u", "i*r=u", "r=u/i"].includes(compact)
    ) {
      return {
        status: "partially_correct",
        score: 0.7,
        max_score: 1,
        error_code: "variable_non_isolee",
        error_category: "Algébrique",
        explanation: `Ta relation est juste, mais la consigne demande d'isoler ${body.target_symbol || "I"}.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }

    for (const m of body.misconceptions || []) {
      const mCompact = normalize(m.expr).replace(/\s+/g, "").toLowerCase();
      if (studentRhs === mCompact || compact === mCompact) {
        return {
          status: "incorrect",
          score: 0,
          max_score: 1,
          error_code: m.code,
          error_category: "Algébrique",
          explanation: m.explanation,
          expected_display: expectedDisplay,
          engine: "ts_fallback",
        };
      }
    }

    return {
      status: "incorrect",
      score: 0,
      max_score: 1,
      error_code: "expression_incorrecte",
      error_category: "Sélection de formule",
      explanation: "L'expression ne correspond pas à la relation attendue. Repars de la loi fondamentale du chapitre.",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  // Quantity evaluation
  const match = raw.match(/^\s*([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(.*)$/i);
  if (!match) {
    return {
      status: "unreadable",
      score: 0,
      max_score: 1,
      explanation: "Je n'arrive pas à lire cette valeur. Écris un nombre suivi de son unité (ex : 0,26 A ou 260 mA).",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  const numStr = match[1];
  const studentUnitRaw = match[2].trim();
  const studentVal = parseFloat(numStr);
  const expectedVal = parseFloat(normalize(body.expected));
  const tol = body.tolerance ?? 0.03;

  if (body.unit && !studentUnitRaw) {
    const relErr = Math.abs(studentVal - expectedVal) / Math.max(Math.abs(expectedVal), 1e-12);
    if (relErr <= tol) {
      return {
        status: "partially_correct",
        score: 0.75,
        max_score: 1,
        error_code: "unite_manquante",
        error_category: "Unité / conversion",
        explanation: `Valeur numérique correcte, mais l'unité (${body.unit}) est manquante !`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
    if (Math.abs(studentVal - expectedVal * 1000) / Math.max(Math.abs(expectedVal * 1000), 1e-12) <= 0.05) {
      return {
        status: "incorrect",
        score: 0.25,
        max_score: 1,
        error_code: "conversion_unites",
        error_category: "Unité / conversion",
        explanation: `${numStr} est la valeur en m${body.unit}, pas en ${body.unit}. Divise par 1000 et précise l'unité.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
  }

  let converted = studentVal;
  if (body.unit && studentUnitRaw) {
    const stuInfo = UNIT_FACTORS[studentUnitRaw.toLowerCase()];
    const expInfo = UNIT_FACTORS[body.unit.toLowerCase()];
    if (!stuInfo || !expInfo) {
      return {
        status: "unreadable",
        score: 0,
        max_score: 1,
        explanation: `Unité « ${studentUnitRaw} » non reconnue. Utilise par exemple A, mA, V, kg, g.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
    if (stuInfo.base !== expInfo.base) {
      return {
        status: "incorrect",
        score: 0,
        max_score: 1,
        error_code: "unite_incompatible",
        error_category: "Unité / conversion",
        explanation: `L'unité « ${studentUnitRaw} » n'est pas homogène à ${body.unit}.`,
        expected_display: expectedDisplay,
        engine: "ts_fallback",
      };
    }
    converted = (studentVal * stuInfo.factor) / expInfo.factor;
  }

  const relErr = Math.abs(converted - expectedVal) / Math.max(Math.abs(expectedVal), 1e-12);
  if (relErr <= tol) {
    if (body.sig_figs !== undefined) {
      const sf = countSigFigs(numStr);
      if (sf !== body.sig_figs) {
        return {
          status: "partially_correct",
          score: 0.85,
          max_score: 1,
          error_code: "chiffres_significatifs",
          error_category: "Chiffres significatifs",
          explanation: `Valeur et unité exactes ! Mais la consigne demande ${body.sig_figs} chiffres significatifs (tu en as donné ${sf}).`,
          expected_display: expectedDisplay,
          engine: "ts_fallback",
        };
      }
    }
    return {
      status: "correct",
      score: 1,
      max_score: 1,
      explanation: "Exact ! Valeur, conversion d'unité et chiffres significatifs validés.",
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  if (Math.abs(converted - expectedVal * 1000) / Math.max(Math.abs(expectedVal * 1000), 1e-12) <= 0.05) {
    return {
      status: "incorrect",
      score: 0.25,
      max_score: 1,
      error_code: "conversion_unites",
      error_category: "Unité / conversion",
      explanation: `Erreur d'un facteur 1000 : vérifie ta conversion d'unité vers ${body.unit || "l'unité demandée"}.`,
      expected_display: expectedDisplay,
      engine: "ts_fallback",
    };
  }

  return {
    status: "incorrect",
    score: 0,
    max_score: 1,
    error_code: "erreur_calcul",
    error_category: "Calcul",
    explanation: "Le calcul ne correspond pas au résultat attendu. Vérifie ton application numérique.",
    expected_display: expectedDisplay,
    engine: "ts_fallback",
  };
}

export async function POST(req: NextRequest) {
  let body: EvaluatePayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const serviceUrl = process.env.EVALUATION_SERVICE_URL || "http://127.0.0.1:8000";

  // Try real Python FastAPI (SymPy + Pint) evaluation microservice first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(`${serviceUrl}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Microservice offline — seamlessly use built-in fallback evaluator
  }

  return NextResponse.json(fallbackEvaluate(body));
}
