import { Navigate, Route, Routes } from "react-router-dom";
import PublicRoutes from "./PublicRoutes.jsx";
import PortalRoutes from "./PortalRoutes.jsx";
import AuthLayout from "../features/auth/components/AuthLayout.jsx";
import LoginPage from "../features/auth/pages/LoginPage.jsx";
import RegisterChooserPage from "../features/auth/pages/RegisterChooserPage.jsx";
import StudentRegisterPage from "../features/auth/pages/StudentRegisterPage.jsx";
import TeacherRegisterPage from "../features/auth/pages/TeacherRegisterPage.jsx";
import ForgotPasswordPage from "../features/auth/pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage.jsx";

export default function AppRoutes() {
  return (
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
  );
}
