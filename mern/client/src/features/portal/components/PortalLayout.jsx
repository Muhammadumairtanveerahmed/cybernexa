import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import ThemeToggle from "../../../components/common/ThemeToggle.jsx";
import portalCssUrl from "../../../styles/portal.css?url";
import extraCssUrl from "../../../styles/portal-extra.css?url";

const items = {
  dashboard: { to: "/portal/dashboard", label: "Dashboard", icon: "fa-chart-column" },
  enrollments: { to: "/portal/enrollments", label: "My Enrollments", icon: "fa-graduation-cap" },
  assignments: { to: "/portal/assignments", label: "Assignments", icon: "fa-pen-to-square" },
  quizzes: { to: "/portal/quizzes", label: "Quizzes", icon: "fa-flask" },
  marks: { to: "/portal/marks", label: "My Marks & Result", icon: "fa-chart-column" },
  timetable: { to: "/portal/timetable", label: "Timetable", icon: "fa-calendar-days" },
  attendance: { to: "/portal/attendance", label: "Attendance", icon: "fa-circle-check" },
  materials: { to: "/portal/materials", label: "Materials", icon: "fa-folder" },
  documents: { to: "/portal/documents", label: "My Documents", icon: "fa-file-lines" },
  fees: { to: "/portal/fees", label: "Fees & Payments", icon: "fa-sack-dollar" },
  messages: { to: "/portal/messages", label: "Messages & Calls", icon: "fa-comments" },
  announcements: { to: "/portal/announcements", label: "Announcements", icon: "fa-bullhorn" },
  notices: { to: "/portal/notices", label: "Notices", icon: "fa-bell" },
  profile: { to: "/portal/profile", label: "My Profile", icon: "fa-user" },
  courses: { to: "/portal/courses", label: "My Courses", icon: "fa-book-open" },
  qbank: { to: "/portal/qbank", label: "Question Bank", icon: "fa-database" },
  students: { to: "/portal/students", label: "My Students", icon: "fa-user-graduate" },
  teachers: { to: "/portal/teachers", label: "Teachers", icon: "fa-chalkboard-user" },
  logs: { to: "/portal/logs", label: "Login Logs", icon: "fa-clock-rotate-left" },
  calls: { to: "/portal/calls", label: "Call Logs", icon: "fa-phone" },
  resets: { to: "/portal/resets", label: "Password Resets", icon: "fa-key" },
  inbox: { to: "/portal/contact-messages", label: "Website Messages", icon: "fa-envelope" },
  subscribers: { to: "/portal/subscribers", label: "Subscribers", icon: "fa-users" }
};

const navByRole = {
  student: [
    { title: "Overview", keys: ["dashboard"] },
    { title: "Academics", keys: ["courses", "enrollments", "assignments", "quizzes", "marks"] },
    { title: "Class", keys: ["timetable", "attendance", "materials"] },
    { title: "Records", keys: ["documents", "fees"] },
    { title: "Communication", keys: ["messages", "announcements", "notices"] },
    { title: "Account", keys: ["profile"] }
  ],
  teacher: [
    { title: "Overview", keys: ["dashboard"] },
    { title: "Teaching", keys: ["courses", "assignments", "quizzes", "qbank", "students"] },
    { title: "Class", keys: ["timetable", "attendance", "materials"] },
    { title: "Communication", keys: ["messages", "announcements", "notices"] },
    { title: "Account", keys: ["profile", "documents"] }
  ],
  admin: [
    { title: "Overview", keys: ["dashboard"] },
    { title: "People", keys: ["students", "teachers"] },
    { title: "Academics", keys: ["enrollments", "courses", "assignments", "quizzes"] },
    { title: "Campus", keys: ["timetable", "attendance", "materials"] },
    { title: "Communication", keys: ["messages", "announcements", "notices"] },
    { title: "System", keys: ["logs", "calls", "resets", "inbox", "subscribers"] },
    { title: "Account", keys: ["profile"] }
  ]
};

function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function PortalLayout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const links = [portalCssUrl, extraCssUrl].map((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.technexaPortal = "true";
      document.head.appendChild(link);
      return link;
    });
    return () => links.forEach((link) => link.remove());
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="wrap">
        <div className="center">
          <div className="card narrow">
            <div className="loading">
              <i className="fa-solid fa-spinner fa-spin" /> Loading portal...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  const role = user.role || "student";
  const groups = navByRole[role] || navByRole.student;
  const photo = user.photo_url || user.photo || "";
  const isAdmin = role === "admin";

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <>
      <button
        className="portal-menu-btn"
        type="button"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <i className={`fa-solid ${menuOpen ? "fa-xmark" : "fa-bars"}`} aria-hidden="true" />
      </button>
      <div
        className={`side-backdrop${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <div className="shell">
        <aside className={`side${menuOpen ? " open" : ""}`}>
          <div className="brand">
            Tech<b>Nexa</b> {isAdmin ? "Admin" : "Portal"}
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <div className="grp">{group.title}</div>
              {group.keys.map((key) => {
                const item = items[key];
                const label =
                  key === "courses" && role === "admin"
                    ? "Courses"
                    : key === "students" && role === "admin"
                      ? "Students"
                      : item.label;
                const active =
                  location.pathname === item.to ||
                  (item.to !== "/portal/dashboard" && location.pathname.startsWith(`${item.to}/`));
                return (
                  <Link className={active ? "on" : ""} to={item.to} key={key}>
                    <i className={`fa-solid ${item.icon}`} aria-hidden="true" /> {label}
                  </Link>
                );
              })}
            </div>
          ))}

          <Link to="/" target="_blank" rel="noreferrer">
            <i className="fa-solid fa-globe" aria-hidden="true" /> View Website
          </Link>

          <div className="who">
            {photo ? (
              <span className="avatar lg" style={{ marginBottom: 8 }}>
                <img src={photo} alt={user.full_name} />
              </span>
            ) : (
              <span className="avatar lg" style={{ marginBottom: 8 }}>
                {initials(user.full_name)}
              </span>
            )}
            <div className="nm">{user.full_name}</div>
            <div>
              {role} · {user.email}
            </div>
            <button className="btn ghost sm" type="button" onClick={signOut} style={{ marginTop: 10 }}>
              Sign out
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="topline">
            <span className="muted-sm">{user.email}</span>
            <ThemeToggle className="portal-theme-toggle" />
            <button className="btn ghost sm" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>

          {user.status && user.status !== "active" ? (
            <div className="note" style={{ marginBottom: 18 }}>
              <h4>
                <i className="fa-solid fa-hourglass-half" aria-hidden="true" /> Account {user.status}
              </h4>
              <p>
                {role === "teacher"
                  ? "Your teacher application is waiting for admin approval. You can complete your profile meanwhile."
                  : `Your account is ${user.status}. Please contact the administration.`}
              </p>
            </div>
          ) : null}

          <Outlet />
        </main>
      </div>
    </>
  );
}
