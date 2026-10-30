import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";

export default function MarksPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch(portalApi.marks, []);
  const isStudent = user?.role === "student";
  const submissions = data?.submissions || [];
  const attempts = data?.attempts || [];

  return (
    <PortalPage
      title={isStudent ? "My Marks & Result" : "Marks & Results"}
      sub={isStudent ? "Your graded assignments and quiz results." : "Submission and quiz performance records."}
    >
      {error ? <div className="err">{error}</div> : null}

      <div className="panel">
        <h2>Assignment marks</h2>
        <DataTable
          rows={submissions}
          loading={loading}
          empty="No graded assignments yet."
          columns={[
            ...(!isStudent
              ? [{ key: "student_name", label: "Student", render: (row) => row.student_name || "—" }]
              : []),
            { key: "assignment_title", label: "Assignment" },
            { key: "course_title", label: "Course" },
            { key: "max_marks", label: "Max marks" },
            {
              key: "marks",
              label: "Marks",
              render: (row) => (row.marks === null || row.marks === undefined ? "—" : `${row.marks}/${row.max_marks}`)
            },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "graded_at", label: "Graded", render: (row) => formatDate(row.graded_at) },
            { key: "feedback", label: "Feedback" }
          ]}
        />
      </div>

      {isStudent ? (
        <div className="panel">
          <h2>Quiz results</h2>
          <DataTable
            rows={attempts}
            loading={loading}
            empty="No quiz attempts yet."
            columns={[
              { key: "quiz_title", label: "Quiz" },
              { key: "course_title", label: "Course" },
              { key: "score", label: "Score", render: (row) => `${row.score}/${row.total}` },
              {
                key: "percent",
                label: "Percent",
                render: (row) => `${row.total ? Math.round((Number(row.score) / Number(row.total)) * 100) : 0}%`
              },
              {
                key: "passed",
                label: "Result",
                render: (row) => {
                  const percent = row.total ? Math.round((Number(row.score) / Number(row.total)) * 100) : 0;
                  return <Badge status={percent >= Number(row.pass_percent || 50) ? "completed" : "rejected"} label={percent >= Number(row.pass_percent || 50) ? "Passed" : "Failed"} />;
                }
              },
              { key: "submitted_at", label: "Submitted", render: (row) => formatDate(row.submitted_at, true) }
            ]}
          />
        </div>
      ) : null}
    </PortalPage>
  );
}
