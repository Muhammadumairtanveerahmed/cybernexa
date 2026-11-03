import { useMemo, useState } from "react";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import PortalPage from "../components/PortalPage.jsx";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import EmptyState from "../components/EmptyState.jsx";

const blank = () => ({
  course_title: "",
  question: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct: "a",
  marks: 1
});

export default function QuestionBankPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qbank = useFetch(portalApi.qbank, []);
  const courses = useFetch(
    () => (isAdmin ? portalApi.admin.courses() : portalApi.courses()),
    [isAdmin]
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(5);
  const [aiBusy, setAiBusy] = useState(false);
  const [generated, setGenerated] = useState([]);
  const [aiNotice, setAiNotice] = useState("");

  const courseOptions = useMemo(
    () => (courses.data || []).map((course) => course.title || course.course_title).filter(Boolean),
    [courses.data]
  );

  const openForm = () => {
    setForm({ ...blank(), course_title: courseOptions[0] || "" });
    setOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await portalApi.addQuestion(form);
      setOpen(false);
      setMessage("Question saved to the bank.");
      await qbank.reload();
    } catch (err) {
      setMessage(err.message || "Could not save the question.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this question?")) return;
    try {
      await portalApi.deleteQuestion(id);
      await qbank.reload();
    } catch (err) {
      setMessage(err.message || "Could not delete the question.");
    }
  };

  const generate = async (event) => {
    event.preventDefault();
    setAiBusy(true);
    setMessage("");
    setAiNotice("");
    try {
      const response = await portalApi.generateQuestions({ topic: aiTopic, count: aiCount });
      const questions = response.data?.data || [];
      setGenerated(questions);
      setAiNotice(response.data?.meta?.warning || "");
      if (!questions.length) setMessage("No questions were generated. Try a different topic.");
    } catch (err) {
      setMessage(err.message || "Could not generate questions.");
    } finally {
      setAiBusy(false);
    }
  };

  const saveGenerated = async (question) => {
    setMessage("");
    try {
      await portalApi.addQuestion({
        ...question,
        course_title: form.course_title || courseOptions[0] || ""
      });
      setGenerated((current) => current.filter((item) => item !== question));
      setMessage("Generated question saved.");
      await qbank.reload();
    } catch (err) {
      setMessage(err.message || "Could not save the generated question.");
    }
  };

  return (
    <PortalPage
      title="Question Bank"
      sub="Reusable questions for quizzes, with optional AI-assisted drafting."
      actions={<button className="btn primary sm" type="button" onClick={openForm}>Add question</button>}
    >
      {message ? <div className={message.includes("Could not") ? "err" : "ok"}>{message}</div> : null}
      {qbank.error ? <div className="err">{qbank.error}</div> : null}

      <div className="panel">
        <h2>AI question generator</h2>
        <form className="inline" onSubmit={generate}>
          <input
            value={aiTopic}
            onChange={(event) => setAiTopic(event.target.value)}
            placeholder="Topic, e.g. SQL joins"
            style={{ flex: 1, minWidth: 220 }}
            required
          />
          <input
            type="number"
            min="1"
            max="10"
            value={aiCount}
            onChange={(event) => setAiCount(event.target.value)}
            style={{ width: 80 }}
            aria-label="Number of questions"
          />
          <button className="btn primary" type="submit" disabled={aiBusy}>
            {aiBusy ? "Generating..." : "Generate"}
          </button>
        </form>
        <p className="form-note">
          Works out of the box with the built-in generator. Add OPENAI_API_KEY on the server to use live AI.
        </p>
        {aiNotice ? <p className="form-note">{aiNotice}</p> : null}
        {generated.length ? (
          <div className="stack" style={{ marginTop: 14 }}>
            {generated.map((question, index) => (
              <div className="quiz-q" key={index}>
                <b>{question.question}</b>
                <div className="muted-sm">A. {question.option_a} · B. {question.option_b} · C. {question.option_c} · D. {question.option_d}</div>
                <div className="inline" style={{ marginTop: 8 }}>
                  <span className="tag">Answer {String(question.correct).toUpperCase()}</span>
                  <button className="btn primary sm" type="button" onClick={() => saveGenerated(question)}>Save to bank</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="panel">
        <h2>Saved questions</h2>
        <DataTable
          rows={qbank.data || []}
          loading={qbank.loading}
          empty="No questions in the bank yet."
          columns={[
            { key: "question", label: "Question" },
            { key: "course_title", label: "Course" },
            { key: "correct", label: "Answer", render: (row) => String(row.correct || "").toUpperCase() },
            { key: "marks", label: "Marks" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <button className="btn danger" type="button" onClick={() => remove(row.id)}>Delete</button>
              )
            }
          ]}
        />
        {!qbank.loading && !qbank.data?.length ? <EmptyState icon="fa-database" text="Build your first question." /> : null}
      </div>

      <Modal
        open={open}
        title="Add question"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" type="submit" form="qbank-form" disabled={busy}>
              {busy ? "Saving..." : "Save question"}
            </button>
          </>
        }
      >
        <form id="qbank-form" onSubmit={save}>
          <div className="form-grid">
            <div>
              <label htmlFor="qb-course">Course</label>
              <select id="qb-course" value={form.course_title} onChange={(event) => setForm((current) => ({ ...current, course_title: event.target.value }))}>
                <option value="">General</option>
                {courseOptions.map((title) => <option value={title} key={title}>{title}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="qb-marks">Marks</label>
              <input id="qb-marks" type="number" min="0.5" step="0.5" value={form.marks} onChange={(event) => setForm((current) => ({ ...current, marks: event.target.value }))} />
            </div>
          </div>
          <label htmlFor="qb-question">Question</label>
          <textarea id="qb-question" rows={3} value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} required />
          {["a", "b", "c", "d"].map((option) => (
            <div className="q-option-row" key={option}>
              <span>{option.toUpperCase()}</span>
              <input
                type="text"
                value={form[`option_${option}`]}
                onChange={(event) => setForm((current) => ({ ...current, [`option_${option}`]: event.target.value }))}
                placeholder={`Option ${option.toUpperCase()}`}
                required={option === "a" || option === "b"}
              />
              <select value={form.correct} onChange={(event) => setForm((current) => ({ ...current, correct: event.target.value }))}>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>
              </select>
            </div>
          ))}
        </form>
      </Modal>
    </PortalPage>
  );
}
