import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import ThemeToggle from "../../../components/common/ThemeToggle.jsx";
import portalCssUrl from "../../../styles/portal.css?url";

export default function AuthLayout() {
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "";
  const withNext = (path) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = portalCssUrl;
    link.dataset.technexaPortal = "true";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  return (
    <div className="wrap">
      <nav className="nav">
        <Link to="/" className="logo">
          Tech<b>Nexa</b>
        </Link>
        <span className="sp" />
        <Link className="lnk" to="/">
          Website
        </Link>
        <Link className="lnk" to={withNext("/login")}>
          Sign in
        </Link>
        <Link className="btn primary sm" to={withNext("/register")}>
          Register
        </Link>
        <ThemeToggle />
      </nav>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 18px"
        }}
      >
        <Outlet />
      </div>
    </div>
  );
}
