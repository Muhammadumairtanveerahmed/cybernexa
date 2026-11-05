import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { formatDate } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Badge from "../components/Badge.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";

const emptyQuestion = () => ({
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct: "a",
  marks: 1
});

function StudentQuizzes() {
  const { data, loading, error } = useFetch(portalApi.quizzes, []);
  return (
    <>
      {error ? <div className="err">{error}</div> : null}
      <div className="panel">
        <h2>Available quizzes</h2>
        {loading ? (
          <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading...</div>
        ) : !data?.length ? (
          <EmptyState icon="fa-flask" text="No quizzes published yet." />
        ) : (
          <div className="stack">
            {data.map((quiz) => {
              const canRetake =
                quiz.attempt_status === "submitted" && Number(quiz.unanswered_count || 0) > 0;
              return (
              <div className="note" key={quiz.id}>
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <h4>{quiz.title}</h4>
                  <Badge
                    status={
                      canRetake
                        ? "pending"
                        : quiz.attempt_status === "submitted"
                          ? "completed"
                          : quiz.attempt_status === "in_progress"
                            ? "pending"
                            : "active"
                    }
                    label={
                      canRetake
                        ? "Retake available"
                        : quiz.attempt_status === "submitted"
                          ? "Submitted"
                          : quiz.attempt_status === "in_progress"
                            ? "In progress"
                            : "Not started"
                    }
                  />
                </div>
                <p>{quiz.description || `${quiz.course_title} quiz`}</p>
                <div className="inline" style={{ marginTop: 8 }}>
                  <span className="tag">{quiz.course_title || "All students"}</span>
                  <span className="muted-sm">{quiz.duration_minutes} minutes</span>
                  <span className="muted-sm">Pass {quiz.pass_percent}%</span>
                  {quiz.attempt_status === "submitted" && !canRetake ? (
                    <span className="muted-sm">Score: {quiz.score}/{quiz.total}</span>
                  ) : (
                    <Link className="btn primary sm" to={`/portal/quizzes/${quiz.id}`}>
                      {canRetake
                        ? "Retake quiz"
                        : quiz.attempt_status === "in_progress"
                          ? "Continue"
                          : "Start quiz"}
                    </Link>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function StaffQuizzes() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const quizzes = useFetch(portalApi.quizzes, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    course_title: "",
    description: "",
    duration_minutes: 15,
    pass_percent: 50,
    audience: "all",
    status: "published"
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSource, setAiSource] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openForm = () => {
    setForm({
      title: "",
      course_title: courseOptions[0] || "",
      description: "",
      duration_minutes: 15,
      pass_percent: 50,
      audience: "all",
      status: "published"
    });
    setQuestions([emptyQuestion()]);
    setAiTopic("");
    setAiSource("");
    setOpen(true);
  };

  const updateQuestion = (index, field, value) => {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, [field]: value } : question)));
  };

  const addQuestion = () => setQuestions((current) => [...current, emptyQuestion()]);
  const removeQuestion = (index) => setQuestions((current) => current.filter((_, i) => i !== index));

  const generateQuizQuestions = async () => {
    if (!aiTopic.trim()) return setMessage("Please enter a topic for AI generation.");
    setAiGenerating(true);
    setMessage("");
    try {
      const response = await portalApi.generateQuestions({ topic: aiTopic.trim(), count: 5, courseTitle: form.course_title || "" });
      const generated = response.data?.data || [];
      if (!generated.length) throw new Error("No questions were generated.");
      setQuestions(
        generated.map((q, index) => ({
          question: q.question || "",
          option_a: q.option_a || "",
          option_b: q.option_b || "",
          option_c: q.option_c || "",
          option_d: q.option_d || "",
          correct: q.correct || "a",
          marks: q.marks || 1
        }))
      );
      setAiSource(response.data?.meta?.source || "AI");
      setMessage(`Questions generated via ${response.data?.meta?.source || "AI"}.`);
    } catch (err) {
      setMessage(err.message || "AI generation failed. You can still add questions manually.");
    } finally {
      setAiGenerating(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.createQuiz({ ...form, questions });
      setOpen(false);
      setMessage("Quiz created.");
      await quizzes.reload();
    } catch (err) {
      setMessage(err.message || "Could not create the quiz.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this quiz and all its attempts?")) return;
    try {
      await portalApi.deleteQuiz(id);
      await quizzes.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the quiz.");
    }
  };

  return (
    <>
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {quizzes.error ? <div className="err">{quizzes.error}</div> : null}
      <div className="panel">
        <div className="inline" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h2>My quizzes</h2>
          <button className="btn primary sm" type="button" onClick={openForm}>New quiz</button>
        </div>
        <DataTable
          rows={quizzes.data || []}
          loading={quizzes.loading}
          empty="No quizzes yet."
          columns={[
            { key: "title", label: "Title" },
            { key: "course_title", label: "Course" },
            { key: "duration_minutes", label: "Minutes" },
            { key: "pass_percent", label: "Pass %" },
            { key: "audience", label: "Audience" },
            { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
            { key: "question_count", label: "Questions" },
            { key: "created_at", label: "Created", render: (row) => formatDate(row.created_at) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="table-actions">
                  <Link className="btn ghost" to={`/portal/quizzes/${row.id}`}>Preview</Link>
                  <button className="btn danger" type="button" onClick={() => remove(row.id)}>Delete</button>
                </div>
              )
            }
          ]}
        />
      </div>

      <Modal
        open={open}
        title="Create quiz"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="quiz-form" disabled={busy}>
              {busy ? "Creating..." : "Create quiz"}
            </button>
          </>
        }
      >
        <form id="quiz-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="q-title">Title</label>
              <input id="q-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </div>
            <div>
              <label htmlFor="q-course">Course</label>
              <select id="q-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))} required>
                <option value="">Select course</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="q-duration">Duration (minutes)</label>
              <input id="q-duration" type="number" min="1" value={form.duration_minutes} onChange={(event) => setForm((current) => ({ ...current, duration_minutes: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="q-pass">Pass percent</label>
              <input id="q-pass" type="number" min="0" max="100" value={form.pass_percent} onChange={(event) => setForm((current) => ({ ...current, pass_percent: event.target.value }))} />
            </div>
            <div>
              <label htmlFor="q-audience">Audience</label>
              <select id="q-audience" value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}>
                <option value="all">All students</option>
                <option value="course">This course only</option>
              </select>
            </div>
            <div>
              <label htmlFor="q-status">Status</label>
              <select id="q-status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <label htmlFor="q-description">Description</label>
          <input id="q-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />

          <h3 style={{ margin: "20px 0 10px", fontSize: ".95rem" }}>Questions</h3>
          {questions.map((question, index) => (
            <div className="quiz-q" key={index}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <b>Question {index + 1}</b>
                {questions.length > 1 ? (
                  <button className="btn danger sm" type="button" onClick={() => removeQuestion(index)}>Remove</button>
                ) : null}
              </div>
              <label htmlFor={`question-${index}`}>Question</label>
              <input id={`question-${index}`} value={question.question} onChange={(event) => updateQuestion(index, "question", event.target.value)} required />
              {["a", "b", "c", "d"].map((option) => (
                <div className="q-option-row" key={option}>
                  <span>{option.toUpperCase()}</span>
                  <input
                    type="text"
                    value={question[`option_${option}`]}
                    onChange={(event) => updateQuestion(index, `option_${option}`, event.target.value)}
                    placeholder={`Option ${option.toUpperCase()}`}
                    required={option === "a" || option === "b"}
                  />
                  <select value={question.correct} onChange={(event) => updateQuestion(index, "correct", event.target.value)}>
                    <option value="a">A</option>
                    <option value="b">B</option>
                    <option value="c">C</option>
                    <option value="d">D</option>
                  </select>
                </div>
              ))}
              <div className="inline">
                <label htmlFor={`marks-${index}`} style={{ margin: 0 }}>Marks</label>
                <input id={`marks-${index}`} type="number" min="0.5" step="0.5" value={question.marks} onChange={(event) => updateQuestion(index, "marks", event.target.value)} style={{ width: 90 }} />
              </div>
            </div>
          ))}
          {aiSource ? (
            <p className="ok" style={{ marginTop: 10, fontSize: ".85rem" }}>
              <i className="fa-solid fa-robot" aria-hidden="true" /> {questions.length} question{questions.length === 1 ? "" : "s"} generated via {aiSource}. You can edit them below.
            </p>
          ) : null}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <label htmlFor="ai-topic">Generate questions with AI</label>
            <p className="muted-sm" style={{ marginBottom: 8, fontSize: ".85rem" }}>
              <i className="fa-solid fa-info-circle" aria-hidden="true" /> Select a course above, enter a topic, then generate AI questions.
            </p>
            <div className="inline" style={{ gap: 8, flexWrap: "wrap" }}>
              <input
                id="ai-topic"
                value={aiTopic}
                onChange={(event) => setAiTopic(event.target.value)}
                placeholder="e.g. Cybersecurity basics, SQL joins, React hooks"
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                className="btn primary sm"
                type="button"
                onClick={generateQuizQuestions}
                disabled={aiGenerating}
              >
                {aiGenerating ? "Generating..." : "Generate with AI"}
              </button>
            </div>
            {form.course_title ? (
              <p className="ok" style={{ marginTop: 6, fontSize: ".8rem" }}>
                <i className="fa-solid fa-check-circle" aria-hidden="true" /> Course selected: {form.course_title}
              </p>
            ) : (
              <p className="muted-sm" style={{ marginTop: 6, fontSize: ".8rem" }}>
                <i className="fa-solid fa-info-circle" aria-hidden="true" /> Course can be selected before saving the quiz.
              </p>
            )}
            <p className="muted-sm" style={{ marginTop: 6, fontSize: ".8rem" }}>
              Uses Gemini/OpenAI when configured; otherwise built-in topic-aware questions.
            </p>
          </div>
          <button className="btn ghost" type="button" onClick={addQuestion}>Add another question</button>
        </form>
      </Modal>
    </>
  );
}

export default function QuizzesPage() {
  const { user } = useAuth();
  const isStaff = user?.role === "teacher" || user?.role === "admin";
  return (
    <PortalPage
      title="Quizzes"
      sub={isStaff ? "Create quizzes, reuse your question bank and review results." : "Attempt quizzes and track your scores."}
    >
      {isStaff ? <StaffQuizzes /> : <StudentQuizzes />}
    </PortalPage>
  );
}
