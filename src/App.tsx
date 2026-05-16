import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./auth/authContext";
import Register from "./ui/components/auth/register/Register";
import Login from "./ui/components/auth/login/Login";
import ResetPassword from "./ui/components/auth/resetpassword/ResetPassword";
import Home from "./ui/pages/Home";
import CreateExcercise from "./ui/pages/CreateExcercise";
import CreateTraining from "./ui/pages/CreateTraining";
import ExerciseDetail from "./ui/pages/ExerciseDetail";
import TrainingDetail from "./ui/pages/TrainingDetail";
import TrainingOverview from "./ui/pages/TrainingOverview";
import ExerciseOverview from "./ui/pages/ExerciseOverview";

const App: React.FC = () => {
  const { userLoggedIn, currentUser } = useAuth() || {
    currentUser: null,
    userLoggedIn: false,
    loading: false,
  };

  console.log(currentUser);

  return (
    <Router>
      <Routes>
        {userLoggedIn ? (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/exercise-overview" element={<ExerciseOverview />} />
            <Route path="/training-overview" element={<TrainingOverview />} />
            <Route path="/create-exercise" element={<CreateExcercise />} />
            <Route path="/create-training" element={<CreateTraining />} />
            <Route
              path="/exercise-detail/:exerciseId"
              element={<ExerciseDetail />}
            />
            <Route
              path="/training-detail/:trainingId"
              element={<TrainingDetail />}
            />
          </>
        ) : (
          <>
            <Route path="/" element={<Login />} />
            <Route path="*" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/resetpassword" element={<ResetPassword />} />
          </>
        )}
      </Routes>
    </Router>
  );
};

export default App;
