import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import db from "../../../firebase";
import AvatarEditor from "../avatareditor/AvatarEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

type MobileMode = "advanced" | "simple";
type PlanningDirection = "forward" | "backward";
type Role = "coach" | "player";

interface TourProps {
  onComplete: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  "welcome",
  "bio",
  "avatar",
  "team",
  "preferences",
  "done",
] as const;
type Step = (typeof STEPS)[number];

const CONTENT_STEPS: Step[] = ["bio", "avatar", "team", "preferences"];

const TEAM_OPTIONS = [
  "Herren 1",
  "Herren 2",
  "Damen 1",
  "Damen 2",
  "Damen 3",
  "HU23",
  "DU23/1",
  "DU23/2",
  "DU20/1",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const OptionCard = ({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    className={`preference__option ${active ? "preference__option--active" : ""}`}
    onClick={onClick}
    type="button"
  >
    <div className="preference__option__radio">
      {active && <div className="preference__option__radio__dot" />}
    </div>
    <div className="preference__option__text">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Tour = ({ onComplete }: TourProps) => {
  const auth = getAuth();

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  // Per-step data
  const [userName, setUserName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [team, setTeam] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [mobileMode, setMobileMode] = useState<MobileMode>("advanced");
  const [planningDirection, setPlanningDirection] =
    useState<PlanningDirection>("forward");

  // Fetch user's name for avatar initials placeholder
  const uid = auth.currentUser?.uid;
  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setUserName((snap.data().userName as string) ?? "");
    });
  }, [uid]);

  const step = STEPS[stepIndex];
  const contentStepIndex = CONTENT_STEPS.indexOf(step as Step);

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIndex((i) => Math.max(i - 1, 0));

  const handleFinish = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        tourCompleted: true,
        mobileMode,
        planningDirection,
        role,
      };
      if (bio.trim()) updates.bio = bio.trim();
      if (team) updates.team = team;
      await updateDoc(doc(db, "users", userId), updates);
      onComplete();
    } catch (e) {
      console.error("Tour save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="tour__overlay">
      <div className="tour">
        {/* ── Welcome ── */}
        {step === "welcome" && (
          <>
            <div className="tour__stripe" aria-hidden="true" />
            <div className="tour__body tour__body--centered">
              <h1 className="tour__title">Welcome to Trainingsplaner</h1>
              <p className="tour__subtitle">
                Let's set up your profile in a few quick steps so the app works
                perfectly for you.
              </p>
              <button className="btn__primary tour__cta" onClick={next}>
                Get started
                <svg width="16" height="10" viewBox="0 0 23 12" fill="none">
                  <path
                    d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ── Content steps (bio / avatar / team / preferences) ── */}
        {CONTENT_STEPS.includes(step as (typeof CONTENT_STEPS)[number]) && (
          <>
            <div className="tour__header">
              <div className="tour__progress">
                {CONTENT_STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`tour__progress__dot ${
                      i < contentStepIndex ? "tour__progress__dot--done" : ""
                    } ${i === contentStepIndex ? "tour__progress__dot--active" : ""}`}
                  />
                ))}
              </div>
            </div>

            <div className="tour__body">
              {/* Bio */}
              {step === "bio" && (
                <>
                  <h2 className="tour__step__title">Your bio</h2>
                  <p className="tour__step__hint">
                    Tell your team a little about yourself. You can update this
                    anytime from your profile.
                  </p>
                  <textarea
                    className="profile__edit__input profile__edit__input--bio tour__textarea"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="E.g. Head coach of Herren 1, former national player..."
                    rows={5}
                  />
                </>
              )}

              {/* Avatar */}
              {step === "avatar" && (
                <>
                  <h2 className="tour__step__title">Your avatar</h2>
                  <p className="tour__step__hint">
                    Design a personal avatar that appears across the app.
                  </p>
                  <div className="tour__avatar__preview">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Your avatar"
                        className="tour__avatar__img"
                      />
                    ) : (
                      <div className="tour__avatar__placeholder">
                        <span>{initials || "?"}</span>
                      </div>
                    )}
                    <button
                      className="btn__wired"
                      onClick={() => setAvatarDialogOpen(true)}
                    >
                      {avatarUrl ? "Edit avatar" : "Create avatar"}
                    </button>
                  </div>
                </>
              )}

              {/* Team & Role */}
              {step === "team" && (
                <>
                  <h2 className="tour__step__title">Team & Role</h2>
                  <p className="tour__step__hint">
                    Choose the team you belong to and your role in the club.
                  </p>
                  <div className="tour__field">
                    <label className="tour__label">Team</label>
                    <select
                      className="profile__edit__select tour__select"
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                    >
                      <option value="">— no team —</option>
                      {TEAM_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="tour__field">
                    <label className="tour__label">Role</label>
                    <div className="preference__options">
                      <OptionCard
                        title="Player"
                        description="I take part in training sessions"
                        active={role === "player"}
                        onClick={() => setRole("player")}
                      />
                      <OptionCard
                        title="Coach"
                        description="I plan and lead training sessions"
                        active={role === "coach"}
                        onClick={() => setRole("coach")}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Preferences */}
              {step === "preferences" && (
                <>
                  <h2 className="tour__step__title">Preferences</h2>
                  <p className="tour__step__hint">
                    Customize how the app works for you. These can be changed
                    anytime in the Preference Center.
                  </p>
                  <div className="tour__field">
                    <label className="tour__label">Reorder mode</label>
                    <span className="tour__field__hint">
                      How you reorder exercises in a training on touch devices.
                    </span>
                    <div className="preference__options">
                      <OptionCard
                        title="Advanced"
                        description="Drag & drop to reorder"
                        active={mobileMode === "advanced"}
                        onClick={() => setMobileMode("advanced")}
                      />
                      <OptionCard
                        title="Simple"
                        description="Up / down buttons to reorder"
                        active={mobileMode === "simple"}
                        onClick={() => setMobileMode("simple")}
                      />
                    </div>
                  </div>
                  <div className="tour__field">
                    <label className="tour__label">Planning direction</label>
                    <span className="tour__field__hint">
                      Whether you build a training from start to finish or
                      backwards.
                    </span>
                    <div className="preference__options">
                      <OptionCard
                        title="Forward"
                        description="Add the first exercise first"
                        active={planningDirection === "forward"}
                        onClick={() => setPlanningDirection("forward")}
                      />
                      <OptionCard
                        title="Backward"
                        description="Add the last exercise first"
                        active={planningDirection === "backward"}
                        onClick={() => setPlanningDirection("backward")}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer navigation */}
            <div className="tour__footer">
              <button
                className="btn__wired"
                onClick={step === "bio" ? () => setStepIndex(0) : prev}
              >
                <svg width="14" height="8" viewBox="0 0 23 12" fill="none">
                  <path
                    d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                    fill="currentColor"
                  />
                </svg>
                Back
              </button>
              <div className="tour__footer__right">
                <button className="tour__skip" onClick={next}>
                  Skip
                </button>
                <button className="btn__primary" onClick={next}>
                  Next
                  <svg width="14" height="8" viewBox="0 0 23 12" fill="none">
                    <path
                      d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Done ── */}
        {step === "done" && (
          <>
            <div className="tour__stripe" aria-hidden="true" />
            <div className="tour__body tour__body--centered">
              <div className="tour__check" aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <circle cx="16" cy="16" r="16" fill="#1e1e1e" />
                  <path
                    d="M9 16.5L13.5 21L23 11"
                    stroke="#fffaf0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="tour__title">You're all set!</h1>
              <p className="tour__subtitle">
                Your profile is ready. Head in and start planning your first
                training.
              </p>
              <button
                className="btn__primary tour__cta"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? "Saving..." : "Let's go"}
                {!saving && (
                  <svg width="16" height="10" viewBox="0 0 23 12" fill="none">
                    <path
                      d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Avatar editor sub-dialog ── */}
      {avatarDialogOpen && (
        <div
          className="dialog__overlay tour__avatar__dialog__overlay"
          onClick={() => setAvatarDialogOpen(false)}
        >
          <div
            className="dialog profile__avatar__editor__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog__header">
              <h3 className="dialog__title">Customize your avatar</h3>
              <button
                className="dialog__close"
                onClick={() => setAvatarDialogOpen(false)}
              >
                ×
              </button>
            </div>
            <AvatarEditor
              userId={auth.currentUser?.uid}
              onSaved={(url) => {
                setAvatarUrl(url);
                setAvatarDialogOpen(false);
              }}
              onClose={() => setAvatarDialogOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Tour;
