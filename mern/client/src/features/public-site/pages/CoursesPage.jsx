import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Hero from "../components/Hero.jsx";
import CourseCard from "../components/CourseCard.jsx";
import CourseModal from "../components/CourseModal.jsx";
import CtaBand from "../components/CtaBand.jsx";
import { allCourses, categoryMeta } from "../data/siteData.js";
import { useAuth } from "../../../context/AuthContext.jsx";

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CoursesPage() {
  const { loading } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const enrollId = searchParams.get("enroll");

  useEffect(() => {
    if (!enrollId || loading) return;
    const match = allCourses.find((course) => course.id === enrollId);
    if (match) {
      setSelectedCourse(match);
    }
    const next = new URLSearchParams(window.location.search);
    next.delete("enroll");
    setSearchParams(next, { replace: true });
  }, [enrollId, setSearchParams, loading]);

  const groups = useMemo(() => {
    const map = new Map();
    allCourses.forEach((course) => {
      const category = course.category || "Other";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(course);
    });

    const ordered = categoryMeta
      .filter((meta) => map.has(meta.name))
      .map((meta) => ({ ...meta, courses: map.get(meta.name) }));

    const known = new Set(ordered.map((group) => group.name));
    map.forEach((courses, name) => {
      if (!known.has(name)) {
        ordered.push({
          slug: slugify(name),
          name,
          icon: "fa-book",
          blurb: `Courses in ${name}.`,
          courses
        });
      }
    });

    return ordered;
  }, []);

  return (
    <>
      <Hero
        short
        badge="TechNexa Academy"
        title={`${allCourses.length} Courses.`}
        accent="One Career Leap."
        sub="Full course catalog with durations, levels and prices. Click Enroll Now on any card to see its price and start your application."
        primary={{ label: "Talk to a Counselor", href: "#contact" }}
        secondary={{ label: "Browse Categories", href: "#catalog" }}
      />

      <section className="section" id="catalog">
        <div className="container">
          <div className="cat-chips" id="catChips">
            {groups.map((group) => (
              <a href={`#${group.slug}`} key={group.slug}>
                <i className={`fa-solid ${group.icon}`} aria-hidden="true" /> {group.name}
              </a>
            ))}
          </div>

          {groups.map((group) => (
            <div className="cat-block" id={group.slug} key={group.slug}>
              <div className="cat-head">
                <span className="ic">
                  <i className={`fa-solid ${group.icon}`} aria-hidden="true" />
                </span>
                <div>
                  <h2>{group.name}</h2>
                  <p>{group.blurb}</p>
                </div>
              </div>
              <div className="course-grid">
                {group.courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onEnroll={(courseToEnroll) => {
                      setSelectedCourse(courseToEnroll);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <CtaBand
        title="Not Sure Which Course Fits You?"
        text="Send us your background and career goal. We will recommend a course and a study plan."
      />

      <CourseModal
        course={selectedCourse}
        open={Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
      />
    </>
  );
}
