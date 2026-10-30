import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { portalApi } from "../../../api/portal.api.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useFetch } from "../../../hooks/useFetch.js";
import { useCall } from "../../../hooks/useCall.js";
import { formatDate, initials } from "../../../utils/format.js";
import PortalPage from "../components/PortalPage.jsx";
import EmptyState from "../components/EmptyState.jsx";
import CallOverlay from "../components/CallOverlay.jsx";

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🙂", "😉", "😊", "😍", "😎",
  "🤔", "😴", "😢", "😡", "👍", "👎", "👌", "🙏", "👏", "💪", "❤️", "💙",
  "🔥", "✨", "🎉", "✅", "❌", "📌", "📎", "📄", "🎓", "💻", "🔒", "☕"
];

function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const conversations = useFetch(portalApi.conversations, []);
  const [selected, setSelected] = useState(null);
  const selectedRef = useRef(null);
  const [thread, setThread] = useState({ messages: [], attachments: [] });
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState({});
  const [socket, setSocket] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editText, setEditText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const threadRef = useRef(null);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const recordTimerRef = useRef(null);
  const recordCancelledRef = useRef(false);
  const callApi = useCall(socket);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    const s = io("/", { withCredentials: true });
    setSocket(s);

    s.on("chat:message", (incoming) => {
      const current = selectedRef.current;
      if (!current) return;
      if (incoming.sender_id === current.id || incoming.recipient_id === current.id) {
        setThread((state) =>
          state.messages.some((item) => item.id === incoming.id)
            ? state
            : { ...state, messages: [...state.messages, incoming] }
        );
      }
      conversations.reload();
    });

    s.on("chat:message:update", ({ id, body, edited_at }) => {
      setThread((state) => ({
        ...state,
        messages: state.messages.map((item) =>
          item.id === id ? { ...item, body, edited_at } : item
        )
      }));
    });

    s.on("chat:message:delete", ({ id }) => {
      setThread((state) => ({
        ...state,
        messages: state.messages.filter((item) => item.id !== id),
        attachments: state.attachments.filter((item) => item.message_id !== id)
      }));
    });

    s.on("presence:update", ({ userId, online: isOnline }) => {
      setOnline((current) => ({ ...current, [userId]: isOnline }));
    });

    s.on("chat:typing", ({ user_id, typing: isTyping }) => {
      if (selectedRef.current?.id === user_id) {
        setTyping(Boolean(isTyping));
        if (isTyping) {
          window.clearTimeout(window.__technexaTypingTimer);
          window.__technexaTypingTimer = window.setTimeout(() => setTyping(false), 2500);
        }
      }
    });

    return () => s.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread.messages, typing]);

  const openThread = async (person) => {
    setSelected(person);
    selectedRef.current = person;
    setThread({ messages: [], attachments: [] });
    setMessage("");
    try {
      const response = await portalApi.thread(person.id);
      const data = response.data?.data;
      setThread({ messages: data?.messages || [], attachments: data?.attachments || [] });
      await portalApi.markRead(person.id);
      conversations.reload();
    } catch (err) {
      setMessage(err.message || "Could not load this conversation.");
    }
  };

  const sendPayload = async (bodyText, fileToSend) => {
    if (!selected) return false;
    if (!bodyText.trim() && !fileToSend) return false;

    const body = new FormData();
    body.append("recipient_id", selected.id);
    body.append("body", bodyText);
    if (fileToSend) body.append("file", fileToSend);

    try {
      const response = await portalApi.sendMessage(body);
      const data = response.data?.data;
      if (data?.message) {
        setThread((current) =>
          current.messages.some((item) => item.id === data.message.id)
            ? current
            : {
                messages: [...current.messages, data.message],
                attachments: data.attachment
                  ? [...current.attachments, data.attachment]
                  : current.attachments
              }
        );
      }
      conversations.reload();
      return true;
    } catch (err) {
      setMessage(err.message || "Could not send the message.");
      return false;
    }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const sent = await sendPayload(text, file);
    if (sent) {
      setText("");
      setFile(null);
      setShowEmoji(false);
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    setEditText(item.body || "");
  };

  const saveEdit = async () => {
    if (!editing || !editText.trim()) return;
    try {
      await portalApi.updateMessage(editing.id, editText.trim());
      setThread((current) => ({
        ...current,
        messages: current.messages.map((item) =>
          item.id === editing.id ? { ...item, body: editText.trim(), edited_at: new Date().toISOString() } : item
        )
      }));
      setEditing(null);
      setEditText("");
    } catch (err) {
      setMessage(err.message || "Could not update the message.");
    }
  };

  const typingHandler = (value) => {
    setText(value);
    if (socket && selected) {
      socket.emit("chat:typing", { recipient_id: selected.id, typing: Boolean(value) });
    }
  };

  const clearRecordTimer = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const stopRecording = (cancelled = false) => {
    recordCancelledRef.current = cancelled;
    clearRecordTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* already stopped */
      }
    } else {
      setRecording(false);
    }
  };

  const startRecording = async () => {
    if (recording) {
      stopRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMessage("This browser cannot record voice messages.");
      return;
    }
    try {
      setMessage("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mime = preferred.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordChunksRef.current = [];
      recordCancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data?.size) recordChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        clearRecordTimer();
        setRecording(false);
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            /* already stopped */
          }
        });
        recordStreamRef.current = null;
        const type = recorder.mimeType || "audio/webm";
        const chunks = recordChunksRef.current;
        recordChunksRef.current = [];
        recorderRef.current = null;
        if (recordCancelledRef.current || !chunks.length) return;
        const blob = new Blob(chunks, { type });
        if (blob.size < 1200) {
          setMessage("Recording is too short.");
          return;
        }
        const extension = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const voiceFile = new File([blob], `voice-${Date.now()}.${extension}`, { type });
        await sendPayload("", voiceFile);
      };

      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((value) => Math.min(value + 1, 120));
      }, 1000);
    } catch (err) {
      clearRecordTimer();
      setRecording(false);
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((track) => track.stop());
        recordStreamRef.current = null;
      }
      setMessage(
        err?.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow access in the browser and try again."
          : err.message || "Could not open the microphone."
      );
    }
  };

  useEffect(
    () => () => {
      recordCancelledRef.current = true;
      clearRecordTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      if (recordStreamRef.current) {
        recordStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    },
    []
  );

  useEffect(() => {
    if (recording && recordSeconds >= 120) stopRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, recordSeconds]);

  const removeMessage = async (id) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      await portalApi.deleteMessage(id);
      setThread((current) => ({
        ...current,
        messages: current.messages.filter((item) => item.id !== id),
        attachments: current.attachments.filter((item) => item.message_id !== id)
      }));
    } catch (err) {
      setMessage(err.message || "Could not delete the message.");
    }
  };

  const attachmentsFor = (messageId) => thread.attachments.filter((item) => item.message_id === messageId);

  return (
    <PortalPage title="Messages & Calls" sub="Chat privately with teachers, students and the administration.">
      {message ? <div className="err">{message}</div> : null}
      {conversations.error ? <div className="err">{conversations.error}</div> : null}
      {callApi.error ? <div className="err">{callApi.error}</div> : null}
      {callApi.notice ? <div className="ok">{callApi.notice}</div> : null}

      <div className="chat-layout">
        <div className="chat-side">
          <div className="chat-head">
            <b>Conversations</b>
            <span className="muted-sm">{conversations.data?.length || 0}</span>
          </div>
          <div className="chat-list">
            {conversations.loading ? (
              <div className="loading"><i className="fa-solid fa-spinner fa-spin" /> Loading...</div>
            ) : !conversations.data?.length ? (
              <EmptyState icon="fa-comments" text="No conversations yet." />
            ) : (
              conversations.data.map((person) => (
                <button
                  className={`chat-person${selected?.id === person.id ? " on" : ""}`}
                  type="button"
                  key={person.id}
                  onClick={() => openThread(person)}
                  style={{ width: "100%", textAlign: "left", background: "transparent", border: 0 }}
                >
                  {person.photo_url ? (
                    <span className="avatar sm"><img src={person.photo_url} alt={person.full_name} /></span>
                  ) : (
                    <span className="avatar sm">{initials(person.full_name)}</span>
                  )}
                  <span className="nm">
                    <b>{person.full_name}</b>
                    <span>{person.last_body || `${person.role} · start a conversation`}</span>
                  </span>
                  {person.unread ? <span className="badge b-pending">{person.unread}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="chat-main">
          {!selected ? (
            <EmptyState icon="fa-comment-dots" text="Choose a conversation to start chatting." />
          ) : (
            <>
              <div className="chat-head">
                <div className="inline">
                  {selected.photo_url ? (
                    <span className="avatar sm"><img src={selected.photo_url} alt={selected.full_name} /></span>
                  ) : (
                    <span className="avatar sm">{initials(selected.full_name)}</span>
                  )}
                  <div>
                    <b>{selected.full_name}</b>
                    <div className="muted-sm">
                      {selected.role} ·{" "}
                      <span style={{ color: online[selected.id] ? "#86efac" : "var(--mut)" }}>
                        {online[selected.id] ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="inline" style={{ gap: 6 }}>
                  <span className="muted-sm">{selected.email}</span>
                  <button
                    className="btn ghost sm"
                    type="button"
                    title="Audio call"
                    onClick={() => callApi.startCall(selected, "audio")}
                    disabled={Boolean(callApi.call)}
                  >
                    <i className="fa-solid fa-phone" aria-hidden="true" />
                  </button>
                  <button
                    className="btn ghost sm"
                    type="button"
                    title="Video call"
                    onClick={() => callApi.startCall(selected, "video")}
                    disabled={Boolean(callApi.call)}
                  >
                    <i className="fa-solid fa-video" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="call-note">
                <i className="fa-solid fa-circle-info" aria-hidden="true" /> Calls are recorded for quality and training.
              </div>

              <div className="chat-thread" ref={threadRef}>
                {!thread.messages.length ? (
                  <EmptyState icon="fa-comment" text="No messages yet. Say hello!" />
                ) : (
                  thread.messages.map((item) => {
                    const mine = item.sender_id === user?.id;
                    return (
                      <div className={`chat-bubble${mine ? " me" : ""}`} key={item.id}>
                        {editing?.id === item.id ? (
                          <div className="editbox">
                            <textarea
                              className="editin"
                              value={editText}
                              onChange={(event) => setEditText(event.target.value)}
                              rows={3}
                            />
                            <div className="editrow">
                              <button className="btn ghost sm" type="button" onClick={() => setEditing(null)}>
                                Cancel
                              </button>
                              <button className="btn primary sm" type="button" onClick={saveEdit}>
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          item.body ? <div className="txt">{item.body}</div> : null
                        )}
                        {attachmentsFor(item.id).map((attachment) => {
                          const url = `/api/portal/messages/attachments/${attachment.id}`;
                          if (attachment.mime_type?.startsWith("audio/")) {
                            return (
                              <audio key={attachment.id} controls preload="metadata" src={url} style={{ marginTop: 6 }} />
                            );
                          }
                          if (attachment.mime_type?.startsWith("image/")) {
                            return (
                              <a key={attachment.id} href={url} target="_blank" rel="noreferrer">
                                <img className="chat-att-img" src={url} alt={attachment.original_name} />
                              </a>
                            );
                          }
                          return (
                            <div className="file-row" key={attachment.id} style={{ marginTop: 6 }}>
                              <i className="fa-solid fa-paperclip" aria-hidden="true" />
                              <span className="nm">{attachment.original_name}</span>
                              <a href={url} target="_blank" rel="noreferrer">
                                Open
                              </a>
                            </div>
                          );
                        })}
                        <span className="meta">
                          {formatDate(item.created_at, true)}
                          {item.edited_at ? " · edited" : ""}
                          {mine ? (
                            <>
                              {item.body && editing?.id !== item.id ? (
                                <button
                                  className="btn ghost sm"
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  style={{ marginLeft: 6, padding: "0 4px", fontSize: ".65rem" }}
                                >
                                  Edit
                                </button>
                              ) : null}
                              <button
                                className="btn ghost sm"
                                type="button"
                                onClick={() => removeMessage(item.id)}
                                style={{ marginLeft: 4, padding: "0 4px", fontSize: ".65rem" }}
                              >
                                Delete
                              </button>
                            </>
                          ) : null}
                        </span>
                      </div>
                    );
                  })
                )}
                {typing ? <div className="muted-sm">{selected.full_name} is typing...</div> : null}
              </div>

              {recording ? (
                <div className="rec-bar" style={{ display: "flex" }}>
                  <span className="rec-dot" />
                  <span>Recording {formatClock(recordSeconds)}</span>
                  <button className="btn ghost sm" type="button" onClick={() => stopRecording(true)}>
                    Cancel
                  </button>
                  <button className="btn primary sm" type="button" onClick={() => stopRecording(false)}>
                    Stop & send
                  </button>
                </div>
              ) : null}

              <form className="chat-send" onSubmit={send}>
                <input
                  value={text}
                  onChange={(event) => typingHandler(event.target.value)}
                  placeholder="Write a message..."
                  aria-label="Message"
                />
                <button
                  className={`btn ghost${recording ? " rec" : ""}`}
                  type="button"
                  title={recording ? "Stop recording" : "Record voice message"}
                  onClick={() => (recording ? stopRecording(false) : startRecording())}
                >
                  <i className={`fa-solid ${recording ? "fa-stop" : "fa-microphone"}`} aria-hidden="true" />
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  title="Emoji"
                  onClick={() => setShowEmoji((value) => !value)}
                >
                  <i className="fa-regular fa-face-smile" aria-hidden="true" />
                </button>
                <label className="btn ghost" style={{ margin: 0, cursor: "pointer" }}>
                  <i className="fa-solid fa-paperclip" aria-hidden="true" />
                  <input
                    type="file"
                    style={{ display: "none" }}
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button className="btn primary" type="submit">
                  <i className="fa-solid fa-paper-plane" aria-hidden="true" /> Send
                </button>
              </form>

              {showEmoji ? (
                <div className="emoji-panel open" role="dialog" aria-label="Choose an emoji">
                  {EMOJIS.map((emoji) => (
                    <button
                      className="emoji-item"
                      type="button"
                      key={emoji}
                      onClick={() => {
                        setText((value) => value + emoji);
                        setShowEmoji(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}

              {file ? (
                <div className="muted-sm" style={{ padding: "0 14px 10px" }}>
                  Attached: {file.name}{" "}
                  <button className="btn ghost sm" type="button" onClick={() => setFile(null)}>Remove</button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <CallOverlay
        call={callApi.call}
        muted={callApi.muted}
        cameraOn={callApi.cameraOn}
        remoteReady={callApi.remoteReady}
        recording={callApi.recording}
        elapsed={callApi.elapsed}
        error={callApi.error}
        remoteVideoRef={callApi.remoteVideoRef}
        localVideoRef={callApi.localVideoRef}
        onAccept={callApi.acceptCall}
        onReject={callApi.rejectCall}
        onEnd={callApi.endCall}
        onToggleMute={callApi.toggleMute}
        onToggleCamera={callApi.toggleCamera}
      />
    </PortalPage>
  );
}
