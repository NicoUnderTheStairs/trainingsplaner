import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";
import type { Training } from "../../../types/Training";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: string | Timestamp | Date): string => {
  if (!date) return "—";
  // Handle Firestore Timestamp
  if (typeof (date as Timestamp).toDate === "function") {
    return (date as Timestamp).toDate().toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return new Date(date as string).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// ─── Component ────────────────────────────────────────────────────────────────

const TrainingList = () => {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrainings = async () => {
      try {
        const userId = getAuth().currentUser?.uid;
        if (!userId) throw new Error("Not authenticated");

        const snapshot = await getDocs(
          collection(db, "users", userId, "trainings"),
        );
        const data: Training[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Training, "id">),
        }));

        // Sort by date descending — most recent first
        data.sort((a, b) => {
          const dateA = (a.date as any)?.toDate?.() ?? new Date(a.date);
          const dateB = (b.date as any)?.toDate?.() ?? new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });

        setTrainings(data);
      } catch (e) {
        console.error("Error fetching trainings:", e);
        setError("Failed to load trainings.");
      } finally {
        setLoading(false);
      }
    };

    fetchTrainings();
  }, []);

  const formatDate = (date: string | Timestamp | Date): string => {
    if (!date) return "—";

    const d =
      typeof (date as Timestamp).toDate === "function"
        ? (date as Timestamp).toDate()
        : new Date(date as string);

    const weekday = d.toLocaleDateString("en-GB", { weekday: "long" }); // "Tuesday"
    const dayMonth = d.toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "2-digit",
    }); // "12.02"

    return `${weekday}, ${dayMonth}`;
  };

  return (
    <div className="traininglist section">
      <div className="traininglist__inner">
        {/* Back button */}
        <div className="exercisedetail__back">
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
        <div className="traininglist__menu">
          <h2>My Trainings</h2>
          <button
            className="btn__primary"
            onClick={() => navigate("/create-training")}
          >
            Create Training
          </button>
        </div>

        {/* States */}
        {loading && <p className="traininglist__status">Loading...</p>}
        {error && (
          <p className="traininglist__status traininglist__status--error">
            {error}
          </p>
        )}

        {/* List */}
        {!loading && !error && (
          <>
            {trainings.length === 0 ? (
              <p className="traininglist__status">No trainings yet.</p>
            ) : (
              <div className="traininglist__list">
                {/* Rows */}
                {trainings.map((training) => (
                  <div
                    key={training.id}
                    className="traininglist__list__row"
                    onClick={() => navigate(`/training-detail/${training.id}`)}
                  >
                    <h3 className="traininglist__list__row__cell traininglist__list__row__cell--title">
                      <span className="traininglist__list__row__cell traininglist__list__row__cell--author">
                        {training.author || "—"}
                      </span>
                      {training.title || "—"}
                    </h3>

                    <div>
                      <p className="traininglist__list__row__cell traininglist__list__row__cell--date">
                        {formatDate(training.date)}
                      </p>

                      <span className="traininglist__list__row__cell traininglist__list__row__cell--duration">
                        {training.duration ? `${training.duration} min` : "—"}
                      </span>
                    </div>

                    <div className="traininglist__list__row__cell traininglist__list__row__cell--tags">
                      {(training.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className={`tags tags--${tag.toLowerCase()}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Arrow */}
                    <div className="traininglist__list__row__cell traininglist__list__row__cell--action">
                      <svg
                        width="23"
                        height="12"
                        viewBox="0 0 23 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 5.25004H0.25V6.75004H1V5.25004ZM22.5303 6.53037C22.8232 6.23748 22.8232 5.7626 22.5303 5.46971L17.7574 0.696739C17.4645 0.403839 16.9896 0.403839 16.6967 0.696739C16.4038 0.989639 16.4038 1.46454 16.6967 1.75744L20.9393 6.00004L16.6967 10.2427C16.4038 10.5356 16.4038 11.0104 16.6967 11.3033C16.9896 11.5962 17.4645 11.5962 17.7574 11.3033L22.5303 6.53037ZM1 6.75004L22 6.75004V5.25004L1 5.25004V6.75004Z"
                          fill="black"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TrainingList;
