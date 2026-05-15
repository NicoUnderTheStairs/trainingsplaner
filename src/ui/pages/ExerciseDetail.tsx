import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import Navigation from "../components/navigation/Navigation";
import SketchThumbnail from "../components/sketch/SketchThumbnail";
import type { Exercise } from "../../types/Exercise";
import db from "../../firebase";

const ExerciseDetail = () => {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!exerciseId) return;
    const fetch = async () => {
      const snap = await getDoc(doc(db, "Excercises", exerciseId));
      if (snap.exists())
        setExercise({ id: snap.id, ...snap.data() } as Exercise);
      setLoading(false);
    };
    fetch();
  }, [exerciseId]);

  if (loading) return <p>Loading...</p>;
  if (!exercise) return <p>Exercise not found.</p>;

  return (
    <>
      <Navigation />
      <div className="exercisedetail">
        <div className="exercisedetail__inner">
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

          <div className="exercisedetail__menu">
            <div className="exercisedetail__menu__text">
              <h1>{exercise.title}</h1>
              <p>{exercise.description}</p>
              <div className="exercisedetail__menu__details">
                <div className="exercisedetail__menu__details--difficulty">
                  <h4>Difficulty:</h4>
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
                <div className="exercisedetail__menu__details--tags">
                  {(exercise.tags ?? []).map((tag) => (
                    <div
                      key={tag}
                      className={
                        "excerciselist__exercise__content__tags tags tags--" +
                        tag.toLowerCase()
                      }
                    >
                      <span className="excerciselist__exercise__content__tags--tag">
                        {tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="exercisedetail__menu__btn__wrapper">
              <button className="exercisedetail__menu__btn">
                <svg
                  width="33"
                  height="33"
                  viewBox="0 0 33 33"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18.128 14.1438L18.1412 2.00654C18.1412 1.47441 17.9298 0.964063 17.5535 0.587766C17.1772 0.211468 16.6668 4.6073e-05 16.1347 8.24807e-06C15.6026 -2.95769e-05 15.0923 0.211319 14.716 0.587563C14.3398 0.963807 14.1284 1.47412 14.1285 2.00625L14.1435 14.1435L2.00623 14.1285C1.47411 14.1285 0.963788 14.3398 0.587544 14.716C0.2113 15.0923 -4.98448e-05 15.6026 -1.20199e-05 16.1347C2.5805e-05 16.6669 0.211449 17.1772 0.587746 17.5535C0.964043 17.9298 1.47439 18.1412 2.00652 18.1413L14.1437 18.128L14.1305 30.2652C14.1294 30.529 14.1806 30.7904 14.2811 31.0343C14.3815 31.2782 14.5293 31.4999 14.7158 31.6864C14.9024 31.8729 15.124 32.0207 15.3679 32.1212C15.6118 32.2216 15.8732 32.2728 16.137 32.2718C16.4008 32.2729 16.6622 32.2217 16.9061 32.1213C17.15 32.0209 17.3716 31.8731 17.5581 31.6866C17.7446 31.5001 17.8924 31.2785 17.9928 31.0346C18.0932 30.7907 18.1444 30.5293 18.1433 30.2655L18.1283 18.1283L30.2655 18.1433C30.5293 18.1444 30.7907 18.0932 31.0346 17.9928C31.2785 17.8924 31.5001 17.7446 31.6866 17.5581C31.8731 17.3716 32.0208 17.15 32.1213 16.9061C32.2217 16.6622 32.2728 16.4008 32.2717 16.137C32.2728 15.8732 32.2216 15.6118 32.1212 15.3679C32.0207 15.124 31.8729 14.9024 31.6864 14.7158C31.4998 14.5293 31.2782 14.3815 31.0343 14.2811C30.7904 14.1806 30.529 14.1294 30.2652 14.1305L18.128 14.1438Z"
                    fill="#1E1E1E"
                  />
                </svg>
                Add to training
              </button>
              <button className="exercisedetail__menu__btn">
                <svg
                  width="26"
                  height="24"
                  viewBox="0 0 26 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M19.2754 1.5C22.2429 1.5 24.4998 3.75726 24.5 6.79199C24.5 8.52207 24.2672 9.79464 23.8379 10.8643C23.4088 11.9333 22.7465 12.892 21.7627 13.9512C20.7617 15.0288 19.4807 16.1562 17.8262 17.6025C16.4436 18.8112 14.8339 20.216 13 21.9346C11.1661 20.216 9.55644 18.8112 8.17383 17.6025C6.51934 16.1562 5.2383 15.0288 4.2373 13.9512C3.25348 12.892 2.59124 11.9333 2.16211 10.8643C1.73284 9.79464 1.5 8.52207 1.5 6.79199C1.50023 3.75726 3.7571 1.5 6.72461 1.5C8.77382 1.50018 10.5736 2.70206 11.71 4.61523L13 6.78613L14.29 4.61523C15.4264 2.70206 17.2262 1.50018 19.2754 1.5Z"
                    stroke="#1E1E1E"
                    strokeWidth="3"
                  />
                </svg>
              </button>
              <button className="exercisedetail__menu__btn">
                <svg
                  width="18"
                  height="24"
                  viewBox="0 0 18 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16.8756 21.5929H1.12977C0.831474 21.5929 0.545402 21.7198 0.334478 21.9454C0.123556 22.1711 0.00506036 22.4772 0.00506036 22.7964C0.00506036 23.1156 0.123556 23.4217 0.334478 23.6474C0.545402 23.873 0.831474 23.9999 1.12977 23.9999H16.8756C17.1739 23.9999 17.46 23.873 17.671 23.6474C17.8818 23.4217 18.0004 23.1156 18.0004 22.7964C18.0004 22.4772 17.8818 22.1711 17.671 21.9454C17.46 21.7198 17.1739 21.5929 16.8756 21.5929Z"
                    fill="#1E1E1E"
                  />
                  <path
                    d="M1.12943 19.1861H1.23066L5.92067 18.7288C6.43444 18.674 6.91495 18.4318 7.28156 18.0428L17.404 7.21152C17.7968 6.76739 18.0091 6.17473 17.9944 5.5634C17.9796 4.95206 17.739 4.37192 17.3251 3.9501L14.2435 0.652573C13.8413 0.248321 13.3142 0.0163667 12.7626 0.000833716C12.211 -0.0146993 11.6733 0.187273 11.2518 0.568331L1.12943 11.3996C0.765888 11.7919 0.53953 12.3061 0.48835 12.8558L0.00472708 17.8744C-0.0104239 18.0505 0.0109516 18.2282 0.0673295 18.3947C0.123707 18.5611 0.2137 18.7122 0.330892 18.8371C0.435984 18.9486 0.56062 19.0369 0.69765 19.0968C0.834682 19.1567 0.981413 19.187 1.12943 19.1861ZM12.6802 2.33744L15.7506 5.62292L13.5012 7.9697L10.487 4.74439L12.6802 2.33744ZM2.67028 13.0604L9.00236 6.33298L12.0391 9.58236L5.74072 16.3218L2.3666 16.6588L2.67028 13.0604Z"
                    fill="#1E1E1E"
                  />
                </svg>
              </button>
              <button className="exercisedetail__menu__btn exercisedetail__menu__btn--danger">
                Delete
              </button>
            </div>
          </div>

          <div className="exercisedetail__sketch">
            {exercise.sketch ? (
              <SketchThumbnail sketch={exercise.sketch} />
            ) : (
              <p className="exercisedetail__sketch--empty">
                No sketch available.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ExerciseDetail;
