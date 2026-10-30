import { useState } from "react";
import { Link } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate, formatMoney } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import StatCard from "../components/StatCard.jsx";
import Modal from "../components/Modal.jsx";

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(portalApi.enrollments, []);
  const [selected, setSelected] = useState(null);
  const [payment, setPayment] = useState({ amount: "", method: "Cash", note: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const rows = data || [];

  const updateStatus = async (row, status) => {
    setMessage("");
    try {
      await portalApi.admin.updateEnrollment(row.id, { status });
      setMessage(`Enrollment marked ${status}.`);
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not update the enrollment.");
    }
  };

  const openPayment = (row) => {
    setSelected(row);
    setPayment({
      amount: String(Math.max(0, Number(row.amount_total || 0) - Number(row.paid || 0))),
      method: "Cash",
      note: ""
    });
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await portalApi.admin.recordPayment({
        enrollment_id: selected.id,
        amount: Number(payment.amount),
        method: payment.method,
        note: payment.note
      });
      setSelected(null);
      setMessage("Payment recorded.");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not record the payment.");
    } finally {
      setBusy(false);
    }
  };

  const total = rows.reduce((sum, row) => sum + Number(row.amount_total || 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.paid || 0), 0);

  return (
    <PortalPage
      title={isAdmin ? "Enrollments" : isTeacher ? "Course Enrollments" : "My Enrollments"}
      sub={
        isAdmin
          ? "Review applications, approve students and record payments."
          : isTeacher
            ? "Students enrolled in your courses."
            : "Your course applications, approvals and payment status."
      }
      actions={
        !isAdmin && !isTeacher ? (
          <Link className="btn primary sm" to="/courses">
            Browse courses
          </Link>
        ) : null
      }
    >
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}

      <div className="cards">
        <StatCard icon="fa-graduation-cap" value={rows.length} label="Enrollments" />
        <StatCard icon="fa-circle-check" value={rows.filter((row) => row.status === "approved").length} label="Approved" tone="green" />
        <StatCard icon="fa-sack-dollar" value={formatMoney(total)} label="Total fees" />
        <StatCard icon="fa-wallet" value={formatMoney(paid)} label="Paid" tone="green" />
      </div>

      <div className="panel">
        <h2>{isAdmin ? "All enrollments" : isTeacher ? "Students in your courses" : "My applications"}</h2>
        <DataTable
          rows={rows}
          loading={loading}
          empty={isAdmin ? "No enrollments yet." : isTeacher ? "No students enrolled yet." : "You have not enrolled in a course yet."}
          columns={[
            ...(isAdmin || isTeacher
              ? [{ key: "student_name", label: "Student", render: (row) => row.student_name || row.email || "—" }]
              : []),
            { key: "course_title", label: "Course" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "payment_status", label: "Payment", render: (row) => <Badge status={row.payment_status} /> },
            { key: "amount_total", label: "Fee", render: (row) => formatMoney(row.amount_total) },
            { key: "paid", label: "Paid", render: (row) => formatMoney(row.paid) },
            {
              key: "balance",
              label: "Balance",
              render: (row) => formatMoney(Math.max(0, Number(row.amount_total || 0) - Number(row.paid || 0)))
            },
            { key: "created_at", label: "Applied", render: (row) => formatDate(row.created_at) },
            ...(isAdmin
              ? [
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <div className="table-actions">
                        <select
                          value={row.status}
                          onChange={(event) => updateStatus(row, event.target.value)}
                          style={{ width: 110, height: 30, fontSize: ".75rem" }}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="completed">Completed</option>
                        </select>
                        <button className="btn ghost" type="button" onClick={() => openPayment(row)}>
                          Payment
                        </button>
                      </div>
                    )
                  }
                ]
              : [])
          ]}
        />
      </div>

      <Modal
        open={Boolean(selected)}
        title={`Record payment · ${selected?.student_name || selected?.course_title || ""}`}
        onClose={() => setSelected(null)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button className="btn primary" type="submit" form="payment-form" disabled={busy}>
              {busy ? "Saving..." : "Record payment"}
            </button>
          </>
        }
      >
        <form id="payment-form" onSubmit={recordPayment}>
          <div className="form-grid">
            <div>
              <label htmlFor="amount">Amount (PKR)</label>
              <input id="amount" type="number" min="1" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="method">Method</label>
              <select id="method" value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value }))}>
                <option>Cash</option>
                <option>Bank transfer</option>
                <option>JazzCash</option>
                <option>EasyPaisa</option>
                <option>Card</option>
              </select>
            </div>
          </div>
          <label htmlFor="note">Note</label>
          <input id="note" value={payment.note} onChange={(event) => setPayment((current) => ({ ...current, note: event.target.value }))} placeholder="Receipt number or remark" />
          {selected ? (
            <p className="form-note">
              Total fee {formatMoney(selected.amount_total)} · Already paid {formatMoney(selected.paid)}
            </p>
          ) : null}
        </form>
      </Modal>

      {error ? <div className="err">{error}</div> : null}
    </PortalPage>
  );
}
