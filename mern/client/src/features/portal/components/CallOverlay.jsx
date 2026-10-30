import { initials } from "../../../utils/format.js";

export default function CallOverlay({
  call,
  muted,
  cameraOn,
  remoteReady,
  recording,
  elapsed,
  error,
  remoteVideoRef,
  localVideoRef,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera
}) {
  if (!call) return null;

  const incoming = call.direction === "incoming" && call.status === "ringing";
  const waiting = incoming || call.kind === "audio" || !remoteReady;
  const status =
    call.status === "connected"
      ? elapsed
      : call.status === "failed"
        ? "Connection failed"
        : call.status === "ringing"
          ? "Incoming call"
          : "Connecting...";

  return (
    <div className={`callov on${waiting ? " waiting" : ""}${call.kind === "audio" ? " audio" : ""}`}>
      <video ref={remoteVideoRef} id="remoteV" autoPlay playsInline />
      {call.kind === "video" ? (
        <video ref={localVideoRef} id="localV" autoPlay playsInline muted />
      ) : null}

      <div className="call-avatar-big">
        <div className="av">
          {call.peer.photo_url ? (
            <img src={call.peer.photo_url} alt={call.peer.full_name} />
          ) : (
            initials(call.peer.full_name)
          )}
        </div>
        <div className="av-name">{call.peer.full_name}</div>
        <div className="call-sub">
          {recording
            ? "This call is being recorded"
            : incoming
              ? `Incoming ${call.kind} call`
              : call.kind === "video"
                ? "Video call"
                : "Audio call"}
        </div>
      </div>

      <div className="callbar">
        <strong>{call.peer.full_name}</strong>
        <span className="call-status">{status}</span>
        {recording ? (
          <span className="rec-live">
            <span className="rec-dot" /> Recording
          </span>
        ) : null}
        {incoming ? (
          <>
            <button className="btn primary cbtn" type="button" onClick={onAccept} title="Accept call">
              <i className="fa-solid fa-phone" aria-hidden="true" /> Accept
            </button>
            <button className="btn danger cbtn" type="button" onClick={onReject} title="Reject call">
              <i className="fa-solid fa-phone-slash" aria-hidden="true" /> Reject
            </button>
          </>
        ) : (
          <>
            <button
              className="btn ghost cbtn"
              type="button"
              onClick={onToggleMute}
              title={muted ? "Unmute microphone" : "Mute microphone"}
            >
              <i className={`fa-solid ${muted ? "fa-microphone-slash" : "fa-microphone"}`} aria-hidden="true" />
            </button>
            {call.kind === "video" ? (
              <button
                className="btn ghost cbtn"
                type="button"
                onClick={onToggleCamera}
                title={cameraOn ? "Turn camera off" : "Turn camera on"}
              >
                <i className={`fa-solid ${cameraOn ? "fa-video" : "fa-video-slash"}`} aria-hidden="true" />
              </button>
            ) : null}
            <button className="btn danger cbtn" type="button" onClick={() => onEnd(true)} title="End call">
              <i className="fa-solid fa-phone-slash" aria-hidden="true" /> End
            </button>
          </>
        )}
      </div>

      {error ? <div className="call-error">{error}</div> : null}
    </div>
  );
}
