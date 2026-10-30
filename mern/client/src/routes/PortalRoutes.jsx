import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PortalLayout from "../features/portal/components/PortalLayout.jsx";
import DashboardPage from "../features/portal/pages/DashboardPage.jsx";
import ProfilePage from "../features/portal/pages/ProfilePage.jsx";
import EnrollmentsPage from "../features/portal/pages/EnrollmentsPage.jsx";
import FeesPage from "../features/portal/pages/FeesPage.jsx";
import DocumentsPage from "../features/portal/pages/DocumentsPage.jsx";
import NoticesPage from "../features/portal/pages/NoticesPage.jsx";
import AssignmentsPage from "../features/portal/pages/AssignmentsPage.jsx";
import MarksPage from "../features/portal/pages/MarksPage.jsx";
import AttendancePage from "../features/portal/pages/AttendancePage.jsx";
import TimetablePage from "../features/portal/pages/TimetablePage.jsx";
import MaterialsPage from "../features/portal/pages/MaterialsPage.jsx";
import AnnouncementsPage from "../features/portal/pages/AnnouncementsPage.jsx";
import QuizzesPage from "../features/portal/pages/QuizzesPage.jsx";
import QuizTakePage from "../features/portal/pages/QuizTakePage.jsx";
import MessagesPage from "../features/portal/pages/MessagesPage.jsx";
import CoursesPortalPage from "../features/portal/pages/CoursesPortalPage.jsx";
import StudentsPage from "../features/portal/pages/StudentsPage.jsx";
import TeachersPage from "../features/portal/pages/TeachersPage.jsx";
import QuestionBankPage from "../features/portal/pages/QuestionBankPage.jsx";
import LogsPage from "../features/portal/pages/LogsPage.jsx";
import CallsPage from "../features/portal/pages/CallsPage.jsx";
import ResetsPage from "../features/portal/pages/ResetsPage.jsx";
import ContactMessagesPage from "../features/portal/pages/ContactMessagesPage.jsx";
import SubscribersPage from "../features/portal/pages/SubscribersPage.jsx";

function RoleGuard({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/portal/dashboard" replace />;
  return children;
}

export default function PortalRoutes() {
  return (
    <Routes>
      <Route element={<PortalLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="enrollments" element={<EnrollmentsPage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="notices" element={<NoticesPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="marks" element={<MarksPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="timetable" element={<TimetablePage />} />
        <Route path="materials" element={<MaterialsPage />} />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="quizzes" element={<QuizzesPage />} />
        <Route path="quizzes/:id" element={<QuizTakePage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="courses" element={<CoursesPortalPage />} />
        <Route
          path="students"
          element={
            <RoleGuard roles={["teacher", "admin"]}>
              <StudentsPage />
            </RoleGuard>
          }
        />
        <Route
          path="teachers"
          element={
            <RoleGuard roles={["admin"]}>
              <TeachersPage />
            </RoleGuard>
          }
        />
        <Route
          path="qbank"
          element={
            <RoleGuard roles={["teacher", "admin"]}>
              <QuestionBankPage />
            </RoleGuard>
          }
        />
        <Route
          path="logs"
          element={
            <RoleGuard roles={["admin"]}>
              <LogsPage />
            </RoleGuard>
          }
        />
        <Route
          path="calls"
          element={
            <RoleGuard roles={["admin"]}>
              <CallsPage />
            </RoleGuard>
          }
        />
        <Route
          path="resets"
          element={
            <RoleGuard roles={["admin"]}>
              <ResetsPage />
            </RoleGuard>
          }
        />
        <Route
          path="contact-messages"
          element={
            <RoleGuard roles={["admin"]}>
              <ContactMessagesPage />
            </RoleGuard>
          }
        />
        <Route
          path="subscribers"
          element={
            <RoleGuard roles={["admin"]}>
              <SubscribersPage />
            </RoleGuard>
          }
        />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
}
