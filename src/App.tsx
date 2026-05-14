import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useAuth } from "./auth/authContext";
import Register from "./ui/components/auth/register/Register";
import Login from "./ui/components/auth/login/Login";
import ResetPassword from "./ui/components/auth/resetpassword/ResetPassword";
import Dashboard from "./ui/pages/Dashboard";

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
            <Route path="/" element={<Dashboard />} />
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
