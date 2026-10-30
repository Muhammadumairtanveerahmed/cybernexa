export default function DataTable({ columns, rows, empty = "No records yet.", loading = false }) {
  if (loading) {
    return (
      <div className="loading">
        <i className="fa-solid fa-spinner fa-spin" /> Loading...
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="empty">
        <i className="fa-solid fa-inbox" aria-hidden="true" />
        {empty}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className || ""}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.key || index}>
              {columns.map((column) => (
                <td key={column.key} className={column.className || ""}>
                  {column.render ? column.render(row, index) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
