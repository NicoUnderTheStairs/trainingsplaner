import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate, useParams, Link } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import type { Training } from "../../types/Training";
import type { SelectedExercise } from "../components/trainingwizard/exerciseSelection";
import type { Players } from "../components/trainingwizard/playerSelection";
import type { UserProfile } from "../../services/upload/registerUser";
import type { SketchData } from "../../types/Sketch";
import { notifyTrainingShared } from "../../services/notifications/notifications";
import db from "../../firebase";

// ─── Player display ───────────────────────────────────────────────────────────

const POSITION_META: {
  key: keyof Players;
  label: string;
  abbr: string;
  color: string;
}[] = [
  { key: "outside", label: "Outside Hitter", abbr: "OH", color: "#E63C2F" },
  { key: "opposite", label: "Opposite", abbr: "OP", color: "#F5A623" },
  {
    key: "middleBlocker",
    label: "Middle Blocker",
    abbr: "MB",
    color: "#4DB87A",
  },
  { key: "setter", label: "Setter", abbr: "S", color: "#3EC6D4" },
  { key: "libero", label: "Libero", abbr: "L", color: "#624DB8" },
];

const PlayerDisplay = ({ players }: { players: Players }) => {
  const total = Object.values(players).reduce((s, v) => s + v, 0);
  const attending = POSITION_META.filter((p) => players[p.key] > 0);

  if (total === 0)
    return (
      <p className="trainingdetail__players__empty">
        No players added to this training.
      </p>
    );

  return (
    <div className="trainingdetail__players__grid">
      {attending.map((pos) => (
        <div key={pos.key} className="trainingdetail__players__chip">
          <div
            className="trainingdetail__players__chip__abbr"
            style={{ background: pos.color }}
          >
            {pos.abbr}
          </div>
          <div className="trainingdetail__players__chip__info">
            <span className="trainingdetail__players__chip__count">
              {players[pos.key]}
            </span>
            <span className="trainingdetail__players__chip__label">
              {pos.label}
            </span>
          </div>
        </div>
      ))}
      <div className="trainingdetail__players__total">
        <span className="trainingdetail__players__total__num">{total}</span>
        <span className="trainingdetail__players__total__label">Total</span>
      </div>
    </div>
  );
};

// ─── Sketch thumbnail (for add-exercise dialog) ───────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  attacker: "#E63C2F",
  defender: "#3EC6D4",
  setter: "#F5A623",
  libero: "#4DB87A",
};
const PLAYER_LABELS: Record<string, string> = {
  attacker: "A",
  defender: "D",
  setter: "S",
  libero: "L",
};

const SketchThumbnail = ({ sketch }: { sketch: SketchData }) => {
  const players = sketch?.players ? Object.entries(sketch.players) : [];
  const arrows = sketch?.arrows ? Object.entries(sketch.arrows) : [];
  const objects = (sketch as any)?.objects
    ? Object.entries((sketch as any).objects)
    : [];
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 560 440"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
    >
      <path d="M560 0H0V440H560V0Z" fill="white" />
      <path
        d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z"
        fill="#F4EDE0"
      />
      <path
        d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203"
        stroke="black"
        strokeWidth="1"
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
        </g>
      ))}
      {arrows.map(([id, arrow]: [string, any]) => (
        <line
          key={id}
          x1={arrow.x1}
          y1={arrow.y1}
          x2={arrow.x2}
          y2={arrow.y2}
          stroke="#1E1E1E"
          strokeWidth="2"
          strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined}
        />
      ))}
      {players.map(([id, player]: [string, any]) => (
        <g key={id} transform={`translate(${player.x}, ${player.y})`}>
          <circle r={11} fill={PLAYER_COLORS[player.type] ?? "#999"} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={11}
            fontWeight="bold"
          >
            {PLAYER_LABELS[player.type] ?? "?"}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Add-exercise dialog ──────────────────────────────────────────────────────

interface ExerciseDoc {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  tags: string[];
  sketch: SketchData;
}

interface AddExerciseDialogProps {
  userTeam: string;
  alreadyAddedIds: Set<string>;
  onAdd: (exercise: ExerciseDoc, duration: number) => void;
  onClose: () => void;
}

const AddExerciseDialog = ({
  userTeam,
  alreadyAddedIds,
  onAdd,
  onClose,
}: AddExerciseDialogProps) => {
  const [exercises, setExercises] = useState<ExerciseDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Two-step: pick exercise → set duration
  const [step, setStep] = useState<"grid" | "duration">("grid");
  const [pending, setPending] = useState<ExerciseDoc | null>(null);
  const [duration, setDuration] = useState("");

  useEffect(() => {
    const fetch = async () => {
      try {
        const q = userTeam
          ? query(
              collection(db, "Excercises"),
              where("team", "array-contains", userTeam),
            )
          : collection(db, "Excercises");
        const snap = await getDocs(q);
        setExercises(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ExerciseDoc, "id">),
          })),
        );
      } catch (e) {
        console.error("Error fetching exercises:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userTeam]);

  const allTags = Array.from(
    new Set(exercises.flatMap((e) => e.tags ?? [])),
  ).sort();

  const filtered = exercises.filter((ex) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      ex.title?.toLowerCase().includes(q) ||
      ex.description?.toLowerCase().includes(q);
    const matchesTag =
      activeTag === null || (ex.tags ?? []).includes(activeTag);
    return matchesSearch && matchesTag;
  });

  const pickExercise = (ex: ExerciseDoc) => {
    setPending(ex);
    setDuration("");
    setStep("duration");
  };

  const confirmDuration = () => {
    if (!pending) return;
    onAdd(pending, Math.max(0, parseInt(duration) || 0));
    // Reset back to grid so they can keep adding
    setPending(null);
    setDuration("");
    setStep("grid");
  };

  return (
    <div className="exerciseSelection__lightbox__overlay" onClick={onClose}>
      <div
        className="exerciseSelection__lightbox"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="exerciseSelection__lightbox__header">
          <h3>
            {step === "grid"
              ? "Add an exercise"
              : `Set duration — ${pending?.title}`}
          </h3>
          <button
            className="exerciseSelection__lightbox__header__close btn__primary"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {step === "grid" && (
          <>
            <div className="exerciseSelection__lightbox__toolbar">
              <div className="exerciseSelection__lightbox__toolbar__search">
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="exerciseSelection__lightbox__toolbar__search__input"
                  autoFocus
                />
              </div>
              <div className="exerciseSelection__lightbox__toolbar__filter">
                <button
                  className={`exerciseSelection__lightbox__toolbar__filter__btn exerciseSelection__lightbox__toolbar__filter__btn--all ${
                    activeTag === null
                      ? "exerciseSelection__lightbox__toolbar__filter__btn--active"
                      : ""
                  }`}
                  onClick={() => setActiveTag(null)}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={`exerciseSelection__lightbox__toolbar__filter__btn tags--${tag.toLowerCase()} ${
                      activeTag === tag
                        ? "exerciseSelection__lightbox__toolbar__filter__btn--active"
                        : ""
                    }`}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="exerciseSelection__status">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="exerciseSelection__status">No exercises found.</p>
            ) : (
              <div className="exerciseSelection__lightbox__grid">
                {filtered.map((exercise) => {
                  const added = alreadyAddedIds.has(exercise.id);
                  return (
                    <div
                      key={exercise.id}
                      className={`exerciseSelection__lightbox__card ${added ? "exerciseSelection__lightbox__card--added" : ""}`}
                      onClick={() => pickExercise(exercise)}
                    >
                      <div className="exerciseSelection__lightbox__card__sketch">
                        <SketchThumbnail sketch={exercise.sketch} />
                      </div>
                      <div className="exerciseSelection__lightbox__card__info">
                        <h4>{exercise.title}</h4>
                        <p>{exercise.description}</p>
                        <div className="exerciseSelection__lightbox__card__tags">
                          {(exercise.tags ?? []).map((tag) => (
                            <span
                              key={tag}
                              className={`tags tags--${tag.toLowerCase()}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {added && (
                        <div className="exerciseSelection__lightbox__card__added">
                          Added
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === "duration" && pending && (
          <div className="exerciseSelection__lightbox__duration">
            <div className="exerciseSelection__lightbox__duration__sketch">
              <SketchThumbnail sketch={pending.sketch} />
            </div>
            <div className="exerciseSelection__lightbox__duration__form">
              <div className="exerciseSelection__lightbox__duration__form__title">
                <label
                  htmlFor="add-ex-duration"
                  className="exerciseSelection__lightbox__duration__label"
                >
                  How many minutes for this exercise?
                </label>
              </div>
              <div className="exerciseSelection__lightbox__duration__input__wrapper">
                <input
                  id="add-ex-duration"
                  type="number"
                  min={1}
                  value={duration}
                  placeholder="e.g. 15"
                  className="exerciseSelection__lightbox__duration__input"
                  onChange={(e) => setDuration(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmDuration()}
                  autoFocus
                />
                <span className="exerciseSelection__lightbox__duration__unit">
                  min
                </span>
              </div>
            </div>
            <div className="exerciseSelection__lightbox__duration__actions">
              <button
                className="excercisewizard__btn excercisewizard__btn--secondary"
                onClick={() => setStep("grid")}
              >
                ← Back
              </button>
              <button
                className="excercisewizard__btn"
                onClick={confirmDuration}
                disabled={!duration || parseInt(duration) <= 0}
              >
                Add to training
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_TAGS = [
  "Warmup",
  "Defense",
  "Attack",
  "Block",
  "Reception",
  "Service",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: any): string => {
  if (!date) return "—";
  const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${weekday}, ${dayMonth}`;
};

// ─── Duration bar ─────────────────────────────────────────────────────────────

const DurationBar = ({
  planned,
  total,
}: {
  planned: number;
  total: number;
}) => {
  const pct = total > 0 ? Math.min((planned / total) * 100, 100) : 0;
  const over = planned > total;
  return (
    <div className="trainingdetail__durationbar">
      <div className="trainingdetail__durationbar__track">
        <div
          className={`trainingdetail__durationbar__fill${over ? " trainingdetail__durationbar__fill--over" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`trainingdetail__durationbar__label${over ? " trainingdetail__durationbar__label--over" : ""}`}
      >
        {planned} / {total} min planned
        {over && (
          <span className="trainingdetail__durationbar__over">
            {" "}
            (+{planned - total} over)
          </span>
        )}
      </span>
    </div>
  );
};

// ─── Share dialog ─────────────────────────────────────────────────────────────

interface ShareDialogProps {
  training: Training;
  currentUserId: string;
  senderName: string;
  onClose: () => void;
}

const ShareDialog = ({
  training,
  currentUserId,
  senderName,
  onClose,
}: ShareDialogProps) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, "users"));
      const all = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }) as UserProfile)
        .filter((u) => u.uid !== currentUserId);
      setUsers(all);
      setLoadingUsers(false);
    };
    fetch();
  }, [currentUserId]);

  const toggleUser = (uid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const handleShare = async () => {
    if (selected.size === 0) return;
    setSharing(true);

    try {
      const recipientIds = Array.from(selected);

      await Promise.all(
        recipientIds.map((recipientId) =>
          setDoc(doc(collection(db, "users", recipientId, "trainings")), {
            title: training.title,
            description: training.description,
            duration: training.duration,
            difficulty: training.difficulty,
            tags: training.tags ?? [],
            exercises: training.exercises ?? [],
            players: training.players ?? null,
            author: training.author,
            date: training.date,
            sharedBy: currentUserId,
            sharedAt: new Date(),
          }),
        ),
      );

      try {
        await Promise.all(
          recipientIds.map((recipientId) =>
            notifyTrainingShared(
              recipientId,
              (training as any).id ?? "",
              training.title,
              senderName,
              currentUserId,
            ),
          ),
        );
      } catch (notifError) {
        console.warn("Could not send share notifications:", notifError);
      }

      setShared(true);
      setTimeout(onClose, 1600);
    } catch (e) {
      console.error("Error sharing training:", e);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="dialog__overlay" onClick={onClose}>
      <div
        className="dialog dialog--share"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__header">
          <h3 className="dialog__title">Share training</h3>
          <button className="dialog__close" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="dialog__body">
          Select teammates to share <strong>{training.title}</strong> with. It
          will appear in their training list with you as the author.
        </p>

        {loadingUsers ? (
          <div className="share__loading">Loading teammates...</div>
        ) : users.length === 0 ? (
          <div className="share__empty">No other users found.</div>
        ) : (
          <div className="share__user__list">
            {users.map((user) => {
              const isSelected = selected.has(user.uid);
              return (
                <button
                  key={user.uid}
                  className={`share__user ${isSelected ? "share__user--selected" : ""}`}
                  onClick={() => toggleUser(user.uid)}
                >
                  {user.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt={user.userName}
                      className="share__user__avatar"
                    />
                  ) : (
                    <div className="share__user__avatar share__user__avatar--initials">
                      {user.userName?.slice(0, 2).toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div className="share__user__info">
                    <span className="share__user__name">{user.userName}</span>
                    {user.team && (
                      <span className="share__user__team">{user.team}</span>
                    )}
                  </div>
                  <div
                    className={`share__user__check ${isSelected ? "share__user__check--active" : ""}`}
                  >
                    {isSelected && (
                      <svg
                        width="12"
                        height="10"
                        viewBox="0 0 14 11"
                        fill="none"
                      >
                        <path
                          d="M1 5L5 9L13 1"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="dialog__actions">
          <button className="btn__wired" onClick={onClose} disabled={sharing}>
            Cancel
          </button>
          <button
            className={`btn__primary ${shared ? "btn__primary--success" : ""}`}
            onClick={handleShare}
            disabled={sharing || selected.size === 0 || shared}
          >
            {shared ? (
              <>
                <svg width="14" height="12" viewBox="0 0 14 11" fill="none">
                  <path
                    d="M1 5L5 9L13 1"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Shared!
              </>
            ) : sharing ? (
              "Sharing..."
            ) : (
              <>
                Share with {selected.size > 0 ? `${selected.size} ` : ""}
                {selected.size === 1 ? "person" : "people"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const TrainingDetail = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const navigate = useNavigate();

  const currentUser = getAuth().currentUser;
  const currentUserId = currentUser?.uid ?? "";

  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [senderName, setSenderName] = useState<string>("");
  const [userTeam, setUserTeam] = useState<string>("");

  // Edit info
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Training>>({});

  // Edit exercises
  const [editingExercises, setEditingExercises] = useState(false);
  const [editExercises, setEditExercises] = useState<SelectedExercise[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Share
  const [shareOpen, setShareOpen] = useState(false);

  // Drag & drop refs
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // ── Fetch training ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trainingId || !currentUserId) return;
    const fetch = async () => {
      const snap = await getDoc(
        doc(db, "users", currentUserId, "trainings", trainingId),
      );
      if (snap.exists())
        setTraining({ id: snap.id, ...snap.data() } as Training);
      setLoading(false);
    };
    fetch();
  }, [trainingId, currentUserId]);

  // ── Resolve sender name + team ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, "users", currentUserId));
        if (snap.exists()) {
          const data = snap.data() as any;
          setSenderName(
            data.userName ?? currentUser?.email?.split("@")[0] ?? "Someone",
          );
          setUserTeam(data.team ?? "");
        }
      } catch {
        setSenderName(currentUser?.email?.split("@")[0] ?? "Someone");
      }
    };
    fetch();
  }, [currentUserId]);

  // ── Edit info ──────────────────────────────────────────────────────────────
  const handleEditStart = () => {
    if (!training) return;
    setEditData({
      title: training.title,
      description: training.description,
      duration: training.duration,
      tags: training.tags ?? [],
    });
    setEditing(true);
  };
  const handleEditCancel = () => {
    setEditing(false);
    setEditData({});
  };
  const handleEditChange = (field: keyof Training, value: unknown) =>
    setEditData((prev) => ({ ...prev, [field]: value }));
  const handleTagToggle = (tag: string) => {
    const current = editData.tags ?? [];
    handleEditChange(
      "tags",
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );
  };
  const handleSave = async () => {
    if (!trainingId || !training || !currentUserId) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "users", currentUserId, "trainings", trainingId),
        {
          title: editData.title ?? training.title,
          description: editData.description ?? training.description,
          duration: editData.duration ?? training.duration,
          tags: editData.tags ?? training.tags,
        },
      );
      setTraining((prev) => (prev ? { ...prev, ...editData } : prev));
      setEditing(false);
      setEditData({});
    } catch (e) {
      console.error("Error updating training:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit exercises ─────────────────────────────────────────────────────────
  const handleEditExercisesStart = () => {
    setEditExercises([...(training?.exercises ?? [])]);
    setEditingExercises(true);
  };
  const handleEditExercisesCancel = () => {
    setEditingExercises(false);
    setEditExercises([]);
    setAddOpen(false);
  };
  const handleExerciseDurationChange = (idx: number, val: string) =>
    setEditExercises((prev) =>
      prev.map((e, i) =>
        i === idx ? { ...e, duration: Math.max(0, parseInt(val) || 0) } : e,
      ),
    );
  const handleRemoveExercise = (idx: number) =>
    setEditExercises((prev) => prev.filter((_, i) => i !== idx));

  // Add a freshly-picked exercise to the edit list
  const handleAddExercise = (exercise: ExerciseDoc, duration: number) => {
    setEditExercises((prev) => [
      ...prev,
      { exerciseId: exercise.id, title: exercise.title, duration },
    ]);
  };

  const handleSaveExercises = async () => {
    if (!trainingId || !training || !currentUserId) return;
    setSaving(true);
    try {
      await updateDoc(
        doc(db, "users", currentUserId, "trainings", trainingId),
        {
          exercises: editExercises,
        },
      );
      setTraining((prev) =>
        prev ? { ...prev, exercises: editExercises } : prev,
      );
      setEditingExercises(false);
      setEditExercises([]);
      setAddOpen(false);
    } catch (e) {
      console.error("Error updating exercises:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Drag reorder ───────────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => {
    dragIndex.current = idx;
    setDraggingIdx(idx);
  };
  const handleDragEnter = (idx: number) => {
    dragOverIndex.current = idx;
    setDragOverIdx(idx);
  };
  const handleDragEnd = () => {
    const from = dragIndex.current,
      to = dragOverIndex.current;
    if (from !== null && to !== null && from !== to) {
      const arr = [...editExercises];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      setEditExercises(arr);
    }
    dragIndex.current = null;
    dragOverIndex.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!trainingId || !currentUserId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", currentUserId, "trainings", trainingId));
      navigate(-1);
    } catch (e) {
      console.error("Error deleting training:", e);
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (loading)
    return (
      <>
        <Navigation />
        <p style={{ padding: "4rem 11.2rem" }}>Loading...</p>
      </>
    );
  if (!training)
    return (
      <>
        <Navigation />
        <p style={{ padding: "4rem 11.2rem" }}>Training not found.</p>
      </>
    );

  const exercises = training.exercises ?? [];
  const totalPlanned = exercises.reduce((sum, e) => sum + (e.duration ?? 0), 0);
  const editPlanned = editExercises.reduce(
    (sum, e) => sum + (e.duration ?? 0),
    0,
  );
  const addedIds = new Set(editExercises.map((e) => e.exerciseId));

  return (
    <>
      <Navigation />
      <div className="trainingdetail section">
        <div className="trainingdetail__inner">
          {/* Back */}
          <div className="trainingdetail__back">
            <button className="btn__wired" onClick={() => navigate(-1)}>
              <svg width="23" height="12" viewBox="0 0 23 12" fill="none">
                <path
                  d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                  fill="black"
                />
              </svg>
              Back
            </button>
          </div>

          {/* Header card */}
          <div className="trainingdetail__header">
            <div className="trainingdetail__header__accent" />
            <div className="trainingdetail__header__body">
              <div className="trainingdetail__header__main">
                <div className="trainingdetail__header__text">
                  <div className="trainingdetail__meta">
                    <span className="trainingdetail__meta__date">
                      {formatDate(training.date)}
                    </span>
                    <span className="trainingdetail__meta__sep">·</span>
                    <span className="trainingdetail__meta__author">
                      {training.author}
                    </span>
                    {!editing && (
                      <>
                        <span className="trainingdetail__meta__sep">·</span>
                        <span className="trainingdetail__meta__duration">
                          {training.duration} min
                        </span>
                      </>
                    )}
                  </div>

                  {editing ? (
                    <>
                      <input
                        className="trainingdetail__edit__input trainingdetail__edit__input--title"
                        value={editData.title ?? ""}
                        onChange={(e) =>
                          handleEditChange("title", e.target.value)
                        }
                        placeholder="Training title"
                      />
                      <textarea
                        className="trainingdetail__edit__input trainingdetail__edit__input--description"
                        value={editData.description ?? ""}
                        onChange={(e) =>
                          handleEditChange("description", e.target.value)
                        }
                        placeholder="Description"
                        rows={3}
                      />
                      <div className="trainingdetail__edit__duration">
                        <label>Total duration</label>
                        <div className="trainingdetail__edit__duration__row">
                          <input
                            type="number"
                            className="trainingdetail__edit__input trainingdetail__edit__input--duration"
                            value={editData.duration ?? ""}
                            onChange={(e) =>
                              handleEditChange(
                                "duration",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            placeholder="90"
                            min={1}
                          />
                          <span>min</span>
                        </div>
                      </div>
                      <div className="trainingdetail__edit__tags">
                        {AVAILABLE_TAGS.map((tag) => (
                          <label
                            key={tag}
                            className={[
                              "tags",
                              `tags--${tag.toLowerCase()}`,
                              (editData.tags ?? []).includes(tag)
                                ? `tags--${tag.toLowerCase()}--active`
                                : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{ cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              style={{ display: "none" }}
                              checked={(editData.tags ?? []).includes(tag)}
                              onChange={() => handleTagToggle(tag)}
                            />
                            {tag}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <h1 className="trainingdetail__title">
                        {training.title}
                      </h1>
                      {training.description && (
                        <p className="trainingdetail__description">
                          {training.description}
                        </p>
                      )}
                      <div className="trainingdetail__tags">
                        {(training.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className={`tags tags--${tag.toLowerCase()}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="trainingdetail__header__actions">
                  {editing ? (
                    <>
                      <button
                        className="btn__wired"
                        onClick={handleEditCancel}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn__primary"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="trainingdetail__btn"
                        onClick={() => setShareOpen(true)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M4 12V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V12"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M12 2V15M12 2L8 6M12 2L16 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Share
                      </button>
                      <button
                        className="trainingdetail__btn"
                        onClick={() =>
                          window.open(
                            `/training-export/${trainingId}`,
                            "_blank",
                          )
                        }
                        title="Export as PDF"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M14 2V8H20"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 18V12M9 15L12 18L15 15"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Export
                      </button>
                      <button
                        className="trainingdetail__btn"
                        onClick={handleEditStart}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 18 24"
                          fill="none"
                        >
                          <path
                            d="M16.8756 21.5929H1.12977C0.831474 21.5929 0.545402 21.7198 0.334478 21.9454C0.123556 22.1711 0.00506036 22.4772 0.00506036 22.7964C0.00506036 23.1156 0.123556 23.4217 0.334478 23.6474C0.545402 23.873 0.831474 23.9999 1.12977 23.9999H16.8756C17.1739 23.9999 17.46 23.873 17.671 23.6474C17.8818 23.4217 18.0004 23.1156 18.0004 22.7964C18.0004 22.4772 17.8818 22.1711 17.671 21.9454C17.46 21.7198 17.1739 21.5929 16.8756 21.5929Z"
                            fill="currentColor"
                          />
                          <path
                            d="M1.12943 19.1861H1.23066L5.92067 18.7288C6.43444 18.674 6.91495 18.4318 7.28156 18.0428L17.404 7.21152C17.7968 6.76739 18.0091 6.17473 17.9944 5.5634C17.9796 4.95206 17.739 4.37192 17.3251 3.9501L14.2435 0.652573C13.8413 0.248321 13.3142 0.0163667 12.7626 0.000833716C12.211 -0.0146993 11.6733 0.187273 11.2518 0.568331L1.12943 11.3996C0.765888 11.7919 0.53953 12.3061 0.48835 12.8558L0.00472708 17.8744C-0.0104239 18.0505 0.0109516 18.2282 0.0673295 18.3947C0.123707 18.5611 0.2137 18.7122 0.330892 18.8371C0.435984 18.9486 0.56062 19.0369 0.69765 19.0968C0.834682 19.1567 0.981413 19.187 1.12943 19.1861ZM12.6802 2.33744L15.7506 5.62292L13.5012 7.9697L10.487 4.74439L12.6802 2.33744ZM2.67028 13.0604L9.00236 6.33298L12.0391 9.58236L5.74072 16.3218L2.3666 16.6588L2.67028 13.0604Z"
                            fill="currentColor"
                          />
                        </svg>
                        Edit
                      </button>
                      <button
                        className="trainingdetail__btn trainingdetail__btn--danger"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Players section */}
          {training.players && (
            <div className="trainingdetail__players">
              <h2 className="trainingdetail__players__title">
                Players
                <span>
                  {Object.values(training.players).reduce((s, v) => s + v, 0)}
                </span>
              </h2>
              <PlayerDisplay players={training.players} />
            </div>
          )}

          {/* Exercises section */}
          <div className="trainingdetail__exercises">
            <div className="trainingdetail__exercises__header">
              <div className="trainingdetail__exercises__header__left">
                <h2>
                  Exercises{" "}
                  <span>
                    (
                    {editingExercises ? editExercises.length : exercises.length}
                    )
                  </span>
                </h2>
                <DurationBar
                  planned={editingExercises ? editPlanned : totalPlanned}
                  total={training.duration}
                />
              </div>
              <div className="trainingdetail__exercises__header__actions">
                {editingExercises ? (
                  <>
                    <button
                      className="btn__wired"
                      onClick={handleEditExercisesCancel}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn__primary"
                      onClick={handleSaveExercises}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    className="trainingdetail__btn"
                    onClick={handleEditExercisesStart}
                  >
                    <svg width="16" height="16" viewBox="0 0 18 24" fill="none">
                      <path
                        d="M16.8756 21.5929H1.12977C0.831474 21.5929 0.545402 21.7198 0.334478 21.9454C0.123556 22.1711 0.00506036 22.4772 0.00506036 22.7964C0.00506036 23.1156 0.123556 23.4217 0.334478 23.6474C0.545402 23.873 0.831474 23.9999 1.12977 23.9999H16.8756C17.1739 23.9999 17.46 23.873 17.671 23.6474C17.8818 23.4217 18.0004 23.1156 18.0004 22.7964C18.0004 22.4772 17.8818 22.1711 17.671 21.9454C17.46 21.7198 17.1739 21.5929 16.8756 21.5929Z"
                        fill="currentColor"
                      />
                      <path
                        d="M1.12943 19.1861H1.23066L5.92067 18.7288C6.43444 18.674 6.91495 18.4318 7.28156 18.0428L17.404 7.21152C17.7968 6.76739 18.0091 6.17473 17.9944 5.5634C17.9796 4.95206 17.739 4.37192 17.3251 3.9501L14.2435 0.652573C13.8413 0.248321 13.3142 0.0163667 12.7626 0.000833716C12.211 -0.0146993 11.6733 0.187273 11.2518 0.568331L1.12943 11.3996C0.765888 11.7919 0.53953 12.3061 0.48835 12.8558L0.00472708 17.8744C-0.0104239 18.0505 0.0109516 18.2282 0.0673295 18.3947C0.123707 18.5611 0.2137 18.7122 0.330892 18.8371C0.435984 18.9486 0.56062 19.0369 0.69765 19.0968C0.834682 19.1567 0.981413 19.187 1.12943 19.1861ZM12.6802 2.33744L15.7506 5.62292L13.5012 7.9697L10.487 4.74439L12.6802 2.33744ZM2.67028 13.0604L9.00236 6.33298L12.0391 9.58236L5.74072 16.3218L2.3666 16.6588L2.67028 13.0604Z"
                        fill="currentColor"
                      />
                    </svg>
                    Edit exercises
                  </button>
                )}
              </div>
            </div>

            {(
              editingExercises
                ? editExercises.length === 0
                : exercises.length === 0
            ) ? (
              <p className="trainingdetail__exercises__empty">
                No exercises added yet.
              </p>
            ) : (
              <div className="trainingdetail__exercises__list">
                {(editingExercises ? editExercises : exercises).map(
                  (ex: SelectedExercise, index: number) =>
                    editingExercises ? (
                      <div
                        key={`${ex.exerciseId}-${index}`}
                        className={[
                          "trainingdetail__exercises__item",
                          "trainingdetail__exercises__item--edit",
                          draggingIdx === index
                            ? "trainingdetail__exercises__item--dragging"
                            : "",
                          dragOverIdx === index && draggingIdx !== index
                            ? "trainingdetail__exercises__item--dragover"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        <div className="trainingdetail__exercises__item__handle">
                          <svg
                            width="14"
                            height="12"
                            viewBox="0 0 14 12"
                            fill="none"
                          >
                            <path
                              d="M1 1H13"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M1 6H13"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M1 11H13"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <span className="trainingdetail__exercises__item__index">
                          {index + 1}
                        </span>
                        <h3 className="trainingdetail__exercises__item__title">
                          {ex.title}
                        </h3>
                        <div className="trainingdetail__exercises__item__duration">
                          <input
                            type="number"
                            min={0}
                            value={ex.duration || ""}
                            placeholder="0"
                            onChange={(e) =>
                              handleExerciseDurationChange(
                                index,
                                e.target.value,
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span>min</span>
                        </div>
                        <button
                          className="trainingdetail__exercises__item__remove"
                          onClick={() => handleRemoveExercise(index)}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <Link
                        key={ex.exerciseId}
                        to={`/exercise-detail/${ex.exerciseId}`}
                        className="trainingdetail__exercises__item"
                      >
                        <span className="trainingdetail__exercises__item__index">
                          {index + 1}
                        </span>
                        <h3 className="trainingdetail__exercises__item__title">
                          {ex.title}
                        </h3>
                        <span className="trainingdetail__exercises__item__duration__pill">
                          {ex.duration} min
                        </span>
                        <svg
                          className="trainingdetail__exercises__item__arrow"
                          width="16"
                          height="10"
                          viewBox="0 0 23 12"
                          fill="none"
                        >
                          <path
                            d="M1 5.25004H0.25V6.75004H1V5.25004ZM22.5303 6.53037C22.8232 6.23748 22.8232 5.7626 22.5303 5.46971L17.7574 0.696739C17.4645 0.403839 16.9896 0.403839 16.6967 0.696739C16.4038 0.989639 16.4038 1.46454 16.6967 1.75744L20.9393 6.00004L16.6967 10.2427C16.4038 10.5356 16.4038 11.0104 16.6967 11.3033C16.9896 11.5962 17.4645 11.5962 17.7574 11.3033L22.5303 6.53037ZM1 6.75004L22 6.75004V5.25004L1 5.25004V6.75004Z"
                            fill="currentColor"
                          />
                        </svg>
                      </Link>
                    ),
                )}

                {/* Add-exercise button — only in edit mode */}
                {editingExercises && (
                  <button
                    className="trainingdetail__exercises__add btn__wired"
                    onClick={() => setAddOpen(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M7 1V13M1 7H13"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    Add exercise
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add-exercise dialog */}
      {addOpen && (
        <AddExerciseDialog
          userTeam={userTeam}
          alreadyAddedIds={addedIds}
          onAdd={handleAddExercise}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Share dialog */}
      {shareOpen && training && (
        <ShareDialog
          training={training}
          currentUserId={currentUserId}
          senderName={senderName}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Delete dialog */}
      {deleteConfirm && (
        <div
          className="dialog__overlay"
          onClick={() => !deleting && setDeleteConfirm(false)}
        >
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog__title">Delete training?</h3>
            <p className="dialog__body">
              <strong>{training.title}</strong> will be permanently deleted.
              This cannot be undone.
            </p>
            <div className="dialog__actions">
              <button
                className="btn__wired"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn__danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TrainingDetail;
