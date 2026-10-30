import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";

const sections = [
  {
    id: "privacy",
    tag: "Privacy",
    title: "Privacy Policy",
    updated: "Last updated: October 2026",
    blocks: [
      {
        heading: "What we collect",
        text: "When you contact us, we collect your name, email, phone and message. When you create a portal account or enroll, we also collect the information needed to deliver the service, including CNIC, photo, qualification documents, payment receipts and, for teachers, a CV."
      },
      {
        heading: "How we use it",
        text: "We use your information to respond to enquiries, process enrollments, deliver courses, issue receipts and certificates, and operate the portal. We do not sell your data or share it with advertisers."
      },
      {
        heading: "Retention",
        text: "Enquiry records are kept for up to 24 months. Academic and fee records are kept as required for certification, audit and legal obligations."
      },
      {
        heading: "Security",
        text: "Access is role-controlled, passwords are hashed, and portal traffic should be served over HTTPS. Uploaded documents are private and served only to authorised users."
      },
      {
        heading: "Your rights",
        text: "You can request access, correction or deletion of your personal data by emailing us. We will respond within a reasonable period, subject to legal retention requirements."
      },
      {
        heading: "Cookies",
        text: "The public site does not use advertising or tracking cookies. The portal uses a session cookie to keep you signed in."
      }
    ]
  },
  {
    id: "terms",
    tag: "Terms",
    title: "Terms of Service",
    updated: "Last updated: October 2026",
    blocks: [
      {
        heading: "Website use",
        text: "You may use this website for lawful purposes only. Do not attempt to disrupt the service, access another user's account or upload malicious files."
      },
      {
        heading: "Services",
        text: "The scope, deliverables, timeline and pricing of professional services are defined in a written agreement. Website content is for general information and does not create a contract by itself."
      },
      {
        heading: "Intellectual property",
        text: "All branding, course material, code and content on this site remain the property of TechNexa Solutions unless a written agreement says otherwise."
      },
      {
        heading: "Limitation of liability",
        text: "The website is provided on an as-is basis. To the extent permitted by law, TechNexa is not liable for indirect or consequential loss arising from use of the website."
      },
      {
        heading: "Contact",
        text: "Questions about these terms can be sent to our team by email or WhatsApp."
      }
    ]
  },
  {
    id: "refunds",
    tag: "Academy",
    title: "Fees, Refunds & Course Terms",
    updated: "Last updated: October 2026",
    blocks: [
      {
        heading: "Enrollment",
        text: "Applications are reviewed within one business day. Your seat is confirmed after the enrollment is approved and the fee or first installment is recorded."
      },
      {
        heading: "Fees",
        text: "The course fee is locked for your batch. Installment plans must be agreed in writing before the batch starts."
      },
      {
        heading: "Refunds",
        text: "A full refund is available before the first class. A 50% refund is available within the first 7 days and after no more than two classes. After that, fees are non-refundable, but a credit may be offered for a future batch at our discretion. Approved refunds are processed within 14 business days."
      },
      {
        heading: "Attendance and certificate",
        text: "A certificate requires at least 70% attendance and completion of the required assessments. Missed labs can be repeated subject to seat availability."
      },
      {
        heading: "Conduct",
        text: "Students are expected to respect instructors, classmates and lab rules. Serious misconduct can lead to removal from the course without a refund."
      },
      {
        heading: "Questions",
        text: "Contact us by email or WhatsApp if anything in these terms is unclear before you enroll."
      }
    ]
  }
];

export default function LegalPage() {
  return (
    <>
      <Hero
        short
        badge="Legal"
        title="Privacy &"
        accent="Terms"
        sub="How we handle your data and the terms that govern use of our website and services."
      />

      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          {sections.map((section) => (
            <article
              className="course"
              id={section.id}
              key={section.id}
              style={{ marginBottom: 34, scrollMarginTop: 120 }}
            >
              <div className="course-top">
                <span className="course-tag">{section.tag}</span>
                <h3>{section.title}</h3>
                <p style={{ color: "var(--muted)", fontSize: ".9rem" }}>{section.updated}</p>
                {section.blocks.map((block) => (
                  <div key={block.heading} style={{ marginTop: 18 }}>
                    <h4 style={{ marginBottom: 6 }}>{block.heading}</h4>
                    <p>{block.text}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
          <Link className="btn btn-primary" to="/">
            Back to Home
          </Link>
        </div>
      </section>
    </>
  );
}
