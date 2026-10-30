export default function CourseCard({ course, onEnroll }) {
  const meta = (course.meta || "").split("|").map((item) => item.trim()).filter(Boolean);

  return (
    <article className="course reveal visible">
      <div className="course-top">
        <span className="course-tag">{course.tag || course.category}</span>
        <h3>{course.title}</h3>
        <p>{course.shortDesc || course.description}</p>
        <div className="course-meta">
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <button
          className="enroll-btn"
          type="button"
          onClick={() => onEnroll(course)}
          data-course-title={course.title}
        >
          Enroll Now
        </button>
      </div>
    </article>
  );
}
