import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import PortalPage from "../components/PortalPage.jsx";
import EmptyState from "../components/EmptyState.jsx";

function clock(seconds) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);

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
    if (attempt && !result && seconds === 0 && quiz) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  const start = async () => {
    setStarting(true);
    setError("");
    try {
      const response = await portalApi.startQuiz(id);
      const data = response.data?.data;
      setQuiz(data?.quiz || quiz);
      setQuestions(data?.questions || []);
      setAttempt(data?.attempt || null);
      setAnswers({});
      setResult(null);
      setSeconds(Number(data?.quiz?.duration_minutes || 15) * 60);
    } catch (err) {
      setError(err.message || "Could not start the quiz.");
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!attempt) return;
    try {
      const response = await portalApi.submitQuiz(id, { attempt_id: attempt.id, answers });
      setResult(response.data?.data || null);
    } catch (err) {
      setError(err.message || "Could not submit the quiz.");
    }
  };

  if (loading) {
    return (
      <PortalPage title="Quiz" sub="Loading...">
        <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading quiz...</div>
      </PortalPage>
    );
  }

  if (error) {
    return (
      <PortalPage title="Quiz" sub="Quiz details">
        <div className="err">{error}</div>
        <Link className="btn ghost" to="/portal/quizzes">Back to quizzes</Link>
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
              <div className="stat-icon"><i className="fa-solid fa-star" /></div>
              <div>
                <b>{result.score}/{result.total}</b>
                <span>Score</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><i className="fa-solid fa-percent" /></div>
              <div>
                <b>{result.percent}%</b>
                <span>Percentage</span>
              </div>
            </div>
            <div className={`stat-card ${result.passed ? "green" : "red"}`}>
              <div className="stat-icon"><i className={`fa-solid ${result.passed ? "fa-circle-check" : "fa-circle-xmark"}`} /></div>
              <div>
                <b>{result.passed ? "Passed" : "Try again"}</b>
                <span>Result</span>
              </div>
            </div>
          </div>
          <p className="muted-sm">Your result has been saved. Your teacher can see it in the marks section.</p>
        </div>
      ) : !attempt ? (
        <div className="panel">
          <h2>Ready to begin?</h2>
          <p>{quiz.description || "Read each question carefully and choose the best answer."}</p>
          <p className="muted-sm">
            {questions.length} questions · {quiz.duration_minutes} minutes · The quiz will submit automatically when time runs out.
          </p>
          <button className="btn primary" type="button" onClick={start} disabled={starting} style={{ marginTop: 14 }}>
            {starting ? "Starting..." : "Start quiz"}
          </button>
        </div>
      ) : (
        <>
          <div className="panel">
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <h2>Questions</h2>
              <span className="quiz-timer"><i className="fa-solid fa-clock" aria-hidden="true" /> {clock(seconds)}</span>
            </div>
            {questions.map((question, index) => (
              <div className="quiz-q" key={question.id}>
                <h3>{index + 1}. {question.question}</h3>
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
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
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
            <button className="btn primary" type="button" onClick={submit}>
              Submit quiz
            </button>
            <p className="form-note">You cannot change your answers after submitting.</p>
          </div>
        </>
      )}
    </PortalPage>
  );
}
