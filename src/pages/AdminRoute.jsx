import React from "react";
import { Navigate } from "react-router-dom";
import { useUserAuth } from "../auth/AuthContext";

const AdminRoute = ({ children }) => {
  const { authReady, session, isAdmin, isConfiguredAdminEmail } = useUserAuth();

  if (!authReady) {
    return null;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin && !isConfiguredAdminEmail(session?.email || "")) {
    return <Navigate to="/admin/signin" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;