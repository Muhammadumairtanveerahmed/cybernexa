import { useParams } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import SectionHead from "../components/SectionHead.jsx";
import StatsRow from "../components/StatsRow.jsx";
import CtaBand from "../components/CtaBand.jsx";
import { servicePages, whyChooseCards } from "../data/siteData.js";
import NotFoundPage from "./NotFoundPage.jsx";

export default function ServicePage() {
  const { slug } = useParams();
  const page = servicePages[slug];

  if (!page) return <NotFoundPage />;

  return (
    <>
      <Hero
        short
        badge={page.badge}
        title={page.heroTitle}
        accent={page.heroAccent}
        sub={page.heroSub}
        primary={{ label: page.heroButton, href: "#contact" }}
      />

      <section className="section" id="services">
        <div className="container">
          <SectionHead
            eyebrow={page.sectionEyebrow}
            title={page.sectionTitle}
            accent={page.sectionAccent}
            sub="A practical, measurable engagement model with clear ownership and reporting."
          />
          <div className="cards-grid">
            {page.cards.map((card) => (
              <div className="card" key={card.title}>
                <div className={`card-icon ${card.color}`}>
                  <i className={`fa-solid ${card.icon}`} aria-hidden="true" />
                </div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="why">
        <div className="container">
          <SectionHead
            eyebrow="Why Choose TechNexa?"
            title="A Strategic IT Partner,"
            accent="Not Just a Service Provider"
            sub="Proactive management, enterprise expertise and security-first operations."
          />
          <div className="course-grid">
            {whyChooseCards.map((card) => (
              <article className="course" key={card.num}>
                <div className="course-top">
                  <span className="course-tag">{card.num}</span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              </article>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <a className="btn btn-primary" href="#contact">
              Schedule Technical Consultation
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="Operational Resilience"
            title="Outcomes You Can"
            accent="Measure"
            sub="Clear service levels and reporting, not vague promises."
          />
          <StatsRow compact items={page.stats} />
        </div>
      </section>

      <CtaBand title={page.ctaTitle} text={page.ctaText} />
    </>
  );
}
