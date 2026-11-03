import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";

const labels = {
  screen_hidden: "Screen left / off",
  window_blur: "Window focus lost",
  fullscreen_exit: "Fullscreen exited",
  page_leave: "Page leave attempt",
  copy_attempt: "Content copied",
  other: "Other"
};

export default function QuizViolationsPage() {
  const { data, loading, error } = useFetch(portalApi.admin.quizViolations, []);
  const rows = data || [];

  return (
    <PortalPage
      title="Quiz Violations"
      sub="Screen-off, tab-switch, focus-loss and copy events recorded during student quizzes."
    >
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <div className="inline" style={{ justifyContent: "space-between", gap: 10 }}>
          <h2>Violation log</h2>
          <span className="tag">
            {loading ? "Loading..." : `${rows.length} event${rows.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <DataTable
          rows={rows}
          loading={loading}
          empty="No quiz violations recorded yet."
          columns={[
            {
              key: "student_name",
              label: "Student",
              render: (row) => (
                <div>
                  <b>{row.student_name || row.student_id}</b>
                  <div className="muted-sm">{row.student_email || ""}</div>
                </div>
              )
            },
            {
              key: "quiz_title",
              label: "Quiz",
              render: (row) => (
                <div>
                  <b>{row.quiz_title || row.quiz_id}</b>
                  <div className="muted-sm">{row.course_title || ""}</div>
                </div>
              )
            },
            {
              key: "violation_type",
              label: "Violation",
              render: (row) => (
                <Badge
                  status="rejected"
                  label={labels[row.violation_type] || row.violation_type}
                />
              )
            },
            { key: "details", label: "Details", render: (row) => row.details || "—" },
            {
              key: "ip",
              label: "IP",
              render: (row) => row.ip || "—"
            },
            {
              key: "occurred_at",
              label: "Time",
              render: (row) => formatDate(row.occurred_at, true)
            }
          ]}
        />
      </div>
    </PortalPage>
  );
}
