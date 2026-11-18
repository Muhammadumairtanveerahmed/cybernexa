import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import PublicLayout from "../features/public-site/components/PublicLayout.jsx";

const HomePage = lazy(() => import("../features/public-site/pages/HomePage.jsx"));
const AboutPage = lazy(() => import("../features/public-site/pages/AboutPage.jsx"));
const CoursesPage = lazy(() => import("../features/public-site/pages/CoursesPage.jsx"));
const IndustriesPage = lazy(() => import("../features/public-site/pages/IndustriesPage.jsx"));
const LegalPage = lazy(() => import("../features/public-site/pages/LegalPage.jsx"));
const ServicePage = lazy(() => import("../features/public-site/pages/ServicePage.jsx"));
const NotFoundPage = lazy(() => import("../features/public-site/pages/NotFoundPage.jsx"));

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
