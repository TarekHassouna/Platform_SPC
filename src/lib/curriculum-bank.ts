export type CurriculumLevel = "Seconde" | "Première" | "Terminale";
export type Domain = "Électricité" | "Mécanique" | "Chimie" | "Métrologie";
export type Difficulty = "Guidé" | "Standard" | "Type Bac";

export interface QuestionInstance {
  id: string;
  type: "expression" | "quantity";
  prompt: string;
  placeholder: string;
  expected: string;
  unit?: string;
  sig_figs?: number;
  target_symbol?: string;
  hint: string;
  misconceptions?: { expr: string; code: string; explanation: string }[];
}

export interface ExerciseTemplate {
  id: string;
  title: string;
  level: CurriculumLevel;
  domain: Domain;
  chapter: string;
  difficulty: Difficulty;
  conceptCodes: string[];
  lessonTitle: string;
  lessonContent: string;
  workedExample: string;
  generate: (seed: number) => {
    params: Record<string, number>;
    statement: string;
    questions: QuestionInstance[];
  };
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function sig(val: number, n: number): string {
  return Number(val.toPrecision(n)).toString();
}

export const CURRICULUM_EXERCISES: ExerciseTemplate[] = [
  // ========================= SECONDE =========================
  {
    id: "ohm-001",
    title: "Loi d'Ohm et intensité du courant",
    level: "Seconde",
    domain: "Électricité",
    chapter: "Circuits électriques",
    difficulty: "Standard",
    conceptCodes: ["loi_ohm", "conversion_unites", "chiffres_significatifs"],
    lessonTitle: "La loi d'Ohm",
    lessonContent:
      "La tension $U$ (en volts, $\\text{V}$) aux bornes d'un conducteur ohmique de résistance $R$ (en ohms, $\\Omega$) est proportionnelle à l'intensité $I$ (en ampères, $\\text{A}$) qui le traverse : $$U = R \\times I$$ On en déduit $I = \\frac{U}{R}$ et $R = \\frac{U}{I}$. Attention aux conversions : $1\\text{ mA} = 10^{-3}\\text{ A}$.",
    workedExample:
      "Pour $R = 100\\ \\Omega$ et $U = 6,0\\text{ V}$ : $I = \\frac{U}{R} = \\frac{6,0}{100} = 0,060\\text{ A} = 60\\text{ mA}$.",
    generate(seed) {
      const R = pick([47, 100, 22, 68, 150], seed);
      const U = pick([12, 24, 5.5, 15, 9.0], seed);
      const I = sig(U / R, 2);
      return {
        params: { R, U },
        statement: `Un conducteur ohmique de résistance $R = ${R}\\ \\Omega$ est soumis à une tension $U = ${String(U).replace(".", ",")}\\text{ V}$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer l'intensité $I$ en fonction de $U$ et $R$.",
            placeholder: "ex : I = U/R",
            expected: "I = U/R",
            target_symbol: "I",
            hint: "Pars de $U = R \\times I$ et divise les deux membres par $R$.",
            misconceptions: [
              { expr: "R/U", code: "formule_inversee", explanation: "Tu as inversé la fraction : $U = R \\cdot I \\Rightarrow I = U / R$, pas $R / U$." },
              { expr: "U*R", code: "operation_incorrecte", explanation: "Tu as multiplié $U$ par $R$ au lieu de diviser $U$ par $R$." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer $I$ avec 2 chiffres significatifs (en $\\text{A}$ ou en $\\text{mA}$).",
            placeholder: `ex : ${I.replace(".", ",")} A`,
            expected: I,
            unit: "A",
            sig_figs: 2,
            hint: `Divise $U = ${U}$ par $R = ${R}$, puis arrondis à 2 chiffres significatifs sans oublier l'unité.`,
          },
        ],
      };
    },
  },
  {
    id: "puissance-001",
    title: "Puissance électrique d'un dipôle",
    level: "Seconde",
    domain: "Électricité",
    chapter: "Puissance et énergie",
    difficulty: "Guidé",
    conceptCodes: ["loi_ohm", "conversion_unites"],
    lessonTitle: "Puissance électrique en courant continu",
    lessonContent:
      "La puissance électrique $P$ reçue par un dipôle soumis à une tension $U$ et traversé par un courant $I$ vaut : $$P = U \\times I$$ avec $P$ en watts ($\\text{W}$), $U$ en volts ($\\text{V}$) et $I$ en ampères ($\\text{A}$).",
    workedExample:
      "Si $U = 12\\text{ V}$ et $I = 500\\text{ mA} = 0,50\\text{ A}$, alors $P = 12 \\times 0,50 = 6,0\\text{ W}$.",
    generate(seed) {
      const U = pick([12, 24, 5.0, 9.0], seed);
      const ImA = pick([250, 500, 400, 200], seed);
      const P = sig(U * (ImA / 1000), 2);
      return {
        params: { U, ImA },
        statement: `Une lampe est alimentée sous une tension $U = ${U}\\text{ V}$ et traversée par un courant d'intensité $I = ${ImA}\\text{ mA}$.`,
        questions: [
          {
            id: "q1",
            type: "quantity",
            prompt: "1. Convertir l'intensité $I$ en ampères ($\\text{A}$).",
            placeholder: "ex : 0,25 A",
            expected: sig(ImA / 1000, 2),
            unit: "A",
            hint: "Pour passer des $\\text{mA}$ aux $\\text{A}$, on divise par $1000$.",
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer la puissance électrique $P$ reçue par la lampe (2 CS).",
            placeholder: "ex : 3,0 W",
            expected: P,
            unit: "W",
            sig_figs: 2,
            hint: "Utilise $P = U \\times I$ avec $I$ exprimée en ampères.",
          },
        ],
      };
    },
  },
  {
    id: "masse-vol-001",
    title: "Masse volumique et identification d'un métal",
    level: "Seconde",
    domain: "Chimie",
    chapter: "Corps purs et mélanges",
    difficulty: "Standard",
    conceptCodes: ["conversion_unites", "chiffres_significatifs"],
    lessonTitle: "La masse volumique",
    lessonContent:
      "La masse volumique $\\rho$ d'une espèce chimique est le rapport de sa masse $m$ par son volume $V$ : $$\\rho = \\frac{m}{V}$$ Si $m$ est en $\\text{g}$ et $V$ en $\\text{mL}$ (ou $\\text{cm}^3$), alors $\\rho$ est en $\\text{g}\\cdot\\text{mL}^{-1}$.",
    workedExample:
      "Un cylindre d'aluminium de masse $m = 54\\text{ g}$ et de volume $V = 20\\text{ mL}$ a pour masse volumique $\\rho = \\frac{54}{20} = 2,7\\text{ g/mL}$.",
    generate(seed) {
      const m = pick([54, 81, 27, 135], seed);
      const V = pick([20, 30, 10, 50], seed);
      const rho = sig(m / V, 2);
      return {
        params: { m, V },
        statement: `On pèse un échantillon métallique de masse $m = ${m}\\text{ g}$. Par déplacement d'eau dans une éprouvette graduée, on mesure son volume $V = ${V}\\text{ mL}$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer la masse volumique $\\rho$ (écris `rho`) en fonction de $m$ et $V$.",
            placeholder: "ex : rho = m/V",
            expected: "rho = m/V",
            target_symbol: "rho",
            hint: "La masse volumique est la masse divisée par le volume.",
            misconceptions: [
              { expr: "V/m", code: "formule_inversee", explanation: "Tu as inversé : c'est la masse divisée par le volume ($m/V$), pas $V/m$." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer $\\rho$ en $\\text{g/mL}$ (ou $\\text{kg/L}$) avec 2 chiffres significatifs.",
            placeholder: "ex : 2,7 g/mL",
            expected: rho,
            unit: "g/mL",
            sig_figs: 2,
            hint: `Calcule $${m} / ${V}$ et précise l'unité $\\text{g/mL}$.`,
          },
        ],
      };
    },
  },
  {
    id: "concentration-001",
    title: "Concentration en masse d'une solution aqueuse",
    level: "Seconde",
    domain: "Chimie",
    chapter: "Solutions aqueuses",
    difficulty: "Guidé",
    conceptCodes: ["conversion_unites", "chiffres_significatifs"],
    lessonTitle: "Concentration en masse $C_m$",
    lessonContent:
      "Lorsqu'on dissout une masse $m$ de soluté dans un volume $V$ de solution : $$C_m = \\frac{m}{V}$$ Attention : convertir $V$ en litres ($1\\text{ mL} = 10^{-3}\\text{ L}$) pour obtenir $C_m$ en $\\text{g/L}$.",
    workedExample:
      "$m = 2,5\\text{ g}$ dans $V = 250\\text{ mL} = 0,250\\text{ L} \\Rightarrow C_m = \\frac{2,5}{0,250} = 10\\text{ g/L}$.",
    generate(seed) {
      const m = pick([2.5, 4.0, 1.5, 6.0], seed);
      const VmL = pick([250, 500, 100, 200], seed);
      const Cm = sig(m / (VmL / 1000), 2);
      return {
        params: { m, VmL },
        statement: `On prépare une solution aqueuse de saccharose en dissolvant une masse $m = ${String(m).replace(".", ",")}\\text{ g}$ dans une fiole jaugée de volume $V = ${VmL}\\text{ mL}$.`,
        questions: [
          {
            id: "q1",
            type: "quantity",
            prompt: "1. Convertir le volume $V$ en litres ($\\text{L}$).",
            placeholder: "ex : 0,25 L",
            expected: sig(VmL / 1000, 2),
            unit: "L",
            hint: "Divise le volume en $\\text{mL}$ par $1000$.",
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer la concentration en masse $C_m$ en $\\text{g/L}$ (2 CS).",
            placeholder: "ex : 10 g/L",
            expected: Cm,
            unit: "g/L",
            sig_figs: 2,
            hint: "Applique $C_m = m / V$ avec $V$ en litres.",
          },
        ],
      };
    },
  },
  // ========================= PREMIÈRE =========================
  {
    id: "quantite-mat-001",
    title: "Quantité de matière et masse molaire",
    level: "Première",
    domain: "Chimie",
    chapter: "Constitution de la matière",
    difficulty: "Standard",
    conceptCodes: ["tableau_avancement", "conversion_unites"],
    lessonTitle: "Relation entre masse et quantité de matière",
    lessonContent:
      "La quantité de matière $n$ (en $\\text{mol}$) d'un échantillon de masse $m$ (en $\\text{g}$) et de masse molaire $M$ (en $\\text{g/mol}$) est : $$n = \\frac{m}{M}$$",
    workedExample:
      "Pour $m = 9,0\\text{ g}$ d'eau ($M = 18\\text{ g/mol}$) : $n = \\frac{9,0}{18} = 0,50\\text{ mol}$.",
    generate(seed) {
      const m = pick([4.6, 9.2, 2.3, 11.5], seed);
      const M = 23;
      const n = sig(m / M, 2);
      return {
        params: { m, M },
        statement: `On dispose d'un échantillon de sodium $\\text{Na}$ de masse $m = ${String(m).replace(".", ",")}\\text{ g}$. Donnée : $M(\\text{Na}) = 23,0\\text{ g/mol}$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer $n$ en fonction de $m$ et $M$.",
            placeholder: "ex : n = m/M",
            expected: "n = m/M",
            target_symbol: "n",
            hint: "Combien de moles contient une masse $m$ si $1\\text{ mol}$ pèse $M$ ?",
            misconceptions: [
              { expr: "m*M", code: "operation_incorrecte", explanation: "Attention : $m = n \\times M$, donc $n = m / M$." },
              { expr: "M/m", code: "formule_inversee", explanation: "Fraction inversée : $n = m / M$." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer $n$ en $\\text{mol}$ (ou $\\text{mmol}$) avec 2 chiffres significatifs.",
            placeholder: "ex : 0,20 mol",
            expected: n,
            unit: "mol",
            sig_figs: 2,
            hint: `Calcule $n = ${m} / 23,0$ en moles.`,
          },
        ],
      };
    },
  },
  {
    id: "avancement-001",
    title: "Avancement maximal et réactif limitant",
    level: "Première",
    domain: "Chimie",
    chapter: "Suivi d'une transformation",
    difficulty: "Standard",
    conceptCodes: ["tableau_avancement", "chiffres_significatifs"],
    lessonTitle: "Déterminer l'avancement maximal $x_{\\max}$",
    lessonContent:
      "Pour une réaction $a\\text{A} + b\\text{B} \\rightarrow \\text{produits}$, on compare $\\frac{n_0(\\text{A})}{a}$ et $\\frac{n_0(\\text{B})}{b}$. La plus petite des deux valeurs donne l'avancement maximal $x_{\\max}$ et identifie le réactif limitant.",
    workedExample:
      "Pour $\\text{Mg} + 2\\,\\text{H}^+ \\rightarrow \\text{Mg}^{2+} + \\text{H}_2$ avec $n_0(\\text{Mg}) = 0,10\\text{ mol}$ et $n_0(\\text{H}^+) = 0,14\\text{ mol}$ : $0,14 / 2 = 0,070 < 0,10$, donc $x_{\\max} = 0,070\\text{ mol}$.",
    generate(seed) {
      const nMg = pick([0.12, 0.20, 0.15, 0.18], seed);
      const nH = pick([0.16, 0.30, 0.20, 0.24], seed);
      const xmax = sig(Math.min(nMg, nH / 2), 2);
      return {
        params: { nMg, nH },
        statement: `On fait réagir $n_0(\\text{Mg}) = ${String(nMg).replace(".", ",")}\\text{ mol}$ de magnésium avec $n_0(\\text{H}^+) = ${String(nH).replace(".", ",")}\\text{ mol}$ d'ions hydrogène selon : $$\\text{Mg} + 2\\,\\text{H}^+ \\rightarrow \\text{Mg}^{2+} + \\text{H}_2$$`,
        questions: [
          {
            id: "q1",
            type: "quantity",
            prompt: "1. Calculer le rapport $n_0(\\text{H}^+) / 2$ en $\\text{mol}$.",
            placeholder: "ex : 0,080 mol",
            expected: sig(nH / 2, 2),
            unit: "mol",
            hint: "Divise la quantité initiale d'ions $\\text{H}^+$ par son coefficient stœchiométrique $2$.",
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. En déduire l'avancement maximal $x_{\\max}$ en $\\text{mol}$ (2 CS).",
            placeholder: "ex : 0,080 mol",
            expected: xmax,
            unit: "mol",
            sig_figs: 2,
            hint: "Compare $n_0(\\text{Mg})$ et $n_0(\\text{H}^+)/2$, puis garde la plus petite valeur.",
          },
        ],
      };
    },
  },
  {
    id: "ec-001",
    title: "Énergie cinétique et conversion km/h → m/s",
    level: "Première",
    domain: "Mécanique",
    chapter: "Énergie mécanique",
    difficulty: "Standard",
    conceptCodes: ["lois_newton", "conversion_unites"],
    lessonTitle: "Énergie cinétique",
    lessonContent:
      "Un solide de masse $m$ (en $\\text{kg}$) animé d'une vitesse $v$ (en $\\text{m/s}$) possède une énergie cinétique : $$E_c = \\frac{1}{2} m v^2$$ Pour convertir une vitesse : $v(\\text{m/s}) = \\frac{v(\\text{km/h})}{3,6}$.",
    workedExample:
      "Une voiture de $1000\\text{ kg}$ à $72\\text{ km/h} = 20\\text{ m/s}$ a $E_c = 0,5 \\times 1000 \\times 20^2 = 2,0 \\times 10^5\\text{ J}$.",
    generate(seed) {
      const m = pick([800, 1000, 1200, 1500], seed);
      const vKmh = pick([72, 36, 54, 90], seed);
      const vMs = vKmh / 3.6;
      const Ec = sig(0.5 * m * vMs * vMs, 2);
      return {
        params: { m, vKmh },
        statement: `Un véhicule de masse $m = ${m}\\text{ kg}$ roule à une vitesse constante $v = ${vKmh}\\text{ km/h}$.`,
        questions: [
          {
            id: "q1",
            type: "quantity",
            prompt: "1. Convertir la vitesse $v$ en $\\text{m/s}$.",
            placeholder: "ex : 20 m/s",
            expected: sig(vMs, 2),
            unit: "m/s",
            hint: "Divise la vitesse en $\\text{km/h}$ par $3,6$.",
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer son énergie cinétique $E_c$ en joules ($\\text{J}$ ou $\\text{kJ}$, 2 CS).",
            placeholder: "ex : 160000 J",
            expected: Ec,
            unit: "J",
            sig_figs: 2,
            hint: "Utilise $E_c = 0,5 \\times m \\times v^2$ avec $v$ en $\\text{m/s}$.",
          },
        ],
      };
    },
  },
  // ========================= TERMINALE =========================
  {
    id: "newton-001",
    title: "Deuxième loi de Newton — Chute libre",
    level: "Terminale",
    domain: "Mécanique",
    chapter: "Mouvement dans un champ uniforme",
    difficulty: "Standard",
    conceptCodes: ["lois_newton", "chute_libre"],
    lessonTitle: "Deuxième loi de Newton en chute libre",
    lessonContent:
      "Dans un référentiel terrestre supposé galiléen, un objet en chute libre n'est soumis qu'à son poids $\\vec{P} = m\\vec{g}$. La 2e loi de Newton donne : $$\\sum \\vec{F}_{\\text{ext}} = m\\vec{a} \\implies \\vec{a} = \\vec{g}$$ Sans vitesse initiale, $v(t) = g \\cdot t$.",
    workedExample:
      "Après $t = 2,0\\text{ s}$ de chute libre ($g = 9,81\\text{ m/s}^2$) : $v = 9,81 \\times 2,0 = 20\\text{ m/s}$.",
    generate(seed) {
      const t = pick([2.0, 3.0, 1.5, 4.0], seed);
      const g = 9.81;
      const v = sig(g * t, 2);
      return {
        params: { t, g },
        statement: `On lâche une bille sans vitesse initiale en chute libre ($g = 9,81\\text{ m/s}^2$). On étudie son mouvement après une durée $t = ${String(t).replace(".", ",")}\\text{ s}$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer la norme de la vitesse $v$ en fonction de $g$ et $t$.",
            placeholder: "ex : v = g*t",
            expected: "v = g*t",
            target_symbol: "v",
            hint: "L'accélération est constante ($a = g$) et la vitesse initiale est nulle.",
            misconceptions: [
              { expr: "g/t", code: "formule_inversee", explanation: "La vitesse augmente avec le temps : $v = g \\times t$, pas $g / t$." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer la vitesse $v$ atteinte en $\\text{m/s}$ (2 CS).",
            placeholder: "ex : 20 m/s",
            expected: v,
            unit: "m/s",
            sig_figs: 2,
            hint: `Multiplie $g = 9,81$ par $t = ${t}$ puis arrondis à 2 chiffres significatifs.`,
          },
        ],
      };
    },
  },
  {
    id: "frottements-001",
    title: "Chute avec frottements visqueux — Vitesse limite",
    level: "Terminale",
    domain: "Mécanique",
    chapter: "Mouvement dans un champ uniforme",
    difficulty: "Type Bac",
    conceptCodes: ["lois_newton", "chute_libre", "conversion_unites"],
    lessonTitle: "Vitesse limite avec frottement fluide",
    lessonContent:
      "Pour une bille soumise à son poids $P = m g$ et à une force de frottement $f = k v$ : $$m \\frac{\\text{d}v}{\\text{d}t} = m g - k v$$ En régime permanent ($\\frac{\\text{d}v}{\\text{d}t} = 0$), la vitesse atteint sa valeur limite : $$v_{\\text{lim}} = \\frac{m \\cdot g}{k}$$",
    workedExample:
      "Pour $m = 50\\text{ g} = 0,050\\text{ kg}$ et $k = 0,12\\text{ kg/s}$ : $v_{\\text{lim}} = \\frac{0,050 \\times 9,81}{0,12} = 4,1\\text{ m/s}$.",
    generate(seed) {
      const mg = pick([50, 80, 40, 120], seed);
      const k = pick([0.12, 0.20, 0.10, 0.25], seed);
      const vlim = sig(((mg / 1000) * 9.81) / k, 2);
      return {
        params: { mg, k },
        statement: `Une bille de masse $m = ${mg}\\text{ g}$ tombe dans un fluide exerçant une force de frottement $f = k \\cdot v$ avec $k = ${String(k).replace(".", ",")}\\text{ kg/s}$ et $g = 9,81\\text{ m/s}^2$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer la vitesse limite `vlim` en fonction de `m`, `g` et `k`.",
            placeholder: "ex : vlim = m*g/k",
            expected: "vlim = m*g/k",
            target_symbol: "vlim",
            hint: "En régime permanent, l'accélération est nulle donc $m g - k v_{\\text{lim}} = 0$.",
            misconceptions: [
              { expr: "k/(m*g)", code: "formule_inversee", explanation: "Attention : $m g = k v_{\\text{lim}} \\Rightarrow v_{\\text{lim}} = m g / k$." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer $v_{\\text{lim}}$ en $\\text{m/s}$ avec 2 chiffres significatifs.",
            placeholder: "ex : 4,1 m/s",
            expected: vlim,
            unit: "m/s",
            sig_figs: 2,
            hint: `Pense à convertir $m = ${mg}\\text{ g}$ en kilogrammes ($${mg / 1000}\\text{ kg}$) avant de calculer !`,
          },
        ],
      };
    },
  },
  {
    id: "titrage-001",
    title: "Titrage acido-basique à l'équivalence",
    level: "Terminale",
    domain: "Chimie",
    chapter: "Acido-basicité",
    difficulty: "Type Bac",
    conceptCodes: ["acido_basicite", "tableau_avancement", "chiffres_significatifs"],
    lessonTitle: "Relation à l'équivalence d'un titrage",
    lessonContent:
      "Lors d'un titrage acido-basique de stœchiométrie $1:1$ ($\\text{AH} + \\text{HO}^- \\rightarrow \\text{A}^- + \\text{H}_2\\text{O}$), les réactifs sont introduits en proportions stœchiométriques à l'équivalence : $$C_A \\cdot V_A = C_B \\cdot V_E \\implies C_A = \\frac{C_B \\cdot V_E}{V_A}$$",
    workedExample:
      "Pour $V_A = 20\\text{ mL}$, $C_B = 0,10\\text{ mol/L}$ et $V_E = 14\\text{ mL}$ : $C_A = \\frac{0,10 \\times 14}{20} = 0,070\\text{ mol/L}$.",
    generate(seed) {
      const VA = pick([20, 10, 25, 15], seed);
      const CB = pick([0.1, 0.05, 0.2, 0.1], seed);
      const VE = pick([14, 12, 16, 18], seed);
      const CA = sig((CB * VE) / VA, 2);
      return {
        params: { VA, CB, VE },
        statement: `On titre un volume $V_A = ${VA}\\text{ mL}$ d'acide éthanoïque par de la soude de concentration $C_B = ${String(CB).replace(".", ",")}\\text{ mol/L}$. L'équivalence est repérée pour $V_E = ${VE}\\text{ mL}$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer `CA` en fonction de `CB`, `VE` et `VA`.",
            placeholder: "ex : CA = CB*VE/VA",
            expected: "CA = CB*VE/VA",
            target_symbol: "CA",
            hint: "Pars de l'égalité à l'équivalence : $C_A \\cdot V_A = C_B \\cdot V_E$.",
            misconceptions: [
              { expr: "CB*VA/VE", code: "formule_inversee", explanation: "Attention : tu as inversé $V_A$ et $V_E$. On divise par $V_A$." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer $C_A$ en $\\text{mol/L}$ avec 2 chiffres significatifs.",
            placeholder: "ex : 0,070 mol/L",
            expected: CA,
            unit: "mol/L",
            sig_figs: 2,
            hint: "Les volumes $V_E$ et $V_A$ étant tous deux en $\\text{mL}$, leurs unités se simplifient !",
          },
        ],
      };
    },
  },
  {
    id: "rc-001",
    title: "Circuit RC — Constante de temps τ",
    level: "Terminale",
    domain: "Électricité",
    chapter: "Dipôle RC",
    difficulty: "Type Bac",
    conceptCodes: ["loi_ohm", "conversion_unites", "chiffres_significatifs"],
    lessonTitle: "Constante de temps d'un dipôle RC",
    lessonContent:
      "La constante de temps $\\tau$ caractérisant la charge ou décharge d'un condensateur de capacité $C$ (en farads, $\\text{F}$) à travers une résistance $R$ (en $\\Omega$) vaut : $$\\tau = R \\cdot C$$ Rappel : $1\\text{ k}\\Omega = 10^3\\ \\Omega$ et $1\\ \\mu\\text{F} = 10^{-6}\\text{ F}$.",
    workedExample:
      "Pour $R = 2,0\\text{ k}\\Omega = 2000\\ \\Omega$ et $C = 100\\ \\mu\\text{F} = 100 \\times 10^{-6}\\text{ F}$ : $\\tau = 0,20\\text{ s} = 200\\text{ ms}$.",
    generate(seed) {
      const Rk = pick([2.0, 4.7, 1.0, 5.0], seed);
      const CuF = pick([100, 220, 470, 50], seed);
      const tau = sig(Rk * 1000 * CuF * 1e-6, 2);
      return {
        params: { Rk, CuF },
        statement: `On associe en série un conducteur ohmique de résistance $R = ${String(Rk).replace(".", ",")}\\text{ k}\\Omega$ et un condensateur de capacité $C = ${CuF}\\ \\mu\\text{F}$.`,
        questions: [
          {
            id: "q1",
            type: "expression",
            prompt: "1. Exprimer la constante de temps `tau` en fonction de `R` et `C`.",
            placeholder: "ex : tau = R*C",
            expected: "tau = R*C",
            target_symbol: "tau",
            hint: "La constante de temps est le produit de la résistance par la capacité.",
            misconceptions: [
              { expr: "R/C", code: "operation_incorrecte", explanation: "Non : $\\tau = R \\times C$ (un produit, homogène à un temps)." },
            ],
          },
          {
            id: "q2",
            type: "quantity",
            prompt: "2. Calculer $\\tau$ en secondes ($\\text{s}$ ou $\\text{ms}$) avec 2 chiffres significatifs.",
            placeholder: "ex : 0,20 s ou 200 ms",
            expected: tau,
            unit: "s",
            sig_figs: 2,
            hint: "Convertis $R$ en $\\Omega$ ($\\times 10^3$) et $C$ en $\\text{F}$ ($\\times 10^{-6}$).",
          },
        ],
      };
    },
  },
];

export function getExerciseById(id: string): ExerciseTemplate | undefined {
  return CURRICULUM_EXERCISES.find((ex) => ex.id === id);
}
