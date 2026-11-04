import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../../api/axios.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { brand } from "../data/siteData.js";

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  enrollmentType: "Online"
};

const requiredFiles = ["cnic", "photo", "payment"];

export default function CourseModal({ course, open, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);

  const price = useMemo(() => course?.price || "PKR 20,000", [course]);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: user?.full_name || user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      enrollmentType: "Online"
    });
    setFiles({});
    setErrors({});
    setStatus("");
    setSuccess(null);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !course) return null;

  const nextParams = new URLSearchParams(location.search);
  nextParams.set("enroll", course.id);
  const nextPath = `${location.pathname}?${nextParams.toString()}`;

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Please enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      next.email = "Please enter a valid email.";
    }
    if (form.phone.trim() && !/^(\+92|0092|92|0)?3\d{9}$/.test(form.phone.replace(/[\s-]/g, ""))) {
      next.phone = "Enter a valid Pakistani mobile number.";
    }
    requiredFiles.forEach((key) => {
      if (!files[key]) next[key] = "This document is required.";
    });
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

    const data = new FormData();
    data.append("course", course.title);
    data.append("price", price);
    data.append("name", form.name.trim());
    data.append("email", form.email.trim());
    data.append("phone", form.phone.trim());
    data.append("enrollmentType", form.enrollmentType);
    requiredFiles.forEach((key) => data.append(key, files[key]));
    if (files.qualification) data.append("qualification", files.qualification);
    if (files.other) data.append("other", files.other);

    setBusy(true);
    try {
      const response = await api.post("/enroll", data);
      setSuccess(response.data?.msg || "Your enrollment request has been received.");
    } catch (error) {
      const serverErrors = error.response?.data?.errors;
      if (serverErrors) setErrors(serverErrors);
      setStatus(error.response?.data?.msg || error.message || "Could not submit the form.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="course-modal open"
      role="dialog"
      aria-modal="true"
      aria-hidden="false"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>

        <div className="modal-head">
          <span className="eyebrow">{course.category}</span>
          <h2>{course.title}</h2>
          <p className="m-desc">{course.description || course.shortDesc}</p>
          <div className="course-meta">
            {(course.meta || "").split("|").map((item) => (
              <span key={item}>{item.trim()}</span>
            ))}
          </div>
        </div>

        <div className="price-box">
          <span>Course fee</span>
          <strong>{price}</strong>
          <small>Installments available on request</small>
        </div>

        {!user ? (
          <div className="enroll-auth-gate">
            <div className="enroll-auth-icon">
              <i className="fa-solid fa-lock" aria-hidden="true" />
            </div>
            <h3>Sign in to enroll</h3>
            <p>
              Create a free student account or sign in before submitting your enrollment. This keeps
              your personal information and documents secure.
            </p>
            <div className="enroll-auth-actions">
              <Link className="btn btn-primary" to={`/login?next=${encodeURIComponent(nextPath)}`}>
                Sign in
              </Link>
              <Link
                className="btn btn-ghost"
                to={`/register/student?next=${encodeURIComponent(nextPath)}`}
              >
                Create account
              </Link>
            </div>
            <p className="enroll-auth-note">
              <i className="fa-solid fa-shield-halved" aria-hidden="true" /> Document upload is only
              available after login.
            </p>
          </div>
        ) : success ? (
          <div className="enroll-success">
            <div className="enroll-success-head">
              <i className="fa-solid fa-circle-check" aria-hidden="true" />
              <h3>Enrollment received</h3>
            </div>
            <p className="enroll-success-text">{success}</p>
            <p className="enroll-success-text">
              Our team reviews applications within 24 hours (Mon-Sat, 10am-7pm). Keep your
              phone and email available.
            </p>
            <div className="enroll-success-actions">
              <Link className="btn btn-primary" to="/portal/enrollments">
                View my enrollments
              </Link>
              <a
                className="btn btn-ghost"
                href={brand.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                Send documents on WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <form className="enroll-form" onSubmit={submit} noValidate>
            <div className="form-row">
              <div className={`field${errors.name ? " invalid" : ""}`}>
                <input
                  className="enroll-input"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder=" "
                  autoComplete="name"
                />
                <label>Full name</label>
              </div>
              <div className={`field${errors.email ? " invalid" : ""}`}>
                <input
                  className="enroll-input"
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder=" "
                  autoComplete="email"
                />
                <label>Email</label>
              </div>
            </div>
            {errors.name ? <span className="enroll-field-error">{errors.name}</span> : null}
            {errors.email ? <span className="enroll-field-error">{errors.email}</span> : null}

            <div className="form-row">
              <div className={`field${errors.phone ? " invalid" : ""}`}>
                <input
                  className="enroll-input"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  placeholder=" "
                  autoComplete="tel"
                />
                <label>Phone (optional)</label>
              </div>
              <div className="field">
                <select
                  className="enroll-input"
                  value={form.enrollmentType}
                  onChange={(event) => update("enrollmentType", event.target.value)}
                >
                  <option value="Online">Online</option>
                  <option value="On-Site">On-Site</option>
                </select>
                <label>Enrollment type</label>
              </div>
            </div>
            {errors.phone ? <span className="enroll-field-error">{errors.phone}</span> : null}

            <div className="enroll-docs">
              <h4 className="enroll-docs-title">Required documents</h4>
              <p>CNIC, a recent photo and the payment receipt (JPG, PNG or PDF, max 10 MB each).</p>
              <div className="enroll-docs-grid">
                <label className="enroll-file">
                  <span>CNIC</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) => setFiles((current) => ({ ...current, cnic: event.target.files[0] }))}
                  />
                  <small>{files.cnic?.name || "Choose file"}</small>
                </label>
                <label className="enroll-file">
                  <span>Photo</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(event) => setFiles((current) => ({ ...current, photo: event.target.files[0] }))}
                  />
                  <small>{files.photo?.name || "Choose file"}</small>
                </label>
                <label className="enroll-file">
                  <span>Payment receipt</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) => setFiles((current) => ({ ...current, payment: event.target.files[0] }))}
                  />
                  <small>{files.payment?.name || "Choose file"}</small>
                </label>
                <label className="enroll-file">
                  <span>Qualification (optional)</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(event) =>
                      setFiles((current) => ({ ...current, qualification: event.target.files[0] }))
                    }
                  />
                  <small>{files.qualification?.name || "Choose file"}</small>
                </label>
              </div>
              {requiredFiles.map((key) =>
                errors[key] ? (
                  <span className="enroll-field-error" key={key}>
                    {errors[key]}
                  </span>
                ) : null
              )}
            </div>

            {status ? <p className="enroll-status err">{status}</p> : null}

            <div className="modal-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Submitting..." : "Submit enrollment"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
