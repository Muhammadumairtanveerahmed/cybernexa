export default function StatCard({ icon, value, label, hint, tone = "" }) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ""}`}>
      <div className="stat-icon">
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <div>
        <b>{value}</b>
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}
