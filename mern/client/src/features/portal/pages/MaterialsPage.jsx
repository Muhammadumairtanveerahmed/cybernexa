import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";

const MAX_MATERIAL_MB = 500;

export default function MaterialsPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const materials = useFetch(portalApi.materials, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ course_title: "", title: "", description: "", external_url: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openForm = () => {
    setForm({ course_title: courseOptions[0] || "", title: "", description: "", external_url: "" });
    setFile(null);
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (file && file.size > MAX_MATERIAL_MB * 1024 * 1024) {
      setMessage(`File is too large. Materials can be up to ${MAX_MATERIAL_MB} MB.`);
      return;
    }
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (file) body.append("file", file);
    setBusy(true);
    setMessage("");
    try {
      await portalApi.addMaterial(body, file ? { timeout: 0 } : undefined);
      setOpen(false);
      setMessage("Material added.");
      await materials.reload();
    } catch (err) {
      setMessage(err.message || "Could not add the material.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this material?")) return;
    try {
      await portalApi.deleteMaterial(id);
      await materials.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the material.");
    }
  };

  return (
    <PortalPage
      title="Materials"
      sub={isStaff ? "Share notes, slides and resources with your students." : "Notes, slides and resources shared by your teachers."}
      actions={isStaff ? <button className="btn primary sm" type="button" onClick={openForm}>Add material</button> : null}
    >
      {message ? (
        <div className={message.includes("Could not") || message.includes("too large") ? "err" : "ok"}>{message}</div>
      ) : null}
      {materials.error ? <div className="err">{materials.error}</div> : null}

      <div className="panel">
        <h2>Course materials</h2>
        <DataTable
          rows={materials.data || []}
          loading={materials.loading}
          empty="No materials have been shared yet."
          columns={[
            { key: "title", label: "Title" },
            { key: "course_title", label: "Course" },
            { key: "description", label: "Description" },
            { key: "teacher_name", label: "Teacher", render: (row) => row.teacher_name || "—" },
            { key: "created_at", label: "Added", render: (row) => formatDate(row.created_at) },
            {
              key: "links",
              label: "Resource",
              render: (row) => (
                <div className="table-actions">
                  {row.doc_id ? (
                    <a className="btn ghost" href={`/api/portal/documents/${row.doc_id}/download`} target="_blank" rel="noreferrer">Download</a>
                  ) : null}
                  {row.external_url ? (
                    <a className="btn ghost" href={row.external_url} target="_blank" rel="noreferrer">Open link</a>
                  ) : null}
                  {!row.doc_id && !row.external_url ? <span className="muted-sm">—</span> : null}
                </div>
              )
            },
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
        title="Add material"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="material-form" disabled={busy}>
              {busy ? "Saving..." : "Add material"}
            </button>
          </>
        }
      >
        <form id="material-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="m-course">Course</label>
              <select id="m-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))} required>
                <option value="">Select course</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="m-title">Title</label>
              <input id="m-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="m-file">File</label>
              <input id="m-file" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <small className="muted-sm">PDF, DOC/PPT, image, text or ZIP up to {MAX_MATERIAL_MB} MB.</small>
            </div>
            <div>
              <label htmlFor="m-url">External link</label>
              <input id="m-url" value={form.external_url} onChange={(event) => setForm((current) => ({ ...current, external_url: event.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <label htmlFor="m-description">Description</label>
          <textarea id="m-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </form>
      </Modal>
    </PortalPage>
  );
}
