import { Link } from "react-router-dom";
import Hero from "../components/Hero.jsx";

export default function NotFoundPage() {
  return (
    <Hero
      short
      badge="404"
      title="Page Not"
      accent="Found"
      sub="The page you are looking for does not exist or has moved."
      primary={{ label: "Back to Home", to: "/" }}
      secondary={{ label: "Browse Courses", to: "/courses" }}
    />
  );
}
