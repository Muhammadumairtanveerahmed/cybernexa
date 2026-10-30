import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";

export default function SubscribersPage() {
  const { data, loading, error } = useFetch(portalApi.admin.subscribers, []);
  return (
    <PortalPage title="Newsletter Subscribers" sub="People who subscribed through the public website footer.">
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <h2>Subscriber list</h2>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No newsletter subscribers yet."
          columns={[
            { key: "email", label: "Email" },
            { key: "created_at", label: "Subscribed", render: (row) => formatDate(row.created_at, true) }
          ]}
        />
      </div>
    </PortalPage>
  );
}
