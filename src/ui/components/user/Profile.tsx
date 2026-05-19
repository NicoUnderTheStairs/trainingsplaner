import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { doSignOut } from "../../../auth/auth";
import Navigation from "../navigation/Navigation";
import type { UserProfile } from "../../../services/upload/registerUser";
import db from "../../../firebase";

// ─── Avatar options ───────────────────────────────────────────────────────────
// Add or swap URLs freely — these are the preset images users can choose from.

const AVATAR_OPTIONS = [
  { id: "wolf", url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Wolf" },
  { id: "fox", url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Fox" },
  { id: "bear", url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Bear" },
  {
    id: "eagle",
    url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Eagle",
  },
  { id: "lynx", url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Lynx" },
  {
    id: "shark",
    url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Shark",
  },
  {
    id: "tiger",
    url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Tiger",
  },
  {
    id: "panther",
    url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Panther",
  },
  {
    id: "falcon",
    url: "https://api.dicebear.com/8.x/adventurer/svg?seed=Falcon",
  },
];

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

// ─── Avatar picker dialog ─────────────────────────────────────────────────────

interface AvatarPickerProps {
  current: string | null;
  onSelect: (url: string) => void;
  onClose: () => void;
}

const AvatarPicker = ({ current, onSelect, onClose }: AvatarPickerProps) => (
  <div className="dialog__overlay" onClick={onClose}>
    <div
      className="dialog profile__avatar__picker"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="dialog__header">
        <h3 className="dialog__title">Choose your avatar</h3>
        <button className="profile__avatar__picker__close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="profile__avatar__picker__grid">
        {AVATAR_OPTIONS.map((avatar) => (
          <button
            key={avatar.id}
            className={`profile__avatar__picker__option ${
              current === avatar.url
                ? "profile__avatar__picker__option--selected"
                : ""
            }`}
            onClick={() => onSelect(avatar.url)}
            title={avatar.id}
          >
            <img src={avatar.url} alt={avatar.id} />
            {current === avatar.url && (
              <div className="profile__avatar__picker__check">✓</div>
            )}
          </button>
        ))}
      </div>
    </div>
  </div>
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

  // Avatar picker
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  // Favourite counts (fetched from subcollections, not stored on profile)
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

      // Fetch favourite counts from subcollections
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

  // ── Avatar select ────────────────────────────────────────────────────────
  const handleAvatarSelect = async (url: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      await updateDoc(doc(db, "users", userId), { profileImageUrl: url });
      setProfile((prev) => (prev ? { ...prev, profileImageUrl: url } : prev));
    } catch (e) {
      console.error("Error updating avatar:", e);
    } finally {
      setAvatarPickerOpen(false);
    }
  };

  // ── Sign out ─────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await doSignOut();
    navigate("/");
  };

  if (loading) return <p>Loading...</p>;
  if (!profile) return <p>Profile not found.</p>;

  const joinDate = (profile.createdAt as any)?.toDate?.()
    ? (profile.createdAt as any).toDate().toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <>
      <Navigation />
      <div className="profile">
        <div className="profile__inner">
          {/* ── Hero ── */}
          <div className="profile__hero">
            {/* Avatar */}
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
                onClick={() => setAvatarPickerOpen(true)}
                title="Change avatar"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
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

            {/* Name + meta */}
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

            {/* Actions */}
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
                    <option value="Damen 1">Damen 1</option>
                    <option value="Damen 2">Damen 2</option>
                    <option value="Damen 3">Damen 3</option>
                    <option value="Herren 1">Herren 1</option>
                    <option value="Herren 2">Herren 2</option>
                    <option value="DU23/1">DU23/1</option>
                    <option value="DU23/2">DU23/2</option>
                    <option value="DU20/1">DU20/1</option>
                    <option value="HU23">HU23</option>
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
                    <option value="admin">Admin</option>
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
              <h3 className="profile__card__title">Quick links</h3>
              <button
                className="profile__quicklink"
                onClick={() => navigate("/training-overview")}
              >
                My Trainings
                <svg
                  width="16"
                  height="10"
                  viewBox="0 0 23 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                className="profile__quicklink"
                onClick={() => navigate("/exercise-overview")}
              >
                Exercise Library
                <svg
                  width="16"
                  height="10"
                  viewBox="0 0 23 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 5.25H0.25V6.75H1V5.25ZM22.5303 6.53C22.8232 6.237 22.8232 5.763 22.5303 5.47L17.757 0.697C17.465 0.404 16.99 0.404 16.697 0.697C16.404 0.99 16.404 1.465 16.697 1.757L20.939 6L16.697 10.243C16.404 10.536 16.404 11.01 16.697 11.303C16.99 11.596 17.465 11.596 17.757 11.303L22.5303 6.53ZM1 6.75H22V5.25H1V6.75Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Avatar picker dialog ── */}
      {avatarPickerOpen && (
        <AvatarPicker
          current={profile.profileImageUrl ?? null}
          onSelect={handleAvatarSelect}
          onClose={() => setAvatarPickerOpen(false)}
        />
      )}
    </>
  );
};

export default Profile;
