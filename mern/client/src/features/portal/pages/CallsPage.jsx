import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";

export default function CallsPage() {
  const { data, loading, error } = useFetch(portalApi.admin.calls, []);
  return (
    <PortalPage title="Call Logs" sub="Audio and video call history across the platform.">
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <h2>Call history</h2>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No calls recorded yet."
          columns={[
            { key: "caller_name", label: "Caller", render: (row) => row.caller_name || row.caller_id },
            { key: "callee_name", label: "Callee", render: (row) => row.callee_name || row.callee_id },
            { key: "kind", label: "Type" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "started_at", label: "Started", render: (row) => formatDate(row.started_at, true) },
            { key: "ended_at", label: "Ended", render: (row) => formatDate(row.ended_at, true) },
            {
              key: "recording",
              label: "Recording",
              render: (row) =>
                row.recording_file ? (
                  <audio
                    controls
                    preload="none"
                    src={`/api/portal/calls/${row.call_key}/recording`}
                    style={{ height: 32, maxWidth: 220 }}
                  />
                ) : (
                  <span className="muted-sm">Not recorded</span>
                )
            }
          ]}
        />
      </div>
    </PortalPage>
  );
}
