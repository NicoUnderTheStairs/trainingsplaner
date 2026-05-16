import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { doc, getDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Navigation from "../components/navigation/Navigation";
import type { Training } from "../../types/Training";
import type { SelectedExercise } from "../components/trainingwizard/exerciseSelection";
import db from "../../firebase";

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

// ─── Component ────────────────────────────────────────────────────────────────

const TrainingDetail = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const navigate = useNavigate();

  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<Training>>({});

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trainingId) return;
    const fetch = async () => {
      const userId = getAuth().currentUser?.uid;
      if (!userId) return;
      const snap = await getDoc(
        doc(db, "users", userId, "trainings", trainingId),
      );
      if (snap.exists())
        setTraining({ id: snap.id, ...snap.data() } as Training);
      setLoading(false);
    };
    fetch();
  }, [trainingId]);

  // ── Edit ─────────────────────────────────────────────────────────────────
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

  const handleEditChange = (field: keyof Training, value: unknown) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTagToggle = (tag: string) => {
    const current = editData.tags ?? [];
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    handleEditChange("tags", updated);
  };

  const handleSave = async () => {
    if (!trainingId || !training) return;
    setSaving(true);
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;
    try {
      await updateDoc(doc(db, "users", userId, "trainings", trainingId), {
        title: editData.title ?? training.title,
        description: editData.description ?? training.description,
        duration: editData.duration ?? training.duration,
        tags: editData.tags ?? training.tags,
      });
      setTraining((prev) => (prev ? { ...prev, ...editData } : prev));
      setEditing(false);
      setEditData({});
    } catch (e) {
      console.error("Error updating training:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!trainingId) return;
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "users", userId, "trainings", trainingId));
      navigate(-1);
    } catch (e) {
      console.error("Error deleting training:", e);
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!training) return <p>Training not found.</p>;

  const totalPlanned = (training.exercises ?? []).reduce(
    (sum, e) => sum + (e.duration ?? 0),
    0,
  );

  return (
    <>
      <Navigation />
      <div className="trainingdetail section">
        <div className="trainingdetail__inner">
          {/* Back */}
          <div className="trainingdetail__back">
            <button className="btn__wired" onClick={() => navigate(-1)}>
              <svg
                width="23"
                height="12"
                viewBox="0 0 23 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                  fill="black"
                />
              </svg>
              Back
            </button>
          </div>

          {/* Header */}
          <div className="trainingdetail__menu">
            <div className="trainingdetail__menu__text">
              {/* Title */}
              {editing ? (
                <input
                  className="trainingdetail__edit__input trainingdetail__edit__input--title"
                  value={editData.title ?? ""}
                  onChange={(e) => handleEditChange("title", e.target.value)}
                  placeholder="Title"
                />
              ) : (
                <div>
                  {/* Meta row */}
                  <div className="trainingdetail__meta">
                    <span className="trainingdetail__meta__date">
                      {formatDate(training.date)}
                    </span>
                    <span className="trainingdetail__meta__author">
                      {training.author}
                    </span>
                    {editing ? (
                      <div className="trainingdetail__meta__duration__edit">
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
                          placeholder="Duration"
                          min={1}
                        />
                        <span>min total</span>
                      </div>
                    ) : (
                      <span className="trainingdetail__meta__duration">
                        {training.duration} min
                      </span>
                    )}
                  </div>
                  <h1>{training.title}</h1>
                </div>
              )}

              {/* Description */}
              {editing ? (
                <textarea
                  className="trainingdetail__edit__input trainingdetail__edit__input--description"
                  value={editData.description ?? ""}
                  onChange={(e) =>
                    handleEditChange("description", e.target.value)
                  }
                  placeholder="Description"
                  rows={3}
                />
              ) : (
                training.description && <p>{training.description}</p>
              )}

              {/* Tags */}
              <div className="trainingdetail__tags">
                {editing ? (
                  <div className="trainingdetail__edit__tags">
                    {[
                      "Warmup",
                      "Defense",
                      "Attack",
                      "Block",
                      "Reception",
                      "Service",
                    ].map((tag) => (
                      <label
                        key={tag}
                        className={[
                          "excercisewizard__tags__option",
                          `excercisewizard__tags--${tag.toLowerCase()}`,
                          (editData.tags ?? []).includes(tag)
                            ? `excercisewizard__tags--${tag.toLowerCase()}--active`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <input
                          type="checkbox"
                          className="excercisewizard__tags__checkbox"
                          checked={(editData.tags ?? []).includes(tag)}
                          onChange={() => handleTagToggle(tag)}
                        />
                        <span className="excercisewizard__tags__label">
                          {tag}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  (training.tags ?? []).map((tag) => (
                    <div
                      key={tag}
                      className={`tags tags--${tag.toLowerCase()}`}
                    >
                      <span>{tag}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="trainingdetail__menu__btn__wrapper">
              {editing ? (
                <>
                  <button
                    className="trainingdetail__menu__btn"
                    onClick={handleEditCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    className="trainingdetail__menu__btn trainingdetail__menu__btn--save"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="trainingdetail__menu__btn"
                    onClick={handleEditStart}
                    title="Edit training"
                  >
                    <svg
                      width="18"
                      height="24"
                      viewBox="0 0 18 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16.8756 21.5929H1.12977C0.831474 21.5929 0.545402 21.7198 0.334478 21.9454C0.123556 22.1711 0.00506036 22.4772 0.00506036 22.7964C0.00506036 23.1156 0.123556 23.4217 0.334478 23.6474C0.545402 23.873 0.831474 23.9999 1.12977 23.9999H16.8756C17.1739 23.9999 17.46 23.873 17.671 23.6474C17.8818 23.4217 18.0004 23.1156 18.0004 22.7964C18.0004 22.4772 17.8818 22.1711 17.671 21.9454C17.46 21.7198 17.1739 21.5929 16.8756 21.5929Z"
                        fill="#1E1E1E"
                      />
                      <path
                        d="M1.12943 19.1861H1.23066L5.92067 18.7288C6.43444 18.674 6.91495 18.4318 7.28156 18.0428L17.404 7.21152C17.7968 6.76739 18.0091 6.17473 17.9944 5.5634C17.9796 4.95206 17.739 4.37192 17.3251 3.9501L14.2435 0.652573C13.8413 0.248321 13.3142 0.0163667 12.7626 0.000833716C12.211 -0.0146993 11.6733 0.187273 11.2518 0.568331L1.12943 11.3996C0.765888 11.7919 0.53953 12.3061 0.48835 12.8558L0.00472708 17.8744C-0.0104239 18.0505 0.0109516 18.2282 0.0673295 18.3947C0.123707 18.5611 0.2137 18.7122 0.330892 18.8371C0.435984 18.9486 0.56062 19.0369 0.69765 19.0968C0.834682 19.1567 0.981413 19.187 1.12943 19.1861ZM12.6802 2.33744L15.7506 5.62292L13.5012 7.9697L10.487 4.74439L12.6802 2.33744ZM2.67028 13.0604L9.00236 6.33298L12.0391 9.58236L5.74072 16.3218L2.3666 16.6588L2.67028 13.0604Z"
                        fill="#1E1E1E"
                      />
                    </svg>
                  </button>
                  <button
                    className="trainingdetail__menu__btn trainingdetail__menu__btn--danger"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Exercise list ── */}
          <div className="trainingdetail__exercises">
            <div className="trainingdetail__exercises__header">
              <h2>Exercises</h2>
              <p className="trainingdetail__exercises__header--duration">
                {totalPlanned} / {training.duration} min planned
              </p>
            </div>

            {(training.exercises ?? []).length === 0 ? (
              <p className="trainingdetail__exercises__empty">
                No exercises added to this training.
              </p>
            ) : (
              <div className="trainingdetail__exercises__list">
                {(training.exercises ?? []).map(
                  (ex: SelectedExercise, index: number) => (
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

                      <span className="trainingdetail__exercises__item__duration">
                        {ex.duration} min
                      </span>

                      {/* Arrow */}
                      <svg
                        className="trainingdetail__exercises__item__arrow"
                        width="16"
                        height="10"
                        viewBox="0 0 23 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 5.25004H0.25V6.75004H1V5.25004ZM22.5303 6.53037C22.8232 6.23748 22.8232 5.7626 22.5303 5.46971L17.7574 0.696739C17.4645 0.403839 16.9896 0.403839 16.6967 0.696739C16.4038 0.989639 16.4038 1.46454 16.6967 1.75744L20.9393 6.00004L16.6967 10.2427C16.4038 10.5356 16.4038 11.0104 16.6967 11.3033C16.9896 11.5962 17.4645 11.5962 17.7574 11.3033L22.5303 6.53037ZM1 6.75004L22 6.75004V5.25004L1 5.25004V6.75004Z"
                          fill="currentColor"
                        />
                      </svg>
                    </Link>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete confirmation dialog ── */}
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
