import { useState } from "react";

export default function FaqAccordion({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq-list">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div className={`faq-item${isOpen ? " open" : ""}`} key={item.q}>
            <button
              className="faq-q"
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : index)}
            >
              {item.q}
              <span className="faq-icon">
                <i className={`fa-solid ${isOpen ? "fa-minus" : "fa-plus"}`} aria-hidden="true" />
              </span>
            </button>
            <div className="faq-a" style={{ maxHeight: isOpen ? 400 : 0 }}>
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
