import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import StatCard from "../components/StatCard.jsx";
import Modal from "../components/Modal.jsx";

function StudentAttendance() {
  const { data, loading, error } = useFetch(portalApi.attendance, []);
  const rows = data || [];
  const attended = rows.filter((row) => row.status === "present" || row.status === "late").length;
  const percent = rows.length ? Math.round((attended / rows.length) * 100) : 0;

  return (
    <>
      {error ? <div className="err">{error}</div> : null}
      <div className="cards">
        <StatCard icon="fa-calendar-check" value={rows.length} label="Recorded classes" />
        <StatCard icon="fa-circle-check" value={attended} label="Attended" tone="green" />
        <StatCard icon="fa-percent" value={`${percent}%`} label="Attendance" tone={percent >= 70 ? "green" : "red"} />
      </div>
      <div className="panel">
        <h2>Attendance record</h2>
        <DataTable
          rows={rows}
          loading={loading}
          empty="No attendance has been recorded yet."
          columns={[
            { key: "session_date", label: "Date", render: (row) => formatDate(row.session_date) },
            { key: "course_title", label: "Course" },
            { key: "topic", label: "Topic" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> }
          ]}
        />
      </div>
    </>
  );
}

function StaffAttendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const attendance = useFetch(portalApi.attendance, []);
  const students = useFetch(portalApi.students, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    course_title: "",
    session_date: new Date().toISOString().slice(0, 10),
    topic: ""
  });
  const [records, setRecords] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openForm = () => {
    setForm({ course_title: courseOptions[0] || "", session_date: new Date().toISOString().slice(0, 10), topic: "" });
    setRecords((students.data || []).map((student) => ({ student_id: student.id, status: "present" })));
    setOpen(true);
  };

  const setStatus = (studentId, status) => {
    setRecords((current) => current.map((record) => (record.student_id === studentId ? { ...record, status } : record)));
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.saveAttendance({ ...form, records });
      setOpen(false);
      setMessage("Attendance saved.");
      await attendance.reload();
    } catch (err) {
      setMessage(err.message || "Could not save attendance.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this attendance session?")) return;
    try {
      await portalApi.deleteAttendance(id);
      await attendance.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the session.");
    }
  };

  return (
    <>
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {attendance.error ? <div className="err">{attendance.error}</div> : null}
      <div className="panel">
        <div className="inline" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2>Attendance sessions</h2>
          <button className="btn primary sm" type="button" onClick={openForm}>New session</button>
        </div>
        <DataTable
          rows={attendance.data?.sessions || []}
          loading={attendance.loading}
          empty="No attendance sessions yet."
          columns={[
            { key: "session_date", label: "Date", render: (row) => formatDate(row.session_date) },
            { key: "course_title", label: "Course" },
            { key: "topic", label: "Topic" },
            { key: "teacher_name", label: "Teacher", render: (row) => row.teacher_name || "—" },
            { key: "attended", label: "Present", render: (row) => `${row.attended || 0}/${row.total || 0}` },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button className="btn danger" type="button" onClick={() => remove(row.id)}>Delete</button>
              )
            }
          ]}
        />
      </div>

      <Modal
        open={open}
        title="New attendance session"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="attendance-form" disabled={busy}>
              {busy ? "Saving..." : "Save attendance"}
            </button>
          </>
        }
      >
        <form id="attendance-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="att-course">Course</label>
              <select id="att-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))} required>
                <option value="">Select course</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="att-date">Date</label>
              <input id="att-date" type="date" value={form.session_date} onChange={(event) => setForm((current) => ({ ...current, session_date: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="att-topic">Topic</label>
              <input id="att-topic" value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} />
            </div>
          </div>

          <h3 style={{ margin: "18px 0 10px", fontSize: ".95rem" }}>Students</h3>
          {!records.length ? (
            <p className="muted-sm">No students found. Add students to your course first.</p>
          ) : (
            <div className="stack">
              {records.map((record) => {
                const student = (students.data || []).find((row) => row.id === record.student_id);
                return (
                  <div className="inline" key={record.student_id} style={{ justifyContent: "space-between" }}>
                    <span>{student?.full_name || record.student_id}</span>
                    <select value={record.status} onChange={(event) => setStatus(record.student_id, event.target.value)} style={{ width: 130 }}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  return (
    <PortalPage title="Attendance" sub={isStaff ? "Record and review class attendance." : "Your class attendance record."}>
      {isStaff ? <StaffAttendance /> : <StudentAttendance />}
    </PortalPage>
  );
}
