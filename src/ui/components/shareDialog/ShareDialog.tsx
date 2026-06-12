import { useEffect, useState } from "react";
import { collection, doc, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import type { Training } from "../../../types/Training";
import type { UserProfile, SharedTrainingRef } from "../../../services/upload/registerUser";
import { notifyTrainingShared } from "../../../services/notifications/notifications";
import db from "../../../firebase";

interface ShareDialogProps {
  trainings: Training[];
  currentUserId: string;
  currentUserTeam: string;
  senderName: string;
  onClose: () => void;
}

const ShareDialog = ({
  trainings,
  currentUserId,
  currentUserTeam,
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
    const recipientIds = Array.from(selected);
    const sharedAt = new Date();

    try {
      await Promise.all(
        trainings.map(async (training) => {
          const trainingId = (training as any).id ?? "";

          await Promise.all(
            recipientIds.map((recipientId) => {
              const ref: SharedTrainingRef = {
                trainingId,
                ownerId: currentUserId,
                sharedBy: currentUserId,
                sharedAt,
              };
              return updateDoc(doc(db, "users", recipientId), {
                sharedWithMe: arrayUnion(ref),
              });
            }),
          );

          await updateDoc(
            doc(db, "users", currentUserId, "trainings", trainingId),
            { sharedWith: arrayUnion(...recipientIds) },
          );

          try {
            await Promise.all(
              recipientIds.map((recipientId) =>
                notifyTrainingShared(
                  recipientId,
                  currentUserId,
                  trainingId,
                  training.title,
                  senderName,
                  currentUserId,
                ),
              ),
            );
          } catch (notifError) {
            console.warn("Could not send share notifications:", notifError);
          }
        }),
      );

      setShared(true);
      setTimeout(onClose, 1600);
    } catch (e) {
      console.error("Error sharing trainings:", e);
    } finally {
      setSharing(false);
    }
  };

  const isSingle = trainings.length === 1;
  const label = isSingle
    ? trainings[0].title
    : `${trainings.length} trainings`;

  return (
    <div className="dialog__overlay" onClick={onClose}>
      <div
        className="dialog dialog--share"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__header">
          <h3 className="dialog__title">
            Share {isSingle ? "training" : "trainings"}
          </h3>
          <button className="dialog__close" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="dialog__body">
          Select teammates to share <strong>{label}</strong> with. It will
          appear in their training list with you as the author.
        </p>

        {loadingUsers ? (
          <div className="share__loading">Loading teammates...</div>
        ) : users.length === 0 ? (
          <div className="share__empty">No other users found.</div>
        ) : (
          <div className="share__user__list">
            {(() => {
              const inTeam = currentUserTeam
                ? users.filter((u) => u.team === currentUserTeam)
                : [];
              const others = currentUserTeam
                ? users.filter((u) => u.team !== currentUserTeam)
                : users;
              const showLabels = inTeam.length > 0 && others.length > 0;

              const renderUser = (user: UserProfile) => {
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
              };

              return (
                <>
                  {inTeam.length > 0 && (
                    <>
                      {showLabels && (
                        <span className="share__group__label">Your team</span>
                      )}
                      {inTeam.map(renderUser)}
                    </>
                  )}
                  {others.length > 0 && (
                    <>
                      {showLabels && (
                        <span className="share__group__label">
                          Everyone else
                        </span>
                      )}
                      {others.map(renderUser)}
                    </>
                  )}
                </>
              );
            })()}
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

export default ShareDialog;
