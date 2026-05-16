import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import db from "../../../firebase";
import type { SketchData } from "../../../types/Sketch";
import type { Exercise } from "../../../types/Exercise";

// ─── Sketch thumbnail ─────────────────────────────────────────────────────────

const PLAYER_COLORS: Record<string, string> = {
  attacker: "#E63C2F",
  defender: "#3EC6D4",
  setter: "#F5A623",
  libero: "#4DB87A",
};

const PLAYER_LABELS: Record<string, string> = {
  attacker: "A",
  defender: "D",
  setter: "S",
  libero: "L",
};

const SketchThumbnail = ({ sketch }: { sketch: SketchData }) => {
  const players = sketch?.players ? Object.entries(sketch.players) : [];
  const arrows = sketch?.arrows ? Object.entries(sketch.arrows) : [];

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 560 440"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Arrow marker */}
      <defs>
        <marker
          id="thumb-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 Z" fill="#1E1E1E" />
        </marker>
      </defs>

      {/* Court background */}
      <path d="M560 0H0V440H560V0Z" fill="white" />
      <path
        d="M363.814 77H496.261V365H279.5L280 77H363.814ZM280 77L279.5 365H194.203V77H280ZM194.203 77V365H62.9062V77H194.203Z"
        fill="#F4EDE0"
      />
      <path
        d="M363.814 77V365M363.814 77H496.261V365H279.5M363.814 77H280M279.5 365L280 77M279.5 365H194.203M280 77H194.203M194.203 365V77M194.203 365H62.9062V77H194.203"
        stroke="black"
        strokeWidth="1"
      />

      {/* Arrows */}
      {arrows.map(([id, arrow]) => (
        <line
          key={id}
          x1={arrow.x1}
          y1={arrow.y1}
          x2={arrow.x2}
          y2={arrow.y2}
          stroke="#1E1E1E"
          strokeWidth="2"
          strokeDasharray={arrow.style === "dashed" ? "6 4" : undefined}
          markerEnd="url(#thumb-arrow)"
        />
      ))}

      {/* Players */}
      {players.map(([id, player]) => (
        <g key={id} transform={`translate(${player.x}, ${player.y})`}>
          <circle r={11} fill={PLAYER_COLORS[player.type] ?? "#999"} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={11}
            fontWeight="bold"
            fontFamily="Roboto, sans-serif"
          >
            {PLAYER_LABELS[player.type] ?? "?"}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ExcerciseList = () => {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const snapshot = await getDocs(collection(db, "Excercises"));
        const data: Exercise[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Exercise, "id">),
        }));
        setExercises(data);
      } catch (e) {
        console.error("Error fetching exercises:", e);
        setError("Failed to load exercises.");
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, []);

  return (
    <div className="excerciselist section">
      <div className="excerciselist__inner">
        <div className="excerciselist__menu">
          <h2>
            All Exercises <span>({exercises.length})</span>
          </h2>
          <div className="excerciselist__menu__buttons">
            <button className="excerciselist__menu__buttons--search">
              Search...
            </button>
            <button className="excerciselist__menu__buttons--filter">
              Filter
            </button>
            <button
              onClick={() => navigate("/create-exercise")}
              className="excerciselist__menu__buttons--newexercise"
            >
              New Exercise
            </button>
          </div>
        </div>

        {loading && <p className="excerciselist__status">Loading...</p>}
        {error && (
          <p className="excerciselist__status excerciselist__status--error">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="excerciselist__exercise__wrapper">
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                className="excerciselist__exercise"
                onClick={() => navigate(`/exercise-detail/${exercise.id}`)}
              >
                {/* variant count can be added later */}
                {/* <div className="excerciselist__exercise__variants">
                </div> */}

                <div className="excerciselist__exercise__img">
                  <SketchThumbnail sketch={exercise.sketch} />
                </div>

                <div className="excerciselist__exercise__content">
                  <h3>{exercise.title}</h3>
                  {(exercise.description.length > 100 && (
                    <p>{exercise.description.substring(0, 100) + "..."}</p>
                  )) || <p>{exercise.description}</p>}

                  <div className="excerciselist__exercise__content--detail">
                    <div>
                      {(exercise.tags ?? []).map((tag) => (
                        <div
                          className={
                            "excerciselist__exercise__content__tags tags tags--" +
                            tag.toLowerCase()
                          }
                        >
                          <span
                            key={tag}
                            className="excerciselist__exercise__content__tags--tag"
                          >
                            {tag}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className={`difficulty difficulty--${exercise.difficulty}`}
                    >
                      <svg
                        width="21"
                        height="24"
                        viewBox="0 0 21 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          className={`difficulty__path1 difficulty--${exercise.difficulty}__path1`}
                          d="M0 17.5238H6V24H0V17.5238Z"
                          fill="#1E1E1E"
                        />
                        <path
                          className={`difficulty__path2 difficulty--${exercise.difficulty}__path2`}
                          d="M7.5 8.7619H13.5V24H7.5V8.7619Z"
                          fill="#1E1E1E"
                        />
                        <path
                          className={`difficulty__path3 difficulty--${exercise.difficulty}__path3`}
                          d="M15 0H21V24H15V0Z"
                          fill="#1E1E1E"
                        />
                      </svg>
                      <h4>{exercise.difficulty}</h4>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {exercises.length === 0 && (
              <p className="excerciselist__status">No exercises yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcerciseList;
