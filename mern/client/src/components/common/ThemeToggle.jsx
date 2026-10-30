import { useTheme } from "../../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { isLight, toggleTheme } = useTheme();
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={isLight}
    >
      <i className={`fa-solid ${isLight ? "fa-moon" : "fa-sun"}`} aria-hidden="true" />
    </button>
  );
}
