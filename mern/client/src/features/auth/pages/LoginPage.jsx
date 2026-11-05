import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const nextParam = params.get("next") || "";
  const next = nextParam || "/portal/dashboard";
  const authLink = (path) => (nextParam ? `${path}?next=${encodeURIComponent(nextParam)}` : path);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ email: form.email.trim(), password: form.password, rememberMe });
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/portal/dashboard";
      navigate(safeNext, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 430, width: "100%" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Sign in</h1>
      <p className="muted" style={{ fontSize: ".88rem", marginBottom: 18 }}>
        Access your student, teacher or admin portal.
      </p>

      {params.get("reset") ? (
        <p className="badge b-approved" style={{ display: "block", marginBottom: 14 }}>
          Password updated. Sign in with your new password.
        </p>
      ) : null}

      <form onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          autoComplete="current-password"
          required
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Show password
        </label>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Remember me
        </label>

        {error ? <p className="muted" style={{ color: "#f87171", marginTop: 12 }}>{error}</p> : null}

        <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16, fontSize: ".85rem" }}>
        <Link to={authLink("/forgot-password")} style={{ color: "var(--acc)" }}>
          Forgot password?
        </Link>
        <Link to={authLink("/register")} style={{ color: "var(--acc)" }}>
          Create account
        </Link>
      </div>
    </div>
  );
}
