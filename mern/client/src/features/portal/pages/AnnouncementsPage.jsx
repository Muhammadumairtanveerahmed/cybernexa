import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const announcements = useFetch(portalApi.announcements, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ course_title: "", title: "", body: "", pinned: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openForm = () => {
    setForm({ course_title: courseOptions[0] || "", title: "", body: "", pinned: false });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.createAnnouncement(form);
      setOpen(false);
      setMessage("Announcement published.");
      await announcements.reload();
    } catch (err) {
      setMessage(err.message || "Could not publish the announcement.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await portalApi.deleteAnnouncement(id);
      await announcements.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the announcement.");
    }
  };

  return (
    <PortalPage
      title="Announcements"
      sub={isStaff ? "Share course updates with your students." : "Updates from your teachers."}
      actions={isStaff ? <button className="btn primary sm" type="button" onClick={openForm}>New announcement</button> : null}
    >
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {announcements.error ? <div className="err">{announcements.error}</div> : null}

      <div className="panel">
        <h2>Course announcements</h2>
        {announcements.loading ? (
          <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading...</div>
        ) : !announcements.data?.length ? (
          <EmptyState icon="fa-bullhorn" text="No announcements yet." />
        ) : (
          <div className="stack">
            {announcements.data.map((announcement) => (
              <div className="note" key={announcement.id}>
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <h4>
                    {announcement.pinned ? <i className="fa-solid fa-thumbtack" aria-hidden="true" style={{ color: "var(--acc)", marginRight: 6 }} /> : null}
                    {announcement.title}
                  </h4>
                  <span className="muted-sm">{formatDate(announcement.created_at, true)}</span>
                </div>
                <p>{announcement.body}</p>
                <div className="inline" style={{ marginTop: 8 }}>
                  <span className="tag">{announcement.course_title}</span>
                  {announcement.teacher_name ? <span className="muted-sm">{announcement.teacher_name}</span> : null}
                  {isStaff ? (
                    <button className="btn danger sm" type="button" onClick={() => remove(announcement.id)}>Delete</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={open}
        title="New announcement"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="announcement-form" disabled={busy}>
              {busy ? "Publishing..." : "Publish"}
            </button>
          </>
        }
      >
        <form id="announcement-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="an-course">Course</label>
              <select id="an-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))} required>
                <option value="">Select course</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="an-title">Title</label>
              <input id="an-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
          </div>
          <label htmlFor="an-body">Message</label>
          <textarea id="an-body" rows={5} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
          <label className="inline" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={form.pinned} onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))} />
            Pin this announcement
          </label>
        </form>
      </Modal>
    </PortalPage>
  );
}
