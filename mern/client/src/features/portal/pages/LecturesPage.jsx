import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";

function statusBadge(status) {
  if (status === "published") return <span className="badge b-approved">Published</span>;
  if (status === "draft") return <span className="badge b-pending">Draft</span>;
  return <span className="badge">{status || "—"}</span>;
}

function procBadge(status) {
  if (status === "ready") return <span className="badge b-approved">Ready</span>;
  if (status === "processing") return <span className="badge b-pending">Processing</span>;
  if (status === "pending") return <span className="badge b-pending">Queued</span>;
  if (status === "failed") return <span className="badge b-rejected">Failed</span>;
  if (status === "not_required") return <span className="badge">YouTube</span>;
  return <span className="badge">{status || "—"}</span>;
}

export default function LecturesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const lectures = useFetch(portalApi.lectures, []);
  const courses = useFetch(() => (isAdmin ? portalApi.admin.courses() : portalApi.courses()), [isAdmin]);

  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    course_title: "",
    title: "",
    description: "",
    lecture_type: "upload",
    youtube_url: "",
    status: "draft"
  });
  const [video, setVideo] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openCreate = () => {
    setEditItem(null);
    setForm({
      course_title: courseOptions[0] || "",
      title: "",
      description: "",
      lecture_type: "upload",
      youtube_url: "",
      status: "draft"
    });
    setVideo(null);
    setThumbnail(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    setEditItem(row);
    setForm({
      course_title: row.course_title || "",
      title: row.title || "",
      description: row.description || "",
      lecture_type: row.lecture_type || "upload",
      youtube_url: row.youtube_url || "",
      status: row.status || "draft"
    });
    setVideo(null);
    setThumbnail(null);
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("course_title", form.course_title);
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("lecture_type", form.lecture_type);
      body.append("status", form.status);
      if (form.lecture_type === "youtube") {
        body.append("youtube_url", form.youtube_url);
      }
      if (video) body.append("video", video);
      if (thumbnail) body.append("thumbnail", thumbnail);

      if (editItem) {
        await portalApi.updateLecture(editItem.id, body);
        setMessage("Lecture updated.");
      } else {
        await portalApi.createLecture(body);
        setMessage("Lecture created.");
      }
      setOpen(false);
      await lectures.reload();
    } catch (err) {
      setMessage(err.message || "Could not save the lecture.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm("Delete this lecture and its files?")) return;
    try {
      await portalApi.deleteLecture(row.id);
      await lectures.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the lecture.");
    }
  };

  const rows = lectures.data || [];

  return (
    <PortalPage
      title="Lectures"
      sub={isStaff ? "Upload videos or share YouTube lectures for your courses." : "Watch assigned course lectures and track your progress."}
      actions={isStaff ? <button className="btn primary sm" type="button" onClick={openCreate}>New lecture</button> : null}
    >
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {lectures.error ? <div className="err">{lectures.error}</div> : null}

      <div className="panel">
        <h2>{isStaff ? "All lectures" : "Available lectures"}</h2>
        <DataTable
          rows={rows}
          loading={lectures.loading}
          empty={isStaff ? "No lectures yet." : "No lectures available for your enrolled courses."}
          columns={[
            { key: "title", label: "Title" },
            { key: "course_title", label: "Course" },
            { key: "lecture_type", label: "Type", render: (row) => (row.lecture_type === "youtube" ? "YouTube" : "Video upload") },
            ...(isStaff
              ? [
                  { key: "status", label: "Status", render: (row) => statusBadge(row.status) },
                  { key: "processing_status", label: "Processing", render: (row) => procBadge(row.processing_status) }
                ]
              : []),
            { key: "teacher_name", label: "Teacher", render: (row) => row.teacher_name || "—" },
            { key: "created_at", label: "Added", render: (row) => formatDate(row.created_at) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <Link className="btn ghost" to={`/portal/lectures/${row.id}`}>
                    {isStaff ? "View" : "Watch"}
                  </Link>
                  {isStaff ? (
                    <>
                      <button className="btn ghost" type="button" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button className="btn danger" type="button" onClick={() => remove(row)}>
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      </div>

      <Modal
        open={open}
        title={editItem ? "Edit lecture" : "New lecture"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="lecture-form" disabled={busy}>
              {busy ? "Saving..." : "Save lecture"}
            </button>
          </>
        }
      >
        <form id="lecture-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="lec-course">Course</label>
              <select
                id="lec-course"
                value={form.course_title}
                onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))}
                required
              >
                <option value="">Select course</option>
                {courseOptions.map((title) => (
                  <option value={title} key={title}>
                    {title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lec-title">Title</label>
              <input
                id="lec-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="lec-type">Type</label>
              <select
                id="lec-type"
                value={form.lecture_type}
                onChange={(event) => setForm((current) => ({ ...current, lecture_type: event.target.value }))}
                required
              >
                <option value="upload">Video upload (MP4)</option>
                <option value="youtube">YouTube link</option>
              </select>
            </div>
            <div>
              <label htmlFor="lec-status">Status</label>
              <select
                id="lec-status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          {form.lecture_type === "youtube" ? (
            <div>
              <label htmlFor="lec-yt">YouTube URL</label>
              <input
                id="lec-yt"
                value={form.youtube_url}
                onChange={(event) => setForm((current) => ({ ...current, youtube_url: event.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                required={form.lecture_type === "youtube"}
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="lec-video">Video file (MP4 / MOV / MKV / WebM)</label>
                <input
                  id="lec-video"
                  type="file"
                  accept="video/*"
                  onChange={(event) => setVideo(event.target.files?.[0] || null)}
                  required={!editItem || form.lecture_type !== "upload"}
                />
                {editItem ? <p className="form-note">Leave empty to keep the current video.</p> : null}
              </div>
            </>
          )}
          <div>
            <label htmlFor="lec-thumb">Thumbnail (optional)</label>
            <input
              id="lec-thumb"
              type="file"
              accept="image/*"
              onChange={(event) => setThumbnail(event.target.files?.[0] || null)}
            />
          </div>
          <label htmlFor="lec-desc">Description</label>
          <textarea
            id="lec-desc"
            rows={3}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </form>
      </Modal>
    </PortalPage>
  );
}