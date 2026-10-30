import { Link } from "react-router-dom";

export default function ServiceCard({ title, text, icon, color, to, linkText }) {
  return (
    <Link className="card reveal visible" to={to}>
      <div className={`card-icon ${color}`}>
        <i className={`fa-solid ${icon}`} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {linkText ? <span className="card-link">{linkText}</span> : null}
    </Link>
  );
}
