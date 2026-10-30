export default function SectionHead({ eyebrow, title, accent, sub }) {
  return (
    <div className="section-head">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>
        {title} {accent ? <span className="gradient-text">{accent}</span> : null}
      </h2>
      {sub ? <p>{sub}</p> : null}
    </div>
  );
}
