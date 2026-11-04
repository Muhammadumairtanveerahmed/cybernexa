import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../../api/auth.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";

export default function TeacherRegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") || "";
  const signInTo = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    password2: "",
    qualification: "",
    expertise: "",
    experience_years: "",
    bio: "",
    portfolio_url: ""
  });
  const [cv, setCv] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.full_name.trim().length < 2) return setError("Enter your full name.");
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError("Password must be at least 8 characters and include a letter and a number.");
    }
    if (form.password !== form.password2) return setError("Passwords do not match.");

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (cv) data.append("cv", cv);

    setBusy(true);
    try {
      await authApi.registerTeacher(data);
      await login({ email: form.email.trim(), password: form.password });
      navigate("/portal/dashboard?applied=1", { replace: true });
    } catch (err) {
      setError(err.message || "Could not submit your application.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 620, width: "100%" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Teacher application</h1>
      <p className="muted" style={{ fontSize: ".88rem", marginBottom: 16 }}>
        Tell us about your teaching experience. An administrator will review your application.
      </p>

      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <label htmlFor="full_name">Full name</label>
            <input id="full_name" value={form.full_name} onChange={(event) => update("full_name", event.target.value)} required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} required />
          </div>
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          </div>
          <div>
            <label htmlFor="experience_years">Experience (years)</label>
            <input
              id="experience_years"
              type="number"
              min="0"
              max="60"
              value={form.experience_years}
              onChange={(event) => update("experience_years", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} required />
          </div>
          <div>
            <label htmlFor="password2">Confirm password</label>
            <input id="password2" type="password" value={form.password2} onChange={(event) => update("password2", event.target.value)} required />
          </div>
        </div>

        <label htmlFor="qualification">Qualification</label>
        <input id="qualification" value={form.qualification} onChange={(event) => update("qualification", event.target.value)} placeholder="e.g. MSc Computer Science" />

        <label htmlFor="expertise">Expertise</label>
        <input id="expertise" value={form.expertise} onChange={(event) => update("expertise", event.target.value)} placeholder="e.g. Cybersecurity, CCNA, AWS" />

        <label htmlFor="bio">Short bio</label>
        <textarea id="bio" rows={4} value={form.bio} onChange={(event) => update("bio", event.target.value)} maxLength={1200} />

        <label htmlFor="portfolio_url">Portfolio or LinkedIn URL</label>
        <input id="portfolio_url" value={form.portfolio_url} onChange={(event) => update("portfolio_url", event.target.value)} placeholder="https://..." />

        <label htmlFor="cv">CV (PDF, JPG or PNG)</label>
        <input id="cv" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setCv(event.target.files[0])} />

        {error ? <p style={{ color: "#f87171", fontSize: ".85rem", marginTop: 12 }}>{error}</p> : null}

        <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
          {busy ? "Submitting..." : "Submit application"}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", fontSize: ".85rem", marginTop: 16 }}>
        Already registered? <Link to={signInTo} style={{ color: "var(--acc)" }}>Sign in</Link>
      </p>
    </div>
  );
}
