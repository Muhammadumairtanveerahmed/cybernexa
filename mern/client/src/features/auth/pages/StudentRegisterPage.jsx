import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../../api/auth.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";

export default function StudentRegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const next = params.get("next") || "";
  const signInTo = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const [form, setForm] = useState({
    full_name: "",
    email: params.get("email") || "",
    phone: "",
    password: "",
    password2: ""
  });
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

    setBusy(true);
    try {
      await authApi.registerStudent({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        password2: form.password2
      });
      await login({ email: form.email.trim(), password: form.password });
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/portal/profile?welcome=1";
      navigate(safeNext, { replace: true });
    } catch (err) {
      setError(err.message || "Could not create your account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 520, width: "100%" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Student registration</h1>
      <p className="muted" style={{ fontSize: ".88rem", marginBottom: 16 }}>
        Create your account to enroll, track progress and access course material.
      </p>

      <form onSubmit={submit}>
        <label htmlFor="full_name">Full name</label>
        <input
          id="full_name"
          value={form.full_name}
          onChange={(event) => update("full_name", event.target.value)}
          autoComplete="name"
          required
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => update("email", event.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="phone">Phone</label>
        <input
          id="phone"
          value={form.phone}
          onChange={(event) => update("phone", event.target.value)}
          autoComplete="tel"
          placeholder="03xx xxxxxxx"
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.password}
          onChange={(event) => update("password", event.target.value)}
          autoComplete="new-password"
          required
        />

        <label htmlFor="password2">Confirm password</label>
        <input
          id="password2"
          type="password"
          value={form.password2}
          onChange={(event) => update("password2", event.target.value)}
          autoComplete="new-password"
          required
        />

        {error ? <p style={{ color: "#f87171", fontSize: ".85rem", marginTop: 12 }}>{error}</p> : null}

        <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="muted" style={{ textAlign: "center", fontSize: ".85rem", marginTop: 16 }}>
        Already registered? <Link to={signInTo} style={{ color: "var(--acc)" }}>Sign in</Link>
      </p>
    </div>
  );
}
