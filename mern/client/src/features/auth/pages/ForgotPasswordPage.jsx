import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../../api/auth.api.js";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await authApi.forgotPassword({ email: email.trim() });
      setMessage(
        response.data?.msg ||
          "If an account exists for this email, a reset link has been sent."
      );
    } catch (error) {
      setMessage(error.message || "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 430, width: "100%" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: 4 }}>Forgot password</h1>
      <p className="muted" style={{ fontSize: ".88rem", marginBottom: 16 }}>
        Enter your email and we will send a reset link if the account exists.
      </p>

      <form onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
        <button className="btn primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 18 }}>
          {busy ? "Sending..." : "Send reset link"}
        </button>
      </form>

      {message ? <p className="muted" style={{ fontSize: ".85rem", marginTop: 14 }}>{message}</p> : null}

      <p className="muted" style={{ textAlign: "center", fontSize: ".85rem", marginTop: 16 }}>
        <Link to="/login" style={{ color: "var(--acc)" }}>Back to sign in</Link>
      </p>
    </div>
  );
}
