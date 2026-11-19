import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import PortalLayout from "../features/portal/components/PortalLayout.jsx";

// Each portal screen is its own chunk: the dashboard does not pay for the
// quiz, chat or admin screens unless the user opens them.
const DashboardPage = lazy(() => import("../features/portal/pages/DashboardPage.jsx"));
const ProfilePage = lazy(() => import("../features/portal/pages/ProfilePage.jsx"));
const EnrollmentsPage = lazy(() => import("../features/portal/pages/EnrollmentsPage.jsx"));
const FeesPage = lazy(() => import("../features/portal/pages/FeesPage.jsx"));
const DocumentsPage = lazy(() => import("../features/portal/pages/DocumentsPage.jsx"));
const NoticesPage = lazy(() => import("../features/portal/pages/NoticesPage.jsx"));
const AssignmentsPage = lazy(() => import("../features/portal/pages/AssignmentsPage.jsx"));
const MarksPage = lazy(() => import("../features/portal/pages/MarksPage.jsx"));
const AttendancePage = lazy(() => import("../features/portal/pages/AttendancePage.jsx"));
const TimetablePage = lazy(() => import("../features/portal/pages/TimetablePage.jsx"));
const MaterialsPage = lazy(() => import("../features/portal/pages/MaterialsPage.jsx"));
const LecturesPage = lazy(() => import("../features/portal/pages/LecturesPage.jsx"));
const LectureWatchPage = lazy(() => import("../features/portal/pages/LectureWatchPage.jsx"));
const AnnouncementsPage = lazy(() => import("../features/portal/pages/AnnouncementsPage.jsx"));
const QuizzesPage = lazy(() => import("../features/portal/pages/QuizzesPage.jsx"));
const QuizTakePage = lazy(() => import("../features/portal/pages/QuizTakePage.jsx"));
const MessagesPage = lazy(() => import("../features/portal/pages/MessagesPage.jsx"));
const CoursesPortalPage = lazy(() => import("../features/portal/pages/CoursesPortalPage.jsx"));
const StudentsPage = lazy(() => import("../features/portal/pages/StudentsPage.jsx"));
const TeachersPage = lazy(() => import("../features/portal/pages/TeachersPage.jsx"));
const QuestionBankPage = lazy(() => import("../features/portal/pages/QuestionBankPage.jsx"));
const LogsPage = lazy(() => import("../features/portal/pages/LogsPage.jsx"));
const CallsPage = lazy(() => import("../features/portal/pages/CallsPage.jsx"));
const QuizViolationsPage = lazy(() => import("../features/portal/pages/QuizViolationsPage.jsx"));
const ResetsPage = lazy(() => import("../features/portal/pages/ResetsPage.jsx"));
const ContactMessagesPage = lazy(() => import("../features/portal/pages/ContactMessagesPage.jsx"));
const SubscribersPage = lazy(() => import("../features/portal/pages/SubscribersPage.jsx"));

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
        <Route path="lectures" element={<LecturesPage />} />
        <Route path="lectures/:id" element={<LectureWatchPage />} />
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
          path="quiz-violations"
          element={
            <RoleGuard roles={["admin"]}>
              <QuizViolationsPage />
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
