import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "../components/navigation/Navigation";
import type { Match, Player } from "../../types/Match";
import db from "../../firebase";

const POSITION_COLOR: Record<string, string> = {
  "Outside Hitter": "#E63C2F",
  "Opposite Hitter": "#F5A623",
  "Middle Blocker": "#4DB87A",
  Setter: "#3EC6D4",
  Libero: "#624DB8",
};

const POSITION_ABBR: Record<string, string> = {
  "Outside Hitter": "OH",
  "Opposite Hitter": "OP",
  "Middle Blocker": "MB",
  Setter: "S",
  Libero: "L",
};

export default function MatchDetail() {
  const { ownerId: teamId, matchId } = useParams<{ ownerId: string; matchId: string }>();
  const navigate = useNavigate();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !matchId) return;
    getDoc(doc(db, "teams", teamId, "matches", matchId))
      .then((snap) => {
        if (snap.exists()) {
          setMatch({ id: snap.id, ...snap.data() } as Match);
        }
      })
      .finally(() => setLoading(false));
  }, [teamId, matchId]);

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="matchdetail">
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (!match) {
    return (
      <>
        <Navigation />
        <div className="matchdetail">
          <p>Match not found.</p>
        </div>
      </>
    );
  }

  const matchDate =
    match.date && "toDate" in match.date
      ? match.date.toDate().toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";

  return (
    <>
      <Navigation />
      <div className="matchdetail">
        <div className="btn__back">
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

        <div className="matchdetail__header">
          <h1 className="matchdetail__opponent">Limmattal vs. {match.opponent}</h1>
          <div className="matchdetail__header__meta">
            <span className="matchdetail__date">{matchDate}</span>
            <span className={`matchlist__badge matchlist__badge--${match.isHomeGame ? "home" : "away"}`}>
              {match.isHomeGame ? "Home" : "Away"}
            </span>
          </div>
        </div>

        {match.noteOnOpponent && (
          <section className="matchdetail__section">
            <h2 className="matchdetail__section__title">Notes on Opponent</h2>
            <p className="matchdetail__section__text">{match.noteOnOpponent}</p>
          </section>
        )}

        {match.strategy && (
          <section className="matchdetail__section">
            <h2 className="matchdetail__section__title">Strategy</h2>
            <p className="matchdetail__section__text">{match.strategy}</p>
          </section>
        )}

        <section className="matchdetail__section">
          <h2 className="matchdetail__section__title">
            Lineup ({match.lineup?.length ?? 0} players)
          </h2>

          {!match.lineup || match.lineup.length === 0 ? (
            <p className="matchdetail__empty">No players added to this match.</p>
          ) : (
            <div className="matchdetail__lineup">
              {match.lineup.map((player: Player, i: number) => (
                <div key={i} className="matchdetail__lineup__row">
                  <div
                    className="matchdetail__lineup__abbr"
                    style={{
                      background:
                        POSITION_COLOR[player.playerPosition] ?? "#888",
                    }}
                  >
                    {POSITION_ABBR[player.playerPosition] ?? "?"}
                  </div>
                  <div className="matchdetail__lineup__info">
                    <span className="matchdetail__lineup__name">
                      {player.playerName}
                    </span>
                    <span className="matchdetail__lineup__position">
                      {player.playerPosition}
                    </span>
                  </div>
                  <div className="matchdetail__lineup__number">
                    #{player.playerNumber}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
