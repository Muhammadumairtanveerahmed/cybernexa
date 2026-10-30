import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext.jsx";
import { brand, navMenus } from "../data/siteData.js";

export default function PublicNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState("");
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setOpenDropdown("");
  }, [location.pathname, location.hash]);

  const toggleDropdown = (label) => {
    setOpenDropdown((current) => (current === label ? "" : label));
  };

  const firstName = (user?.full_name || user?.name || "").trim().split(/\s+/)[0];

  return (
    <header className={`navbar${scrolled ? " scrolled" : ""}`} id="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo" aria-label="TechNexa home">
          <span className="logo-mark">
            <i className="fa-solid fa-shield-halved" aria-hidden="true" />
          </span>
          <span className="logo-text">
            Tech<span className="accent">Nexa</span>
          </span>
        </Link>

        <nav className={`nav-links${menuOpen ? " open" : ""}`} id="navLinks">
          <Link to="/" className={location.pathname === "/" ? "active" : ""}>
            Home
          </Link>

          {navMenus.map((menu) => (
            <div
              className={`dropdown${openDropdown === menu.label ? " open" : ""}`}
              key={menu.label}
            >
              <button
                className="drop-btn"
                type="button"
                onClick={() => toggleDropdown(menu.label)}
                aria-expanded={openDropdown === menu.label}
              >
                {menu.label}
              </button>
              <div className="dropdown-menu">
                {menu.links.map((link) => (
                  <Link key={link.label} to={link.to} onClick={() => setOpenDropdown("")}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {user ? (
            <Link className="btn btn-small" to="/portal/dashboard">
              {firstName || "Portal"} ·{" "}
              {user.role === "teacher" ? "Teacher" : user.role === "admin" ? "Admin" : "Student"}
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost btn-small" to="/login">
                Login
              </Link>
              <Link className="btn btn-small" to="/register">
                Register
              </Link>
            </>
          )}

          <Link className="btn btn-small" to="/#contact">
            Talk to an Expert
          </Link>
        </nav>

        <button
          className={`hamburger${menuOpen ? " open" : ""}`}
          id="hamburger"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <span className="sr-only">{brand.tagline}</span>
    </header>
  );
}
