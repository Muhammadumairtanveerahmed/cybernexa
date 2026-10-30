import { useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function NoticesPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(portalApi.notices, []);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const isStaff = user?.role === "teacher" || user?.role === "admin";

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.createNotice(form);
      setForm({ title: "", body: "", audience: "all" });
      setMessage("Notice published.");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not publish the notice.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    try {
      await portalApi.deleteNotice(id);
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the notice.");
    }
  };

  return (
    <PortalPage title="Notices" sub="Important announcements from the administration.">
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {error ? <div className="err">{error}</div> : null}

      {isStaff ? (
        <form className="panel" onSubmit={create}>
          <h2>Publish a notice</h2>
          <div className="form-grid">
            <div>
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="audience">Audience</label>
              <select id="audience" value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}>
                <option value="all">Everyone</option>
                <option value="students">Students</option>
                <option value="teachers">Teachers</option>
              </select>
            </div>
          </div>
          <label htmlFor="body">Message</label>
          <textarea id="body" rows={4} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
          <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Publishing..." : "Publish notice"}
          </button>
        </form>
      ) : null}

      <div className="panel">
        <h2>Notice board</h2>
        {loading ? (
          <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading...</div>
        ) : !data?.length ? (
          <EmptyState icon="fa-bell" text="No notices yet." />
        ) : (
          <div className="stack">
            {data.map((notice) => (
              <div className="note" key={notice.id}>
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <h4>{notice.title}</h4>
                  <span className="muted-sm">{formatDate(notice.created_at, true)}</span>
                </div>
                <p>{notice.body}</p>
                <div className="inline" style={{ marginTop: 8 }}>
                  <span className="tag">{notice.audience}</span>
                  {user?.role === "admin" ? (
                    <button className="btn danger sm" type="button" onClick={() => remove(notice.id)}>
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalPage>
  );
}
