import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "../features/auth/components/AuthLayout.jsx";
import RouteFallback from "../components/common/RouteFallback.jsx";

// Route groups are split so the public site ships without the portal bundle
// (and vice versa). Chat, calls and quiz screens only download when visited.
const PublicRoutes = lazy(() => import("./PublicRoutes.jsx"));
const PortalRoutes = lazy(() => import("./PortalRoutes.jsx"));
const LoginPage = lazy(() => import("../features/auth/pages/LoginPage.jsx"));
const RegisterChooserPage = lazy(() => import("../features/auth/pages/RegisterChooserPage.jsx"));
const StudentRegisterPage = lazy(() => import("../features/auth/pages/StudentRegisterPage.jsx"));
const TeacherRegisterPage = lazy(() => import("../features/auth/pages/TeacherRegisterPage.jsx"));
const ForgotPasswordPage = lazy(() => import("../features/auth/pages/ForgotPasswordPage.jsx"));
const ResetPasswordPage = lazy(() => import("../features/auth/pages/ResetPasswordPage.jsx"));

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterChooserPage />} />
          <Route path="/register/student" element={<StudentRegisterPage />} />
          <Route path="/register/teacher" element={<TeacherRegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        <Route path="/portal/*" element={<PortalRoutes />} />
        <Route path="/admin/*" element={<Navigate to="/portal/dashboard" replace />} />
        <Route path="/*" element={<PublicRoutes />} />
      </Routes>
    </Suspense>
  );
}
