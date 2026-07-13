// Client-side export helpers — no backend, no extra libraries. Fantasy
// Optimizer exports its selected lineup as a plain text file; Player
// Comparison exports its table as a PNG snapshot drawn on an offscreen
// <canvas>, falling back to CSV if canvas rendering isn't possible.

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type PlayerExportRole = "Captain" | "Vice Captain" | "";

export type OptimizerExportPlayer = {
  name: string;
  teamAbbreviation: string;
  position: string;
  /** Effective FPTS after role multiplier has been applied. */
  fpts: number;
  /** Base FPTS before multiplier (same as fpts for non-captain/VC). */
  baseFpts: number;
  credits: number;
  role: PlayerExportRole;
};

export function exportOptimizerSelectionAsText(players: OptimizerExportPlayer[], gameLabel: string): void {
  const roleTag = (role: PlayerExportRole) => (role ? ` [${role}]` : "");
  const multiplierNote = (role: PlayerExportRole, baseFpts: number, effectiveFpts: number) => {
    if (role === "Captain") return ` (${baseFpts.toFixed(1)} × 2)`;
    if (role === "Vice Captain") return ` (${baseFpts.toFixed(1)} × 1.5)`;
    return "";
  };
  const lines = [
    `HoopIQ Fantasy Lineup — ${gameLabel}`,
    `Generated ${new Date().toLocaleString()}`,
    "",
    ...players.map(
      (p) =>
        `${p.name}${roleTag(p.role)} (${p.teamAbbreviation} \u00b7 ${p.position}) \u2014 ${p.fpts.toFixed(1)} FPTS${multiplierNote(p.role, p.baseFpts, p.fpts)}, ${p.credits} credits`,
    ),
    "",
    `Total: ${players.reduce((sum, p) => sum + p.fpts, 0).toFixed(1)} FPTS, ${players.reduce((sum, p) => sum + p.credits, 0)} credits`,
  ];
  download(`hoopiq-lineup-${Date.now()}.txt`, new Blob([lines.join("\n")], { type: "text/plain" }));
}

export type ComparisonExportRow = { label: string; values: string[] };

export function exportComparisonAsCsv(playerNames: string[], rows: ComparisonExportRow[]): void {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const header = ["Stat", ...playerNames].map(escape).join(",");
  const body = rows.map((row) => [row.label, ...row.values].map(escape).join(",")).join("\n");
  download(`hoopiq-comparison-${Date.now()}.csv`, new Blob([`${header}\n${body}`], { type: "text/csv" }));
}

/**
 * Draws the comparison table to a canvas and downloads it as a PNG.
 * If canvas rendering isn't available/fails for any reason, falls back
 * to a CSV export so the user always gets a usable file.
 */
export function exportComparisonAsPng(playerNames: string[], rows: ComparisonExportRow[]): void {
  try {
    const padding = 14;
    const titleHeight = 26;
    const headerHeight = 34;
    const rowHeight = 30;
    const labelWidth = 140;
    const colWidth = 112;

    const width = padding * 2 + labelWidth + colWidth * playerNames.length;
    const height = padding * 2 + titleHeight + headerHeight + rowHeight * rows.length;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("HoopIQ Player Comparison", padding, padding);

    const headerY = padding + titleHeight;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    playerNames.forEach((name, i) => {
      ctx.fillStyle = "#93c5fd";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(name, padding + labelWidth + colWidth * i + colWidth / 2, headerY + headerHeight / 2);
    });

    rows.forEach((row, r) => {
      const y = padding + titleHeight + headerHeight + r * rowHeight;
      ctx.fillStyle = r % 2 === 0 ? "#111827" : "#0b1220";
      ctx.fillRect(0, y, width, rowHeight);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(row.label, padding, y + rowHeight / 2);

      row.values.forEach((value, i) => {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(value, padding + labelWidth + colWidth * i + colWidth / 2, y + rowHeight / 2);
      });
    });

    canvas.toBlob((blob) => {
      if (!blob) {
        exportComparisonAsCsv(playerNames, rows);
        return;
      }
      download(`hoopiq-comparison-${Date.now()}.png`, blob);
    }, "image/png");
  } catch {
    exportComparisonAsCsv(playerNames, rows);
  }
}
