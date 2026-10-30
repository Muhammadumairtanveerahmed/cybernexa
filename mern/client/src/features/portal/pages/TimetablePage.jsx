import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { dayName, formatTime } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";

export default function TimetablePage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const timetable = useFetch(portalApi.timetable, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    course_title: "",
    day_of_week: 1,
    start_time: "09:00",
    end_time: "10:00",
    room: ""
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openForm = () => {
    setForm({ course_title: courseOptions[0] || "", day_of_week: 1, start_time: "09:00", end_time: "10:00", room: "" });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.addTimetable(form);
      setOpen(false);
      setMessage("Timetable slot added.");
      await timetable.reload();
    } catch (err) {
      setMessage(err.message || "Could not add the slot.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this timetable slot?")) return;
    try {
      await portalApi.deleteTimetable(id);
      await timetable.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the slot.");
    }
  };

  return (
    <PortalPage
      title="Timetable"
      sub={isStaff ? "Weekly class schedule for your courses." : "Your weekly class schedule."}
      actions={isStaff ? <button className="btn primary sm" type="button" onClick={openForm}>Add slot</button> : null}
    >
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {timetable.error ? <div className="err">{timetable.error}</div> : null}

      <div className="panel">
        <h2>Weekly schedule</h2>
        <DataTable
          rows={timetable.data || []}
          loading={timetable.loading}
          empty="No timetable slots have been added yet."
          columns={[
            { key: "day_of_week", label: "Day", render: (row) => dayName(row.day_of_week) },
            { key: "start_time", label: "Start", render: (row) => formatTime(row.start_time) },
            { key: "end_time", label: "End", render: (row) => formatTime(row.end_time) },
            { key: "course_title", label: "Course" },
            { key: "room", label: "Room", render: (row) => row.room || "—" },
            { key: "teacher_name", label: "Teacher", render: (row) => row.teacher_name || "—" },
            ...(isStaff
              ? [
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <button className="btn danger" type="button" onClick={() => remove(row.id)}>Delete</button>
                    )
                  }
                ]
              : [])
          ]}
        />
      </div>

      <Modal
        open={open}
        title="Add timetable slot"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="timetable-form" disabled={busy}>
              {busy ? "Saving..." : "Add slot"}
            </button>
          </>
        }
      >
        <form id="timetable-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="tt-course">Course</label>
              <select id="tt-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))} required>
                <option value="">Select course</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tt-day">Day</label>
              <select id="tt-day" value={form.day_of_week} onChange={(event) => setForm((current) => ({ ...current, day_of_week: event.target.value }))}>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => <option value={day} key={day}>{dayName(day)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="tt-start">Start time</label>
              <input id="tt-start" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="tt-end">End time</label>
              <input id="tt-end" type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="tt-room">Room / link</label>
              <input id="tt-room" value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} placeholder="Lab 2 or Zoom link" />
            </div>
          </div>
        </form>
      </Modal>
    </PortalPage>
  );
}
