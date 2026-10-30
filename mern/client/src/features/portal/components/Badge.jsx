export default function Badge({ status, label }) {
  if (!status) return null;
  return <span className={`badge b-${status}`}>{label || status}</span>;
}
