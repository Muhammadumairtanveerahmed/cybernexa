import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate, formatMoney, formatTime, dayName } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import StatCard from "../components/StatCard.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import EmptyState from "../components/EmptyState.jsx";

function MiniList({ items, empty, render }) {
  if (!items?.length) return <EmptyState text={empty} />;
  return <div className="mini-list">{items.map(render)}</div>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || "student";
  const loader = role === "admin" ? portalApi.admin.stats : portalApi.dashboard;
  const { data, loading, error } = useFetch(loader, [role]);

  if (loading) {
    return (
      <PortalPage title="Dashboard" sub="Loading your workspace...">
        <div className="loading">
          <i className="fa-solid fa-spinner fa-spin" /> Loading dashboard...
        </div>
      </PortalPage>
    );
  }

  if (error) {
    return (
      <PortalPage title="Dashboard" sub="Your workspace overview">
        <div className="err">{error}</div>
      </PortalPage>
    );
  }

  if (role === "student") {
    const stats = data?.stats || {};
    return (
      <PortalPage
        title={`Welcome back, ${(user.full_name || "").split(" ")[0] || "Student"}`}
        sub="Here is your academic overview."
        actions={
          <Link className="btn primary sm" to="/courses">
            Browse courses
          </Link>
        }
      >
        <div className="cards">
          <StatCard icon="fa-graduation-cap" value={stats.enrollments || 0} label="Enrollments" hint={`${stats.approved || 0} approved`} />
          <StatCard icon="fa-pen-to-square" value={stats.pendingAssignments || 0} label="Pending assignments" tone="amber" />
          <StatCard icon="fa-flask" value={stats.availableQuizzes || 0} label="Quizzes available" tone="green" />
          <StatCard icon="fa-circle-check" value={`${stats.attendancePercent || 0}%`} label="Attendance" tone="green" />
          <StatCard icon="fa-sack-dollar" value={formatMoney(stats.due || 0)} label="Fees due" tone={stats.due ? "red" : "green"} />
        </div>

        <div className="panel">
          <h2>Attendance progress</h2>
          <div className="progress">
            <i style={{ width: `${Math.min(100, stats.attendancePercent || 0)}%` }} />
          </div>
          <p className="muted-sm" style={{ marginTop: 8 }}>
            {stats.attendancePercent || 0}% of recorded classes attended. Keep it above 70% for certification.
          </p>
        </div>

        <div className="panel">
          <h2>My enrollments</h2>
          <DataTable
            rows={data?.enrollments || []}
            empty="You have not enrolled in a course yet."
            columns={[
              { key: "course_title", label: "Course" },
              { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
              { key: "payment_status", label: "Payment", render: (row) => <Badge status={row.payment_status} /> },
              { key: "amount_total", label: "Fee", render: (row) => formatMoney(row.amount_total) },
              { key: "paid", label: "Paid", render: (row) => formatMoney(row.paid) },
              { key: "created_at", label: "Applied", render: (row) => formatDate(row.created_at) }
            ]}
          />
        </div>

        <div className="panel">
          <h2>Upcoming assignments</h2>
          <MiniList
            items={data?.assignments || []}
            empty="No assignments right now."
            render={(assignment) => (
              <div className="mini-item" key={assignment.id}>
                <i className="fa-solid fa-pen-to-square mi-icon" aria-hidden="true" />
                <div className="mi-body">
                  <b>{assignment.title}</b>
                  <span>
                    {assignment.course_title} · Due {formatDate(assignment.due_date)} · {assignment.max_marks} marks
                  </span>
                </div>
                <span className="mi-meta">
                  {assignment.submission_id ? <Badge status={assignment.submission_status} /> : "Not submitted"}
                </span>
              </div>
            )}
          />
        </div>

        <div className="panel">
          <h2>Available quizzes</h2>
          <MiniList
            items={data?.quizzes || []}
            empty="No quizzes published yet."
            render={(quiz) => (
              <div className="mini-item" key={quiz.id}>
                <i className="fa-solid fa-flask mi-icon" aria-hidden="true" />
                <div className="mi-body">
                  <b>{quiz.title}</b>
                  <span>
                    {quiz.audience === "all" ? "All students" : quiz.course_title} · {quiz.duration_minutes} min ·{" "}
            {quiz.audience === "all" ? "Open to everyone" : "Course students"}
                  </span>
                </div>
                <span className="mi-meta">
                  {quiz.attempt_status === "submitted" ? (
                    <Badge status="completed" label={`${quiz.score}/${quiz.total}`} />
                  ) : quiz.attempt_status === "in_progress" ? (
                    <Badge status="pending" label="In progress" />
                  ) : (
                    <Link className="btn primary sm" to={`/portal/quizzes/${quiz.id}`}>Start</Link>
                  )}
                </span>
              </div>
            )}
          />
        </div>

        <div className="panel">
          <h2>Notices</h2>
          <MiniList
            items={data?.notices || []}
            empty="No notices yet."
            render={(notice) => (
              <div className="mini-item" key={notice.id}>
                <i className="fa-solid fa-bell mi-icon" aria-hidden="true" />
                <div className="mi-body">
                  <b>{notice.title}</b>
                  <span>{notice.body}</span>
                </div>
                <span className="mi-meta">{formatDate(notice.created_at)}</span>
              </div>
            )}
          />
        </div>

        <div className="panel">
          <h2>Recent payments</h2>
          <DataTable
            rows={data?.payments || []}
            empty="No payments recorded yet."
            columns={[
              { key: "course_title", label: "Course" },
              { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount) },
              { key: "method", label: "Method" },
              { key: "paid_at", label: "Date", render: (row) => formatDate(row.paid_at) }
            ]}
          />
        </div>
      </PortalPage>
    );
  }

  if (role === "teacher") {
    const stats = data?.stats || {};
    return (
      <PortalPage
        title={`Welcome, ${(user.full_name || "").split(" ")[0] || "Teacher"}`}
        sub="Your teaching overview."
        actions={
          <Link className="btn primary sm" to="/portal/assignments">
            Create assignment
          </Link>
        }
      >
        <div className="cards">
          <StatCard icon="fa-book-open" value={stats.courses || 0} label="Courses" />
          <StatCard icon="fa-user-graduate" value={stats.students || 0} label="Students" tone="green" />
          <StatCard icon="fa-pen-to-square" value={stats.assignments || 0} label="Assignments" />
          <StatCard icon="fa-flask" value={stats.quizzes || 0} label="Quizzes" tone="green" />
          <StatCard icon="fa-hourglass-half" value={stats.pendingSubmissions || 0} label="Pending submissions" tone="amber" />
        </div>

        <div className="panel">
          <h2>Recent submissions</h2>
          <DataTable
            rows={data?.recentSubmissions || []}
            empty="No submissions yet."
            columns={[
              { key: "student_name", label: "Student" },
              { key: "assignment_title", label: "Assignment" },
              { key: "course_title", label: "Course" },
              { key: "submitted_at", label: "Submitted", render: (row) => formatDate(row.submitted_at, true) },
              { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> }
            ]}
          />
        </div>

        <div className="panel">
          <h2>Recent enrollments</h2>
          <DataTable
            rows={data?.recentEnrollments || []}
            empty="No enrollments in your courses yet."
            columns={[
              { key: "student_name", label: "Student" },
              { key: "course_title", label: "Course" },
              { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
              { key: "created_at", label: "Applied", render: (row) => formatDate(row.created_at) }
            ]}
          />
        </div>

        <div className="panel">
          <h2>Upcoming classes</h2>
          <MiniList
            items={data?.upcomingClasses || []}
            empty="No timetable slots yet."
            render={(slot) => (
              <div className="mini-item" key={slot.id}>
                <i className="fa-solid fa-calendar-days mi-icon" aria-hidden="true" />
                <div className="mi-body">
                  <b>{slot.course_title}</b>
                  <span>
                    {dayName(slot.day_of_week)} · {formatTime(slot.start_time)} to {formatTime(slot.end_time)}
                  </span>
                </div>
                <span className="mi-meta">{slot.room || "—"}</span>
              </div>
            )}
          />
        </div>

        <div className="panel">
          <h2>My announcements</h2>
          <MiniList
            items={data?.announcements || []}
            empty="No announcements yet."
            render={(announcement) => (
              <div className="mini-item" key={announcement.id}>
                <i className="fa-solid fa-bullhorn mi-icon" aria-hidden="true" />
                <div className="mi-body">
                  <b>{announcement.title}</b>
                  <span>{announcement.body}</span>
                </div>
                <span className="mi-meta">{formatDate(announcement.created_at)}</span>
              </div>
            )}
          />
        </div>
      </PortalPage>
    );
  }

  const stats = data?.stats || {};
  return (
    <PortalPage
      title="Admin dashboard"
      sub="Platform health, people and revenue at a glance."
      actions={
        <Link className="btn primary sm" to="/portal/enrollments">
          Review enrollments
        </Link>
      }
    >
      <div className="cards">
        <StatCard icon="fa-user-graduate" value={stats.students || 0} label="Students" />
        <StatCard icon="fa-chalkboard-user" value={stats.teachers || 0} label="Teachers" />
        <StatCard icon="fa-graduation-cap" value={stats.enrollments || 0} label="Enrollments" />
        <StatCard icon="fa-sack-dollar" value={formatMoney(stats.revenue || 0)} label="Revenue" tone="green" />
        <StatCard icon="fa-hourglass-half" value={stats.pendingTeachers || 0} label="Pending teachers" tone="amber" />
        <StatCard icon="fa-shield-halved" value={stats.failedLogins || 0} label="Failed logins" tone="red" />
      </div>

      <div className="panel">
        <h2>Recent enrollments</h2>
        <DataTable
          rows={data?.recentEnrollments || []}
          empty="No enrollments yet."
          columns={[
            { key: "student_name", label: "Student" },
            { key: "course_title", label: "Course" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "payment_status", label: "Payment", render: (row) => <Badge status={row.payment_status} /> },
            { key: "created_at", label: "Applied", render: (row) => formatDate(row.created_at) }
          ]}
        />
      </div>

      <div className="panel">
        <h2>Recent login activity</h2>
        <DataTable
          rows={data?.recentLogs || []}
          empty="No login activity yet."
          columns={[
            { key: "full_name", label: "User" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "created_at", label: "Time", render: (row) => formatDate(row.created_at, true) }
          ]}
        />
      </div>
    </PortalPage>
  );
}
