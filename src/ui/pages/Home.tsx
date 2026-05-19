import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import SketchThumbnail from "../components/sketch/Sketchthumbnail";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";
import db from "../../firebase";
import type { Exercise } from "../../types/Exercise";
import type { Training } from "../../types/Training";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedTraining extends Training {
  sharedBy: string;
  sharedByName?: string;
  sharedAt?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: any): string => {
  if (!date) return "—";
  const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const Skeleton = () => (
  <div className="home__skeleton">
    <div className="home__skeleton__line home__skeleton__line--short" />
    <div className="home__skeleton__line" />
    <div className="home__skeleton__line home__skeleton__line--medium" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || { currentUser: null };

  const userData = useGetUserData(currentUser?.uid ?? "");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [sharedTrainings, setSharedTrainings] = useState<SharedTraining[]>([]);
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>(
    {},
  );
  const [loadingEx, setLoadingEx] = useState(true);
  const [loadingTr, setLoadingTr] = useState(true);
  const [loadingSh, setLoadingSh] = useState(true);

  // ── Fetch recent exercises + their variant counts ──────────────────────────
  useEffect(() => {
    if (userData === undefined) return; // wait for profile to load

    const fetch = async () => {
      try {
        const userTeam = userData?.team ?? "";
        const q = userTeam
          ? query(
              collection(db, "Excercises"),
              where("team", "==", userTeam),
              orderBy("createdAt", "desc"),
              limit(4),
            )
          : query(
              collection(db, "Excercises"),
              orderBy("createdAt", "desc"),
              limit(4),
            );
        const snap = await getDocs(q);
        const data = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Exercise,
        );
        setExercises(data);

        // Batch-fetch variant groups
        const groupIds = [
          ...new Set(
            data
              .map((ex) => (ex as any).variantGroupId as string | undefined)
              .filter(Boolean) as string[],
          ),
        ];
        if (groupIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < groupIds.length; i += 30)
            chunks.push(groupIds.slice(i, i + 30));
          const counts: Record<string, number> = {};
          await Promise.all(
            chunks.map(async (chunk) => {
              const vq = query(
                collection(db, "ExerciseVariants"),
                where("__name__", "in", chunk),
              );
              const vsnap = await getDocs(vq);
              vsnap.docs.forEach((d) => {
                const ids: string[] = d.data().exerciseIds ?? [];
                ids.forEach((eid) => {
                  counts[eid] = ids.length - 1;
                });
              });
            }),
          );
          setVariantCounts(counts);
        }
      } catch {
        const userTeam = userData?.team ?? "";
        const q = userTeam
          ? query(
              collection(db, "Excercises"),
              where("team", "==", userTeam),
              limit(2),
            )
          : query(collection(db, "Excercises"), limit(4));
        const snap = await getDocs(q);
        setExercises(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exercise),
        );
      } finally {
        setLoadingEx(false);
      }
    };
    fetch();
  }, [userData]);

  // ── Fetch user's own trainings ─────────────────────────────────────────────
  useEffect(() => {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      setLoadingTr(false);
      return;
    }
    const fetch = async () => {
      try {
        const q = query(
          collection(db, "users", userId, "trainings"),
          where("sharedBy", "==", null),
          orderBy("createdAt", "desc"),
          limit(3),
        );
        const snap = await getDocs(q);
        setTrainings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Training),
        );
      } catch {
        const snap = await getDocs(
          query(collection(db, "users", userId, "trainings"), limit(20)),
        );
        setTrainings(
          snap.docs
            .map(
              (d) =>
                ({ id: d.id, ...d.data() }) as Training & { sharedBy?: string },
            )
            .filter((t) => !t.sharedBy)
            .slice(0, 3),
        );
      } finally {
        setLoadingTr(false);
      }
    };
    fetch();
  }, []);

  // ── Fetch trainings shared with the user ───────────────────────────────────
  useEffect(() => {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      setLoadingSh(false);
      return;
    }
    const fetch = async () => {
      try {
        const q = query(
          collection(db, "users", userId, "trainings"),
          where("sharedBy", "!=", null),
          orderBy("sharedBy"),
          orderBy("sharedAt", "desc"),
          limit(4),
        );
        const snap = await getDocs(q);
        const raw = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as SharedTraining,
        );
        const senderIds = [
          ...new Set(raw.map((t) => t.sharedBy).filter(Boolean)),
        ];
        const senderMap: Record<string, string> = {};
        await Promise.all(
          senderIds.map(async (uid) => {
            try {
              const { getDoc, doc } = await import("firebase/firestore");
              const senderDoc = await getDoc(doc(db, "users", uid));
              if (senderDoc.exists())
                senderMap[uid] = (senderDoc.data() as any).userName ?? uid;
            } catch {
              senderMap[uid] = uid;
            }
          }),
        );
        setSharedTrainings(
          raw.map((t) => ({
            ...t,
            sharedByName: senderMap[t.sharedBy] ?? t.sharedBy,
          })),
        );
      } catch {
        try {
          const snap = await getDocs(
            query(
              collection(db, "users", getAuth().currentUser!.uid, "trainings"),
              limit(30),
            ),
          );
          setSharedTrainings(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as SharedTraining)
              .filter((t) => !!t.sharedBy)
              .slice(0, 4),
          );
        } catch {
          setSharedTrainings([]);
        }
      } finally {
        setLoadingSh(false);
      }
    };
    fetch();
  }, []);

  const firstName = userData?.userName?.split(" ")[0] ?? "Coach";

  return (
    <>
      <Navigation />
      <div className="home">
        {/* Hero */}
        <div className="home__hero">
          <div className="home__hero__text">
            <p className="home__hero__greeting">{getGreeting()}</p>
            <h1 className="home__hero__name">
              {firstName}
              <span className="home__hero__dot">.</span>
            </h1>
            <p className="home__hero__sub">Here's what's on the board today.</p>
          </div>
          <div className="home__hero__stripes" aria-hidden="true">
            <div className="home__hero__stripe home__hero__stripe--1" />
            <div className="home__hero__stripe home__hero__stripe--2" />
            <div className="home__hero__stripe home__hero__stripe--3" />
            <div className="home__hero__stripe home__hero__stripe--4" />
            <div className="home__hero__stripe home__hero__stripe--5" />
          </div>
        </div>

        {/* Grid */}
        <div className="home__grid">
          {/* My trainings */}
          <section className="home__widget home__widget--trainings">
            <div className="home__widget__header">
              <h2 className="home__widget__title">My Trainings</h2>
              <button
                className="home__widget__link"
                onClick={() => navigate("/training-overview")}
              >
                View all →
              </button>
            </div>
            {loadingTr ? (
              <Skeleton />
            ) : trainings.length === 0 ? (
              <div className="home__widget__empty">
                <p>No trainings yet.</p>
                <button
                  className="home__widget__cta"
                  onClick={() => navigate("/create-training")}
                >
                  + Plan a training
                </button>
              </div>
            ) : (
              <div className="home__trainings__list">
                {trainings.map((tr) => (
                  <div
                    key={tr.id}
                    className="home__training__row"
                    onClick={() => navigate(`/training-detail/${tr.id}`)}
                  >
                    <div className="home__training__row__accent" />
                    <div className="home__training__row__info">
                      <span className="home__training__row__title">
                        {tr.title}
                      </span>
                      <span className="home__training__row__meta">
                        {formatDate(tr.date)} · {tr.duration} min
                      </span>
                    </div>
                    <div className="home__training__row__tags">
                      {(tr.tags ?? []).slice(0, 1).map((tag) => (
                        <span
                          key={tag}
                          className={`tags tags--${tag.toLowerCase()}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  className="home__trainings__new"
                  onClick={() => navigate("/create-training")}
                >
                  + New training
                </button>
              </div>
            )}
          </section>

          {/* Recent exercises */}
          <section className="home__widget home__widget--exercises">
            <div className="home__widget__header">
              <h2 className="home__widget__title">Recent Exercises</h2>
              <button
                className="home__widget__link"
                onClick={() => navigate("/exercise-overview")}
              >
                View all →
              </button>
            </div>
            {loadingEx ? (
              <Skeleton />
            ) : exercises.length === 0 ? (
              <div className="home__widget__empty">
                <p>No exercises yet.</p>
                <button
                  className="home__widget__cta"
                  onClick={() => navigate("/create-exercise")}
                >
                  + Add your first exercise
                </button>
              </div>
            ) : (
              <div className="home__exercises__grid">
                {exercises.map((ex) => {
                  const vc = variantCounts[ex.id!] ?? 0;
                  return (
                    <div
                      key={ex.id}
                      className="home__exercise__card"
                      onClick={() => navigate(`/exercise-detail/${ex.id}`)}
                    >
                      {/* Variant badge */}
                      {vc > 0 && (
                        <div
                          className="home__exercise__card__variants"
                          title={`${vc} variant${vc !== 1 ? "s" : ""}`}
                        >
                          {vc}
                        </div>
                      )}
                      <div className="home__exercise__card__sketch">
                        {ex.sketch ? (
                          <SketchThumbnail sketch={ex.sketch} />
                        ) : (
                          <div className="home__exercise__card__sketch__empty" />
                        )}
                      </div>
                      <div className="home__exercise__card__body">
                        <h4 className="home__exercise__card__name">
                          {ex.title}
                        </h4>
                        <div className="home__exercise__card__tags">
                          {(ex.tags ?? []).slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className={`tags tags--${tag.toLowerCase()}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Shared with me */}
          <section className="home__widget home__widget--shared">
            <div className="home__widget__header">
              <h2 className="home__widget__title">Shared with me</h2>
              <span className="home__widget__badge">Team</span>
            </div>
            <p className="home__widget__desc">
              Trainings your teammates have shared with you.
            </p>
            {loadingSh ? (
              <Skeleton />
            ) : sharedTrainings.length === 0 ? (
              <div className="home__widget__empty">
                <p>No shared trainings yet.</p>
                <p className="home__widget__empty__hint">
                  When a teammate shares a training with you it will appear
                  here.
                </p>
              </div>
            ) : (
              <div className="home__shared__list">
                {sharedTrainings.map((tr) => (
                  <div
                    key={tr.id}
                    className="home__shared__card"
                    onClick={() => navigate(`/training-detail/${tr.id}`)}
                  >
                    <div className="home__shared__card__top">
                      <div className="home__shared__card__author">
                        <div className="home__shared__card__avatar home__shared__card__avatar--initials">
                          {(tr.sharedByName ?? tr.sharedBy)
                            ?.slice(0, 2)
                            .toUpperCase() ?? "?"}
                        </div>
                        <span className="home__shared__card__author__name">
                          {tr.sharedByName ?? tr.author ?? tr.sharedBy}
                        </span>
                      </div>
                      <span className="home__shared__card__date">
                        {formatDate(tr.sharedAt ?? tr.date)}
                      </span>
                    </div>
                    <h4 className="home__shared__card__title">{tr.title}</h4>
                    <div className="home__shared__card__meta">
                      <span>{tr.duration} min</span>
                      <span>·</span>
                      <span>{(tr.exercises ?? []).length} exercises</span>
                    </div>
                    <div className="home__shared__card__tags">
                      {(tr.tags ?? []).map((tag) => (
                        <span
                          key={tag}
                          className={`tags tags--${tag.toLowerCase()}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
