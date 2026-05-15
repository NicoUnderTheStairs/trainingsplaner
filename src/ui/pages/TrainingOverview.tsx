import Navigation from "../components/navigation/Navigation";
import TrainingList from "../components/traininglist/TrainingList";

export default function ExerciseOverview() {
  return (
    <>
      <Navigation />
      <div className="exerciseoverview">
        <TrainingList />
      </div>
    </>
  );
}
