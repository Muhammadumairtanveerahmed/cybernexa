import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../../api/auth.api.js";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [form, setForm] = useState({ password: "", password2: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError("Password must be at least 8 characters and include a letter and a number.");
    }
    if (form.password !== form.password2) return setError("Passwords do not match.");

    setBusy(true);
    try {
      await authApi.resetPassword({ token, password: form.password, password2: form.password2 });
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      setError(err.message || "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 430, width: "100%" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Reset password</h1>
      <p className="muted" style={{ fontSize: ".88rem", marginBottom: 16 }}>
        Choose a new password for your account.
      </p>

      {!token ? (
        <p style={{ color: "#f87171", fontSize: ".85rem" }}>
          This reset link is missing a token. Request a new link.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="password">New password</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            autoComplete="new-password"
            required
          />
          <label htmlFor="password2">Confirm new password</label>
          <input
            id="password2"
            type="password"
            value={form.password2}
            onChange={(event) => setForm((current) => ({ ...current, password2: event.target.value }))}
            autoComplete="new-password"
            required
          />
          {error ? <p style={{ color: "#f87171", fontSize: ".85rem", marginTop: 12 }}>{error}</p> : null}
          <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
            {busy ? "Updating..." : "Update password"}
          </button>
        </form>
      )}

      <p className="muted" style={{ textAlign: "center", fontSize: ".85rem", marginTop: 16 }}>
        <Link to="/login" style={{ color: "var(--acc)" }}>Back to sign in</Link>
      </p>
    </div>
  );
}
