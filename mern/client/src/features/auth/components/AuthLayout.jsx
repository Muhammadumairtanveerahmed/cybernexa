import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import portalCssUrl from "../../../styles/portal.css?url";

export default function AuthLayout() {
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
        <Link className="lnk" to="/login">
          Sign in
        </Link>
        <Link className="btn primary sm" to="/register">
          Register
        </Link>
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
