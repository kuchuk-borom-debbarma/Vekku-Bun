import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";

const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
};

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
};