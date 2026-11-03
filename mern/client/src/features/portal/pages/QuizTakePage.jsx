import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import PortalPage from "../components/PortalPage.jsx";
import EmptyState from "../components/EmptyState.jsx";

const violationLabels = {
  screen_hidden: "You left the quiz screen or turned off the screen.",
  window_blur: "The quiz window lost focus.",
  fullscreen_exit: "You exited fullscreen mode.",
  page_leave: "You tried to leave the quiz page.",
  copy_attempt: "You copied quiz content.",
  other: "A quiz violation was recorded."
};

function clock(seconds) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function storageKey(attemptId) {
  return `technexa_quiz_${attemptId}`;
}

export default function QuizTakePage() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [violationCount, setViolationCount] = useState(0);
  const [violationNotice, setViolationNotice] = useState("");
  const answersRef = useRef({});
  const submitRef = useRef(null);
  const autoSubmittedRef = useRef(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    portalApi
      .quiz(id)
      .then((response) => {
        if (!active) return;
        const data = response.data?.data;
        setQuiz(data?.quiz || null);
        setQuestions(data?.questions || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load the quiz.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const start = async () => {
    setStarting(true);
    setError("");
    setSubmitError("");
    try {
      const response = await portalApi.startQuiz(id);
      const data = response.data?.data;
      const nextAttempt = data?.attempt || null;
      const restarted = Boolean(data?.restarted);
      let savedAnswers = {};
      if (nextAttempt?.id) {
        try {
          if (restarted) {
            localStorage.removeItem(storageKey(nextAttempt.id));
          } else {
            savedAnswers =
              JSON.parse(localStorage.getItem(storageKey(nextAttempt.id)) || "{}") || {};
          }
        } catch {
          savedAnswers = {};
        }
      }
      setQuiz(data?.quiz || quiz);
      setQuestions(data?.questions || []);
      setAttempt(nextAttempt);
      setAnswers(savedAnswers);
      answersRef.current = savedAnswers;
      setResult(null);
      setViolationCount(Number(data?.violation_count || 0));
      setViolationNotice("");
      autoSubmittedRef.current = false;
      setSeconds(
        Math.max(
          0,
          Number(
            data?.remaining_seconds ??
              Number(data?.quiz?.duration_minutes || quiz?.duration_minutes || 15) * 60
          )
        )
      );
    } catch (err) {
      setError(err.message || "Could not start the quiz.");
    } finally {
      setStarting(false);
    }
  };

  const submit = async ({ force = false } = {}) => {
    if (!attempt || submittingRef.current) return;
    const currentAnswers = answersRef.current || {};
    const missing = questions.filter((question) => !currentAnswers[question.id]);
    if (!force && missing.length) {
      setSubmitError(
        `Please answer all questions before submitting. Unanswered: ${missing
          .map((question) => `Q${question.q_no}`)
          .join(", ")}`
      );
      const first = document.getElementById(`quiz-q-${missing[0].id}`);
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    submittingRef.current = true;
    setSubmitError("");
    try {
      const response = await portalApi.submitQuiz(id, {
        attempt_id: attempt.id,
        answers: currentAnswers,
        force
      });
      setResult(response.data?.data || null);
      try {
        localStorage.removeItem(storageKey(attempt.id));
      } catch {
        /* ignore storage failures */
      }
    } catch (err) {
      setSubmitError(err.message || "Could not submit the quiz.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (!attempt || result) return undefined;
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt, result]);

  useEffect(() => {
    if (!attempt || result || !questions.length || seconds > 0) return;
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    submitRef.current?.({ force: true });
  }, [seconds, attempt, result, questions.length]);

  useEffect(() => {
    if (!attempt || result) return;
    try {
      localStorage.setItem(storageKey(attempt.id), JSON.stringify(answers));
    } catch {
      /* ignore storage failures */
    }
  }, [answers, attempt, result]);

  useEffect(() => {
    if (!attempt || result) return undefined;
    let active = true;
    let lastReported = 0;

    const report = (type, details) => {
      const now = Date.now();
      if (!active || now - lastReported < 1500) return;
      lastReported = now;
      portalApi
        .recordQuizViolation(id, { attempt_id: attempt.id, type, details })
        .then((response) => {
          if (!active) return;
          setViolationCount(Number(response.data?.data?.count || 0));
          setViolationNotice(violationLabels[type] || violationLabels.other);
        })
        .catch(() => {
          /* violation reporting should never block the quiz */
        });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        report(
          "screen_hidden",
          "Student left the quiz tab, switched apps or turned off the screen."
        );
      }
    };
    const onBlur = () => report("window_blur", "The quiz window lost focus.");
    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        report("fullscreen_exit", "Student exited fullscreen mode.");
      }
    };
    const onCopy = () => report("copy_attempt", "Student copied quiz content.");
    const onPageLeave = () => {
      if (!active) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || "/api";
        const payload = JSON.stringify({
          attempt_id: attempt.id,
          type: "page_leave",
          details: "Student closed, refreshed or left the quiz page."
        });
        navigator.sendBeacon(
          `${apiBase}/portal/quizzes/${id}/violations`,
          new Blob([payload], { type: "application/json" })
        );
      } catch {
        /* best-effort only */
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    window.addEventListener("beforeunload", onPageLeave);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      window.removeEventListener("beforeunload", onPageLeave);
    };
  }, [attempt, result, id]);

  const answeredCount = useMemo(
    () => questions.filter((question) => Boolean(answers[question.id])).length,
    [questions, answers]
  );
  const progressPercent = questions.length
    ? Math.round((answeredCount / questions.length) * 100)
    : 0;
  const unanswered = questions.filter((question) => !answers[question.id]);

  if (loading) {
    return (
      <PortalPage title="Quiz" sub="Loading...">
        <div className="loading">
          <i className="fa-solid fa-spinner fa-spin" /> Loading quiz...
        </div>
      </PortalPage>
    );
  }

  if (error) {
    return (
      <PortalPage title="Quiz" sub="Quiz details">
        <div className="err">{error}</div>
        <Link className="btn ghost" to="/portal/quizzes">
          Back to quizzes
        </Link>
      </PortalPage>
    );
  }

  if (!quiz) {
    return (
      <PortalPage title="Quiz" sub="Quiz details">
        <EmptyState icon="fa-flask" text="Quiz not found." />
      </PortalPage>
    );
  }

  return (
    <PortalPage
      title={quiz.title}
      sub={`${quiz.course_title || "All students"} · ${quiz.duration_minutes} minutes · Pass ${quiz.pass_percent}%`}
      actions={
        <Link className="btn ghost sm" to="/portal/quizzes">
          Back to quizzes
        </Link>
      }
    >
      {result ? (
        <div className="panel">
          <h2>Quiz submitted</h2>
          <div className="cards">
            <div className="stat-card">
              <div className="stat-icon">
                <i className="fa-solid fa-star" />
              </div>
              <div>
                <b>
                  {result.score}/{result.total}
                </b>
                <span>Score</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <i className="fa-solid fa-percent" />
              </div>
              <div>
                <b>{result.percent}%</b>
                <span>Percentage</span>
              </div>
            </div>
            <div className={`stat-card ${result.passed ? "green" : "red"}`}>
              <div className="stat-icon">
                <i
                  className={`fa-solid ${result.passed ? "fa-circle-check" : "fa-circle-xmark"}`}
                />
              </div>
              <div>
                <b>{result.passed ? "Passed" : "Try again"}</b>
                <span>Result</span>
              </div>
            </div>
          </div>
          {Number(result.unanswered || 0) > 0 ? (
            <p className="muted-sm">
              {result.unanswered} question{Number(result.unanswered) === 1 ? "" : "s"} were not
              answered before time ran out. Open the quiz again to retake it.
            </p>
          ) : (
            <p className="muted-sm">
              Your result has been saved. Your teacher can see it in the marks section.
            </p>
          )}
          {violationCount > 0 ? (
            <p className="muted-sm">
              <i className="fa-solid fa-triangle-exclamation" /> {violationCount} quiz violation
              {violationCount === 1 ? "" : "s"} were recorded and are visible to the admin.
            </p>
          ) : null}
        </div>
      ) : !attempt ? (
        <div className="panel">
          <h2>Ready to begin?</h2>
          <p>{quiz.description || "Read each question carefully and choose the best answer."}</p>
          <p className="muted-sm">
            {questions.length} questions · {quiz.duration_minutes} minutes · The quiz will submit
            automatically when time runs out.
          </p>
          <p className="muted-sm">
            Answer all {questions.length} questions before submitting. Your progress is saved on
            this device while you attempt.
          </p>
          <button
            className="btn primary"
            type="button"
            onClick={start}
            disabled={starting}
            style={{ marginTop: 14 }}
          >
            {starting ? "Starting..." : "Start quiz"}
          </button>
        </div>
      ) : (
        <>
          <div className="panel">
            <div
              className="inline"
              style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
              <div>
                <h2>Questions</h2>
                <p className="muted-sm">
                  Answered {answeredCount} of {questions.length}
                  {unanswered.length
                    ? ` · Unanswered: ${unanswered.map((question) => `Q${question.q_no}`).join(", ")}`
                    : " · All questions answered"}
                </p>
              </div>
              <span className="quiz-timer">
                <i className="fa-solid fa-clock" aria-hidden="true" /> {clock(seconds)}
              </span>
            </div>
            <div className="progress" aria-hidden="true">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
            {violationCount > 0 ? (
              <div className="quiz-violation">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                <span>
                  <b>
                    {violationCount} violation{violationCount === 1 ? "" : "s"} recorded.
                  </b>{" "}
                  {violationNotice || "This activity is visible to the admin."} Leaving the quiz
                  screen, switching tabs or losing focus is recorded.
                </span>
              </div>
            ) : (
              <p className="muted-sm" style={{ marginTop: 10 }}>
                <i className="fa-solid fa-shield-halved" aria-hidden="true" /> Stay on this screen
                while attempting. Switching tabs, turning off the screen or losing focus is recorded
                as a violation.
              </p>
            )}

            {questions.map((question, index) => (
              <div
                className={`quiz-q ${answers[question.id] ? "answered" : ""}`}
                id={`quiz-q-${question.id}`}
                key={question.id}
              >
                <h3>
                  {index + 1}. {question.question}
                </h3>
                {["a", "b", "c", "d"].map((option) => {
                  const text = question[`option_${option}`];
                  if (!text) return null;
                  return (
                    <label className="quiz-opt" key={option}>
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() =>
                          setAnswers((current) => {
                            const next = { ...current, [question.id]: option };
                            answersRef.current = next;
                            return next;
                          })
                        }
                      />
                      <span>{option.toUpperCase()}</span>
                      {text}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="panel">
            {submitError ? <div className="err">{submitError}</div> : null}
            <button
              className="btn primary"
              type="button"
              onClick={() => submit({ force: seconds <= 0 })}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : seconds <= 0 ? "Submit now" : "Submit quiz"}
            </button>
            <p className="form-note">
              You cannot change your answers after submitting. All questions must be answered.
            </p>
          </div>
        </>
      )}
    </PortalPage>
  );
}
