import { portalApi } from "../../../api/portal.api.js";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";

export default function ContactMessagesPage() {
  const { data, loading, error } = useFetch(portalApi.admin.contactMessages, []);
  return (
    <PortalPage title="Contact Messages" sub="Enquiries submitted through the public website.">
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <h2>Website enquiries</h2>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No contact messages yet."
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "message", label: "Message" },
            { key: "created_at", label: "Received", render: (row) => formatDate(row.created_at, true) }
          ]}
        />
      </div>
    </PortalPage>
  );
}
