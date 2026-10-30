import Hero from "../components/Hero.jsx";
import SectionHead from "../components/SectionHead.jsx";
import StatsRow from "../components/StatsRow.jsx";
import CtaBand from "../components/CtaBand.jsx";

const storyCards = [
  {
    title: "Our Mission",
    icon: "fa-bullseye",
    color: "violet",
    text: "Make enterprise-grade technology accessible, secure and practical for growing organizations."
  },
  {
    title: "Our Vision",
    icon: "fa-binoculars",
    color: "cyan",
    text: "Be the long-term technology partner that businesses and graduates trust at every stage."
  },
  {
    title: "Our Values",
    icon: "fa-lightbulb",
    color: "pink",
    text: "Clarity over jargon, security by default and measurable outcomes over vanity metrics."
  }
];

const workSteps = [
  {
    tag: "01",
    title: "Assess First",
    text: "We start with your business goals, current systems and risk profile, not a product catalogue."
  },
  {
    tag: "02",
    title: "Plan Transparently",
    text: "You get a clear scope, timeline, cost and success measure before work begins."
  },
  {
    tag: "03",
    title: "Execute Cleanly",
    text: "Small, tested changes with clear ownership and minimal disruption to your team."
  },
  {
    tag: "04",
    title: "Monitor Forever",
    text: "We stay accountable after launch with monitoring, reporting and continuous improvement."
  }
];

export default function AboutPage() {
  return (
    <>
      <Hero
        short
        badge="About TechNexa"
        title="A Strategic IT Partner,"
        accent="Not Just a Vendor"
        sub="We help businesses simplify technology, strengthen security and scale faster with one accountable team."
      />

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="Our Story"
            title="Technology Should"
            accent="Grow Your Business"
            sub="TechNexa began with a simple observation: growing businesses need enterprise-grade technology without enterprise-grade complexity."
          />
          <div className="container" style={{ maxWidth: 860, marginBottom: 48 }}>
            <p style={{ color: "var(--muted)", textAlign: "center" }}>
              We bring security, cloud, software and training under one roof. That means fewer
              vendors, clearer accountability and a partner who understands how the pieces fit
              together. From managed IT and cybersecurity to the TechNexa Academy, our work is
              measured by uptime, resilience and careers built.
            </p>
          </div>
          <div className="cards-grid">
            {storyCards.map((card) => (
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

      <section className="section section-alt">
        <div className="container">
          <SectionHead
            eyebrow="How We Work"
            title="What It's Like"
            accent="Working With Us"
            sub="No jargon, no surprises, just clear communication and engineering that ships."
          />
          <div className="course-grid">
            {workSteps.map((step) => (
              <article className="course" key={step.tag}>
                <div className="course-top">
                  <span className="course-tag">{step.tag}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow="By The Numbers"
            title="Results That"
            accent="Speak For Themselves"
            sub="A track record built on reliability, retention and long-term partnerships."
          />
          <StatsRow
            compact
            items={[
              { value: "24x7", label: "Support" },
              { value: "99%", label: "Client Retention" },
              { value: "50+", label: "Clients Served" }
            ]}
          />
        </div>
      </section>

      <CtaBand
        title="Let's Build Something Great Together"
        text="Tell us where technology is slowing you down. We will show you a practical path forward."
      />
    </>
  );
}
