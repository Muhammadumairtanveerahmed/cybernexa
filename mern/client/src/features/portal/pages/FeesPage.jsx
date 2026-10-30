import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate, formatMoney } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import StatCard from "../components/StatCard.jsx";

export default function FeesPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch(portalApi.fees, []);
  const enrollments = data?.enrollments || [];
  const payments = data?.payments || [];
  const total = enrollments.reduce((sum, row) => sum + Number(row.amount_total || 0), 0);
  const paid = enrollments.reduce((sum, row) => sum + Number(row.paid || 0), 0);

  return (
    <PortalPage
      title="Fees & Payments"
      sub={user?.role === "student" ? "Your fee summary and payment history." : "Fee records and payment history."}
    >
      {error ? <div className="err">{error}</div> : null}

      <div className="cards">
        <StatCard icon="fa-sack-dollar" value={formatMoney(total)} label="Total fees" />
        <StatCard icon="fa-wallet" value={formatMoney(paid)} label="Paid" tone="green" />
        <StatCard icon="fa-triangle-exclamation" value={formatMoney(Math.max(0, total - paid))} label="Outstanding" tone={total - paid > 0 ? "red" : "green"} />
      </div>

      <div className="panel">
        <h2>Enrollment balances</h2>
        <DataTable
          rows={enrollments}
          loading={loading}
          empty="No enrollment records yet."
          columns={[
            ...(user?.role !== "student"
              ? [{ key: "student_name", label: "Student", render: (row) => row.student_name || "—" }]
              : []),
            { key: "course_title", label: "Course" },
            { key: "amount_total", label: "Fee", render: (row) => formatMoney(row.amount_total) },
            { key: "paid", label: "Paid", render: (row) => formatMoney(row.paid) },
            {
              key: "balance",
              label: "Balance",
              render: (row) => formatMoney(Math.max(0, Number(row.amount_total || 0) - Number(row.paid || 0)))
            },
            { key: "payment_status", label: "Status" }
          ]}
        />
      </div>

      <div className="panel">
        <h2>Payment history</h2>
        <DataTable
          rows={payments}
          loading={loading}
          empty="No payments recorded yet."
          columns={[
            ...(user?.role !== "student"
              ? [{ key: "student_name", label: "Student", render: (row) => row.student_name || "—" }]
              : []),
            { key: "course_title", label: "Course" },
            { key: "amount", label: "Amount", render: (row) => formatMoney(row.amount) },
            { key: "method", label: "Method" },
            { key: "note", label: "Note" },
            { key: "paid_at", label: "Paid on", render: (row) => formatDate(row.paid_at) }
          ]}
        />
      </div>
    </PortalPage>
  );
}
