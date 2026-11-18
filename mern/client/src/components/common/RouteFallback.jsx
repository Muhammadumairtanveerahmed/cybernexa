export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  );
}
