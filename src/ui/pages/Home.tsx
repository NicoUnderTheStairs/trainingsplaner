import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  limit,
  orderBy,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import SketchThumbnail from "../components/sketch/Sketchthumbnail";
import Tour from "../components/user/Tour";
import { useAuth } from "../../auth/authContext";
import { useGetUserData } from "../../hooks/useGetUserData";
import db from "../../firebase";
import type { Exercise } from "../../types/Exercise";
import type { Training } from "../../types/Training";
import type { Match } from "../../types/Match";
import type { SharedTrainingRef } from "../../services/upload/registerUser";
import { useTeamId } from "../../hooks/useTeamId";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedTraining extends Training {
  ownerId: string;
  sharedBy: string;
  sharedByName?: string;
  sharedAt?: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (date: any): string => {
  if (!date) return "—";
  const d = typeof date.toDate === "function" ? date.toDate() : new Date(date);
  return d.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const TrainingWidgetSkeleton = () => (
  <div className="sk-stack" style={{ gap: "1rem" }}>
    <div className="sk-row" style={{ padding: "1.4rem 1.6rem", border: "0.2rem solid rgba(30,30,30,0.1)", borderRadius: "1.2rem" }}>
      <span className="sk sk--rect" style={{ width: "0.5rem", height: "4.4rem", flexShrink: 0 }} />
      <div className="sk-stack" style={{ flex: 1, gap: "0.5rem" }}>
        <span className="sk sk--line sk--w65" />
        <span className="sk sk--line sk--w40" />
      </div>
      <span className="sk sk--rect" style={{ width: "5.6rem", height: "2rem", flexShrink: 0 }} />
    </div>
  </div>
);

const ExerciseWidgetSkeleton = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.2rem" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ display: "flex", flexDirection: "column", border: "0.2rem solid rgba(30,30,30,0.1)", borderRadius: "1.4rem", overflow: "hidden" }}>
        <span className="sk sk--rect" style={{ height: "9rem", width: "100%", borderRadius: 0 }} />
        <div className="sk-stack" style={{ padding: "0.8rem 1.2rem 1.2rem", gap: "0.5rem" }}>
          <span className="sk sk--line sk--w75" />
          <span className="sk sk--line sk--w40" />
        </div>
      </div>
    ))}
  </div>
);

const SharedWidgetSkeleton = () => (
  <div className="sk-stack" style={{ gap: "1rem" }}>
    {[0, 1].map((i) => (
      <div key={i} className="sk-row" style={{ padding: "1.4rem 1.6rem", border: "0.2rem solid rgba(30,30,30,0.1)", borderRadius: "1.2rem" }}>
        <span className="sk sk--circle" style={{ width: "3.6rem", height: "3.6rem", flexShrink: 0 }} />
        <div className="sk-stack" style={{ flex: 1, gap: "0.5rem" }}>
          <span className="sk sk--line sk--w55" />
          <span className="sk sk--line sk--w30" />
        </div>
      </div>
    ))}
  </div>
);

const MatchWidgetSkeleton = () => (
  <div className="sk-stack" style={{ gap: "1rem" }}>
    {[0, 1].map((i) => (
      <div key={i} className="sk-row" style={{ padding: "1.4rem 1.6rem", border: "0.2rem solid rgba(30,30,30,0.1)", borderRadius: "1.2rem" }}>
        <span className="sk sk--rect" style={{ width: "0.5rem", height: "4.4rem", flexShrink: 0 }} />
        <div className="sk-stack" style={{ flex: 1, gap: "0.5rem" }}>
          <span className="sk sk--line sk--w65" />
          <span className="sk sk--line sk--w40" />
        </div>
        <span className="sk sk--rect" style={{ width: "5rem", height: "2rem", flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || { currentUser: null };
  // @ts-ignore
  const userData = useGetUserData(currentUser?.uid ?? "");
  const teamId = useTeamId();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [sharedTrainings, setSharedTrainings] = useState<SharedTraining[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [variantCounts, setVariantCounts] = useState<Record<string, number>>(
    {},
  );
  const [loadingEx, setLoadingEx] = useState(true);
  const [loadingTr, setLoadingTr] = useState(true);
  const [loadingSh, setLoadingSh] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (userData && !userData.tourCompleted) {
      setShowTour(true);
    }
  }, [userData]);

  // ── Fetch recent exercises + their variant counts ──────────────────────────
  useEffect(() => {
    if (userData === undefined) return; // wait for profile to load

    const fetch = async () => {
      try {
        const userTeam = userData?.team ?? "";
        const q = userTeam
          ? query(
              collection(db, "Excercises"),
              where("team", "array-contains", userTeam),
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
              where("team", "array-contains", userTeam),
              limit(4),
            )
          : query(collection(db, "Excercises"), limit(2));
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
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      try {
        const q = query(
          collection(db, "users", userId, "trainings"),
          where("sharedBy", "==", null),
          where("date", ">=", now),
          orderBy("date", "asc"),
          limit(1),
        );
        const snap = await getDocs(q);
        setTrainings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Training),
        );
      } catch {
        const snap = await getDocs(
          query(collection(db, "users", userId, "trainings"), limit(50)),
        );
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Training & { sharedBy?: string; date?: any },
        );
        const upcoming = all
          .filter((t) => {
            if (t.sharedBy) return false;
            if (!t.date) return false;
            const d = typeof t.date.toDate === "function" ? t.date.toDate() : new Date(t.date);
            return d >= now;
          })
          .sort((a, b) => {
            const da = typeof a.date?.toDate === "function" ? a.date.toDate() : new Date(a.date);
            const db2 = typeof b.date?.toDate === "function" ? b.date.toDate() : new Date(b.date);
            return da - db2;
          });
        setTrainings(upcoming.slice(0, 1));
      } finally {
        setLoadingTr(false);
      }
    };
    fetch();
  }, []);

  // ── Fetch trainings shared with the user ───────────────────────────────────
  useEffect(() => {
    if (userData === undefined) return; // wait for profile
    const refs: SharedTrainingRef[] = userData?.sharedWithMe ?? [];
    if (refs.length === 0) {
      setSharedTrainings([]);
      setLoadingSh(false);
      return;
    }
    const fetch = async () => {
      try {
        const sorted = [...refs]
          .sort((a, b) => {
            const ta = a.sharedAt?.toDate?.() ?? new Date(a.sharedAt ?? 0);
            const tb = b.sharedAt?.toDate?.() ?? new Date(b.sharedAt ?? 0);
            return tb - ta;
          })
          .slice(0, 4);

        // Fetch the owner's name for each unique ownerId
        const ownerIds = [...new Set(sorted.map((r) => r.ownerId))];
        const ownerNames: Record<string, string> = {};
        await Promise.all(
          ownerIds.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, "users", uid));
              ownerNames[uid] = snap.exists()
                ? ((snap.data() as any).userName ?? uid)
                : uid;
            } catch {
              ownerNames[uid] = uid;
            }
          }),
        );

        // Fetch each training from the owner's collection
        const results = await Promise.all(
          sorted.map(async (ref) => {
            try {
              const snap = await getDoc(
                doc(db, "users", ref.ownerId, "trainings", ref.trainingId),
              );
              if (!snap.exists()) return null;
              return {
                id: snap.id,
                ...(snap.data() as Omit<Training, "id">),
                ownerId: ref.ownerId,
                sharedBy: ref.sharedBy,
                sharedByName: ownerNames[ref.ownerId] ?? ref.ownerId,
                sharedAt: ref.sharedAt,
              } as SharedTraining;
            } catch {
              return null;
            }
          }),
        );
        setSharedTrainings(results.filter(Boolean) as SharedTraining[]);
      } catch {
        setSharedTrainings([]);
      } finally {
        setLoadingSh(false);
      }
    };
    fetch();
  }, [userData]);

  // ── Fetch upcoming matches ─────────────────────────────────────────────────
  useEffect(() => {
    if (teamId === undefined) return; // still loading
    if (teamId === null) {
      setLoadingMatches(false);
      return;
    }
    const fetch = async () => {
      try {
        const snap = await getDocs(collection(db, "teams", teamId, "matches"));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcoming = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Match)
          .filter((m) => {
            const d = typeof (m.date as any)?.toDate === "function"
              ? (m.date as any).toDate()
              : new Date(m.date as any);
            return d >= today;
          })
          .sort((a, b) => {
            const da = typeof (a.date as any)?.toDate === "function" ? (a.date as any).toDate() : new Date(a.date as any);
            const db2 = typeof (b.date as any)?.toDate === "function" ? (b.date as any).toDate() : new Date(b.date as any);
            return da.getTime() - db2.getTime();
          })
          .slice(0, 3);
        setMatches(upcoming);
      } catch {
        setMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    };
    fetch();
  }, [teamId]);

  const firstName = userData?.userName?.split(" ")[0] ?? "Coach";

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const combinedUpcoming = useMemo(() => {
    const toDate = (d: any): Date =>
      typeof d?.toDate === "function" ? d.toDate() : new Date(d ?? 0);

    const ownUpcoming = trainings.filter((t) => toDate(t.date) >= now);

    const sharedUpcoming = sharedTrainings.filter(
      (t) => toDate(t.date) >= now,
    ) as (SharedTraining & { ownerId: string })[];

    const combined = [
      ...ownUpcoming.map((t) => ({ ...t, ownerId: undefined as string | undefined })),
      ...sharedUpcoming,
    ];

    combined.sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime());
    return combined;
  }, [trainings, sharedTrainings]);

  return (
    <>
      <Navigation />
      <div className="home section">
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
          {/* Upcoming trainings */}
          <section className="home__widget home__widget--trainings">
            <div className="home__widget__header">
              <h2 className="home__widget__title">Upcoming Trainings</h2>
              <button
                className="home__widget__link"
                onClick={() => navigate("/training-overview")}
              >
                View all →
              </button>
            </div>
            {loadingTr || loadingSh ? (
              <TrainingWidgetSkeleton />
            ) : combinedUpcoming.length === 0 ? (
              <div className="home__widget__empty">
                <p>No upcoming trainings planned</p>
                <button
                  className="home__widget__cta"
                  onClick={() => navigate("/create-training")}
                >
                  + Plan a training
                </button>
              </div>
            ) : (
              <div className="home__trainings__list">
                {combinedUpcoming.map((tr) => (
                  <div
                    key={`${tr.ownerId ?? currentUser?.uid}-${tr.id}`}
                    className="home__training__row"
                    onClick={() => navigate(`/training-detail/${tr.ownerId ?? currentUser?.uid}/${tr.id}`)}
                  >
                    <div className="home__training__row__accent" />
                    <div className="home__training__row__info">
                      <span className="home__training__row__title">
                        {tr.title}
                        {tr.ownerId && (
                          <span className="home__shared__inline-badge">Shared</span>
                        )}
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

          {/* Upcoming matches */}
          <section className="home__widget home__widget--matches">
            <div className="home__widget__header">
              <h2 className="home__widget__title">Upcoming Matches</h2>
              <button
                className="home__widget__link"
                onClick={() => navigate("/match-overview")}
              >
                View all →
              </button>
            </div>
            {loadingMatches ? (
              <MatchWidgetSkeleton />
            ) : matches.length === 0 ? (
              <div className="home__widget__empty">
                <p>No upcoming matches scheduled</p>
                <button
                  className="home__widget__cta"
                  onClick={() => navigate("/create-match")}
                >
                  + Schedule a match
                </button>
              </div>
            ) : (
              <div className="home__matches__list">
                {matches.map((match) => (
                  <div
                    key={match.id}
                    className="home__match__row"
                    onClick={() => navigate(`/match-detail/${teamId}/${match.id}`)}
                  >
                    <div className="home__match__row__accent" />
                    <div className="home__match__row__info">
                      <span className="home__match__row__title">
                        vs. {match.opponent}
                      </span>
                      <span className="home__match__row__meta">
                        {formatDate(match.date)} · {match.isHomeGame ? "Home" : "Away"}
                      </span>
                    </div>
                    <span className={`home__match__row__badge home__match__row__badge--${match.isHomeGame ? "home" : "away"}`}>
                      {match.isHomeGame ? "Home" : "Away"}
                    </span>
                  </div>
                ))}
                <button
                  className="home__matches__new"
                  onClick={() => navigate("/create-match")}
                >
                  + New match
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
              <ExerciseWidgetSkeleton />
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
              <SharedWidgetSkeleton />
            ) : sharedTrainings.length === 0 ? (
              <div className="home__widget__empty">
                <p>No shared trainings yet.</p>
                <p className="home__widget__empty__hint">
                  When a teammate shares a training with you it will appear
                  here.
                </p>
                <p></p>
                <p></p>
                <p></p>
                <p></p>
              </div>
            ) : (
              <div className="home__shared__list">
                {sharedTrainings.map((tr) => (
                  <div
                    key={tr.id}
                    className="home__shared__card"
                    onClick={() => navigate(`/training-detail/${tr.ownerId}/${tr.id}`)}
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

      {showTour && <Tour onComplete={() => setShowTour(false)} />}
    </>
  );
}
