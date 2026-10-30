import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";

export default function LogsPage() {
  const { data, loading, error } = useFetch(portalApi.admin.logs, []);
  return (
    <PortalPage title="Login Logs" sub="Successful, failed and blocked sign-in attempts.">
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <h2>Authentication activity</h2>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No login activity yet."
          columns={[
            { key: "full_name", label: "User", render: (row) => row.full_name || "—" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role", render: (row) => row.role || "—" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "ip", label: "IP", render: (row) => row.ip || "—" },
            { key: "created_at", label: "Time", render: (row) => formatDate(row.created_at, true) }
          ]}
        />
      </div>
    </PortalPage>
  );
}
