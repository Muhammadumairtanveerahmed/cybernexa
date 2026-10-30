import { Route, Routes } from "react-router-dom";
import PublicLayout from "../features/public-site/components/PublicLayout.jsx";
import HomePage from "../features/public-site/pages/HomePage.jsx";
import AboutPage from "../features/public-site/pages/AboutPage.jsx";
import CoursesPage from "../features/public-site/pages/CoursesPage.jsx";
import IndustriesPage from "../features/public-site/pages/IndustriesPage.jsx";
import LegalPage from "../features/public-site/pages/LegalPage.jsx";
import ServicePage from "../features/public-site/pages/ServicePage.jsx";
import NotFoundPage from "../features/public-site/pages/NotFoundPage.jsx";

export default function PublicRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/industries" element={<IndustriesPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/services/:slug" element={<ServicePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
