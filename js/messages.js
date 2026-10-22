/* CyberNexa - realtime chat + WebRTC calls (student <-> teacher) */
(function () {
  "use strict";
  var D = window.CNX_CHAT || { me: {}, contacts: [] };
  var ME = (D.me && D.me.id) || "";
  var contacts = Array.isArray(D.contacts) ? D.contacts.slice() : [];
  var online = {};
  var unread = {};
  contacts.forEach(function (c) { unread[c.id] = Number(c.unread || 0); });

  var peer = null;
  var ws = null;
  var retry = 0;
  var pc = null;
  var localStream = null;
  var pendingOffer = null;
  var callId = null;
  var callPeer = null;
  var callKind = "audio";
  var iceQ = [];

  var PEOPLE = document.getElementById("people");
  var THREAD = document.getElementById("thread");
  var PEER_NAME = document.getElementById("peerName");
  var PEER_SUB = document.getElementById("peerSub");
  var MSG_IN = document.getElementById("msgIn");
  var SEND_BTN = document.getElementById("sendBtn");
  var AUDIO_BTN = document.getElementById("btnAudio");
  var VIDEO_BTN = document.getElementById("btnVideo");
  var MODAL = document.getElementById("incoming");
  var CALLOV = document.getElementById("callov");
  var REMOTE_V = document.getElementById("remoteV");
  var LOCAL_V = document.getElementById("localV");
  var STATUS = document.getElementById("callStatus");

  var SECURE = window.isSecureContext && !!(navigator.mediaDevices && window.RTCPeerConnection);
  var ICE = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function initials(n) {
    return String(n || "?").trim().split(/\s+/).slice(0, 2).map(function (x) { return x[0]; }).join("").toUpperCase();
  }
  function hhmm(v) {
    if (!v) return "";
    var d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------------------------------------------------------- people list */
  function renderPeople() {
    var q = (document.getElementById("mq").value || "").toLowerCase();
    var list = contacts.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0; });
    if (!list.length) {
      PEOPLE.innerHTML = '<p class="empty" style="padding:18px;font-size:12px">No one found.</p>';
      return;
    }
    PEOPLE.innerHTML = list.map(function (c) {
      var on = !!online[c.id];
      var n = unread[c.id] || 0;
      return '<div class="person' + (peer && peer.id === c.id ? " on" : "") + '" data-id="' + esc(c.id) + '">' +
        '<span class="dot' + (on ? " on" : "") + '"></span>' +
        '<span class="nm"><b>' + esc(c.name) + '</b><span>' + (on ? "Online" : esc(c.role)) + (c.last && !n ? " - " + esc(c.last) : "") + '</span></span>' +
        (n ? '<span class="unread">' + n + '</span>' : "") +
        '</div>';
    }).join("");
    Array.prototype.forEach.call(PEOPLE.querySelectorAll(".person"), function (el) {
      el.addEventListener("click", function () { openChat(el.getAttribute("data-id")); });
    });
  }

  function findContact(id) {
    for (var i = 0; i < contacts.length; i++) if (contacts[i].id === id) return contacts[i];
    return null;
  }

  /* --------------------------------------------------------------- thread */
  function addBubble(m) {
    var mine = m.sender_id === ME || m.from === ME || m.self;
    var when = m.created_at || m.at;
    var el = document.createElement("div");
    el.className = "bubble" + (mine ? " me" : "");
    el.innerHTML = esc(m.body) + '<span class="t">' + esc(hhmm(when)) + "</span>";
    THREAD.appendChild(el);
    THREAD.scrollTop = THREAD.scrollHeight;
  }

  function clearThread(text) {
    THREAD.innerHTML = '<p class="empty">' + esc(text || "") + "</p>";
  }

  function openChat(id) {
    var c = findContact(id);
    if (!c) return;
    peer = c;
    unread[c.id] = 0;
    PEER_NAME.textContent = c.name;
    PEER_SUB.textContent = online[c.id] ? "Online" : c.role;
    MSG_IN.disabled = false;
    SEND_BTN.disabled = false;
    AUDIO_BTN.disabled = false;
    VIDEO_BTN.disabled = false;
    MSG_IN.focus();
    renderPeople();
    clearThread("Loading...");
    fetch("/api/chat/history?with=" + encodeURIComponent(c.id), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        THREAD.innerHTML = "";
        (d.messages || []).forEach(addBubble);
        if (!d.messages || !d.messages.length) clearThread("No messages yet. Say hello.");
        THREAD.scrollTop = THREAD.scrollHeight;
        wsSend({ type: "read", from: c.id });
      })
      .catch(function () { clearThread("Could not load messages."); });
  }

  /* ------------------------------------------------------------ websocket */
  function wsSend(o) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(o));
  }

  function connect() {
    var proto = location.protocol === "https:" ? "wss:" : "ws:";
    try {
      ws = new WebSocket(proto + "//" + location.host + "/ws");
    } catch (e) {
      return;
    }
    ws.onopen = function () {
      retry = 0;
      wsSend({ type: "hello" });
    };
    ws.onclose = function () {
      online = {};
      renderPeople();
      retry = Math.min(retry + 1, 6);
      setTimeout(connect, 1000 * retry);
    };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }

      if (m.type === "ready") {
        (m.online || []).forEach(function (id) { online[id] = true; });
        renderPeople();
        return;
      }
      if (m.type === "presence") {
        online[m.userId] = !!m.online;
        if (peer && peer.id === m.userId) PEER_SUB.textContent = m.online ? "Online" : peer.role;
        renderPeople();
        return;
      }
      if (m.type === "msg") {
        if (peer && m.from === peer.id) {
          addBubble({ body: m.body, created_at: m.at });
          wsSend({ type: "read", from: m.from });
        } else if (m.from !== ME) {
          unread[m.from] = (unread[m.from] || 0) + 1;
          var c = findContact(m.from);
          if (c) c.last = m.body;
          renderPeople();
        }
        return;
      }
      if (m.type === "read") {
        if (peer && m.by === peer.id) PEER_SUB.textContent = online[peer.id] ? "Online" : peer.role;
        return;
      }
      if (m.type === "typing") {
        if (peer && m.from === peer.id) {
          PEER_SUB.textContent = m.on ? "typing..." : online[peer.id] ? "Online" : peer.role;
        }
        return;
      }
      if (m.type === "signal") handleSignal(m);
    };
  }

  /* ----------------------------------------------------------- WebRTC */
  function setStatus(t) { if (STATUS) STATUS.textContent = t; }
  function showCall(kind) {
    CALLOV.classList.add("on");
    CALLOV.classList.toggle("audio", kind !== "video");
    REMOTE_V.style.opacity = kind === "video" ? "1" : "0.001";
    LOCAL_V.style.display = kind === "video" ? "block" : "none";
  }
  function hideCall() {
    CALLOV.classList.remove("on");
    REMOTE_V.srcObject = null;
    LOCAL_V.srcObject = null;
    REMOTE_V.style.opacity = "1";
    LOCAL_V.style.display = "block";
  }

  function newPC() {
    var p = new RTCPeerConnection(ICE);
    p.onicecandidate = function (e) {
      if (e.candidate && callPeer) {
        wsSend({ type: "signal", action: "ice", to: callPeer, callId: callId, payload: e.candidate });
      }
    };
    p.ontrack = function (e) {
      if (e.streams && e.streams[0]) {
        REMOTE_V.srcObject = e.streams[0];
        REMOTE_V.play().catch(function () {});
      }
    };
    p.onconnectionstatechange = function () {
      if (p.connectionState === "connected") setStatus("Connected");
      else if (p.connectionState === "failed") setStatus("Connection failed - a TURN server may be required");
      else if (p.connectionState === "disconnected") setStatus("Reconnecting...");
    };
    return p;
  }

  function media(kind) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("Calls need a secure HTTPS connection."));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
  }

  function flushIce() {
    if (!pc || !pc.remoteDescription) return;
    iceQ.forEach(function (c) { pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {}); });
    iceQ = [];
  }

  function cleanupCall() {
    if (pc) { try { pc.close(); } catch (e) {} }
    pc = null;
    if (localStream) localStream.getTracks().forEach(function (t) { t.stop(); });
    localStream = null;
    pendingOffer = null;
    iceQ = [];
    hideCall();
  }

  function endCall(notify) {
    if (notify && callPeer && callId) {
      wsSend({ type: "signal", action: "end", to: callPeer, callId: callId });
    }
    cleanupCall();
    callPeer = null;
    callId = null;
  }

  function startCall(kind) {
    if (!peer) return;
    if (!SECURE) {
      alert("Voice and video calls need HTTPS. Chat works normally, but the browser blocks the camera and microphone on plain HTTP.");
      return;
    }
    callPeer = peer.id;
    callKind = kind;
    callId = "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    setStatus("Calling " + peer.name + "...");
    showCall(kind);
    media(kind)
      .then(function (stream) {
        localStream = stream;
        LOCAL_V.srcObject = stream;
        pc = newPC();
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        return pc.createOffer().then(function (offer) {
          return pc.setLocalDescription(offer).then(function () {
            wsSend({ type: "signal", action: "offer", to: callPeer, callId: callId, kind: callKind, payload: offer });
          });
        });
      })
      .catch(function (e) {
        endCall(false);
        alert(e && e.message ? e.message : "Could not start the call.");
      });
  }

  function acceptCall() {
    if (!pendingOffer) return;
    MODAL.classList.remove("open");
    showCall(callKind);
    setStatus("Connecting...");
    media(callKind)
      .then(function (stream) {
        localStream = stream;
        LOCAL_V.srcObject = stream;
        pc = newPC();
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        return pc.setRemoteDescription(new RTCSessionDescription(pendingOffer)).then(function () {
          flushIce();
          return pc.createAnswer();
        }).then(function (answer) {
          return pc.setLocalDescription(answer).then(function () {
            wsSend({ type: "signal", action: "answer", to: callPeer, callId: callId, payload: answer });
            setStatus("Connected");
          });
        });
      })
      .catch(function (e) {
        endCall(true);
        alert(e && e.message ? e.message : "Could not answer the call.");
      });
  }

  function handleSignal(m) {
    if (m.action === "offer") {
      if (pc) { wsSend({ type: "signal", action: "reject", to: m.from, callId: m.callId }); return; }
      pendingOffer = m.payload;
      callId = m.callId;
      callPeer = m.from;
      callKind = m.kind || "audio";
      document.getElementById("incWho").textContent =
        (m.fromName || "Someone") + " is calling you (" + (m.kind === "video" ? "video" : "voice") + ")";
      MODAL.classList.add("open");
      return;
    }
    if (m.action === "answer") {
      if (!pc) return;
      pc.setRemoteDescription(new RTCSessionDescription(m.payload))
        .then(function () { flushIce(); setStatus("Connected"); })
        .catch(function () {});
      return;
    }
    if (m.action === "ice") {
      if (!m.payload) return;
      if (pc && pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(m.payload)).catch(function () {});
      else iceQ.push(m.payload);
      return;
    }
    if (m.action === "reject") {
      endCall(false);
      setStatus("Call rejected");
      return;
    }
    if (m.action === "end") {
      endCall(false);
      return;
    }
    if (m.action === "offline") {
      endCall(false);
      alert("That person is offline right now. Try again later.");
    }
  }

  /* --------------------------------------------------------------- wiring */
  document.getElementById("mq").addEventListener("input", renderPeople);
  document.getElementById("sendForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = MSG_IN.value.trim();
    if (!body || !peer) return;
    MSG_IN.value = "";
    wsSend({ type: "msg", to: peer.id, body: body });
  });
  MSG_IN.addEventListener("input", function () {
    if (!peer) return;
    wsSend({ type: "typing", to: peer.id, on: !!MSG_IN.value });
  });
  AUDIO_BTN.addEventListener("click", function () { startCall("audio"); });
  VIDEO_BTN.addEventListener("click", function () { startCall("video"); });
  document.getElementById("endCall").addEventListener("click", function () { endCall(true); });
  document.getElementById("incAccept").addEventListener("click", acceptCall);
  document.getElementById("incReject").addEventListener("click", function () {
    if (callPeer && callId) wsSend({ type: "signal", action: "reject", to: callPeer, callId: callId });
    MODAL.classList.remove("open");
    pendingOffer = null;
    callPeer = null;
    callId = null;
  });

  if (!SECURE) {
    var warn = document.createElement("div");
    warn.className = "note";
    warn.style.margin = "0 0 14px";
    warn.innerHTML = "<h4><i class='fa-solid fa-lock'></i> Calls need HTTPS</h4><p>Chat works over the current connection. Voice and video calls need a secure (HTTPS) connection, so the browser can allow the camera and microphone. <a href='https://" + location.host + "/portal/messages' style='color:var(--acc)'>Open the secure version</a> (accept the certificate warning once).</p>";
    var shell = document.querySelector(".msg-shell");
    if (shell && shell.parentNode) shell.parentNode.insertBefore(warn, shell);
  }

  renderPeople();
  connect();
})();
