import Navigation from "../components/navigation/Navigation";
import MatchList from "../components/matchlist/MatchList";

export default function MatchOverview() {
  return (
    <>
      <Navigation />
      <div className="exerciseoverview">
        <MatchList />
      </div>
    </>
  );
}
