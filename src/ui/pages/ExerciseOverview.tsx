import Navigation from "../components/navigation/Navigation";
import ExcerciseList from "../components/excerciselist/ExcerciseList";

export default function ExerciseOverview() {
  return (
    <>
      <Navigation />
      <div className="exerciseoverview">
        <ExcerciseList />
      </div>
    </>
  );
}
