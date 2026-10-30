import { useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";

export default function ResetsPage() {
  const { data, loading, error, reload } = useFetch(portalApi.admin.resets, []);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResetUrl("");
    try {
      const response = await portalApi.admin.createReset({ email });
      setResetUrl(response.data?.data?.resetUrl || "");
      setMessage("Reset link generated.");
      setEmail("");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not generate a reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalPage title="Password Resets" sub="Generate secure password reset links for users.">
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {resetUrl ? (
        <div className="panel">
          <h2>Reset link</h2>
          <p className="muted-sm">Share this link privately with the user. It expires in 1 hour.</p>
          <div className="code">{resetUrl}</div>
          <button className="btn ghost" type="button" onClick={() => navigator.clipboard?.writeText(resetUrl)} style={{ marginTop: 10 }}>
            Copy link
          </button>
        </div>
      ) : null}

      <form className="panel" onSubmit={create}>
        <h2>Generate a reset link</h2>
        <div className="form-grid">
          <div>
            <label htmlFor="reset-email">User email</label>
            <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
        </div>
        <button className="btn primary" type="submit" disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "Generating..." : "Generate link"}
        </button>
      </form>

      <div className="panel">
        <h2>Reset history</h2>
        {error ? <div className="err">{error}</div> : null}
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No reset requests yet."
          columns={[
            { key: "full_name", label: "User", render: (row) => row.full_name || "—" },
            { key: "email", label: "Email" },
            { key: "requested_at", label: "Requested", render: (row) => formatDate(row.requested_at, true) },
            { key: "expires_at", label: "Expires", render: (row) => formatDate(row.expires_at, true) },
            { key: "used", label: "Used", render: (row) => <Badge status={row.used ? "completed" : "pending"} label={row.used ? "Yes" : "No"} /> }
          ]}
        />
      </div>
    </PortalPage>
  );
}
