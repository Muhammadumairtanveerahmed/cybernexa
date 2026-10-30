import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";

function CourseCard({ course }) {
  return (
    <div className="card" style={{ maxWidth: "none" }}>
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <span className="tag">{course.category || "Course"}</span>
        {course.featured ? <span className="badge b-pending">Featured</span> : null}
      </div>
      <h2 style={{ marginTop: 10 }}>{course.title}</h2>
      <p className="muted-sm">{course.shortDesc || course.short_desc || course.meta || ""}</p>
      <div className="inline" style={{ justifyContent: "space-between", marginTop: 14 }}>
        <b>{course.price || "Contact us"}</b>
        <Link className="btn ghost sm" to="/courses">View details</Link>
      </div>
    </div>
  );
}

function StudentCourses() {
  const { data, loading, error } = useFetch(portalApi.courses, []);
  return (
    <>
      {error ? <div className="err">{error}</div> : null}
      {loading ? (
        <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading...</div>
      ) : !data?.length ? (
        <EmptyState icon="fa-book-open" text="You are not enrolled in any course yet." />
      ) : (
        <div className="cards">
          {data.map((course) => <CourseCard course={course} key={course.id} />)}
        </div>
      )}
    </>
  );
}

function TeacherCourses() {
  const { data, loading, error, reload } = useFetch(portalApi.courses, []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    tag: "",
    short_desc: "",
    description: "",
    meta: "",
    price: ""
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.addCourse({ ...form, course_title: form.title });
      setOpen(false);
      setForm({ title: "", category: "", tag: "", short_desc: "", description: "", meta: "", price: "" });
      setMessage("Course added.");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not add the course.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!row.teacher_course_id) return;
    if (!window.confirm("Remove this course from your teaching list?")) return;
    try {
      await portalApi.removeCourse(row.teacher_course_id);
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not remove the course.");
    }
  };

  return (
    <>
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <div className="inline" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2>My courses</h2>
          <button className="btn primary sm" type="button" onClick={() => setOpen(true)}>Add course</button>
        </div>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="You have not added any courses yet."
          columns={[
            { key: "title", label: "Course" },
            { key: "category", label: "Category" },
            { key: "price", label: "Price" },
            { key: "active", label: "Active", render: (row) => (row.active ? "Yes" : "No") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <Link className="btn ghost" to="/courses">Public page</Link>
                  <button className="btn danger" type="button" onClick={() => remove(row)}>Remove</button>
                </div>
              )
            }
          ]}
        />
      </div>

      <Modal
        open={open}
        title="Add a course"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="teacher-course-form" disabled={busy}>
              {busy ? "Saving..." : "Add course"}
            </button>
          </>
        }
      >
        <form id="teacher-course-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="tc-title">Course title</label>
              <input id="tc-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="tc-category">Category</label>
              <input id="tc-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="tc-price">Price</label>
              <input id="tc-price" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="PKR 25,000" />
            </div>
            <div>
              <label htmlFor="tc-meta">Duration / mode</label>
              <input id="tc-meta" value={form.meta} onChange={(event) => setForm((current) => ({ ...current, meta: event.target.value }))} placeholder="8 weeks · Online" />
            </div>
          </div>
          <label htmlFor="tc-short">Short description</label>
          <input id="tc-short" value={form.short_desc} onChange={(event) => setForm((current) => ({ ...current, short_desc: event.target.value }))} />
          <label htmlFor="tc-description">Description</label>
          <textarea id="tc-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </form>
      </Modal>
    </>
  );
}

function AdminCourses() {
  const { data, loading, error, reload } = useFetch(portalApi.admin.courses, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    tag: "",
    shortDesc: "",
    description: "",
    meta: "",
    price: "",
    featured: false,
    active: true,
    sortOrder: 0
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", category: "", tag: "", shortDesc: "", description: "", meta: "", price: "", featured: false, active: true, sortOrder: 0 });
    setOpen(true);
  };

  const openEdit = (course) => {
    setEditing(course);
    setForm({
      title: course.title || "",
      category: course.category || "",
      tag: course.tag || "",
      shortDesc: course.shortDesc || course.short_desc || "",
      description: course.description || "",
      meta: course.meta || "",
      price: course.price || "",
      featured: Boolean(course.featured),
      active: Boolean(course.active),
      sortOrder: course.sortOrder || course.sort_order || 0
    });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (editing) {
        await portalApi.admin.updateCourse(editing.id, form);
      } else {
        await portalApi.admin.createCourse(form);
      }
      setOpen(false);
      setMessage(editing ? "Course updated." : "Course created.");
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not save the course.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this course? Existing enrollments keep their course title.")) return;
    try {
      await portalApi.admin.deleteCourse(id);
      await reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the course.");
    }
  };

  const categories = useMemo(() => {
    const set = new Set((data || []).map((course) => course.category).filter(Boolean));
    return Array.from(set);
  }, [data]);

  return (
    <>
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <div className="inline" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2>Course catalogue</h2>
          <button className="btn primary sm" type="button" onClick={openCreate}>New course</button>
        </div>
        <DataTable
          rows={data || []}
          loading={loading}
          empty="No courses in the catalogue."
          columns={[
            { key: "title", label: "Title" },
            { key: "category", label: "Category" },
            { key: "price", label: "Price" },
            { key: "featured", label: "Featured", render: (row) => (row.featured ? "Yes" : "No") },
            { key: "active", label: "Active", render: (row) => (row.active ? "Yes" : "No") },
            { key: "sortOrder", label: "Order" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <button className="btn ghost" type="button" onClick={() => openEdit(row)}>Edit</button>
                  <button className="btn danger" type="button" onClick={() => remove(row.id)}>Delete</button>
                </div>
              )
            }
          ]}
        />
        {categories.length ? <p className="form-note">Categories: {categories.join(", ")}</p> : null}
      </div>

      <Modal
        open={open}
        title={editing ? "Edit course" : "New course"}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="admin-course-form" disabled={busy}>
              {busy ? "Saving..." : "Save course"}
            </button>
          </>
        }
      >
        <form id="admin-course-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="ac-title">Title</label>
              <input id="ac-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="ac-category">Category</label>
              <input id="ac-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="ac-tag">Tag</label>
              <input id="ac-tag" value={form.tag} onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="ac-price">Price</label>
              <input id="ac-price" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="ac-meta">Duration / mode</label>
              <input id="ac-meta" value={form.meta} onChange={(event) => setForm((current) => ({ ...current, meta: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="ac-order">Sort order</label>
              <input id="ac-order" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            </div>
          </div>
          <label htmlFor="ac-short">Short description</label>
          <input id="ac-short" value={form.shortDesc} onChange={(event) => setForm((current) => ({ ...current, shortDesc: event.target.value }))} />
          <label htmlFor="ac-description">Description</label>
          <textarea id="ac-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <div className="inline" style={{ marginTop: 12 }}>
            <label className="inline" style={{ margin: 0 }}>
              <input type="checkbox" checked={form.featured} onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))} />
              Featured
            </label>
            <label className="inline" style={{ margin: 0 }}>
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
              Active
            </label>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default function CoursesPortalPage() {
  const { user } = useAuth();
  const role = user?.role || "student";
  return (
    <PortalPage
      title={role === "admin" ? "Courses" : role === "teacher" ? "My Courses" : "My Courses"}
      sub={role === "admin" ? "Manage the public course catalogue." : role === "teacher" ? "Courses you teach." : "Courses you are enrolled in."}
    >
      {role === "admin" ? <AdminCourses /> : role === "teacher" ? <TeacherCourses /> : <StudentCourses />}
    </PortalPage>
  );
}
