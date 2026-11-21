import type { ParentChildSnapshot } from "@/lib/db";

function escapeHtml(raw: string): string {
  return String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "#047857";
  if (pct >= 50) return "#b45309";
  return "#be123c";
}

function buildChildSectionHtml(child: ParentChildSnapshot): string {
  const subs = child.recentSubmissions || [];
  const assignments = child.assignments || [];
  const doneAssignments = assignments.filter((a) => a.completed);
  const todoAssignments = assignments.filter((a) => !a.completed);

  const avgPct = subs.length
    ? Math.round(
        (subs.reduce((acc, s) => acc + (s.maxScore > 0 ? s.score / s.maxScore : 0), 0) /
          subs.length) *
          100
      )
    : null;

  const classesText = child.enrolledClasses.length
    ? child.enrolledClasses.map((cl) => escapeHtml(cl.name)).join(", ")
    : "Aucune classe rattachée";

  const assignmentsRows = assignments.length
    ? assignments
        .map((a) => {
          const pct =
            a.bestScore !== undefined && a.maxScore
              ? Math.round((a.bestScore / a.maxScore) * 100)
              : null;
          const statusBadge = a.completed
            ? `<span style="color:#047857;font-weight:700;">✓ Fait${
                pct !== null ? ` (${a.bestScore?.toFixed(1)}/${a.maxScore} · ${pct}%)` : ""
              }</span>`
            : `<span style="color:#b45309;font-weight:700;">⏳ À faire</span>`;
          return `
            <tr>
              <td>${escapeHtml(a.title)}</td>
              <td>${escapeHtml(a.className)}</td>
              <td>${a.submissionType === "photo_copy" ? "Copie papier" : escapeHtml(a.mode)}</td>
              <td>${statusBadge}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" style="color:#64748b;text-align:center;">Aucun devoir assigné pour le moment.</td></tr>`;

  const submissionsRows = subs.length
    ? subs
        .map((s) => {
          const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
          const dateStr = new Date(s.createdAt).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          return `
            <tr>
              <td style="white-space:nowrap;">${escapeHtml(dateStr)}</td>
              <td>${escapeHtml(s.exerciseTitle)}</td>
              <td style="font-weight:700;white-space:nowrap;">${s.score.toFixed(1)} / ${s.maxScore}</td>
              <td style="font-weight:700;color:${scoreColor(pct)};white-space:nowrap;">${pct}%</td>
              <td style="color:#475569;">${escapeHtml(s.errorSummary || "—")}</td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" style="color:#64748b;text-align:center;">Aucun exercice évalué pour le moment.</td></tr>`;

  return `
    <section class="child-card">
      <div class="child-header">
        <div>
          <h2>${escapeHtml(child.childName)}</h2>
          <div class="meta">
            Niveau : <strong>${escapeHtml(child.childLevel)}</strong> · Physique-Chimie
            ${child.childEmail ? ` · ${escapeHtml(child.childEmail)}` : ""}
          </div>
          <div class="meta">Classe(s) : <strong>${classesText}</strong></div>
        </div>
        <div class="badge-linked">Liaison validée</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-val">${subs.length}</div>
          <div class="kpi-lbl">Exercices soumis</div>
        </div>
        <div class="kpi">
          <div class="kpi-val" style="color:${avgPct !== null ? scoreColor(avgPct) : "#334155"}">
            ${avgPct !== null ? `${avgPct}%` : "—"}
          </div>
          <div class="kpi-lbl">Moyenne globale</div>
        </div>
        <div class="kpi">
          <div class="kpi-val" style="color:#047857">${doneAssignments.length} / ${assignments.length}</div>
          <div class="kpi-lbl">Devoirs rendus</div>
        </div>
        <div class="kpi">
          <div class="kpi-val" style="color:#b45309">${todoAssignments.length}</div>
          <div class="kpi-lbl">Devoirs restants</div>
        </div>
      </div>

      <h3>Devoirs de la classe</h3>
      <table>
        <thead>
          <tr>
            <th>Devoir</th>
            <th>Classe</th>
            <th>Type</th>
            <th>Statut / Note</th>
          </tr>
        </thead>
        <tbody>${assignmentsRows}</tbody>
      </table>

      <h3>Derniers exercices et résultats</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Exercice</th>
            <th>Note</th>
            <th>Réussite</th>
            <th>Remarque</th>
          </tr>
        </thead>
        <tbody>${submissionsRows}</tbody>
      </table>
    </section>
  `;
}

/**
 * Generates a clean, printable/PDF school progress report for all Admin-approved linked children.
 * Uses native browser print-to-PDF with an iframe fallback if popups are blocked.
 */
export function openPrintableParentReport(params: {
  parentName: string;
  parentEmail: string;
  children: ParentChildSnapshot[];
}): { ok: boolean; error?: string } {
  const linkedChildren = params.children.filter((c) => c.linked);
  if (linkedChildren.length === 0) {
    return {
      ok: false,
      error: "Aucun enfant validé pour générer le bilan PDF.",
    };
  }

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Bilan pédagogique — Platform SPC</title>
  <style>
    @page { margin: 16mm; size: A4; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
    }
    .sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 28px 32px;
    }
    .toolbar {
      max-width: 820px;
      margin: 0 auto 14px auto;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-print {
      background: #4f46e5;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 10px 18px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-close {
      background: #ffffff;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #4f46e5;
      padding-bottom: 14px;
      margin-bottom: 22px;
      gap: 16px;
    }
    .brand { font-size: 20px; font-weight: 800; color: #312e81; }
    .subtitle { font-size: 13px; color: #475569; margin-top: 2px; }
    .doc-meta { text-align: right; font-size: 12px; color: #475569; }
    .child-card {
      margin-bottom: 26px;
      page-break-inside: avoid;
    }
    .child-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 14px;
    }
    .child-header h2 { margin: 0 0 4px 0; font-size: 17px; color: #1e1b4b; }
    .meta { font-size: 12px; color: #475569; }
    .badge-linked {
      background: #d1fae5;
      color: #065f46;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      white-space: nowrap;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }
    .kpi-val { font-size: 18px; font-weight: 800; color: #1e293b; }
    .kpi-lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    h3 {
      font-size: 13px;
      font-weight: 800;
      color: #1e293b;
      margin: 16px 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 12px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 7px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #334155;
    }
    .footer {
      margin-top: 22px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { border: none; border-radius: 0; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
    <button class="btn-close" onclick="window.close()">Fermer</button>
  </div>
  <div class="sheet">
    <header class="doc-header">
      <div>
        <div class="brand">Platform SPC — Bilan pédagogique</div>
        <div class="subtitle">Suivi des devoirs et résultats en Physique-Chimie</div>
      </div>
      <div class="doc-meta">
        <div><strong>Édité le :</strong> ${escapeHtml(today)}</div>
        <div><strong>Parent :</strong> ${escapeHtml(params.parentName || "Parent")}</div>
        <div>${escapeHtml(params.parentEmail || "")}</div>
      </div>
    </header>

    ${linkedChildren.map(buildChildSectionHtml).join("")}

    <footer class="footer">
      Document généré depuis l'espace parent Platform SPC. Les discussions privées entre l'élève et le Tuteur IA restent strictement confidentielles et n'apparaissent pas dans ce bilan.
    </footer>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=920,height=780");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        // User can still click the Print button in the preview toolbar
      }
    }, 250);
    return { ok: true };
  }

  // Fallback if browser blocked popups: print via hidden iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 250);
    return { ok: true };
  }

  return { ok: false, error: "Impossible d'ouvrir la fenêtre d'impression." };
}
