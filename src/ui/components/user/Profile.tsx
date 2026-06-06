import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  setDoc,
  collection,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { doSignOut } from "../../../auth/auth";
import Navigation from "../navigation/Navigation";
import AvatarEditor from "../avatareditor/AvatarEditor";
import type { UserProfile } from "../../../services/upload/registerUser";
import db from "../../../firebase";

// ─── Sub-components ───────────────────────────────────────────────────────────

const AvatarPlaceholder = ({ name }: { name: string }) => {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="profile__avatar__placeholder">
      <span>{initials}</span>
    </div>
  );
};

const RoleBadge = ({ role }: { role: string }) => (
  <span className={`profile__role profile__role--${role}`}>{role}</span>
);

// ─── Admin section ────────────────────────────────────────────────────────────

const AdminSection = () => {
  const [phones, setPhones] = useState<string[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(true);
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getDoc(doc(db, "config", "allowedPhones"))
      .then((snap) => {
        if (snap.exists()) setPhones((snap.data().phones as string[]) ?? []);
      })
      .finally(() => setLoadingPhones(false));
  }, []);

  const persistPhones = async (updated: string[]) => {
    setSaving(true);
    try {
      await setDoc(doc(db, "config", "allowedPhones"), { phones: updated });
      setPhones(updated);
    } catch (e) {
      console.error("Error saving phones:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const normalized = newPhone.trim().replace(/\s/g, "");
    if (!normalized) return;
    if (!/^\+\d{7,15}$/.test(normalized)) {
      setError("Use E.164 format, e.g. +41791234567");
      return;
    }
    if (phones.includes(normalized)) {
      setError("Number already in the list");
      return;
    }
    setError("");
    setNewPhone("");
    persistPhones([...phones, normalized]);
  };

  return (
    <div className="profile__admin">
      <div className="profile__admin__header">
        <span className="profile__role profile__role--admin">Admin</span>
        <h2 className="profile__admin__title">Admin Panel</h2>
        <p className="profile__admin__subtitle">
          Visible only to admins. Changes take effect immediately.
        </p>
      </div>

      <div className="profile__card profile__card--wide">
        <h3 className="profile__card__title">Allowed phone numbers</h3>
        <p className="profile__admin__desc">
          Only users whose phone number is in this list can register. Use E.164
          format (e.g. +41791234567).
        </p>

        {loadingPhones ? (
          <p className="profile__card__value">Loading…</p>
        ) : (
          <>
            <div className="profile__admin__phonelist">
              {phones.length === 0 && (
                <p className="profile__card__empty profile__card__value">
                  No numbers added yet.
                </p>
              )}
              {phones.map((phone) => (
                <div key={phone} className="profile__admin__phonerow">
                  <span className="profile__admin__phone">{phone}</span>
                  <button
                    className="btn__danger profile__admin__remove"
                    onClick={() =>
                      persistPhones(phones.filter((p) => p !== phone))
                    }
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="profile__admin__addrow">
              <input
                className="profile__edit__input"
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(e.target.value);
                  setError("");
                }}
                placeholder="+41791234567"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button
                className="btn__primary"
                onClick={handleAdd}
                disabled={saving || !newPhone.trim()}
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </div>
            {error && <p className="profile__admin__error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ProfileSkeleton = () => (
  <>
    <Navigation />
    <div className="profile">
      <div className="profile__inner">
        {/* hero */}
        <div className="profile__hero">
          <span
            className="sk sk--circle"
            style={{ width: "9.6rem", height: "9.6rem", flexShrink: 0 }}
          />
          <div className="sk-stack" style={{ flex: 1, gap: "0.8rem" }}>
            <span className="sk sk--line-xl sk--w40" />
            <div className="sk-row" style={{ gap: "0.8rem" }}>
              <span
                className="sk sk--rect"
                style={{ width: "5rem", height: "2rem" }}
              />
              <span className="sk sk--line sk--w30" />
            </div>
          </div>
          <div className="sk-row" style={{ flexShrink: 0, gap: "0.8rem" }}>
            <span
              className="sk sk--rect"
              style={{ width: "9rem", height: "3.4rem" }}
            />
            <span
              className="sk sk--rect"
              style={{ width: "8rem", height: "3.4rem" }}
            />
          </div>
        </div>

        {/* grid cards */}
        <div className="profile__grid">
          <div className="sk-card profile__card--wide">
            <span className="sk sk--line sk--w20" />
            <span className="sk sk--line sk--w100" />
            <span className="sk sk--line sk--w75" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk-card">
              <span className="sk sk--line sk--w30" />
              <span className="sk sk--line sk--w55" />
              <span className="sk sk--line sk--w40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </>
);

// ─── Main component ────────────────────────────────────────────────────────────

const Profile = () => {
  const navigate = useNavigate();
  const auth = getAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});

  // Avatar editor
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);

  // Favourite counts
  const [favouriteExerciseCount, setFavouriteExerciseCount] = useState(0);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        navigate("/");
        return;
      }
      const snap = await getDoc(doc(db, "users", userId));
      if (snap.exists()) setProfile(snap.data() as UserProfile);

      const [favExSnap] = await Promise.all([
        getDocs(collection(db, "users", userId, "favouriteExercises")),
      ]);
      setFavouriteExerciseCount(favExSnap.size);

      setLoading(false);
    };
    fetchProfile();
  }, []);

  // ── Edit ─────────────────────────────────────────────────────────────────
  const handleEditStart = () => {
    if (!profile) return;
    setEditData({
      userName: profile.userName,
      bio: profile.bio ?? "",
      team: profile.team ?? "",
      role: profile.role,
    });
    setEditing(true);
  };

  const handleEditCancel = () => {
    setEditing(false);
    setEditData({});
  };

  const handleSave = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || !profile) return;
    setSaving(true);
    try {
      const updates = {
        userName: editData.userName ?? profile.userName,
        bio: editData.bio ?? profile.bio,
        team: editData.team ?? profile.team,
        role: editData.role ?? profile.role,
      };
      await updateDoc(doc(db, "users", userId), updates);
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
      setEditing(false);
      setEditData({});
    } catch (e) {
      console.error("Error updating profile:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Avatar saved ─────────────────────────────────────────────────────────
  const handleAvatarSaved = (dataUrl: string) => {
    setProfile((prev) => (prev ? { ...prev, profileImageUrl: dataUrl } : prev));
    setAvatarEditorOpen(false);
  };

  // ── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await doSignOut();
    navigate("/");
  };

  if (loading) return <ProfileSkeleton />;
  if (!profile) return <p>Profile not found.</p>;

  const joinDate = (profile.createdAt as any)?.toDate?.()
    ? (profile.createdAt as any)
        .toDate()
        .toLocaleDateString("de-CH", { month: "long", year: "numeric" })
    : "—";

  return (
    <>
      <Navigation />
      <div className="profile">
        <div className="profile__inner">
          {/* ── Hero ── */}
          <div className="profile__hero">
            <div className="profile__avatar__wrapper">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt={profile.userName}
                  className="profile__avatar"
                />
              ) : (
                <AvatarPlaceholder name={profile.userName} />
              )}
              <button
                className="profile__avatar__change__btn"
                onClick={() => setAvatarEditorOpen(true)}
                title="Change avatar"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M9.917 1.75a1.237 1.237 0 0 1 1.75 1.75L4.083 11.083 1.167 11.75l.666-2.917L9.917 1.75Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className="profile__hero__info">
              {editing ? (
                <input
                  className="profile__edit__input profile__edit__input--name"
                  value={editData.userName ?? ""}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, userName: e.target.value }))
                  }
                  placeholder="Username"
                />
              ) : (
                <h1 className="profile__name">{profile.userName}</h1>
              )}
              <div className="profile__hero__meta">
                <RoleBadge
                  role={
                    editing ? (editData.role ?? profile.role) : profile.role
                  }
                />
                <span className="profile__joined">Member since {joinDate}</span>
              </div>
            </div>

            <div className="profile__hero__actions">
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
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn__wired" onClick={handleEditStart}>
                    Edit profile
                  </button>
                  <button className="btn__danger" onClick={handleSignOut}>
                    Sign out
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Info cards ── */}
          <div className="profile__grid">
            {/* Bio */}
            <div className="profile__card profile__card--wide">
              <h3 className="profile__card__title">Bio</h3>
              {editing ? (
                <textarea
                  className="profile__edit__input profile__edit__input--bio"
                  value={editData.bio ?? ""}
                  onChange={(e) =>
                    setEditData((p) => ({ ...p, bio: e.target.value }))
                  }
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              ) : (
                <p className="profile__card__value">
                  {profile.bio || (
                    <span className="profile__card__empty">No bio yet.</span>
                  )}
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="profile__card">
              <h3 className="profile__card__title">Contact</h3>
              <div className="profile__card__row">
                <span className="profile__card__label">Email</span>
                <span className="profile__card__value">{profile.email}</span>
              </div>
              <div className="profile__card__row">
                <span className="profile__card__label">Phone</span>
                <span className="profile__card__value">
                  {profile.phone || "—"}
                </span>
              </div>
            </div>

            {/* Team & role */}
            <div className="profile__card">
              <h3 className="profile__card__title">Team & Role</h3>
              <div className="profile__card__row">
                <span className="profile__card__label">Team</span>
                {editing ? (
                  <select
                    className="profile__edit__select"
                    value={editData.team ?? ""}
                    onChange={(e) =>
                      setEditData((p) => ({ ...p, team: e.target.value }))
                    }
                  >
                    <option value="">— no team —</option>
                    <option value="Herren 1">Herren 1</option>
                    <option value="Herren 2">Herren 2</option>
                    <option value="Damen 1">Damen 1</option>
                    <option value="Damen 2">Damen 2</option>
                    <option value="Damen 3">Damen 3</option>
                    <option value="HU23">HU23</option>
                    <option value="DU23/1">DU23/1</option>
                    <option value="DU23/2">DU23/2</option>
                    <option value="DU20/1">DU20/1</option>
                  </select>
                ) : (
                  <span className="profile__card__value">
                    {profile.team || "—"}
                  </span>
                )}
              </div>
              <div className="profile__card__row">
                <span className="profile__card__label">Role</span>
                {editing ? (
                  <select
                    className="profile__edit__select"
                    value={editData.role ?? profile.role}
                    onChange={(e) =>
                      setEditData((p) => ({
                        ...p,
                        role: e.target.value as UserProfile["role"],
                      }))
                    }
                  >
                    <option value="coach">Coach</option>
                    <option value="player">Player</option>
                  </select>
                ) : (
                  <RoleBadge role={profile.role} />
                )}
              </div>
            </div>

            {/* Activity */}
            <div className="profile__card">
              <h3 className="profile__card__title">Activity</h3>
              <div className="profile__card__row">
                <span className="profile__card__label">
                  Favourite exercises
                </span>
                <span className="profile__card__value profile__card__value--accent">
                  {favouriteExerciseCount}
                </span>
              </div>
            </div>

            {/* Quick links */}
            <div className="profile__card">
              <h3 className="profile__card__title">Preference Center</h3>
              <button
                className="profile__quicklink"
                onClick={() => navigate("/preferences")}
              >
                How you want to use Trainingsplaner
                <svg width="16" height="10" viewBox="0 0 23 12" fill="none">
                  <path
                    d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>

          <p className="profile__version">TRAININGSPLANER by Nico | v1.1.55</p>

          {profile.role === "admin" && <AdminSection />}
        </div>
      </div>

      {/* ── Avatar editor dialog ── */}
      {avatarEditorOpen && (
        <div
          className="dialog__overlay"
          onClick={() => setAvatarEditorOpen(false)}
        >
          <div
            className="dialog profile__avatar__editor__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog__header">
              <h3 className="dialog__title">Customize your avatar</h3>
              <button
                className="dialog__close"
                onClick={() => setAvatarEditorOpen(false)}
              >
                ×
              </button>
            </div>
            <AvatarEditor
              userId={auth.currentUser?.uid}
              onSaved={handleAvatarSaved}
              onClose={() => setAvatarEditorOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Profile;
