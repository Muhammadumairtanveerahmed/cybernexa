import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import siteCssUrl from "../../../styles/site.css?url";
import PublicNavbar from "./PublicNavbar.jsx";
import PublicFooter from "./PublicFooter.jsx";
import FloatingActions from "./FloatingActions.jsx";

export default function PublicLayout() {
  const location = useLocation();

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = siteCssUrl;
    link.dataset.technexaSite = "true";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname, location.hash]);

  return (
    <div className="public-site">
      <PublicNavbar />
      <Outlet />
      <PublicFooter />
      <FloatingActions />
    </div>
  );
}
