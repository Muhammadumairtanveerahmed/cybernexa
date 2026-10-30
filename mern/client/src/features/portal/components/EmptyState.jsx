export default function EmptyState({ icon = "fa-inbox", text = "Nothing here yet." }) {
  return (
    <div className="empty">
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      {text}
    </div>
  );
}
