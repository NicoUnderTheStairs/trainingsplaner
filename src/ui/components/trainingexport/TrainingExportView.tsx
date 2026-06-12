import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";
import type { Training } from "../../../types/Training";
import type { SketchData } from "../../../types/Sketch";

// ─── Sketch (self-contained) ───────────────────────────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  outside: "#E63C2F",
  opposite: "#F5A623",
  middleBlocker: "#4DB87A",
  setter: "#3EC6D4",
  libero: "#624DB8",
  coach: "#FFEE52",
  // Legacy backward-compat
  attacker: "#E63C2F",
  defender: "#3EC6D4",
};
const PLAYER_LABELS: Record<string, string> = {
  outside: "OH",
  opposite: "OP",
  middleBlocker: "MB",
  setter: "S",
  libero: "L",
  coach: "C",
  // Legacy backward-compat
  attacker: "OH",
  defender: "S",
};

const ExportSketch = ({ sketch }: { sketch?: SketchData }) => {
  if (!sketch)
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "560/440",
          background: "#f4ede0",
          border: "0.3rem solid #1e1e1e",
          borderRadius: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#aaa",
            fontSize: 13,
            fontFamily: "Roboto Condensed, sans-serif",
          }}
        >
          No sketch
        </span>
      </div>
    );

  const players = Object.entries(sketch.players ?? {});
  const arrows = Object.entries(sketch.arrows ?? {});
  const objects = Object.entries((sketch as any).objects ?? {});

  return (
    <svg
      width="100%"
      viewBox="0 0 560 440"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: "block",
        borderRadius: "1rem",
        border: "0.3rem solid #1e1e1e",
      }}
    >
      <defs>
        <marker
          id="ex-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 Z" fill="#1E1E1E" />
        </marker>
      </defs>
      <path d="M560 0H0V440H560V0Z" fill="white" />
      <path
        d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z"
        fill="#F4EDE0"
      />
      <path
        d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203"
        stroke="#1e1e1e"
        strokeWidth="0.8"
      />
      {objects.map(([id, obj]: [string, any]) => (
        <g key={id} transform={`translate(${obj.x}, ${obj.y})`}>
          {obj.type === "pylon" && (
            <polygon
              points="0,-13 11,8 -11,8"
              fill="#FF8C00"
              stroke="#1E1E1E"
              strokeWidth={1.5}
            />
          )}
          {obj.type === "bench" && (
            <>
              <rect
                x={-15}
                y={-7}
                width={30}
                height={14}
                fill="#8B5E3C"
                stroke="#1E1E1E"
                strokeWidth={1.5}
                rx={2}
              />
              <line
                x1={-11}
                y1={7}
                x2={-11}
                y2={12}
                stroke="#1E1E1E"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <line
                x1={11}
                y1={7}
                x2={11}
                y2={12}
                stroke="#1E1E1E"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </>
          )}
          {obj.type === "matt" && (
            <rect
              x={-22}
              y={-10}
              width={44}
              height={20}
              fill="#4A90D9"
              stroke="#1E1E1E"
              strokeWidth={1.5}
              rx={3}
            />
          )}
          {obj.type === "ball" && (
            <circle r={8} fill="#FFEE52" stroke="#1E1E1E" strokeWidth={1.5} />
          )}
        </g>
      ))}
      {arrows.map(([id, a]: [string, any]) => (
        <line
          key={id}
          x1={a.x1}
          y1={a.y1}
          x2={a.x2}
          y2={a.y2}
          stroke="#1E1E1E"
          strokeWidth="2"
          strokeDasharray={a.style === "dashed" ? "6 4" : undefined}
          markerEnd="url(#ex-arrow)"
        />
      ))}
      {players.map(([id, p]: [string, any]) => (
        <g key={id} transform={`translate(${p.x}, ${p.y})`}>
          <circle r={11} fill={PLAYER_COLORS[p.type] ?? "#999"} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill={p.type === "coach" ? "#1E1E1E" : "white"}
            fontSize={11}
            fontWeight="bold"
            fontFamily="Roboto Condensed, sans-serif"
          >
            {PLAYER_LABELS[p.type] ?? "?"}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Player position meta (for the players section) ───────────────────────────

const EXPORT_POSITIONS: {
  key: string;
  label: string;
  abbr: string;
  color: string;
}[] = [
  { key: "outside", label: "Outside Hitter", abbr: "OH", color: "#E63C2F" },
  { key: "opposite", label: "Opposite Hitter", abbr: "OP", color: "#F5A623" },
  { key: "middleBlocker", label: "Middle Blocker", abbr: "MB", color: "#4DB87A" },
  { key: "setter", label: "Setter", abbr: "S", color: "#3EC6D4" },
  { key: "libero", label: "Libero", abbr: "L", color: "#624DB8" },
  { key: "coach", label: "Coach", abbr: "C", color: "#FFEE52" },
];

// ─── Tag chip ──────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<string, { bg: string; border: string }> = {
  warmup: { bg: "rgba(255,238,82,0.3)", border: "#ffee52" },
  defense: { bg: "rgba(245,166,35,0.25)", border: "#f5a623" },
  attack: { bg: "rgba(230,60,47,0.2)", border: "#e63c2f" },
  block: { bg: "rgba(77,184,122,0.25)", border: "#4db87a" },
  reception: { bg: "rgba(62,198,212,0.2)", border: "#3ec6d4" },
  service: { bg: "rgba(98,77,184,0.2)", border: "#624db8" },
};

const TagChip = ({ tag }: { tag: string }) => {
  const s = TAG_STYLES[tag.toLowerCase()] ?? { bg: "#f0f0f0", border: "#ccc" };
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 100,
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "Roboto Condensed, sans-serif",
        letterSpacing: "0.03em",
        background: s.bg,
        border: `0.15rem solid ${s.border}`,
        color: "#1e1e1e",
      }}
    >
      {tag}
    </span>
  );
};

// ─── Difficulty bars ───────────────────────────────────────────────────────────

const DifficultyBars = ({ level }: { level: number }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: 2 }}>
    {[
      { h: 8, visible: level >= 1 },
      { h: 12, visible: level >= 2 },
      { h: 16, visible: level >= 3 },
      { h: 20, visible: level >= 4 },
      { h: 24, visible: level >= 5 },
    ].map((bar, i) => (
      <div
        key={i}
        style={{
          width: 5,
          height: bar.h,
          background: bar.visible ? "#1e1e1e" : "#ddd",
          borderRadius: 1,
        }}
      />
    ))}
  </div>
);

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseDoc {
  id: string;
  title: string;
  description?: string;
  difficulty?: number;
  tags?: string[];
  sketch?: SketchData;
  duration?: number;
}

// ─── Main export view ──────────────────────────────────────────────────────────

export default function TrainingExportView() {
  const { trainingId } = useParams<{ trainingId: string }>();
  const uid = getAuth().currentUser?.uid ?? "";

  const [training, setTraining] = useState<Training | null>(null);
  const [exercises, setExercises] = useState<ExerciseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"pdf" | "png" | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trainingId || !uid) return;
    const load = async () => {
      const tSnap = await getDoc(
        doc(db, "users", uid, "trainings", trainingId),
      );
      if (!tSnap.exists()) {
        setLoading(false);
        return;
      }
      const t = { id: tSnap.id, ...tSnap.data() } as Training;
      setTraining(t);

      const exList = await Promise.all(
        (t.exercises ?? []).map(async (sel) => {
          try {
            const eSnap = await getDoc(doc(db, "Excercises", sel.exerciseId));
            if (!eSnap.exists()) return null;
            return {
              id: eSnap.id,
              duration: sel.duration,
              ...eSnap.data(),
            } as ExerciseDoc;
          } catch {
            return null;
          }
        }),
      );
      setExercises(exList.filter(Boolean) as ExerciseDoc[]);
      setLoading(false);
    };
    load();
  }, [trainingId, uid]);

  const formatDate = (date: any) => {
    if (!date) return "—";
    const d =
      typeof date.toDate === "function" ? date.toDate() : new Date(date);
    return d.toLocaleDateString("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const totalPlanned = (training?.exercises ?? []).reduce(
    (s, e) => s + (e.duration ?? 0),
    0,
  );

  // Load html2canvas + jsPDF dynamically (no npm install needed)
  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });

  const captureCanvas = async (): Promise<HTMLCanvasElement> => {
    await loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    );
    const html2canvas = (window as any).html2canvas;
    return html2canvas(pageRef.current!, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fffaf0",
      logging: false,
    });
  };

  const handleSavePDF = async () => {
    if (!pageRef.current || saving) return;
    setSaving("pdf");
    try {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
      );
      const canvas = await captureCanvas();
      const { jsPDF } = (window as any).jspdf;

      const imgW = 210; // A4 width mm
      const imgH = (canvas.height / canvas.width) * imgW;
      const pdf = new jsPDF({
        orientation: imgH > imgW ? "p" : "l",
        unit: "mm",
        format: [imgW, imgH],
      });

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        imgW,
        imgH,
      );
      pdf.save(`${training?.title ?? "training"}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setSaving(null);
    }
  };

  const handleSavePNG = async () => {
    if (!pageRef.current || saving) return;
    setSaving("png");
    try {
      const canvas = await captureCanvas();
      const link = document.createElement("a");
      link.download = `${training?.title ?? "training"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("PNG export failed:", e);
    } finally {
      setSaving(null);
    }
  };

  if (loading)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Roboto Condensed, sans-serif",
          fontSize: 18,
          color: "#666",
          background: "#fffaf0",
        }}
      >
        Preparing export…
      </div>
    );

  if (!training)
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Roboto Condensed, sans-serif",
          fontSize: 18,
          color: "#666",
          background: "#fffaf0",
        }}
      >
        Training not found.
      </div>
    );

  const pct =
    training.duration > 0
      ? Math.min((totalPlanned / training.duration) * 100, 100)
      : 0;
  const over = totalPlanned > training.duration;

  return (
    <div
      style={{
        background: "#fffaf0",
        minHeight: "100vh",
        fontFamily: "Roboto Condensed, sans-serif",
        padding: "32px 24px 80px",
        minWidth: "144rem",
      }}
    >
      {/* ── Sticky toolbar ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "#fffaf0",
          borderBottom: "0.3rem solid #1e1e1e",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Colour stripe logo */}
          <div style={{ display: "flex", gap: 3 }}>
            {["#e63c2f", "#f5a623", "#ffee52", "#4db87a", "#3ec6d4"].map(
              (c, i) => (
                <div
                  key={i}
                  style={{
                    width: 6,
                    height: 28,
                    background: c,
                    borderRadius: 2,
                  }}
                />
              ),
            )}
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Export Training: {training.title}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => window.close()} style={btnStyleWired}>
            ← Back
          </button>
          <button
            onClick={handleSavePNG}
            disabled={!!saving}
            style={btnStyleWired}
          >
            {saving === "png" ? "Saving…" : "Save PNG"}
          </button>
          <button
            onClick={handleSavePDF}
            disabled={!!saving}
            style={btnStylePrimary}
          >
            {saving === "pdf" ? "Saving…" : "Save PDF"}
          </button>
        </div>
      </div>

      {/* ── Export page content ── */}
      <div
        ref={pageRef}
        style={{
          maxWidth: 860,
          margin: "64px auto 0",
          background: "#fffaf0",
          padding: "32px 32px 40px",
        }}
      >
        {/* Training header card */}
        <div
          style={{
            border: "0.3rem solid #1e1e1e",
            borderRadius: "2rem",
            overflow: "hidden",
            marginBottom: 32,
            background: "white",
          }}
        >
          {/* Colour accent bar */}
          <div style={{ display: "flex", height: 10 }}>
            {[
              "#e63c2f",
              "#f5a623",
              "#ffee52",
              "#4db87a",
              "#3ec6d4",
              "#624db8",
            ].map((c, i) => (
              <div key={i} style={{ flex: 1, background: c }} />
            ))}
          </div>

          <div style={{ padding: "24px 28px" }}>
            {/* Meta */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0 16px",
                fontSize: 13,
                color: "#666",
                marginBottom: 10,
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: 700 }}>
                {formatDate(training.date)}
              </span>
              <span style={{ color: "#ccc" }}>·</span>
              <span
                style={{
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontWeight: 700,
                }}
              >
                {training.author}
              </span>
              <span style={{ color: "#ccc" }}>·</span>
              <span
                style={{
                  background: "#1e1e1e",
                  color: "white",
                  padding: "2px 12px",
                  borderRadius: 100,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {training.duration} min
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: 40,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.01em",
                lineHeight: 1.1,
                marginBottom: 8,
              }}
            >
              {training.title}
            </h1>

            {training.description && (
              <p
                style={{
                  fontSize: 15,
                  color: "#555",
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                {training.description}
              </p>
            )}

            {/* Tags */}
            {(training.tags ?? []).length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                {(training.tags ?? []).map((tag) => (
                  <TagChip key={tag} tag={tag} />
                ))}
              </div>
            )}

            {/* Duration bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  background: "#e8e0d4",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 4,
                    background: over ? "#e63c2f" : "#4db87a",
                    width: `${pct}%`,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: over ? "#e63c2f" : "#555",
                  whiteSpace: "nowrap",
                }}
              >
                {totalPlanned} / {training.duration} min
                {over && (
                  <span style={{ color: "#e63c2f" }}>
                    {" "}
                    (+{totalPlanned - training.duration})
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Players section */}
        {training.players && Object.values(training.players).some((v) => v > 0) && (
          <div
            style={{
              border: "0.3rem solid #1e1e1e",
              borderRadius: "2rem",
              background: "white",
              padding: "20px 28px",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  margin: 0,
                }}
              >
                Players
              </h2>
              <span style={{ fontSize: 14, color: "#999", fontWeight: 700 }}>
                {Object.values(training.players).reduce((s, v) => s + v, 0)} total
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {EXPORT_POSITIONS.filter(
                (pos) =>
                  ((training.players as unknown as Record<string, number>)[pos.key] ?? 0) > 0,
              ).map((pos) => (
                <div
                  key={pos.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#f8f4ee",
                    border: "0.2rem solid #1e1e1e",
                    borderRadius: "1rem",
                    padding: "6px 14px 6px 6px",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: pos.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: pos.key === "coach" ? "#1e1e1e" : "white",
                      fontFamily: "Roboto Condensed, sans-serif",
                      flexShrink: 0,
                    }}
                  >
                    {pos.abbr}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        lineHeight: 1,
                        fontFamily: "Roboto Condensed, sans-serif",
                      }}
                    >
                      {(training.players as unknown as Record<string, number>)[pos.key]}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#888",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        fontFamily: "Roboto Condensed, sans-serif",
                      }}
                    >
                      {pos.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontSize: 28,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Exercises
          </h2>
          <span style={{ fontSize: 16, color: "#999", fontWeight: 700 }}>
            ({exercises.length})
          </span>
        </div>

        {/* Exercise cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {exercises.map((ex, index) => (
            <div
              key={ex.id}
              style={{
                border: "0.3rem solid #1e1e1e",
                borderRadius: "2rem",
                background: "white",
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1fr 260px",
              }}
            >
              {/* Left: info */}
              <div
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Number + title row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "0.25rem solid #1e1e1e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 15,
                      fontWeight: 800,
                      flexShrink: 0,
                      color: "#666",
                    }}
                  >
                    {index + 1}
                  </div>
                  <h3
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.02em",
                      lineHeight: 1.1,
                    }}
                  >
                    {ex.title}
                  </h3>
                  {/* Duration pill */}
                  <span
                    style={{
                      marginLeft: "auto",
                      flexShrink: 0,
                      background: "#1e1e1e",
                      color: "#ffee52",
                      padding: "4px 14px",
                      borderRadius: 100,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {ex.duration} min
                  </span>
                </div>

                {/* Description */}
                {ex.description && (
                  <p
                    style={{
                      fontSize: 14,
                      color: "#555",
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {ex.description}
                  </p>
                )}

                {/* Tags + difficulty */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: "auto",
                  }}
                >
                  {(ex.tags ?? []).map((tag) => (
                    <TagChip key={tag} tag={tag} />
                  ))}
                  {ex.difficulty && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginLeft: "auto",
                      }}
                    >
                      <DifficultyBars level={ex.difficulty} />
                      <span
                        style={{ fontSize: 12, color: "#888", fontWeight: 700 }}
                      >
                        Level {ex.difficulty}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: sketch */}
              <div
                style={{
                  padding: 16,
                  borderLeft: "0.3rem solid #1e1e1e",
                  background: "#fffaf0",
                }}
              >
                <ExportSketch sketch={ex.sketch} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "0.3rem solid #1e1e1e",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "#aaa",
            fontWeight: 600,
          }}
        >
          <span style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Volleyball Trainingsplaner by nico
          </span>
          <span>
            {new Date().toLocaleDateString("de-CH", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Button styles ─────────────────────────────────────────────────────────────

const btnBase: React.CSSProperties = {
  padding: "8px 18px",
  borderRadius: "1rem",
  border: "0.25rem solid #1e1e1e",
  fontFamily: "Roboto Condensed, sans-serif",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  letterSpacing: "0.03em",
  transition: "all 0.15s ease",
};

const btnStyleWired: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: "#1e1e1e",
};

const btnStylePrimary: React.CSSProperties = {
  ...btnBase,
  background: "#1e1e1e",
  color: "#ffee52",
};
