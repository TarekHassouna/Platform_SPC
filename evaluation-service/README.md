# Platform SPC — Evaluation Microservice (FastAPI + SymPy + Pint)

Checks **what a student's physics/chemistry answer means**, not how it was typed (Vision Document §7):
- Algebraic equivalence via **SymPy** (`U/R`, `I = U / R`, `U = R·I`)
- Physical unit conversions via **Pint** (`0,26 A`, `260 mA`, `2.6×10⁻¹ A`)
- Significant figures & tolerance checks
- Known misconception matching with exact error codes (`formule_inversee`, `conversion_unites`, etc.)

## Run locally (Python 3.11+)
```bash
cd evaluation-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Run with Docker
```bash
docker build -t spc-evaluator ./evaluation-service
docker run -p 8000:8000 spc-evaluator
```

The Next.js API route `POST /api/evaluate` automatically connects to `http://127.0.0.1:8000/evaluate` (or `EVALUATION_SERVICE_URL` in `.env.local`).
