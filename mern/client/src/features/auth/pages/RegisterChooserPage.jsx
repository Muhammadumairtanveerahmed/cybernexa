import { Link, useSearchParams } from "react-router-dom";

export default function RegisterChooserPage() {
  const [params] = useSearchParams();
  const next = params.get("next") || "";
  const withNext = (path) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 760, width: "100%" }}>
      <div className="panel" style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "1.3rem", marginBottom: 6 }}>Create your account</h1>
        <p className="muted" style={{ fontSize: ".88rem" }}>
          Choose the option that matches you. Teachers are reviewed by an administrator before
          their courses go live.
        </p>
      </div>

      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div className="panel">
          <h2>Student</h2>
          <p className="muted" style={{ fontSize: ".88rem" }}>
            Enroll in courses, track attendance, submit assignments, take quizzes and download
            receipts.
          </p>
          <Link className="btn primary" to={withNext("/register/student")} style={{ marginTop: 16 }}>
            Register as student
          </Link>
        </div>

        <div className="panel">
          <h2>Teacher</h2>
          <p className="muted" style={{ fontSize: ".88rem" }}>
            Apply to teach, manage courses, attendance, materials, assignments and quizzes.
          </p>
          <Link className="btn primary" to={withNext("/register/teacher")} style={{ marginTop: 16 }}>
            Apply as teacher
          </Link>
        </div>
      </div>

      <p className="muted" style={{ textAlign: "center", fontSize: ".85rem" }}>
        Already have an account? <Link to={withNext("/login")} style={{ color: "var(--acc)" }}>Sign in</Link>
      </p>
    </div>
  );
}
