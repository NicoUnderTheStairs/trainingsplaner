import Navigation from "../components/navigation/Navigation";
import { useEffect, useState } from "react";

export default function Dashboard() {
  useEffect(() => {
    // Firestore: load group polygons
  }, []);

  return (
    <>
      <div className="dashboard">
        <Navigation />
      </div>
    </>
  );
}
