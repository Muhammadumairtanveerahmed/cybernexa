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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [guardActive, setGuardActive] = useState(false);
  const [guardReason, setGuardReason] = useState("");
  const answersRef = useRef({});
  const submitRef = useRef(null);
  const autoSubmittedRef = useRef(false);
  const submittingRef = useRef(false);
  const attemptRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);

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
    const sync = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) setGuardActive(false);
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      try {
        navigator.keyboard?.unlock?.();
      } catch {
        /* ignore browsers without the keyboard lock API */
      }
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {
          /* ignore browsers that block programmatic exit */
        });
      }
    };
  }, []);

  const enterFullscreen = () => {
    if (document.fullscreenElement) return;
    const root = document.documentElement;
    const request =
      root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    if (request) {
      try {
        const pending = request.call(root, { navigationUI: "hide" });
        if (pending?.catch) pending.catch(() => {});
      } catch {
        /* fullscreen is optional; the quiz still works without it */
      }
    }
    try {
      navigator.keyboard?.lock?.()?.catch?.(() => {});
    } catch {
      /* keyboard lock is only available in some browsers */
    }
  };

  const returnToQuiz = () => {
    enterFullscreen();
    setGuardActive(false);
  };

  const start = async () => {
    enterFullscreen();
    setGuardActive(false);
    setGuardReason("");
    finishedRef.current = false;
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
      finishedRef.current = true;
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

    const sendLeaveBeacon = () => {
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

    const lockScreen = (reason) => {
      setGuardReason(reason);
      setGuardActive(true);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        report(
          "screen_hidden",
          "Student left the quiz tab, switched apps or turned off the screen."
        );
        lockScreen("You switched away from the quiz tab or turned off the screen.");
      } else if (document.fullscreenElement) {
        setGuardActive(false);
      }
    };

    const onBlur = () => {
      report("window_blur", "The quiz window lost focus.");
      if (!document.fullscreenElement) {
        lockScreen("The quiz window lost focus. Return to fullscreen to continue.");
      }
    };

    const onFullscreen = () => {
      if (!document.fullscreenElement) {
        report("fullscreen_exit", "Student exited fullscreen mode.");
        lockScreen("You exited fullscreen. Return to fullscreen to continue the quiz.");
      } else {
        setGuardActive(false);
      }
    };

    const onCopy = () => report("copy_attempt", "Student copied quiz content.");
    const onPaste = () => report("other", "Student tried to paste content into the quiz.");

    const onBeforeUnload = (event) => {
      sendLeaveBeacon();
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    const onKeyDown = (event) => {
      const key = String(event.key || "").toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const devtools =
        event.key === "F12" ||
        (mod && event.shiftKey && ["i", "j", "c"].includes(key)) ||
        (mod && key === "u");
      const blocked =
        devtools ||
        (mod && ["s", "p", "c", "x", "v", "a", "t", "n", "w", "tab"].includes(key)) ||
        (event.altKey && (key === "arrowleft" || key === "arrowright"));
      if (!blocked) return;
      event.preventDefault();
      event.stopPropagation();
      if (devtools) {
        report("other", "Developer tools shortcut blocked.");
      } else if (mod && (key === "c" || key === "x")) {
        report("copy_attempt", "Student tried to copy quiz content.");
      }
    };

    const blockEvent = (event) => event.preventDefault();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("selectstart", blockEvent);
    document.addEventListener("dragstart", blockEvent);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.body.classList.add("quiz-locked");

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("selectstart", blockEvent);
      document.removeEventListener("dragstart", blockEvent);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.body.classList.remove("quiz-locked");
    };
  }, [attempt, result, id]);

  // Records a violation if the student navigates away from the quiz page (browser back, link).
  useEffect(() => {
    return () => {
      const current = attemptRef.current;
      if (!current || finishedRef.current) return;
      try {
        const apiBase = import.meta.env.VITE_API_URL || "/api";
        const payload = JSON.stringify({
          attempt_id: current.id,
          type: "page_leave",
          details: "Student navigated away from the quiz page."
        });
        navigator.sendBeacon(
          `${apiBase}/portal/quizzes/${id}/violations`,
          new Blob([payload], { type: "application/json" })
        );
      } catch {
        /* best-effort only */
      }
    };
  }, [id]);

  useEffect(() => {
    if (!result) return;
    finishedRef.current = true;
    setGuardActive(false);
    try {
      navigator.keyboard?.unlock?.();
    } catch {
      /* ignore browsers without the keyboard lock API */
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {
        /* ignore browsers that block programmatic exit */
      });
    }
  }, [result]);

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
        attempt && !result ? null : (
          <Link className="btn ghost sm" to="/portal/quizzes">
            Back to quizzes
          </Link>
        )
      }
    >
      {attempt && !result && guardActive ? (
        <div className="quiz-guard" role="alertdialog" aria-modal="true" aria-label="Quiz locked">
          <div className="quiz-guard-box">
            <div className="quiz-guard-icon">
              <i className="fa-solid fa-lock" aria-hidden="true" />
            </div>
            <h2>Quiz screen locked</h2>
            <p>{guardReason || "You left the quiz screen."}</p>
            <p className="muted-sm">
              Questions are hidden until you return to fullscreen. The timer is still running.
            </p>
            <div className="quiz-guard-timer">
              <i className="fa-solid fa-clock" aria-hidden="true" /> {clock(seconds)}
            </div>
            {violationCount > 0 ? (
              <p className="quiz-guard-count">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
                {violationCount} violation{violationCount === 1 ? "" : "s"} recorded — visible to the
                admin.
              </p>
            ) : null}
            <button className="btn primary" type="button" onClick={returnToQuiz}>
              <i className="fa-solid fa-expand" aria-hidden="true" /> Return to fullscreen
            </button>
            <p className="quiz-guard-note">
              Opening another tab, switching windows or exiting fullscreen is recorded as a quiz
              violation.
            </p>
          </div>
        </div>
      ) : null}
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
          <p className="muted-sm">
            <i className="fa-solid fa-expand" aria-hidden="true" /> Starting the quiz switches this
            device to fullscreen and locks the quiz screen. Leaving fullscreen, switching tabs or
            opening another window is recorded as a violation.
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
              <div className="inline" style={{ gap: 8 }}>
                {isFullscreen ? (
                  <span className="quiz-focus-badge">
                    <i className="fa-solid fa-lock" aria-hidden="true" /> Focus mode
                  </span>
                ) : (
                  <button className="btn ghost sm" type="button" onClick={enterFullscreen}>
                    <i className="fa-solid fa-expand" aria-hidden="true" /> Fullscreen
                  </button>
                )}
                <span className="quiz-timer">
                  <i className="fa-solid fa-clock" aria-hidden="true" /> {clock(seconds)}
                </span>
              </div>
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

            <div className="quiz-grid">
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
