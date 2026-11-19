"""
Platform SPC — Evaluation Microservice (FastAPI + SymPy + Pint)
Implements Vision Document §7:
  1. Normalization (spaces, comma decimals, ×/·/*, scientific notation)
  2. Algebraic equivalence via SymPy
  3. Physical quantities & unit conversions via Pint
  4. Known misconceptions detection (exact error codes)
  5. Significant figures & tolerance checks
  6. Unreadable input handling (never silently marked wrong)
"""

from __future__ import annotations

import math
import re
from typing import Any, Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pint
from sympy import simplify, Eq
from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations,
    implicit_multiplication_application,
    convert_xor,
)

app = FastAPI(title="Platform SPC Evaluation Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ureg = pint.UnitRegistry()
TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)


class MisconceptionRule(BaseModel):
    expr: str
    code: str
    explanation: str


class EvaluateRequest(BaseModel):
    question_type: Literal["expression", "quantity"]
    student_answer: str
    expected: str
    unit: Optional[str] = None
    tolerance: float = 0.02  # 2% relative tolerance by default
    sig_figs: Optional[int] = None
    target_symbol: Optional[str] = None  # e.g. "I" for "I = U/R"
    misconceptions: list[MisconceptionRule] = Field(default_factory=list)


class EvaluateResponse(BaseModel):
    status: Literal["correct", "partially_correct", "incorrect", "unreadable"]
    score: float
    max_score: float = 1.0
    error_code: Optional[str] = None
    error_category: Optional[str] = None
    explanation: str
    expected_display: str
    engine: str = "sympy_pint"


def normalize_math_text(raw: str) -> str:
    text = raw.strip()
    # Replace French decimal commas inside numbers (e.g., 0,26 -> 0.26)
    text = re.sub(r"(?<=\d),(?=\d)", ".", text)
    # Replace multiplication symbols
    text = text.replace("×", "*").replace("·", "*").replace("÷", "/")
    # Replace unicode minus
    text = text.replace("−", "-")
    # Scientific notation like 6*10^-1 or 6*10⁻¹
    superscripts = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺", "0123456789-+")
    text = text.translate(superscripts)
    text = re.sub(r"(\d(?:\.\d+)?)\s*\*\s*10\s*\^\s*([+-]?\d+)", r"\1e\2", text)
    return text


def count_sig_figs(num_str: str) -> int:
    s = num_str.strip().lower()
    if "e" in s:
        s = s.split("e")[0]
    s = s.lstrip("+-")
    if "." in s:
        s = s.lstrip("0")
        if s.startswith("."):
            s = s[1:].lstrip("0")
        else:
            s = s.replace(".", "")
        return max(len(s), 1)
    s = s.strip("0")
    return max(len(s), 1)


def strip_lhs(expr_str: str, target_symbol: Optional[str]) -> str:
    if "=" not in expr_str:
        return expr_str
    parts = [p.strip() for p in expr_str.split("=")]
    if len(parts) != 2:
        return expr_str
    lhs, rhs = parts
    if target_symbol:
        if lhs.lower() == target_symbol.lower():
            return rhs
        if rhs.lower() == target_symbol.lower():
            return lhs
    return rhs


def evaluate_expression(req: EvaluateRequest) -> EvaluateResponse:
    raw = normalize_math_text(req.student_answer)
    if not raw:
        return EvaluateResponse(
            status="unreadable",
            score=0.0,
            explanation="Ta réponse est vide. Écris une expression littérale (ex : I = U/R).",
            expected_display=req.expected,
        )

    expected_clean = strip_lhs(normalize_math_text(req.expected), req.target_symbol)
    student_clean = strip_lhs(raw, req.target_symbol)

    try:
        expected_expr = parse_expr(expected_clean, transformations=TRANSFORMATIONS)
    except Exception:
        return EvaluateResponse(
            status="unreadable",
            score=0.0,
            explanation="Erreur interne sur le modèle attendu.",
            expected_display=req.expected,
        )

    try:
        student_expr = parse_expr(student_clean, transformations=TRANSFORMATIONS)
    except Exception:
        return EvaluateResponse(
            status="unreadable",
            score=0.0,
            explanation="Je n'arrive pas à lire cette expression mathématique. Vérifie les parenthèses ou réécris-la (ex : U/R).",
            expected_display=req.expected,
        )

    # Direct algebraic equivalence
    try:
        if simplify(student_expr - expected_expr) == 0:
            return EvaluateResponse(
                status="correct",
                score=1.0,
                explanation="Correct ! Ton expression algébrique est équivalente à la relation attendue.",
                expected_display=req.expected,
            )
    except Exception:
        pass

    # Check if student wrote an equivalent equation (e.g. U = R*I when target is I = U/R)
    if "=" in raw and req.target_symbol:
        try:
            lhs_s, rhs_s = [parse_expr(p.strip(), transformations=TRANSFORMATIONS) for p in raw.split("=", 1)]
            target_sym = parse_expr(req.target_symbol, transformations=TRANSFORMATIONS)
            eq_diff = simplify((lhs_s - rhs_s).subs(target_sym, expected_expr))
            if eq_diff == 0:
                return EvaluateResponse(
                    status="partially_correct",
                    score=0.7,
                    error_code="variable_non_isolee",
                    error_category="Algébrique",
                    explanation=f"Ta relation est physiquement juste, mais tu n'as pas encore isolé {req.target_symbol}.",
                    expected_display=req.expected,
                )
        except Exception:
            pass

    # Check known misconceptions
    for rule in req.misconceptions:
        try:
            misc_expr = parse_expr(normalize_math_text(rule.expr), transformations=TRANSFORMATIONS)
            if simplify(student_expr - misc_expr) == 0:
                return EvaluateResponse(
                    status="incorrect",
                    score=0.0,
                    error_code=rule.code,
                    error_category="Algébrique",
                    explanation=rule.explanation,
                    expected_display=req.expected,
                )
        except Exception:
            continue

    return EvaluateResponse(
        status="incorrect",
        score=0.0,
        error_code="expression_incorrecte",
        error_category="Sélection de formule",
        explanation="L'expression proposée n'est pas équivalente à la formule attendue. Repars de la loi fondamentale du chapitre.",
        expected_display=req.expected,
    )


def evaluate_quantity(req: EvaluateRequest) -> EvaluateResponse:
    raw = normalize_math_text(req.student_answer)
    expected_display = f"{req.expected} {req.unit}".strip() if req.unit else req.expected

    if not raw:
        return EvaluateResponse(
            status="unreadable",
            score=0.0,
            explanation="Ta réponse est vide. Indique une valeur numérique suivie de son unité.",
            expected_display=expected_display,
        )

    match = re.match(r"^\s*([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*(.*)$", raw, re.IGNORECASE)
    if not match:
        return EvaluateResponse(
            status="unreadable",
            score=0.0,
            explanation="Format non reconnu. Écris un nombre suivi de son unité (ex : 0,26 A ou 260 mA).",
            expected_display=expected_display,
        )

    num_str, student_unit_str = match.group(1), match.group(2).strip()
    try:
        student_val = float(num_str)
        expected_val = float(normalize_math_text(req.expected))
    except ValueError:
        return EvaluateResponse(
            status="unreadable",
            score=0.0,
            explanation="Je n'ai pas pu lire la valeur numérique. Réécris le nombre clairement.",
            expected_display=expected_display,
        )

    # Check missing unit
    if req.unit and not student_unit_str:
        rel_err = abs(student_val - expected_val) / max(abs(expected_val), 1e-12)
        if rel_err <= req.tolerance:
            return EvaluateResponse(
                status="partially_correct",
                score=0.75,
                error_code="unite_manquante",
                error_category="Unité / conversion",
                explanation=f"La valeur numérique est correcte, mais tu as oublié l'unité ({req.unit}).",
                expected_display=expected_display,
            )
        # Check factor of 1000 unit error without unit
        if abs(student_val - expected_val * 1000) / max(abs(expected_val * 1000), 1e-12) <= 0.05:
            return EvaluateResponse(
                status="incorrect",
                score=0.25,
                error_code="conversion_unites",
                error_category="Unité / conversion",
                explanation=f"Attention : {num_str} correspond à la valeur en milli-{req.unit}, pas en {req.unit}. Divise par 1000 et précise l'unité.",
                expected_display=expected_display,
            )

    # Unit conversion via Pint
    converted_val = student_val
    if req.unit and student_unit_str:
        try:
            q_student = ureg.Quantity(student_val, student_unit_str)
            q_expected_unit = ureg.Unit(req.unit)
            if not q_student.is_compatible_with(q_expected_unit):
                return EvaluateResponse(
                    status="incorrect",
                    score=0.0,
                    error_code="unite_incompatible",
                    error_category="Unité / conversion",
                    explanation=f"L'unité « {student_unit_str} » n'est pas homogène à l'unité attendue ({req.unit}).",
                    expected_display=expected_display,
                )
            converted_val = float(q_student.to(q_expected_unit).magnitude)
        except Exception:
            return EvaluateResponse(
                status="unreadable",
                score=0.0,
                explanation=f"Je ne reconnais pas l'unité « {student_unit_str} ». Vérifie l'orthographe (ex : A, mA, V, Ω, m/s).",
                expected_display=expected_display,
            )

    rel_err = abs(converted_val - expected_val) / max(abs(expected_val), 1e-12)
    if rel_err <= req.tolerance:
        # Check significant figures if requested
        if req.sig_figs is not None:
            student_sf = count_sig_figs(num_str)
            if student_sf != req.sig_figs:
                return EvaluateResponse(
                    status="partially_correct",
                    score=0.85,
                    error_code="chiffres_significatifs",
                    error_category="Chiffres significatifs",
                    explanation=f"Valeur et unité exactes ! Cependant, la consigne demande {req.sig_figs} chiffres significatifs (tu en as donné {student_sf}).",
                    expected_display=expected_display,
                )
        return EvaluateResponse(
            status="correct",
            score=1.0,
            explanation="Exact ! Valeur, unité et précision validées par le moteur physique.",
            expected_display=expected_display,
        )

    # Check common 1000x or 0.001x unit mistake
    if abs(converted_val - expected_val * 1000) / max(abs(expected_val * 1000), 1e-12) <= 0.05:
        return EvaluateResponse(
            status="incorrect",
            score=0.25,
            error_code="conversion_unites",
            error_category="Unité / conversion",
            explanation=f"Erreur d'un facteur 1000 : vérifie la conversion vers {req.unit or 'l’unité SI'} (diviser par 1000 pour mA → A ou g → kg).",
            expected_display=expected_display,
        )

    return EvaluateResponse(
        status="incorrect",
        score=0.0,
        error_code="erreur_calcul",
        error_category="Calcul",
        explanation="Le résultat numérique ne correspond pas à la valeur attendue. Vérifie ton application numérique et tes conversions.",
        expected_display=expected_display,
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "engine": "sympy_pint"}


@app.post("/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest) -> EvaluateResponse:
    if req.question_type == "expression":
        return evaluate_expression(req)
    return evaluate_quantity(req)
