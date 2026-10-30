import { useEffect, useState } from "react";

function Counter({ value, suffix }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const duration = 1600;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <strong>
      {current}
      {suffix}
    </strong>
  );
}

export default function StatsRow({ items, compact = false }) {
  return (
    <div className={`hero-stats${compact ? " stats-3" : ""}`}>
      {items.map((item) => (
        <div className="stat" key={`${item.label}-${item.value}`}>
          {typeof item.value === "number" ? (
            <Counter value={item.value} suffix={item.suffix || ""} />
          ) : (
            <strong>{item.value}</strong>
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
