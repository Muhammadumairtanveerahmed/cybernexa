import Hero from "../components/Hero.jsx";
import CtaBand from "../components/CtaBand.jsx";
import { industries } from "../data/siteData.js";

export default function IndustriesPage() {
  return (
    <>
      <Hero
        short
        badge="Industries We Serve"
        title="Technology Built For"
        accent="Your Industry"
        sub="We adapt compliance, workflows and risk controls to the realities of your sector."
      />

      <section className="section">
        <div className="container">
          {industries.map((industry) => (
            <div
              className="industry"
              id={industry.id}
              key={industry.id}
              style={{ marginBottom: 24, scrollMarginTop: 120 }}
            >
              <article className="course">
                <div className="course-top">
                  <span className="course-tag">{industry.tag}</span>
                  <h3>
                    <i className={`fa-solid ${industry.icon}`} aria-hidden="true" />{" "}
                    {industry.title}
                  </h3>
                  <p>{industry.text}</p>
                  <div className="course-meta">
                    {industry.meta.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          ))}
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <a className="btn btn-primary" href="#contact">
              Discuss Your Industry Needs
            </a>
          </div>
        </div>
      </section>

      <CtaBand
        title="Don't See Your Industry?"
        text="Tell us about your compliance requirements and workflows. We will map a solution."
      />
    </>
  );
}
