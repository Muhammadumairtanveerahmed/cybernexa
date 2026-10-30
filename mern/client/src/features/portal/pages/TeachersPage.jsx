import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";

export default function TeachersPage() {
  const teachers = useFetch(portalApi.admin.teachers, []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: "pending", rejection_reason: "", qualification: "", expertise: "", experience_years: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const rows = useMemo(() => {
    const list = teachers.data || [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((teacher) =>
      [teacher.full_name, teacher.email, teacher.qualification, teacher.expertise]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [teachers.data, search]);

  const openReview = (teacher) => {
    setSelected(teacher);
    setForm({
      status: teacher.status || "pending",
      rejection_reason: teacher.rejection_reason || "",
      qualification: teacher.qualification || "",
      expertise: teacher.expertise || "",
      experience_years: teacher.experience_years || 0
    });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await portalApi.admin.updateTeacher(selected.id, form);
      setSelected(null);
      setMessage("Teacher updated.");
      await teachers.reload();
    } catch (err) {
      setMessage(err.message || "Could not update the teacher.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalPage title="Teachers" sub="Review teacher applications and manage active faculty.">
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {teachers.error ? <div className="err">{teachers.error}</div> : null}

      <div className="panel">
        <div className="search-row">
          <h2 style={{ margin: 0, flex: 1 }}>Faculty directory</h2>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teachers..." aria-label="Search teachers" />
        </div>
        <DataTable
          rows={rows}
          loading={teachers.loading}
          empty="No teacher applications yet."
          columns={[
            { key: "full_name", label: "Teacher" },
            { key: "email", label: "Email" },
            { key: "qualification", label: "Qualification", render: (row) => row.qualification || "—" },
            { key: "expertise", label: "Expertise", render: (row) => row.expertise || "—" },
            { key: "experience_years", label: "Experience", render: (row) => `${row.experience_years || 0} yrs` },
            { key: "course_count", label: "Courses", render: (row) => row.course_count || 0 },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "applied_at", label: "Applied", render: (row) => formatDate(row.applied_at || row.created_at) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button className="btn primary" type="button" onClick={() => openReview(row)}>Review</button>
              )
            }
          ]}
        />
      </div>

      <Modal
        open={Boolean(selected)}
        title={`Review · ${selected?.full_name || ""}`}
        onClose={() => setSelected(null)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn primary" type="submit" form="teacher-review-form" disabled={busy}>
              {busy ? "Saving..." : "Save review"}
            </button>
          </>
        }
      >
        <form id="teacher-review-form" onSubmit={save}>
          <p className="muted-sm" style={{ marginBottom: 12 }}>
            {selected?.email} · {selected?.experience_years || 0} years experience
            {selected?.cv_file ? (
              <>
                {" · "}
                <a href={selected.cv_file} target="_blank" rel="noreferrer" style={{ color: "var(--acc)" }}>View CV</a>
              </>
            ) : null}
          </p>
          <div className="form-grid">
            <div>
              <label htmlFor="tr-status">Status</label>
              <select id="tr-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="pending">Pending</option>
                <option value="active">Approved / active</option>
                <option value="suspended">Suspended</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label htmlFor="tr-experience">Experience (years)</label>
              <input id="tr-experience" type="number" min="0" max="60" value={form.experience_years} onChange={(event) => setForm((current) => ({ ...current, experience_years: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="tr-qualification">Qualification</label>
              <input id="tr-qualification" value={form.qualification} onChange={(event) => setForm((current) => ({ ...current, qualification: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="tr-expertise">Expertise</label>
              <input id="tr-expertise" value={form.expertise} onChange={(event) => setForm((current) => ({ ...current, expertise: event.target.value }))} />
            </div>
          </div>
          {form.status === "rejected" ? (
            <>
              <label htmlFor="tr-reason">Rejection reason</label>
              <textarea id="tr-reason" rows={3} value={form.rejection_reason} onChange={(event) => setForm((current) => ({ ...current, rejection_reason: event.target.value }))} />
            </>
          ) : null}
        </form>
      </Modal>
    </PortalPage>
  );
}
