import { useEffect, useState } from "react";
import { brand } from "../data/siteData.js";

export default function FloatingActions() {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="float-actions">
      <a
        className="float-btn pulse-anim"
        href={brand.whatsapp}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <i className="fa-brands fa-whatsapp" aria-hidden="true" />
      </a>
      {showTop ? (
        <button
          className="float-btn to-top"
          type="button"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <i className="fa-solid fa-arrow-up" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
