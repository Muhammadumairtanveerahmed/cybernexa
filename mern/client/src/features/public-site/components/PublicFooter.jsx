import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../../api/axios.js";
import { brand } from "../data/siteData.js";

const sitemap = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/#services" },
  { label: "Industries", to: "/industries" },
  { label: "Courses", to: "/courses" },
  { label: "About", to: "/about" },
  { label: "Legal", to: "/legal" }
];

const serviceLinks = [
  { label: "Managed IT", to: "/services/managed-it-operations" },
  { label: "Cybersecurity", to: "/services/cybersecurity" },
  { label: "Cloud", to: "/services/cloud-infrastructure" },
  { label: "Software", to: "/services/software-development" },
  { label: "Training", to: "/services/it-training" }
];

export default function PublicFooter() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const subscribe = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!email.trim()) {
      setMessage("Please enter your email.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post("/subscribe", { email: email.trim() });
      setMessage(response.data?.msg || "Subscribed. You will hear from us soon.");
      setEmail("");
    } catch (error) {
      setMessage(error.message || "Could not subscribe right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="logo">
            <span className="logo-mark">
              <i className="fa-solid fa-shield-halved" aria-hidden="true" />
            </span>
            <span className="logo-text">
              Tech<span className="accent">Nexa</span>
            </span>
          </Link>
          <p>
            Your trusted technology partner, delivering secure, scalable IT solutions
            that simplify operations and empower growth.
          </p>
          <div className="socials">
            <a href={brand.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp">
              <i className="fa-brands fa-whatsapp" aria-hidden="true" />
            </a>
            <a href={`mailto:${brand.email}`} aria-label="Email">
              <i className="fa-solid fa-envelope" aria-hidden="true" />
            </a>
            <a href={brand.phoneHref} aria-label="Phone">
              <i className="fa-solid fa-phone" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="footer-col">
          <h4>Sitemap</h4>
          {sitemap.map((link) => (
            <Link key={link.label} to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="footer-col">
          <h4>Services</h4>
          {serviceLinks.map((link) => (
            <Link key={link.label} to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="footer-col">
          <h4>Contact</h4>
          <a href={`mailto:${brand.email}`}>{brand.email}</a>
          <a href={brand.phoneHref}>{brand.phone}</a>
          <span className="footer-addr">{brand.address}</span>
        </div>
      </div>

      <div className="container footer-newsletter">
        <div className="fn-text">
          <strong>Stay ahead of security threats</strong>
          <span>Monthly tips on cybersecurity, cloud and IT careers. No spam, unsubscribe anytime.</span>
        </div>
        <form onSubmit={subscribe}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Subscribing..." : "Subscribe"}
          </button>
        </form>
        {message ? <p className="fn-msg">{message}</p> : null}
      </div>

      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {brand.name} Solutions. All rights reserved. ·{" "}
          <Link to="/legal">Legal</Link>
        </span>
        <span className="footer-tag">{brand.tagline}</span>
      </div>
    </footer>
  );
}
