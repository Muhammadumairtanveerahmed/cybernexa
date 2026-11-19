import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import PortalPage from "../components/PortalPage.jsx";

function youtubeId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || "";
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] || "";
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] || "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

function fmtTime(value) {
  const sec = Math.max(0, Math.floor(Number(value) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LectureWatchPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const isStudent = user?.role === "student";
  const isStaff = user?.role === "teacher" || user?.role === "admin";

  const [lecture, setLecture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState([{ index: -1, label: "Auto" }]);
  const [quality, setQuality] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [resumeAt, setResumeAt] = useState(0);
  const [resumeApplied, setResumeApplied] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const lastSavedRef = useRef(0);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    portalApi
      .lecture(id)
      .then((res) => {
        if (!active) return;
        const data = res.data?.data || null;
        setLecture(data);
        const pos = Number(data?.progress?.position_seconds || 0);
        setResumeAt(Number.isFinite(pos) && pos > 0 ? pos : 0);
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load the lecture.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const ytId = useMemo(() => youtubeId(lecture?.youtube_url || ""), [lecture?.youtube_url]);
  const isUpload = lecture?.lecture_type === "upload";
  const canStreamHls = isUpload && lecture?.processing_status === "ready";
  const streamUrl = `/api/portal/lectures/${id}/stream`;
  const hlsUrl = `/api/portal/lectures/${id}/hls/master.m3u8`;

  const saveProgress = async (force = false) => {
    if (!isStudent || !lecture || !isUpload) return;
    const video = videoRef.current;
    if (!video) return;
    const position = Number(video.currentTime || 0);
    const duration = Number(video.duration || lecture.duration_seconds || 0);
    if (!Number.isFinite(position)) return;
    const delta = Math.abs(position - (lastSavedRef.current || 0));
    if (!force && delta < 8) return;
    lastSavedRef.current = position;
    try {
      await portalApi.saveLectureProgress(id, {
        position_seconds: position,
        duration_seconds: Number.isFinite(duration) ? duration : 0,
        completed: Number.isFinite(duration) && duration > 0 ? position >= Math.max(0, duration - 10) : false
      });
    } catch {
      /* progress save is best-effort */
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      saveProgress(true);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          /* ignore */
        }
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lecture?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isUpload) return;

    let cancelled = false;
    setStatusMsg("");

    const attachNative = (src) => {
      video.src = src;
    };

    const setup = async () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          /* ignore */
        }
        hlsRef.current = null;
      }

      if (canStreamHls) {
        const canNative = video.canPlayType("application/vnd.apple.mpegurl");
        if (canNative) {
          attachNative(hlsUrl);
          const q = Array.isArray(lecture?.qualities) ? lecture.qualities : [];
          const opts = [{ index: -1, label: "Auto" }].concat(
            q.map((name, index) => ({ index, label: String(name) }))
          );
          setLevels(opts);
          setStatusMsg("Playing HLS stream.");
          return;
        }

        try {
          const mod = await import("hls.js");
          if (cancelled) return;
          const Hls = mod.default || mod;
          if (Hls && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
            hlsRef.current = hls;
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              const nextLevels = [{ index: -1, label: "Auto" }].concat(
                (hls.levels || []).map((level, index) => ({
                  index,
                  label: level.height ? `${level.height}p` : `Level ${index + 1}`
                }))
              );
              setLevels(nextLevels);
              setStatusMsg("Playing HLS stream.");
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data?.fatal) {
                setStatusMsg("HLS playback failed, switching to direct video.");
                try {
                  hls.destroy();
                } catch {
                  /* ignore */
                }
                hlsRef.current = null;
                attachNative(streamUrl);
                setLevels([{ index: -1, label: "Auto" }]);
              }
            });
            return;
          }
        } catch {
          /* hls.js unavailable, fallback below */
        }

        // No native HLS and no hls.js: fall back to direct file.
        attachNative(streamUrl);
        setLevels([{ index: -1, label: "Auto" }]);
        setStatusMsg("Direct video playback.");
        return;
      }

      // Not ready (pending/processing/failed) - try direct original if available.
      if (lecture?.source_path) {
        attachNative(streamUrl);
        setLevels([{ index: -1, label: "Auto" }]);
        if (lecture.processing_status === "failed") {
          setStatusMsg("HLS processing failed. Playing the original uploaded file.");
        } else if (lecture.processing_status && lecture.processing_status !== "ready") {
          setStatusMsg("Lecture is still processing. Direct playback may be available for staff.");
        }
      }
    };

    setup();
    return () => {
      cancelled = true;
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {
          /* ignore */
        }
        hlsRef.current = null;
      }
    };
  }, [canStreamHls, hlsUrl, streamUrl, isUpload, lecture?.processing_status, lecture?.source_path, lecture?.qualities]);

  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = quality;
    }
  }, [quality]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, lecture?.id]);

  useEffect(() => {
    if (!isStudent || !isUpload) return undefined;
    saveTimerRef.current = setInterval(() => saveProgress(false), 10000);
    return () => {
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStudent, isUpload, lecture?.id]);

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    if (!resumeApplied && resumeAt > 0 && Number.isFinite(video.duration)) {
      const target = Math.min(Math.max(0, resumeAt), Math.max(0, video.duration - 2));
      if (target > 1) {
        try {
          video.currentTime = target;
        } catch {
          /* ignore */
        }
      }
      setResumeApplied(true);
    }
  };

  const onTimeUpdate = () => {
    // lightweight throttle handled in saveProgress
  };

  if (loading) {
    return (
      <PortalPage title="Lecture" sub="Loading lecture...">
        <div className="loading">
          <i className="fa-solid fa-spinner fa-spin" /> Loading...
        </div>
      </PortalPage>
    );
  }

  if (error) {
    return (
      <PortalPage title="Lecture" sub="Unable to open this lecture">
        <div className="err">{error}</div>
        <Link className="btn ghost" to="/portal/lectures" style={{ marginTop: 12, display: "inline-block" }}>
          Back to lectures
        </Link>
      </PortalPage>
    );
  }

  if (!lecture) {
    return (
      <PortalPage title="Lecture" sub="Not found">
        <div className="err">Lecture not found.</div>
        <Link className="btn ghost" to="/portal/lectures">
          Back to lectures
        </Link>
      </PortalPage>
    );
  }

  return (
    <PortalPage
      title={lecture.title}
      sub={`${lecture.course_title || ""}${lecture.teacher_name ? ` · ${lecture.teacher_name}` : ""}`}
      actions={
        <Link className="btn ghost sm" to="/portal/lectures">
          Back to lectures
        </Link>
      }
    >
      <div className="panel" style={{ marginBottom: 16 }}>
        {lecture.description ? <p style={{ marginBottom: 14 }}>{lecture.description}</p> : null}

        {lecture.lecture_type === "youtube" ? (
          ytId ? (
            <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                title={lecture.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>
          ) : (
            <div className="err">Invalid YouTube link.</div>
          )
        ) : (
          <>
            <div style={{ borderRadius: 12, overflow: "hidden", background: "#000" }}>
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                style={{ width: "100%", maxHeight: "70vh", display: "block", background: "#000" }}
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onPause={() => saveProgress(true)}
                onEnded={() => saveProgress(true)}
              />
            </div>
            <div className="inline" style={{ marginTop: 12, gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label className="inline" style={{ margin: 0, gap: 6 }}>
                <span className="muted-sm">Speed</span>
                <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
                    <option value={value} key={value}>
                      {value}x
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline" style={{ margin: 0, gap: 6 }}>
                <span className="muted-sm">Quality</span>
                <select value={quality} onChange={(e) => setQuality(Number(e.target.value))} disabled={levels.length <= 1}>
                  {levels.map((level) => (
                    <option value={level.index} key={`${level.index}-${level.label}`}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
              {isStudent && resumeAt > 1 ? (
                <span className="muted-sm">
                  Resume point: {fmtTime(resumeAt)}
                </span>
              ) : null}
            </div>
            {statusMsg ? <p className="form-note" style={{ marginTop: 8 }}>{statusMsg}</p> : null}
          </>
        )}
      </div>

      {isStaff ? (
        <div className="panel">
          <h2>Lecture details</h2>
          <div className="cards">
            <div className="stat-card"><div><b>{lecture.status}</b><span>Publish status</span></div></div>
            <div className="stat-card"><div><b>{lecture.processing_status}</b><span>Processing</span></div></div>
            <div className="stat-card"><div><b>{lecture.lecture_type}</b><span>Type</span></div></div>
            {lecture.duration_seconds ? (
              <div className="stat-card"><div><b>{fmtTime(lecture.duration_seconds)}</b><span>Duration</span></div></div>
            ) : null}
          </div>
          {lecture.processing_error ? <div className="err" style={{ marginTop: 12 }}>{lecture.processing_error}</div> : null}
          {Array.isArray(lecture.qualities) && lecture.qualities.length ? (
            <p className="muted-sm" style={{ marginTop: 10 }}>Available HLS qualities: {lecture.qualities.join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </PortalPage>
  );
}
