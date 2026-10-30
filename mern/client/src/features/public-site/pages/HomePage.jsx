import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import SectionHead from "../components/SectionHead.jsx";
import ServiceCard from "../components/ServiceCard.jsx";
import CourseCard from "../components/CourseCard.jsx";
import CourseModal from "../components/CourseModal.jsx";
import CtaBand from "../components/CtaBand.jsx";
import FaqAccordion from "../components/FaqAccordion.jsx";
import ContactSection from "../components/ContactSection.jsx";
import {
  aboutChecklist,
  allCourses,
  certifications,
  divisions,
  faqs,
  process,
  services,
  stats,
  testimonials
} from "../data/siteData.js";

export default function HomePage() {
  const [selectedCourse, setSelectedCourse] = useState(null);

  const featured = useMemo(() => {
    const list = allCourses.filter((course) => course.featured);
    return (list.length ? list : allCourses).slice(0, 8);
  }, []);

  return (
    <>
      <Hero
        badge="Managed · Modern · Secure"
        title="Technology That"
        accent="Powers Business Growth"
        sub="Managed IT, Cybersecurity, Software Development, Cloud and Training, all from one trusted partner. We build, secure and scale your digital future."
        primary={{ label: "Talk to an Expert", href: "#contact" }}
        secondary={{ label: "Explore Services", href: "#services" }}
        stats={stats}
      />

      <section className="section" id="services">
        <div className="container">
          <SectionHead
            eyebrow="Core Capabilities"
            title="Enterprise"
            accent="Service Pillars"
            sub="End-to-end technology solutions, from strategy and build to secure managed operations."
          />
          <div className="cards-grid">
            {services.map((service) => (
              <ServiceCard key={service.title} {...service} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="training">
        <div className="container">
          <SectionHead
            eyebrow="TechNexa Academy"
            title="IT Courses That Build"
            accent="Real Careers"
            sub="Hands-on training with labs, projects and certification prep, online and on-site."
          />
          <div className="course-grid">
            {featured.map((course) => (
              <CourseCard key={course.id} course={course} onEnroll={setSelectedCourse} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link className="btn btn-primary btn-lg" to="/courses">
              View All Courses
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="process">
        <div className="container">
          <SectionHead
            eyebrow="Operational Framework"
            title="The"
            accent="Lifecycle Process"
            sub="A proven three-step methodology that keeps technology aligned with business goals."
          />
          <div className="process-grid">
            {process.map((step, index) => (
              <div className="process-step" key={step.num}>
                <div className="process-num">{step.num}</div>
                <h3>{step.title}</h3>
                <div className="process-tagline">{step.tagline}</div>
                <p>{step.text}</p>
                {index < process.length - 1 ? <div className="process-connector" /> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="about">
        <div className="container about-grid">
          <div className="about-visual">
            <div className="about-card-float f1">
              <i className="fa-solid fa-lock" aria-hidden="true" />
              <span>SOC Monitoring</span>
            </div>
            <div className="about-card-float f2">
              <i className="fa-solid fa-cloud" aria-hidden="true" />
              <span>Cloud Uptime 99.9%</span>
            </div>
            <div className="about-card-float f3">
              <i className="fa-solid fa-bolt" aria-hidden="true" />
              <span>Deploy in days</span>
            </div>
            <div className="about-core">
              <span className="logo-mark big">
                <i className="fa-solid fa-shield-halved" aria-hidden="true" />
              </span>
              <strong>MANAGED.</strong>
              <strong>MODERN.</strong>
              <strong>SECURE.</strong>
            </div>
          </div>

          <div className="about-text">
            <span className="eyebrow">Why TechNexa</span>
            <h2>
              Your Trusted <span className="gradient-text">Technology Partner</span>
            </h2>
            <p>
              We combine enterprise-grade engineering with the responsiveness of a local
              partner. From the first assessment to 24x7 operations, you get one accountable
              team across security, cloud, software and training.
            </p>
            <ul className="check-list">
              {aboutChecklist.map((item) => (
                <li key={item}>
                  <i className="fa-solid fa-circle-check" aria-hidden="true" /> {item}
                </li>
              ))}
            </ul>
            <a className="btn btn-primary" href="#contact">
              Start a Conversation
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="divisions">
        <div className="container">
          <SectionHead
            eyebrow="Our Divisions"
            title="Three Brands,"
            accent="One Mission"
            sub="Specialist teams under one partner, so you can buy exactly what you need."
          />
          <div className="cards-grid">
            {divisions.map((division) => (
              <ServiceCard
                key={division.title}
                title={division.title}
                text={division.text}
                icon={division.icon}
                color={division.color}
                to={division.to}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="certifications">
        <div className="container">
          <SectionHead
            eyebrow="Certified & Trusted"
            title="Standards We"
            accent="Work To"
            sub="Our engineers hold vendor and industry certifications across security, cloud, networking and Linux."
          />
          <div className="cert-grid">
            {certifications.map((cert) => (
              <div className="cert-item" key={cert.name}>
                <span className="cert-badge">{cert.name}</span>
                <strong>{cert.sub}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="testimonials">
        <div className="container">
          <SectionHead
            eyebrow="Client Feedback"
            title="What Clients"
            accent="Say About Us"
            sub="Real outcomes from businesses and graduates who trusted TechNexa."
          />
          <div className="testi-grid">
            {testimonials.map((testimonial) => (
              <figure className="testi-card" key={testimonial.name}>
                <div className="testi-stars" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((star) => (
                    <i className="fa-solid fa-star" key={star} aria-hidden="true" />
                  ))}
                </div>
                <blockquote>{testimonial.quote}</blockquote>
                <figcaption>
                  <span className="testi-avatar">{testimonial.initials}</span>
                  <span>
                    <strong>{testimonial.name}</strong>
                    <small>{testimonial.role}</small>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt" id="faq">
        <div className="container">
          <SectionHead
            eyebrow="FAQ"
            title="Frequently Asked"
            accent="Questions"
            sub="Quick answers about support, training, enrollment and response times."
          />
          <FaqAccordion items={faqs} />
        </div>
      </section>

      <ContactSection />

      <CtaBand
        title="Ready to Modernize Your IT?"
        text="Strengthen security, reduce downtime and give your team a technology partner they can rely on."
      />

      <CourseModal
        course={selectedCourse}
        open={Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
      />
    </>
  );
}
