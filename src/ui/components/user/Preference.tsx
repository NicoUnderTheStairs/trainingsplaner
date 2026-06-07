import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import Navigation from "../../components/navigation/Navigation";
import db from "../../../firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type MobileMode = "advanced" | "simple";
type PlanningDirection = "forward" | "backward";
type NotificationScope = "all" | "team";

interface UserSettings {
  mobileMode: MobileMode;
  planningDirection: PlanningDirection;
  notificationScope: NotificationScope;
}

const DEFAULT_SETTINGS: UserSettings = {
  mobileMode: "advanced",
  planningDirection: "forward",
  notificationScope: "all",
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

const SettingsSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="preference__section">
    <div className="preference__section__header">
      <h2 className="preference__section__title">{title}</h2>
      {description && (
        <p className="preference__section__desc">{description}</p>
      )}
    </div>
    <div className="preference__section__body">{children}</div>
  </div>
);

// ─── Setting row ──────────────────────────────────────────────────────────────

const SettingRow = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="preference__row">
    <div className="preference__row__info">
      <span className="preference__row__label">{label}</span>
      {hint && <span className="preference__row__hint">{hint}</span>}
    </div>
    <div className="preference__row__control">{children}</div>
  </div>
);

// ─── Option card (radio-style) ────────────────────────────────────────────────

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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const PreferenceSkeleton = () => (
  <>
    <Navigation />
    <div className="preference section">
      <div className="preference__inner">
        <div className="preference__header">
          <span
            className="sk sk--rect"
            style={{ width: "8rem", height: "3.4rem" }}
          />
          <span
            className="sk sk--line-xl sk--w40"
            style={{ marginTop: "1.6rem" }}
          />
          <span
            className="sk sk--line sk--w65"
            style={{ marginTop: "0.8rem" }}
          />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="preference__section">
            <div className="preference__section__header">
              <span className="sk sk--line-lg sk--w30" />
              <span
                className="sk sk--line sk--w55"
                style={{ marginTop: "0.4rem" }}
              />
            </div>
            <div className="preference__section__body">
              <div style={{ display: "flex", gap: "1.2rem" }}>
                <div className="sk-card" style={{ flex: 1 }}>
                  <span className="sk sk--line sk--w55" />
                  <span className="sk sk--line sk--w75" />
                </div>
                <div className="sk-card" style={{ flex: 1 }}>
                  <span className="sk sk--line sk--w55" />
                  <span className="sk sk--line sk--w75" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </>
);

// ─── Main component ───────────────────────────────────────────────────────────

const Preference = () => {
  const navigate = useNavigate();
  const auth = getAuth();

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // tracks which field is saving

  // ── Fetch user settings ─────────────────────────────────────────────────
  useEffect(() => {
    const fetchSettings = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        navigate("/");
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            mobileMode: data.mobileMode ?? DEFAULT_SETTINGS.mobileMode,
            planningDirection:
              data.planningDirection ?? DEFAULT_SETTINGS.planningDirection,
            notificationScope:
              data.notificationScope ?? DEFAULT_SETTINGS.notificationScope,
          });
        }
      } catch (e) {
        console.error("Error fetching settings:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // ── Persist a single setting ────────────────────────────────────────────
  const updateSetting = async <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    setSaving(key);
    try {
      await updateDoc(doc(db, "users", userId), { [key]: value });
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (e) {
      console.error(`Error updating ${key}:`, e);
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <PreferenceSkeleton />;

  return (
    <>
      <Navigation />
      <div className="preference section">
        <div className="preference__inner">
          {/* Back + title */}
          <div className="preference__header">
            <button className="btn__wired" onClick={() => navigate(-1)}>
              <svg width="23" height="12" viewBox="0 0 23 12" fill="none">
                <path
                  d="M22 6.75H22.75V5.25H22V6.75ZM0.46967 5.46967C0.176777 5.76256 0.176777 6.23744 0.46967 6.53033L5.24264 11.3033C5.53553 11.5962 6.01041 11.5962 6.3033 11.3033C6.59619 11.0104 6.59619 10.5355 6.3033 10.2426L2.06066 6L6.3033 1.75736C6.59619 1.46447 6.59619 0.989593 6.3033 0.696699C6.01041 0.403806 5.53553 0.403806 5.24264 0.696699L0.46967 5.46967ZM22 5.25H1V6.75H22V5.25Z"
                  fill="black"
                />
              </svg>
              Back
            </button>
            <h1 className="preference__title">Preference Center</h1>
            <p className="preference__subtitle">
              Make Trainingsplaner truly yours by customizing how it works. Your
              preferences are saved to your account and will apply on any device
              you log in from.
            </p>
          </div>

          {/* ── Mobile & touch ─────────────────────────────────────────── */}
          <SettingsSection
            title="Mobile & Touch"
            description="Settings for how the app behaves on mobile devices and touch screens."
          >
            <SettingRow
              label="Reorder mode"
              hint="Choose how you reorder exercises in a training on touch devices."
            >
              <div className="preference__options">
                <OptionCard
                  title="Advanced"
                  description="Drag & drop to reorder"
                  active={settings.mobileMode === "advanced"}
                  onClick={() => updateSetting("mobileMode", "advanced")}
                />
                <OptionCard
                  title="Simple"
                  description="Up / down buttons to reorder"
                  active={settings.mobileMode === "simple"}
                  onClick={() => updateSetting("mobileMode", "simple")}
                />
              </div>
              {saving === "mobileMode" && (
                <span className="preference__saving">Saving...</span>
              )}
            </SettingRow>
          </SettingsSection>

          {/* ── Training planning ──────────────────────────────────────── */}
          <SettingsSection
            title="Training Planning"
            description="How exercises are ordered when you build a training."
          >
            <SettingRow
              label="Planning direction"
              hint="Choose whether you plan a training from start to finish, or from the last exercise backwards."
            >
              <div className="preference__options">
                <OptionCard
                  title="Forward"
                  description="Add the first exercise first, then the second, etc."
                  active={settings.planningDirection === "forward"}
                  onClick={() => updateSetting("planningDirection", "forward")}
                />
                <OptionCard
                  title="Backward"
                  description="Add the last exercise first — the order flips automatically."
                  active={settings.planningDirection === "backward"}
                  onClick={() => updateSetting("planningDirection", "backward")}
                />
              </div>
              {saving === "planningDirection" && (
                <span className="preference__saving">Saving...</span>
              )}
            </SettingRow>
          </SettingsSection>

          {/* ── Notifications ──────────────────────────────────────────── */}
          <SettingsSection
            title="Notifications"
            description="Choose which activity triggers notifications for you."
          >
            <SettingRow
              label="Notify me about"
              hint="Control whether you receive notifications from everyone or only from members of your own team."
            >
              <div className="preference__options">
                <OptionCard
                  title="Everyone"
                  description="Receive notifications from all users in the app."
                  active={settings.notificationScope === "all"}
                  onClick={() => updateSetting("notificationScope", "all")}
                />
                <OptionCard
                  title="My team only"
                  description="Only receive notifications from users in the same team as you."
                  active={settings.notificationScope === "team"}
                  onClick={() => updateSetting("notificationScope", "team")}
                />
              </div>
              {saving === "notificationScope" && (
                <span className="preference__saving">Saving...</span>
              )}
            </SettingRow>
          </SettingsSection>
        </div>
      </div>
    </>
  );
};

export default Preference;
