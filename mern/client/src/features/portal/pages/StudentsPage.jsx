import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate, formatMoney } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";

export default function StudentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const students = useFetch(
    () => (isAdmin ? portalApi.admin.students() : portalApi.students()),
    [isAdmin]
  );
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const rows = useMemo(() => {
    const list = students.data || [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((student) =>
      [student.full_name, student.email, student.phone, student.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [students.data, search]);

  const updateStatus = async (row, status) => {
    setMessage("");
    try {
      await portalApi.admin.updateStudent(row.id, { status });
      setMessage(`Student marked ${status}.`);
      await students.reload();
    } catch (err) {
      setMessage(err.message || "Could not update the student.");
    }
  };

  return (
    <PortalPage
      title={isAdmin ? "Students" : "My Students"}
      sub={isAdmin ? "All registered students on the platform." : "Students enrolled in your courses."}
    >
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {students.error ? <div className="err">{students.error}</div> : null}

      <div className="panel">
        <div className="search-row">
          <h2 style={{ margin: 0, flex: 1 }}>Student directory</h2>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, city..."
            aria-label="Search students"
          />
        </div>
        <DataTable
          rows={rows}
          loading={students.loading}
          empty={isAdmin ? "No students registered yet." : "No students are enrolled in your courses yet."}
          columns={[
            { key: "full_name", label: "Student" },
            { key: "email", label: "Email" },
            { key: "phone", label: "Phone" },
            { key: "city", label: "City", render: (row) => row.city || "—" },
            { key: "last_qualification", label: "Qualification", render: (row) => row.last_qualification || "—" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            ...(isAdmin
              ? [
                  { key: "enrollment_count", label: "Enrollments", render: (row) => row.enrollment_count || 0 },
                  { key: "paid", label: "Paid", render: (row) => formatMoney(row.paid) },
                  { key: "created_at", label: "Joined", render: (row) => formatDate(row.created_at) },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <select
                        value={row.status}
                        onChange={(event) => updateStatus(row, event.target.value)}
                        style={{ width: 120, height: 30, fontSize: ".75rem" }}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    )
                  }
                ]
              : [])
          ]}
        />
      </div>
    </PortalPage>
  );
}
