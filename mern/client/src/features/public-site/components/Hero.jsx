import { Link } from "react-router-dom";
import StatsRow from "./StatsRow.jsx";

export default function Hero({
  badge,
  title,
  accent,
  sub,
  primary,
  secondary,
  stats,
  short = false
}) {
  return (
    <section className={`hero${short ? " hero-short" : ""}`} id="home">
      <div className="hero-glow" />
      <div className="hero-grid" />
      <div className="container hero-content">
        {badge ? <div className="badge reveal visible">{badge}</div> : null}
        <h1 className="reveal visible delay-1">
          {title}
          {accent ? (
            <>
              <br />
              <span className="gradient-text">{accent}</span>
            </>
          ) : null}
        </h1>
        {sub ? <p className="hero-sub reveal visible delay-2">{sub}</p> : null}
        {primary || secondary ? (
          <div className="hero-actions reveal visible delay-3">
            {primary ? (
              primary.to ? (
                <Link className="btn btn-primary" to={primary.to}>
                  {primary.label}
                </Link>
              ) : (
                <a className="btn btn-primary" href={primary.href}>
                  {primary.label}
                </a>
              )
            ) : null}
            {secondary ? (
              secondary.to ? (
                <Link className="btn btn-ghost" to={secondary.to}>
                  {secondary.label}
                </Link>
              ) : (
                <a className="btn btn-ghost" href={secondary.href}>
                  {secondary.label}
                </a>
              )
            ) : null}
          </div>
        ) : null}
        {stats ? (
          <div className="reveal visible delay-4">
            <StatsRow items={stats} compact={short} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
