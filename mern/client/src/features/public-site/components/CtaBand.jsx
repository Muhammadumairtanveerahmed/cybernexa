import { Link } from "react-router-dom";
import { brand } from "../data/siteData.js";

export default function CtaBand({ title, text }) {
  return (
    <section className="cta-band" id="contact">
      <div className="container cta-inner">
        <div className="cta-text">
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <div className="cta-actions">
          <a className="btn btn-primary btn-lg" href={`mailto:${brand.email}`}>
            Email Us
          </a>
          <a className="btn btn-ghost btn-lg" href={brand.phoneHref}>
            Call {brand.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
