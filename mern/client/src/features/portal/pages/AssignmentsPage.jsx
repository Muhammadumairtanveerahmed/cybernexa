import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";

function StudentAssignments() {
  const { data, loading, error, reload } = useFetch(portalApi.assignments, []);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const open = (assignment) => {
    setSelected(assignment);
    setNote("");
    setFile(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const body = new FormData();
    body.append("note", note);
    if (file) body.append("file", file);
    setBusy(true);
    setMessage("");
    try {
      await portalApi.submitAssignment(selected.id, body);
      setSelected(null);
      setMessage("Assignment submitted.");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not submit the assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <h2>Assignments</h2>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No assignments have been published for your courses yet."
          columns={[
            { key: "title", label: "Assignment" },
            { key: "course_title", label: "Course" },
            { key: "due_date", label: "Due", render: (row) => formatDate(row.due_date, true) },
            { key: "max_marks", label: "Marks" },
            {
              key: "status",
              label: "Submission",
              render: (row) =>
                row.submission_id ? <Badge status={row.submission_status} /> : <Badge status="pending" label="Not submitted" />
            },
            {
              key: "marks",
              label: "Result",
              render: (row) => (row.marks === null || row.marks === undefined ? "—" : `${row.marks}/${row.max_marks}`)
            },
            {
              key: "actions",
              label: "Action",
              render: (row) => (
                <button className="btn primary sm" type="button" onClick={() => open(row)}>
                  {row.submission_id ? "Resubmit" : "Submit"}
                </button>
              )
            }
          ]}
        />
      </div>

      <div className="panel">
        <h2>Feedback</h2>
        {loading ? (
          <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading...</div>
        ) : !data?.filter((row) => row.feedback).length ? (
          <EmptyState icon="fa-comment-dots" text="No feedback yet." />
        ) : (
          <div className="stack">
            {data.filter((row) => row.feedback).map((row) => (
              <div className="note" key={row.id}>
                <h4>{row.title}</h4>
                <p>{row.feedback}</p>
                <span className="muted-sm">Marks: {row.marks}/{row.max_marks}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        title={selected?.title || "Submit assignment"}
        onClose={() => setSelected(null)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn primary" type="submit" form="submit-assignment" disabled={busy}>
              {busy ? "Submitting..." : "Submit"}
            </button>
          </>
        }
      >
        <form id="submit-assignment" onSubmit={submit}>
          <p className="muted-sm" style={{ marginBottom: 12 }}>
            {selected?.course_title} · Due {formatDate(selected?.due_date, true)} · {selected?.max_marks} marks
          </p>
          <label htmlFor="note">Note for your teacher</label>
          <textarea id="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          <label htmlFor="submission-file">Attach file</label>
          <input id="submission-file" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <p className="form-note">PDF, DOC, DOCX, ZIP or image. Maximum 20 MB.</p>
        </form>
      </Modal>
    </>
  );
}

function StaffAssignments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const assignments = useFetch(portalApi.assignments, []);
  const submissions = useFetch(portalApi.submissions, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [tab, setTab] = useState("assignments");
  const [openForm, setOpenForm] = useState(false);
  const [grading, setGrading] = useState(null);
  const [form, setForm] = useState({
    title: "",
    course_title: "",
    description: "",
    due_date: "",
    max_marks: 100,
    status: "published"
  });
  const [file, setFile] = useState(null);
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const courseOptions = useMemo(() => {
    const rows = courses.data || [];
    return rows.map((course) => course.title || course.course_title).filter(Boolean);
  }, [courses.data]);

  const create = async (event) => {
    event.preventDefault();
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (file) body.append("file", file);
    setBusy(true);
    setMessage("");
    try {
      await portalApi.createAssignment(body);
      setOpenForm(false);
      setForm({ title: "", course_title: "", description: "", due_date: "", max_marks: 100, status: "published" });
      setFile(null);
      setMessage("Assignment created.");
      await assignments.reload();
    } catch (err) {
      setMessage(err.message || "Could not create the assignment.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this assignment and all its submissions?")) return;
    try {
      await portalApi.deleteAssignment(id);
      await assignments.reload();
      await submissions.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the assignment.");
    }
  };

  const openGrade = (row) => {
    setGrading(row);
    setGradeForm({ marks: row.marks ?? "", feedback: row.feedback || "" });
  };

  const grade = async (event) => {
    event.preventDefault();
    if (!grading) return;
    setBusy(true);
    try {
      await portalApi.gradeSubmission(grading.id, gradeForm);
      setGrading(null);
      setMessage("Submission graded.");
      await submissions.reload();
      await assignments.reload();
    } catch (err) {
      setMessage(err.message || "Could not grade the submission.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {assignments.error ? <div className="err">{assignments.error}</div> : null}

      <div className="tabs">
        <button className={`tab${tab === "assignments" ? " on" : ""}`} type="button" onClick={() => setTab("assignments")}>
          Assignments
        </button>
        <button className={`tab${tab === "submissions" ? " on" : ""}`} type="button" onClick={() => setTab("submissions")}>
          Submissions
        </button>
      </div>

      {tab === "assignments" ? (
        <div className="panel">
          <div className="inline" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h2>My assignments</h2>
            <button className="btn primary sm" type="button" onClick={() => setOpenForm(true)}>
              New assignment
            </button>
          </div>
          <DataTable
            rows={assignments.data || []}
            loading={assignments.loading}
            empty="No assignments yet."
            columns={[
              { key: "title", label: "Title" },
              { key: "course_title", label: "Course" },
              { key: "due_date", label: "Due", render: (row) => formatDate(row.due_date, true) },
              { key: "max_marks", label: "Marks" },
              { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
              { key: "submission_count", label: "Submissions" },
              { key: "pending_count", label: "To grade", render: (row) => <Badge status={row.pending_count ? "pending" : "completed"} label={String(row.pending_count || 0)} /> },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="table-actions">
                    <button className="btn ghost" type="button" onClick={() => remove(row.id)}>Delete</button>
                  </div>
                )
              }
            ]}
          />
        </div>
      ) : (
        <div className="panel">
          <h2>Student submissions</h2>
          <DataTable
            rows={submissions.data || []}
            loading={submissions.loading}
            empty="No submissions yet."
            columns={[
              { key: "student_name", label: "Student" },
              { key: "assignment_title", label: "Assignment" },
              { key: "course_title", label: "Course" },
              { key: "submitted_at", label: "Submitted", render: (row) => formatDate(row.submitted_at, true) },
              { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
              { key: "marks", label: "Marks", render: (row) => (row.marks === null || row.marks === undefined ? "—" : `${row.marks}/${row.max_marks}`) },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="table-actions">
                    {row.doc_id ? (
                      <a className="btn ghost" href={`/api/portal/documents/${row.doc_id}/download`} target="_blank" rel="noreferrer">File</a>
                    ) : null}
                    <button className="btn primary" type="button" onClick={() => openGrade(row)}>Grade</button>
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      <Modal
        open={openForm}
        title="Create assignment"
        onClose={() => setOpenForm(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpenForm(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="assignment-form" disabled={busy}>
              {busy ? "Creating..." : "Create assignment"}
            </button>
          </>
        }
      >
        <form id="assignment-form" onSubmit={create}>
          <div className="form-grid">
            <div>
              <label htmlFor="a-title">Title</label>
              <input id="a-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="a-course">Course</label>
              <select id="a-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))} required>
                <option value="">Select course</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="a-due">Due date</label>
              <input id="a-due" type="datetime-local" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="a-marks">Maximum marks</label>
              <input id="a-marks" type="number" min="1" value={form.max_marks} onChange={(event) => setForm((current) => ({ ...current, max_marks: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="a-status">Status</label>
              <select id="a-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label htmlFor="a-file">Brief / attachment</label>
              <input id="a-file" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </div>
          </div>
          <label htmlFor="a-description">Description</label>
          <textarea id="a-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          {courses.error ? <p className="err">{courses.error}</p> : null}
        </form>
      </Modal>

      <Modal
        open={Boolean(grading)}
        title={`Grade · ${grading?.student_name || ""}`}
        onClose={() => setGrading(null)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setGrading(null)}>Cancel</button>
            <button className="btn primary" type="submit" form="grade-form" disabled={busy}>
              {busy ? "Saving..." : "Save grade"}
            </button>
          </>
        }
      >
        <form id="grade-form" onSubmit={grade}>
          <p className="muted-sm" style={{ marginBottom: 12 }}>
            {grading?.assignment_title} · {grading?.course_title} · max {grading?.max_marks} marks
          </p>
          <div className="form-grid">
            <div>
              <label htmlFor="g-marks">Marks</label>
              <input id="g-marks" type="number" min="0" max={grading?.max_marks || 100} value={gradeForm.marks} onChange={(event) => setGradeForm((current) => ({ ...current, marks: event.target.value }))} required />
            </div>
          </div>
          <label htmlFor="g-feedback">Feedback</label>
          <textarea id="g-feedback" rows={4} value={gradeForm.feedback} onChange={(event) => setGradeForm((current) => ({ ...current, feedback: event.target.value }))} />
        </form>
      </Modal>
    </>
  );
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  return (
    <PortalPage
      title="Assignments"
      sub={isStaff ? "Create assignments and grade student submissions." : "View, submit and track your assignments."}
    >
      {isStaff ? <StaffAssignments /> : <StudentAssignments />}
    </PortalPage>
  );
}
