import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvatarConfig {
  hair?: string | null;
  eyes?: string | null;
  eyebrows?: string | null;
  mouth?: string | null;
  earrings?: string | null;
  features?: string | null;
  glasses?: string | null;
  hairColor?: string;
  skinColor?: string;
}

type Category =
  | "hair"
  | "eyes"
  | "eyebrows"
  | "mouth"
  | "earrings"
  | "features"
  | "glasses";

// ─── Layer order (bottom → top) ───────────────────────────────────────────────

const LAYER_ORDER: Category[] = [
  "hair",
  "eyes",
  "eyebrows",
  "mouth",
  "earrings",
  "features",
  "glasses",
];

const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: "hair", label: "Hair", icon: "💇" },
  { key: "eyes", label: "Eyes", icon: "👁️" },
  { key: "eyebrows", label: "Brows", icon: "〰️" },
  { key: "mouth", label: "Mouth", icon: "👄" },
  { key: "earrings", label: "Earrings", icon: "💎" },
  { key: "features", label: "Features", icon: "✨" },
  { key: "glasses", label: "Glasses", icon: "🕶️" },
];

// ─── POSITION OFFSETS ─────────────────────────────────────────────────────────
// Adjust x/y (CSS value: "%" or "px") and scale to align each layer over the base.

interface LayerOffset {
  x: string;
  y: string;
  scale: number;
  originX: string;
  originY: string;
}

const LAYER_OFFSETS: Record<Category, LayerOffset> = {
  hair: { x: "-4.7%", y: "5%", scale: 1.3, originX: "50%", originY: "50%" },
  eyes: { x: "-5%", y: "6%", scale: 1.1, originX: "50%", originY: "50%" },
  eyebrows: { x: "-5%", y: "7%", scale: 1.2, originX: "50%", originY: "50%" },
  mouth: { x: "-4%", y: "7%", scale: 1.2, originX: "50%", originY: "50%" },
  earrings: { x: "0%", y: "7%", scale: 1.2, originX: "50%", originY: "50%" },
  features: { x: "-6%", y: "5%", scale: 1.3, originX: "50%", originY: "50%" },
  glasses: { x: "-5%", y: "6.5%", scale: 1.1, originX: "50%", originY: "50%" },
};

// ─── Color config ─────────────────────────────────────────────────────────────

const DEFAULT_HAIR_COLOR = "#3B2314";
const DEFAULT_SKIN_COLOR = "#F5C89A";

const HAIR_SWATCHES = [
  "#1C1C1C",
  "#3B2314",
  "#7B4F2E",
  "#C8A050",
  "#F5E6C8",
  "#E8E8E8",
  "#FF6B6B",
  "#4A90D9",
  "#7B68EE",
];

const SKIN_SWATCHES = [
  "#FDDBB4",
  "#F5C89A",
  "#E8A87C",
  "#D08B5B",
  "#C06830",
  "#8D4A2E",
  "#5C2E1A",
  "#FFE0BD",
  "#FFCD94",
];

// ─── Paths ────────────────────────────────────────────────────────────────────

const BASE_SVG = "/avatarAssets/base.svg";
const AVATAR_SIZE = 256;
const MAX_VARIANTS = 50; // hard ceiling — real stop is the first 404

// ─── SVG fetching + cache ─────────────────────────────────────────────────────
// Cache both hits (svg text) and misses (null) so probeVariants never re-fetches
// a 404 and the sequential loop terminates correctly the first time.

const svgCache: Record<string, string | null> = {};

const fetchSVG = async (src: string): Promise<string | null> => {
  if (src in svgCache) return svgCache[src];
  try {
    const res = await fetch(src);
    if (!res.ok) {
      svgCache[src] = null;
      return null;
    }
    // Vite/SPA servers return 200 + index.html for missing static files.
    // Reject anything that isn't actually an SVG.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("svg") && !contentType.includes("xml")) {
      // Peek at the body — real SVGs start with "<svg" or "<?xml"
      const text = await res.text();
      if (
        !text.trimStart().startsWith("<svg") &&
        !text.trimStart().startsWith("<?xml")
      ) {
        svgCache[src] = null;
        return null;
      }
      svgCache[src] = text;
      return text;
    }
    const text = await res.text();
    svgCache[src] = text;
    return text;
  } catch {
    svgCache[src] = null;
    return null;
  }
};

// ─── SVG colorisation ─────────────────────────────────────────────────────────
// Only replaces fill on elements with id="Color". Everything else untouched.

const coloriseByIdPath = (svgText: string, color: string): string => {
  // Step 1: Replace fill on the <g id="Color"> opening tag itself
  let result = svgText.replace(
    /<(path|rect|circle|ellipse|polygon|polyline)([^>]*?)>/gi,
    (fullTag, tag, attrs) => {
      if (!attrs.includes('id="Color"')) return fullTag;
      let updated = attrs;
      if (/fill="/i.test(updated)) {
        updated = updated.replace(/fill="[^"]*"/gi, `fill="${color}"`);
      } else {
        updated = updated + ` fill="${color}"`;
      }
      if (/style="[^"]*fill\s*:/i.test(updated)) {
        updated = updated.replace(
          /(style="[^"]*)fill\s*:\s*[^;"]*/gi,
          `$1fill:${color}`,
        );
      }
      return `<${tag}${updated}>`;
    },
  );

  // Step 2: Find <g id="Color" ...> blocks and recolor all child path fills within them.
  // This handles the case where fill is set on child <path> elements, overriding the group fill.
  result = result.replace(
    /(<g[^>]*id="Color"[^>]*>)([\s\S]*?)(<\/g>)/gi,
    (_match, openTag, inner, closeTag) => {
      // Recolor the group tag fill attribute
      let updatedOpen = openTag;
      if (/fill="/i.test(updatedOpen)) {
        updatedOpen = updatedOpen.replace(/fill="[^"]*"/gi, `fill="${color}"`);
      } else {
        updatedOpen = updatedOpen.replace(/>$/, ` fill="${color}">`);
      }

      // Recolor every fill="..." on child elements inside this group
      const updatedInner = inner.replace(/fill="[^"]*"/gi, `fill="${color}"`);

      return `${updatedOpen}${updatedInner}${closeTag}`;
    },
  );

  return result;
};

// ─── Probe variants ───────────────────────────────────────────────────────────
// All categories use sequential variant-01, variant-02 … naming.
// Stops at the first 404 — no guessing, no over-fetching.

const probeVariants = async (category: Category): Promise<string[]> => {
  const found: string[] = [];
  for (let i = 1; i <= MAX_VARIANTS; i++) {
    const variant = `variant-${String(i).padStart(2, "0")}`;
    const text = await fetchSVG(`/avatarAssets/${category}/${variant}.svg`);
    if (text === null) break; // first miss → stop
    found.push(variant);
  }
  return found;
};

// ─── Hue ↔ hex helpers ────────────────────────────────────────────────────────

const hueToHex = (hue: number): string => {
  const s = 0.7,
    l = 0.45;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(
      (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))) * 255,
    )
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToHue = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }
  return Math.round(h * 360);
};

// ─── BaseSVGLayer ─────────────────────────────────────────────────────────────

const BaseSVGLayer = ({ skinColor }: { skinColor: string }) => {
  const [markup, setMarkup] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchSVG(BASE_SVG).then((text) => {
      if (!cancelled && text) setMarkup(coloriseByIdPath(text, skinColor));
    });
    return () => {
      cancelled = true;
    };
  }, [skinColor]);

  if (!markup) return null;
  return (
    <div
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

// ─── SVGLayer ─────────────────────────────────────────────────────────────────

const SVGLayer = ({
  category,
  variant,
  hairColor,
}: {
  category: Category;
  variant: string;
  hairColor: string;
}) => {
  const [markup, setMarkup] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchSVG(`/avatarAssets/${category}/${variant}.svg`).then((text) => {
      if (!cancelled && text) {
        setMarkup(
          category === "hair" ? coloriseByIdPath(text, hairColor) : text,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [category, variant, hairColor]);

  if (!markup) return null;

  const { x, y, scale, originX, originY } = LAYER_OFFSETS[category];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: "100%",
        height: "100%",
        transform: `scale(${scale})`,
        transformOrigin: `${originX} ${originY}`,
      }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
};

// ─── AvatarDisplay (reusable, read-only) ─────────────────────────────────────

interface AvatarDisplayProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

export const AvatarDisplay = ({
  config,
  size = 80,
  className = "",
}: AvatarDisplayProps) => {
  const skinColor = config.skinColor ?? DEFAULT_SKIN_COLOR;
  const hairColor = config.hairColor ?? DEFAULT_HAIR_COLOR;
  return (
    <div
      className={`avatar__display ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      <BaseSVGLayer skinColor={skinColor} />
      {LAYER_ORDER.map((cat) => {
        const variant = config[cat];
        if (!variant) return null;
        return (
          <SVGLayer
            key={cat}
            category={cat}
            variant={variant}
            hairColor={hairColor}
          />
        );
      })}
    </div>
  );
};

// ─── Canvas export ────────────────────────────────────────────────────────────

const exportToDataURL = async (config: AvatarConfig): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;

  const drawSVGText = async (svgText: string, offset: LayerOffset) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const img = new Image(AVATAR_SIZE, AVATAR_SIZE);
      img.onload = () => {
        const pxX = (parseFloat(offset.x) / 100) * AVATAR_SIZE;
        const pxY = (parseFloat(offset.y) / 100) * AVATAR_SIZE;
        const s = offset.scale;
        const cx = (parseFloat(offset.originX) / 100) * AVATAR_SIZE;
        const cy = (parseFloat(offset.originY) / 100) * AVATAR_SIZE;
        ctx.save();
        ctx.translate(cx + pxX, cy + pxY);
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
        ctx.drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        ctx.restore();
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  };

  const skinColor = config.skinColor ?? DEFAULT_SKIN_COLOR;
  const hairColor = config.hairColor ?? DEFAULT_HAIR_COLOR;
  const noOffset: LayerOffset = {
    x: "0%",
    y: "0%",
    scale: 1,
    originX: "50%",
    originY: "50%",
  };

  const baseSvg = await fetchSVG(BASE_SVG);
  if (baseSvg)
    await drawSVGText(coloriseByIdPath(baseSvg, skinColor), noOffset);

  for (const cat of LAYER_ORDER) {
    const variant = config[cat];
    if (!variant) continue;
    const svgText = await fetchSVG(`/avatarAssets/${cat}/${variant}.svg`);
    if (!svgText) continue;
    const coloured =
      cat === "hair" ? coloriseByIdPath(svgText, hairColor) : svgText;
    await drawSVGText(coloured, LAYER_OFFSETS[cat]);
  }

  return canvas.toDataURL("image/png");
};

// ─── VariantThumb ─────────────────────────────────────────────────────────────

const VariantThumb = ({
  category,
  variant,
  hairColor,
  skinColor,
  isSelected,
  onClick,
}: {
  category: Category;
  variant: string;
  hairColor: string;
  skinColor: string;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const [markup, setMarkup] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchSVG(`/avatarAssets/${category}/${variant}.svg`).then((text) => {
      if (!cancelled && text) {
        setMarkup(
          category === "hair" ? coloriseByIdPath(text, hairColor) : text,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [category, variant, hairColor]);

  return (
    <button
      className={`avatar__editor__thumb ${isSelected ? "avatar__editor__thumb--selected" : ""}`}
      onClick={onClick}
      title={variant}
      type="button"
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        <BaseSVGLayer skinColor={skinColor} />
        {markup && (
          <div
            style={{ position: "absolute", inset: 0 }}
            dangerouslySetInnerHTML={{ __html: markup }}
          />
        )}
      </div>
      {isSelected && (
        <div className="avatar__editor__thumb__check">
          <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
            <path
              d="M1 4.5L4.5 8L11 1"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </button>
  );
};

// ─── Generic color picker ─────────────────────────────────────────────────────

const ColorPicker = ({
  label,
  color,
  swatches,
  onChange,
}: {
  label: string;
  color: string;
  swatches: string[];
  onChange: (hex: string) => void;
}) => {
  const hue = hexToHue(color);
  return (
    <div className="avatar__editor__color">
      <div className="avatar__editor__color__header">
        <span className="avatar__editor__color__label">{label}</span>
        <div
          className="avatar__editor__color__preview"
          style={{ background: color }}
        />
      </div>

      <div className="avatar__editor__color__slider__row">
        <input
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={(e) => onChange(hueToHex(parseInt(e.target.value)))}
          className="avatar__editor__color__slider"
          style={{ "--thumb-color": color } as React.CSSProperties}
        />
      </div>

      <div className="avatar__editor__color__swatches">
        {swatches.map((sw) => (
          <button
            key={sw}
            type="button"
            className={`avatar__editor__color__swatch ${sw.toLowerCase() === color.toLowerCase() ? "avatar__editor__color__swatch--active" : ""}`}
            style={{ background: sw }}
            onClick={() => onChange(sw)}
            title={sw}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

interface AvatarEditorProps {
  userId?: string;
  initialConfig?: AvatarConfig;
  onChange?: (config: AvatarConfig) => void;
  onSaved?: (dataUrl: string) => void;
  onClose?: () => void;
}

const AvatarEditor = ({
  userId,
  initialConfig,
  onChange,
  onSaved,
  onClose,
}: AvatarEditorProps) => {
  const uid = userId ?? getAuth().currentUser?.uid;

  const [config, setConfig] = useState<AvatarConfig>(initialConfig ?? {});
  const [activeTab, setActiveTab] = useState<Category>("hair");
  const [variants, setVariants] = useState<Record<Category, string[]>>({
    hair: [],
    eyes: [],
    eyebrows: [],
    mouth: [],
    earrings: [],
    features: [],
    glasses: [],
  });
  const [probing, setProbing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved config from Firestore
  useEffect(() => {
    if (initialConfig || !uid) return;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.avatarConfig) setConfig(data.avatarConfig as AvatarConfig);
        }
      })
      .catch(console.error);
  }, [uid]);

  // Probe all variant counts on mount
  useEffect(() => {
    Promise.all(
      CATEGORIES.map(
        async ({ key }) => [key, await probeVariants(key)] as const,
      ),
    ).then((results) => {
      setVariants(Object.fromEntries(results) as Record<Category, string[]>);
      setProbing(false);
    });
  }, []);

  useEffect(() => {
    onChange?.(config);
  }, [config]);

  const toggleVariant = (cat: Category, variant: string) => {
    setSaved(false);
    setConfig((prev) => ({
      ...prev,
      [cat]: prev[cat] === variant ? null : variant,
      ...(cat === "hair" && !prev.hairColor
        ? { hairColor: DEFAULT_HAIR_COLOR }
        : {}),
    }));
  };

  const handleSave = async () => {
    if (!uid || saving) return;
    setSaving(true);
    try {
      const dataUrl = await exportToDataURL(config);
      await updateDoc(doc(db, "users", uid), {
        profileImageUrl: dataUrl,
        avatarConfig: config,
      });
      setSaved(true);
      onSaved?.(dataUrl);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Error saving avatar:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const dataUrl = await exportToDataURL(config);
    const a = document.createElement("a");
    a.download = "avatar.png";
    a.href = dataUrl;
    a.click();
  };

  const activeVariants = variants[activeTab] ?? [];
  const hairColor = config.hairColor ?? DEFAULT_HAIR_COLOR;
  const skinColor = config.skinColor ?? DEFAULT_SKIN_COLOR;

  return (
    <div className="avatar__editor">
      {/* ── Preview ── */}
      <div className="avatar__editor__preview">
        <div className="avatar__editor__preview__avatar">
          <AvatarDisplay config={config} size={96} />
        </div>
        <div className="avatar__editor__preview__right">
          <div className="avatar__editor__preview__info">
            <p className="avatar__editor__preview__title">Your Avatar</p>
            <p className="avatar__editor__preview__hint">
              Saved as your profile picture — visible to all teammates.
            </p>
          </div>
          <div className="avatar__editor__preview__actions">
            <button
              className="btn__primary avatar__editor__save__btn"
              onClick={handleSave}
              disabled={saving}
            >
              {saved ? (
                <>
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path
                      d="M1 4.5L4.5 8L11 1"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>{" "}
                  Saved!
                </>
              ) : saving ? (
                "Saving…"
              ) : (
                "Save avatar"
              )}
            </button>
            <button
              className="btn__wired avatar__editor__download__btn"
              onClick={handleDownload}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2V16M12 16L8 12M12 16L16 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 20H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              PNG
            </button>
            {onClose && (
              <button className="btn__wired" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Skin tone picker — always visible ── */}
      <ColorPicker
        label="Skin tone"
        color={skinColor}
        swatches={SKIN_SWATCHES}
        onChange={(hex) => {
          setSaved(false);
          setConfig((prev) => ({ ...prev, skinColor: hex }));
        }}
      />

      {/* ── Category tabs ── */}
      <div className="avatar__editor__tabs">
        {CATEGORIES.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`avatar__editor__tab ${activeTab === key ? "avatar__editor__tab--active" : ""}`}
            onClick={() => setActiveTab(key)}
            type="button"
          >
            <span className="avatar__editor__tab__icon">{icon}</span>
            <span className="avatar__editor__tab__label">{label}</span>
            {config[key] && (
              <span
                className="avatar__editor__tab__dot"
                style={{ background: key === "hair" ? hairColor : "#4DB87A" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Variant grid ── */}
      <div className="avatar__editor__panel">
        {probing ? (
          <p className="avatar__editor__loading">Loading…</p>
        ) : (
          <>
            <button
              className={`avatar__editor__thumb avatar__editor__thumb--none ${!config[activeTab] ? "avatar__editor__thumb--selected" : ""}`}
              onClick={() =>
                setConfig((prev) => ({ ...prev, [activeTab]: null }))
              }
              type="button"
              title="None"
            >
              <span>—</span>
            </button>

            {activeVariants.map((variant) => (
              <VariantThumb
                key={variant}
                category={activeTab}
                variant={variant}
                hairColor={hairColor}
                skinColor={skinColor}
                isSelected={config[activeTab] === variant}
                onClick={() => toggleVariant(activeTab, variant)}
              />
            ))}

            {activeVariants.length === 0 && (
              <p className="avatar__editor__loading">No variants found.</p>
            )}
          </>
        )}
      </div>

      {/* ── Hair color picker — only on hair tab when a variant is selected ── */}
      {activeTab === "hair" && config.hair && (
        <ColorPicker
          label="Hair color"
          color={hairColor}
          swatches={HAIR_SWATCHES}
          onChange={(hex) => {
            setSaved(false);
            setConfig((prev) => ({ ...prev, hairColor: hex }));
          }}
        />
      )}
    </div>
  );
};

export default AvatarEditor;
