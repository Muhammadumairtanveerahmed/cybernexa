import { useState } from "react";
import api from "../../../api/axios.js";
import { brand } from "../data/siteData.js";

const initial = { name: "", email: "", phone: "", message: "" };

export default function ContactSection() {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      next.email = "Please enter a valid email.";
    }
    if (form.phone.trim() && !/^(\+92|0092|92|0)?3\d{9}$/.test(form.phone.replace(/[\s-]/g, ""))) {
      next.phone = "Enter a valid Pakistani mobile number.";
    }
    if (form.message.trim().length < 5) next.message = "Please write a short message.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setStatus("");
    if (!validate()) {
      setStatus("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post("/contact", form);
      setStatus(response.data?.msg || "Thank you. Your message has been received.");
      setForm(initial);
    } catch (error) {
      setStatus(error.response?.data?.msg || error.message || "Could not send your message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section section-alt" id="contact">
      <div className="container contact-grid">
        <div className="contact-info">
          <span className="eyebrow">Get In Touch</span>
          <h2>
            Let&apos;s <span className="gradient-text">Talk</span>
          </h2>
          <p>
            Tell us about your business, your goals and the problem you want to solve. We
            will reply with a clear next step, not a sales pitch.
          </p>
          <div className="contact-lines">
            <a href={`mailto:${brand.email}`}>
              <i className="fa-solid fa-envelope" aria-hidden="true" /> {brand.email}
            </a>
            <a href={brand.phoneHref}>
              <i className="fa-solid fa-phone" aria-hidden="true" /> {brand.phone}
            </a>
            <a href={brand.whatsapp} target="_blank" rel="noreferrer">
              <i className="fa-brands fa-whatsapp" aria-hidden="true" /> WhatsApp
            </a>
          </div>
        </div>

        <form className="contact-form" onSubmit={submit} noValidate>
          <div className="form-row">
            <div className={`field${errors.name ? " invalid" : ""}`}>
              <input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder=" "
                autoComplete="name"
              />
              <label>Your name</label>
            </div>
            <div className={`field${errors.email ? " invalid" : ""}`}>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder=" "
                autoComplete="email"
              />
              <label>Email address</label>
            </div>
          </div>
          {errors.name ? <span className="field-error">{errors.name}</span> : null}
          {errors.email ? <span className="field-error">{errors.email}</span> : null}

          <div className={`field${errors.phone ? " invalid" : ""}`}>
            <input
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder=" "
              autoComplete="tel"
            />
            <label>Phone (optional)</label>
          </div>
          {errors.phone ? <span className="field-error">{errors.phone}</span> : null}

          <div className={`field${errors.message ? " invalid" : ""}`}>
            <textarea
              rows={5}
              value={form.message}
              onChange={(event) => update("message", event.target.value)}
              placeholder=" "
            />
            <label>How can we help?</label>
          </div>
          {errors.message ? <span className="field-error">{errors.message}</span> : null}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Sending..." : "Send Message"}
          </button>
          {status ? <p className="form-response ok">{status}</p> : null}
        </form>
      </div>
    </section>
  );
}
