import { useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";

const kinds = [
  ["cnic", "CNIC"],
  ["photo", "Photo"],
  ["payment", "Payment receipt"],
  ["qualification", "Qualification"],
  ["cv", "CV"],
  ["other", "Other"]
];

export default function DocumentsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(portalApi.documents, []);
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("other");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (event) => {
    event.preventDefault();
    if (!file) {
      setMessage("Choose a file first.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("kind", kind);
    body.append("label", label);
    body.append("scope", user?.role === "teacher" ? "teacher" : user?.role === "admin" ? "admin" : "student");
    setBusy(true);
    setMessage("");
    try {
      await portalApi.uploadDocument(body);
      setFile(null);
      setLabel("");
      setMessage("Document uploaded.");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not upload the document.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this document?")) return;
    try {
      await portalApi.deleteDocument(id);
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the document.");
    }
  };

  return (
    <PortalPage title="My Documents" sub="Upload and manage your private documents.">
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {error ? <div className="err">{error}</div> : null}

      <form className="panel" onSubmit={upload}>
        <h2>Upload a document</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="file">File</label>
            <input id="file" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </div>
          <div>
            <label htmlFor="kind">Document type</label>
            <select id="kind" value={kind} onChange={(event) => setKind(event.target.value)}>
              {kinds.map(([value, text]) => (
                <option value={value} key={value}>{text}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="label">Label</label>
            <input id="label" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. CNIC front" />
          </div>
        </div>
        <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "Uploading..." : "Upload document"}
        </button>
      </form>

      <div className="panel">
        <h2>My documents</h2>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No documents uploaded yet."
          columns={[
            ...(user?.role === "admin"
              ? [{ key: "owner_name", label: "Owner", render: (row) => row.owner_name || "—" }]
              : []),
            { key: "originalname", label: "File" },
            { key: "kind", label: "Type" },
            { key: "label", label: "Label" },
            { key: "uploaded_at", label: "Uploaded", render: (row) => formatDate(row.uploaded_at, true) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <a className="btn ghost" href={`/api/portal/documents/${row.id}/download`} target="_blank" rel="noreferrer">
                    Download
                  </a>
                  <button className="btn danger" type="button" onClick={() => remove(row.id)}>
                    Delete
                  </button>
                </div>
              )
            }
          ]}
        />
      </div>
    </PortalPage>
  );
}
