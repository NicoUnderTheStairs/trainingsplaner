import Navigation from "../components/navigation/Navigation";
import ExcerciseList from "../components/excerciselist/excerciselist";

export default function Home() {
  return (
    <>
      <Navigation />
      <div className="home">
        <ExcerciseList />
      </div>
    </>
  );
}
