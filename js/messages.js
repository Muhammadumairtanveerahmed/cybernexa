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
  var lastGroup = "";
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
  var NET = document.getElementById("callNet");
  var HEALTH = document.getElementById("callHealth");
  var SNDFIX = document.getElementById("sndFix");
  var MIC_BTN = document.getElementById("btnMute");
  var MIC_SEL = document.getElementById("micSel");

  /* Remember the microphone the user picked (a wrong default device is the
     most common reason one side cannot be heard). */
  var MIC_DEV = "";
  try { MIC_DEV = localStorage.getItem("cnxMic") || ""; } catch (e) {}
  function setMicDev(id) {
    MIC_DEV = id || "";
    try {
      if (MIC_DEV) localStorage.setItem("cnxMic", MIC_DEV);
      else localStorage.removeItem("cnxMic");
    } catch (e) {}
  }
  function audioConstraints() {
    return MIC_DEV ? { deviceId: { exact: MIC_DEV } } : true;
  }

  var SECURE = window.isSecureContext && !!(navigator.mediaDevices && window.RTCPeerConnection);
  var ICE = {
    iceCandidatePoolSize: 4,
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      /* self-hosted coturn (best quality when reachable) */
      {
        urls: "turn:54.161.79.42:3478?transport=udp",
        username: "cybernexa",
        credential: "turnpass123"
      },
      {
        urls: "turn:54.161.79.42:3478?transport=tcp",
        username: "cybernexa",
        credential: "turnpass123"
      },
      /* public relay fallback - used automatically when the one above is blocked */
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
      }
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
        '<span class="nm"><b>' + esc(c.name) + '</b><span>' + esc(roleLabel(c.role)) + ' <span class="pstate ' + (on ? "on" : "off") + '">' + (on ? "Online" : "Offline") + '</span>' + (c.last && !n ? " \u00b7 " + esc(c.last) : "") + '</span></span>' +
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

  function tickHtml(status) {
    if (status === "read") return '<span class="ticks read" title="Read"><i class="fa-solid fa-check-double"></i></span>';
    if (status === "delivered") return '<span class="ticks" title="Delivered"><i class="fa-solid fa-check-double"></i></span>';
    if (status === "sending") return '<span class="ticks sending" title="Sending"><i class="fa-solid fa-clock"></i></span>';
    return '<span class="ticks" title="Sent"><i class="fa-solid fa-check"></i></span>';
  }

  function setTicks(el, status) {
    var t = el.querySelector(".ticks");
    if (!t) return;
    t.className = "ticks" + (status === "read" ? " read" : status === "sending" ? " sending" : "");
    t.innerHTML = status === "sending"
      ? '<i class="fa-solid fa-clock"></i>'
      : status === "sent"
        ? '<i class="fa-solid fa-check"></i>'
        : '<i class="fa-solid fa-check-double"></i>';
    t.title = status === "read" ? "Read" : status === "delivered" ? "Delivered" : status === "sending" ? "Sending" : "Sent";
  }

  function markMine(status) {
    Array.prototype.forEach.call(THREAD.querySelectorAll(".bubble.me"), function (el) {
      if (status === "delivered" && el.querySelector(".ticks.read")) return;
      setTicks(el, status);
    });
  }

  /* --------------------------------------------------------------- thread */
  function bubbleHtml(m, mine, who, showWho) {
    var when = m.created_at || m.at;
    var status = m.status || (m.read_at ? "read" : m.delivered_at ? "delivered" : "sent");
    var deleted = !!m.deleted_at;
    var edited = !!m.edited_at && !deleted;
    var head = showWho ? '<span class="who">' + esc(who) + "</span>" : "";
    var acts = deleted
      ? ""
      : mine
        ? '<button type="button" class="mact" data-act="edit" title="Edit"><i class="fa-solid fa-pen"></i> Edit</button>' +
          '<button type="button" class="mact" data-act="del" title="Delete"><i class="fa-solid fa-trash"></i> Delete</button>'
        : '<button type="button" class="mact" data-act="del" title="Delete"><i class="fa-solid fa-trash"></i> Delete</button>';
    var meta = '<span class="meta">' +
      (acts ? '<span class="acts">' + acts + "</span>" : "") +
      (edited ? '<span class="ed">edited</span>' : "") +
      '<span class="t">' + esc(hhmm(when)) + "</span>" +
      (mine && !deleted ? tickHtml(status) : "") +
      "</span>";
    if (deleted) {
      return head + '<span class="txt del-txt"><i class="fa-solid fa-ban"></i> This message was deleted</span>' + meta;
    }
    return head + '<span class="txt">' + esc(m.body) + "</span>" + meta;
  }

  function addBubble(m) {
    var mine = !!(m.self || m.sender_id === ME || m.from === ME);
    var who = mine ? "You" : ((peer && peer.name) || m.fromName || "Them");
    var group = mine ? "me" : "them";
    var showWho = group !== lastGroup;
    lastGroup = group;
    var el = document.createElement("div");
    el.className = "bubble" + (mine ? " me" : "") + (m.deleted_at ? " deleted" : "");
    if (m.id) el.setAttribute("data-id", m.id);
    if (m.tempId) el.setAttribute("data-tmp", m.tempId);
    el.innerHTML = bubbleHtml(m, mine, who, showWho);
    THREAD.appendChild(el);
    THREAD.scrollTop = THREAD.scrollHeight;
    return el;
  }

  function clearThread(text) {
    lastGroup = "";
    THREAD.innerHTML = '<p class="empty">' + esc(text || "") + "</p>";
  }

  function roleLabel(role) {
    return role === "teacher" ? "Teacher" : role === "student" ? "Student" : String(role || "");
  }

  function peerSub() {
    if (!peer) return;
    var on = !!online[peer.id];
    PEER_SUB.innerHTML = esc(roleLabel(peer.role)) + ' <span class="pstate ' + (on ? "on" : "off") + '">' +
      (on ? "Online" : "Offline") + "</span>";
  }

  function markDeleted(el) {
    el.classList.add("deleted");
    var acts = el.querySelector(".acts");
    if (acts) acts.remove();
    var ticks = el.querySelector(".ticks");
    if (ticks) ticks.remove();
    var ed = el.querySelector(".ed");
    if (ed) ed.remove();
    var box = el.querySelector(".editbox");
    if (box) box.remove();
    var txt = el.querySelector(".txt");
    if (txt) {
      txt.className = "txt del-txt";
      txt.innerHTML = '<i class="fa-solid fa-ban"></i> This message was deleted';
    }
  }

  function startEdit(bubble) {
    if (bubble.classList.contains("deleted") || bubble.querySelector(".editbox")) return;
    var id = bubble.getAttribute("data-id");
    var txt = bubble.querySelector(".txt");
    if (!id || !txt) return;
    var box = document.createElement("div");
    box.className = "editbox";
    box.innerHTML = '<textarea class="editin" maxlength="2000"></textarea>' +
      '<div class="editrow"><button type="button" class="btn ghost sm" data-a="cancel">Cancel</button>' +
      '<button type="button" class="btn primary sm" data-a="save">Save</button></div>';
    txt.style.display = "none";
    bubble.appendChild(box);
    var ta = box.querySelector(".editin");
    ta.value = txt.textContent;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    function done() {
      box.remove();
      txt.style.display = "";
    }
    function save() {
      var v = ta.value.trim();
      if (!v) return;
      wsSend({ type: "edit", id: id, body: v });
      txt.textContent = v;
      done();
      var meta = bubble.querySelector(".meta");
      if (meta && !meta.querySelector(".ed")) meta.insertAdjacentHTML("afterbegin", '<span class="ed">edited</span>');
    }
    ta.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        save();
      } else if (ev.key === "Escape") {
        done();
      }
    });
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("button[data-a]") : null;
      if (!b) return;
      if (b.getAttribute("data-a") === "save") save();
      else done();
    });
  }

  function deleteMsg(bubble) {
    var id = bubble.getAttribute("data-id");
    if (!id) return;
    var mine = bubble.classList.contains("me");
    var ask = mine
      ? "Delete this message for both of you?"
      : "Remove this message from your chat?";
    if (!window.confirm(ask)) return;
    wsSend({ type: "del", id: id, scope: mine ? "all" : "me" });
  }

  function openChat(id) {
    var c = findContact(id);
    if (!c) return;
    peer = c;
    unread[c.id] = 0;
    lastGroup = "";
    PEER_NAME.textContent = c.name;
    peerSub();
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
        peerSub();
        renderPeople();
        return;
      }
      if (m.type === "presence") {
        online[m.userId] = !!m.online;
        if (peer && peer.id === m.userId) peerSub();
        renderPeople();
        return;
      }
      if (m.type === "msg") {
        if (m.self) {
          var tmp = m.tempId ? THREAD.querySelector('[data-tmp="' + m.tempId + '"]') : null;
          if (tmp) {
            if (m.id) tmp.setAttribute("data-id", m.id);
            tmp.removeAttribute("data-tmp");
            setTicks(tmp, m.delivered ? "delivered" : "sent");
          } else {
            addBubble({ body: m.body, at: m.at, self: true, status: m.delivered ? "delivered" : "sent" });
          }
          return;
        }
        if (peer && m.from === peer.id) {
          addBubble({ body: m.body, at: m.at, from: m.from });
          wsSend({ type: "read", from: m.from });
        } else {
          unread[m.from] = (unread[m.from] || 0) + 1;
          var c = findContact(m.from);
          if (c) c.last = m.body;
          renderPeople();
        }
        return;
      }
      if (m.type === "delivered") {
        if (peer && m.by === peer.id) markMine("delivered");
        return;
      }
      if (m.type === "read") {
        if (peer && m.by === peer.id) markMine("read");
        return;
      }
      if (m.type === "msg-edit") {
        var e1 = m.id ? THREAD.querySelector('[data-id="' + m.id + '"]') : null;
        if (e1) {
          var t1 = e1.querySelector(".txt");
          if (t1) t1.textContent = m.body;
          var mt = e1.querySelector(".meta");
          if (mt && !mt.querySelector(".ed")) mt.insertAdjacentHTML("afterbegin", '<span class="ed">edited</span>');
        }
        return;
      }
      if (m.type === "msg-del") {
        var e2 = m.id ? THREAD.querySelector('[data-id="' + m.id + '"]') : null;
        if (e2) markDeleted(e2);
        return;
      }
      if (m.type === "msg-hide") {
        var e3 = m.id ? THREAD.querySelector('[data-id="' + m.id + '"]') : null;
        if (e3) e3.remove();
        return;
      }
      if (m.type === "typing") {
        if (peer && m.from === peer.id) {
          if (m.on) PEER_SUB.textContent = "typing...";
          else peerSub();
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
    if (MIC_BTN) {
      MIC_BTN.style.display = "inline-flex";
      MIC_BTN.innerHTML = "<i class='fa-solid fa-microphone'></i>";
      MIC_BTN.title = "Mute microphone";
    }
  }
  function hideCall() {
    CALLOV.classList.remove("on");
    REMOTE_V.srcObject = null;
    LOCAL_V.srcObject = null;
    REMOTE_V.style.opacity = "1";
    LOCAL_V.style.display = "block";
    if (SNDFIX) SNDFIX.style.display = "none";
    if (MIC_BTN) MIC_BTN.style.display = "none";
    stopStats();
    stopMicTest();
  }

  /* Make sure the remote audio is actually audible: autoplay can be blocked,
     the element can be muted, or the volume can be zero. */
  function playRemote() {
    if (!REMOTE_V.srcObject) return;
    REMOTE_V.muted = false;
    try { REMOTE_V.volume = 1; } catch (e) {}
    var pr = REMOTE_V.play();
    if (pr && pr.catch) {
      pr.then(function () {
        if (SNDFIX) SNDFIX.style.display = "none";
      }).catch(function () {
        /* browser blocked audio until a click - offer a button */
        if (SNDFIX) SNDFIX.style.display = "inline-flex";
      });
    }
  }

  var statTimer = null;
  var micCtx = null, micAnalyser = null, micBuf = null, micPeak = 0;
  var micSilentTicks = 0, micMutedSince = 0;
  function stopMicMeter() {
    if (micCtx) { try { micCtx.close(); } catch (e) {} }
    micCtx = null; micAnalyser = null; micBuf = null; micPeak = 0;
  }
  /* Local microphone level via WebAudio. Must be started from a click so the
     AudioContext is allowed to run; otherwise it reports flat data. */
  function startMicMeter(stream) {
    stopMicMeter();
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      micCtx = new AC();
      micAnalyser = micCtx.createAnalyser();
      micAnalyser.fftSize = 512;
      micCtx.createMediaStreamSource(stream).connect(micAnalyser);
      micBuf = new Uint8Array(micAnalyser.fftSize);
      if (micCtx.state === "suspended") micCtx.resume().catch(function () {});
    } catch (e) {
      micCtx = null;
    }
  }
  function readMicPeak() {
    if (!micAnalyser || !micBuf) return -1;
    if (micCtx && micCtx.state !== "running") return -1; /* unknown, not silent */
    micAnalyser.getByteTimeDomainData(micBuf);
    var peak = 0;
    for (var i = 0; i < micBuf.length; i++) {
      var d = Math.abs(micBuf[i] - 128);
      if (d > peak) peak = d;
    }
    micPeak = peak;
    return peak;
  }

  /* Browser reports the mic as muted (device grabbed by another app, unplugged
     briefly, sleep resume). Re-acquire it and swap the live track in. */
  var recovering = 0;
  function recoverMic() {
    if (!pc || !localStream) return;
    if (Date.now() - recovering < 12000) return;
    recovering = Date.now();
    navigator.mediaDevices.getUserMedia({ audio: audioConstraints() })
      .catch(function () { return navigator.mediaDevices.getUserMedia({ audio: true }); })
      .then(function (s) {
        var track = s.getAudioTracks()[0];
        if (!track) return;
        var sender = pc.getSenders().filter(function (x) { return x.track && x.track.kind === "audio"; })[0];
        if (sender) sender.replaceTrack(track);
        localStream.getAudioTracks().forEach(function (t) {
          localStream.removeTrack(t);
          try { t.stop(); } catch (e) {}
        });
        localStream.addTrack(track);
        watchMic(localStream);
        startMicMeter(localStream);
        micMutedSince = 0;
        setStatus("Microphone reconnected");
      })
      .catch(function () {});
  }

  function stopStats() {
    if (statTimer) { clearInterval(statTimer); statTimer = null; }
    if (NET) NET.textContent = "";
    if (HEALTH) HEALTH.textContent = "";
    micSilentTicks = 0;
    micMutedSince = 0;
    stopMicMeter();
  }
  /* Live audio in/out counter + mic state, so a silent side is visible. */
  function startStats() {
    stopStats();
    if (localStream) startMicMeter(localStream);
    var started = Date.now();
    var tick = function () {
      if (!pc) return;
      var mic = localStream && localStream.getAudioTracks()[0];
      var peak = readMicPeak();
      var secs = Math.round((Date.now() - started) / 1000);
      pc.getStats().then(function (rep) {
        var inB = 0, outB = 0, level = -1;
        rep.forEach(function (s) {
          if (s.type === "inbound-rtp" && (s.kind === "audio" || s.mediaType === "audio")) {
            inB = s.bytesReceived || 0;
          }
          if (s.type === "outbound-rtp" && (s.kind === "audio" || s.mediaType === "audio")) {
            outB = s.bytesSent || 0;
          }
          if (s.type === "media-source" && (s.kind === "audio" || s.mediaType === "audio") &&
              typeof s.audioLevel === "number") {
            level = s.audioLevel; /* 0..1, from the browser itself */
          }
        });
        /* use the browser's own level when available, WebAudio as fallback */
        var silent = level >= 0 ? level <= 0.002 : (peak >= 0 && peak < 3);
        if (silent) micSilentTicks++; else micSilentTicks = 0;
        if (mic && mic.muted) { if (!micMutedSince) micMutedSince = Date.now(); }
        else micMutedSince = 0;

        if (NET) {
          NET.textContent =
            "in " + Math.round(inB / 1024) + " KB / out " + Math.round(outB / 1024) + " KB" +
            (level >= 0 ? " / mic " + Math.round(level * 100) + "%" : (peak >= 0 ? " / mic " + (silent ? "silent" : "live") : ""));
        }
        if (HEALTH) {
          if (secs >= 6 && inB === 0) {
            HEALTH.textContent = "No audio is arriving - check the other person's microphone.";
          } else if (secs >= 8 && micSilentTicks >= 5) {
            HEALTH.textContent = "Your microphone is not picking up any sound - speak louder or pick another mic.";
          } else {
            HEALTH.textContent = "";
          }
        }
        /* only warn after the mic has been muted for a while (browsers fire
           a short "mute" at the start of a call) */
        if (micMutedSince && Date.now() - micMutedSince > 5000) {
          setStatus("Your microphone is muted - reconnecting it...");
          recoverMic();
        } else if (pc && pc.connectionState === "connected") {
          setStatus("Connected");
        }
      }).catch(function () {});
    };
    tick();
    statTimer = setInterval(tick, 1500);
  }

  /* --------------------------------------------------- microphone test */
  var MTEST = document.getElementById("micTest");
  var MTEST_BAR = document.getElementById("micBar");
  var MTEST_MSG = document.getElementById("micMsg");
  var MTEST_DEV = document.getElementById("micDev");
  var mTestStream = null, mTestTimer = null, mTestCtx = null, mTestAn = null, mTestBuf = null;

  function stopMicTest() {
    if (mTestTimer) { clearInterval(mTestTimer); mTestTimer = null; }
    if (mTestCtx) { try { mTestCtx.close(); } catch (e) {} }
    mTestCtx = null; mTestAn = null; mTestBuf = null;
    if (mTestStream) {
      mTestStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      mTestStream = null;
    }
    if (MTEST) MTEST.classList.remove("open");
  }

  function openMicTest() {
    if (!MTEST) return;
    if (!SECURE) {
      alert("Microphone test needs HTTPS. Open the secure version of this page.");
      return;
    }
    MTEST.classList.add("open");
    if (MTEST_DEV) MTEST_DEV.textContent = "";
    if (MTEST_MSG) MTEST_MSG.textContent = "Asking for microphone permission...";
    if (MTEST_BAR) MTEST_BAR.style.width = "0%";
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      mTestStream = stream;
      var t = stream.getAudioTracks()[0];
      if (MTEST_DEV) MTEST_DEV.textContent = "Device: " + ((t && t.label) || "default microphone");
      fillMicList(t && t.label);
      var AC = window.AudioContext || window.webkitAudioContext;
      mTestCtx = new AC();
      mTestAn = mTestCtx.createAnalyser();
      mTestAn.fftSize = 512;
      mTestCtx.createMediaStreamSource(stream).connect(mTestAn);
      mTestBuf = new Uint8Array(mTestAn.fftSize);
      if (mTestCtx.state === "suspended") mTestCtx.resume().catch(function () {});
      var heard = false, count = 0;
      if (MTEST_MSG) MTEST_MSG.textContent = "Say something...";
      mTestTimer = setInterval(function () {
        if (!mTestAn || !mTestBuf) return;
        mTestAn.getByteTimeDomainData(mTestBuf);
        var peak = 0;
        for (var i = 0; i < mTestBuf.length; i++) {
          var d = Math.abs(mTestBuf[i] - 128);
          if (d > peak) peak = d;
        }
        count++;
        if (MTEST_BAR) MTEST_BAR.style.width = Math.min(100, Math.round(peak * 1.6)) + "%";
        if (peak > 6) heard = true;
        if (MTEST_MSG) {
          if (heard) MTEST_MSG.textContent = "Microphone is working - the other side will hear you.";
          else if (count > 12) MTEST_MSG.textContent = "No sound detected. Check Windows mic privacy, the selected device, or a headset mute switch.";
        }
      }, 150);
    }).catch(function (e) {
      if (MTEST_MSG) MTEST_MSG.textContent = "Could not open the microphone: " + (e && e.message ? e.message : "permission denied");
    });
  }

  /* Device list for the picker - changing it restarts the test with that device. */
  function fillMicList(currentLabel) {
    if (!MIC_SEL || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(function (list) {
      var mics = list.filter(function (d) { return d.kind === "audioinput"; });
      MIC_SEL.innerHTML = "";
      var def = document.createElement("option");
      def.value = "";
      def.textContent = "System default";
      MIC_SEL.appendChild(def);
      mics.forEach(function (d, i) {
        var o = document.createElement("option");
        o.value = d.deviceId;
        o.textContent = d.label || "Microphone " + (i + 1);
        if (MIC_DEV ? d.deviceId === MIC_DEV : currentLabel && d.label === currentLabel) o.selected = true;
        MIC_SEL.appendChild(o);
      });
    }).catch(function () {});
  }

  function switchMic(deviceId) {
    setMicDev(deviceId);
    if (mTestTimer) { clearInterval(mTestTimer); mTestTimer = null; }
    if (mTestCtx) { try { mTestCtx.close(); } catch (e) {} }
    mTestCtx = null; mTestAn = null; mTestBuf = null;
    if (mTestStream) {
      mTestStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      mTestStream = null;
    }
    if (MTEST_MSG) MTEST_MSG.textContent = "Switching microphone...";
    return navigator.mediaDevices.getUserMedia({ audio: audioConstraints() })
      .then(function (stream) {
        mTestStream = stream;
        var t = stream.getAudioTracks()[0];
        if (MTEST_DEV) MTEST_DEV.textContent = "Device: " + ((t && t.label) || "default microphone");
        var AC = window.AudioContext || window.webkitAudioContext;
        mTestCtx = new AC();
        mTestAn = mTestCtx.createAnalyser();
        mTestAn.fftSize = 512;
        mTestCtx.createMediaStreamSource(stream).connect(mTestAn);
        mTestBuf = new Uint8Array(mTestAn.fftSize);
        if (mTestCtx.state === "suspended") mTestCtx.resume().catch(function () {});
        var heard = false, count = 0;
        if (MTEST_MSG) MTEST_MSG.textContent = "Say something...";
        mTestTimer = setInterval(function () {
          if (!mTestAn || !mTestBuf) return;
          mTestAn.getByteTimeDomainData(mTestBuf);
          var peak = 0;
          for (var i = 0; i < mTestBuf.length; i++) {
            var d = Math.abs(mTestBuf[i] - 128);
            if (d > peak) peak = d;
          }
          count++;
          if (MTEST_BAR) MTEST_BAR.style.width = Math.min(100, Math.round(peak * 1.6)) + "%";
          if (peak > 6) heard = true;
          if (MTEST_MSG) {
            if (heard) MTEST_MSG.textContent = "Microphone is working - the other side will hear you.";
            else if (count > 12) MTEST_MSG.textContent = "No sound detected on this device. Try another microphone from the list.";
          }
        }, 150);
      })
      .catch(function (e) {
        if (MTEST_MSG) MTEST_MSG.textContent = "Could not open that microphone: " + (e && e.message ? e.message : "failed");
      });
  }

  function newPC() {
    var p = new RTCPeerConnection(ICE);
    var restarted = false;
    p._offerer = false;
    p._negotiated = false;
    p.onicecandidate = function (e) {
      if (e.candidate && callPeer) {
        wsSend({ type: "signal", action: "ice", to: callPeer, callId: callId, payload: e.candidate });
      }
    };
    p.ontrack = function (e) {
      if (e.streams && e.streams[0]) {
        REMOTE_V.srcObject = e.streams[0];
        playRemote();
      }
    };
    /* only the original caller re-offers, to avoid offer glare */
    p.onnegotiationneeded = function () {
      if (p !== pc || !p._offerer || !p._negotiated || !callPeer) return;
      p.createOffer({ iceRestart: true })
        .then(function (o) { return p.setLocalDescription(o); })
        .then(function () {
          wsSend({ type: "signal", action: "offer", to: callPeer, callId: callId, kind: callKind, payload: p.localDescription });
        })
        .catch(function () {});
    };
    p.onconnectionstatechange = function () {
      if (p !== pc) return;
      if (p.connectionState === "connected") {
        setStatus("Connected");
        restarted = false;
        playRemote();
        startStats();
      } else if (p.connectionState === "failed") {
        if (!restarted) {
          restarted = true;
          setStatus("Network path lost - reconnecting...");
          try { p.restartIce(); } catch (e) {}
          if (!p._offerer) setStatus("Network path lost - waiting for the other side...");
        } else {
          setStatus("Connection failed - a TURN server may be required");
        }
      } else if (p.connectionState === "disconnected") {
        setStatus("Reconnecting...");
      }
    };
    return p;
  }

  function media(kind) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("Calls need a secure HTTPS connection."));
    }
    var video = kind === "video";
    /* if the saved device was unplugged, fall back to the system default */
    return navigator.mediaDevices.getUserMedia({ audio: audioConstraints(), video: video })
      .catch(function (err) {
        if (!MIC_DEV) throw err;
        setMicDev("");
        return navigator.mediaDevices.getUserMedia({ audio: true, video: video });
      })
      .then(function (stream) {
        watchMic(stream);
        return stream;
      });
  }

  /* If the OS/browser mutes our mic, say it loudly instead of failing silently. */
  function watchMic(stream) {
    var t = stream.getAudioTracks()[0];
    if (!t) { setStatus("No microphone found - the other side cannot hear you"); return; }
    var flag = function () {
      if (t.muted || t.readyState === "ended") {
        setStatus("Your microphone is muted or unavailable - the other side cannot hear you");
      }
    };
    t.onmute = flag;
    t.onunmute = function () { setStatus("Connected"); };
    t.onended = flag;
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
      if (location.protocol !== "https:") {
        if (window.confirm("Voice and video calls need HTTPS.\n\nSwitch to the secure version now? Chat keeps working, you just need to accept the certificate warning once.")) {
          location.href = "https://" + location.host + location.pathname + location.search;
        }
        return;
      }
      alert("This browser cannot access the camera and microphone. Use Chrome, Edge or Firefox on HTTPS.");
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
        pc._offerer = true;
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        return pc.createOffer().then(function (offer) {
          return pc.setLocalDescription(offer).then(function () {
            pc._negotiated = true;
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
      /* ICE-restart re-offer for the call already in progress */
      if (pc && m.callId === callId) {
        pc.setRemoteDescription(new RTCSessionDescription(m.payload))
          .then(function () { flushIce(); return pc.createAnswer(); })
          .then(function (a) { return pc.setLocalDescription(a); })
          .then(function () {
            wsSend({ type: "signal", action: "answer", to: m.from, callId: m.callId, payload: pc.localDescription });
          })
          .catch(function () {});
        return;
      }
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
  THREAD.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest(".mact") : null;
    if (!btn) return;
    var bubble = btn.closest(".bubble");
    if (!bubble) return;
    var act = btn.getAttribute("data-act");
    if (act === "edit") startEdit(bubble);
    else if (act === "del") deleteMsg(bubble);
  });
  document.getElementById("mq").addEventListener("input", renderPeople);
  document.getElementById("sendForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var body = MSG_IN.value.trim();
    if (!body || !peer) return;
    MSG_IN.value = "";
    var tempId = "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    addBubble({ body: body, at: new Date().toISOString(), self: true, tempId: tempId, status: "sending" });
    wsSend({ type: "msg", to: peer.id, body: body, tempId: tempId });
  });
  MSG_IN.addEventListener("input", function () {
    if (!peer) return;
    wsSend({ type: "typing", to: peer.id, on: !!MSG_IN.value });
  });
  AUDIO_BTN.addEventListener("click", function () { startCall("audio"); });
  VIDEO_BTN.addEventListener("click", function () { startCall("video"); });
  if (SNDFIX) {
    SNDFIX.addEventListener("click", function () {
      SNDFIX.style.display = "none";
      playRemote();
    });
  }
  var MTEST_BTN = document.getElementById("btnMicTest");
  if (MTEST_BTN) MTEST_BTN.addEventListener("click", openMicTest);
  if (MIC_SEL) {
    MIC_SEL.addEventListener("change", function () { switchMic(MIC_SEL.value); });
  }
  if (MIC_BTN) {
    MIC_BTN.addEventListener("click", function () {
      if (!localStream) return;
      var t = localStream.getAudioTracks()[0];
      if (!t) return;
      t.enabled = !t.enabled;
      MIC_BTN.innerHTML = t.enabled
        ? "<i class='fa-solid fa-microphone'></i>"
        : "<i class='fa-solid fa-microphone-slash'></i>";
      MIC_BTN.title = t.enabled ? "Mute microphone" : "Unmute microphone";
      setStatus(t.enabled ? "Connected" : "Microphone muted");
      micMutedSince = 0;
    });
  }
  var MTEST_CLOSE = document.getElementById("micClose");
  if (MTEST_CLOSE) MTEST_CLOSE.addEventListener("click", stopMicTest);
  if (MTEST) {
    MTEST.addEventListener("click", function (e) {
      if (e.target === MTEST) stopMicTest();
    });
  }
  /* Any tap/click while a call is on also retries remote playback. */
  CALLOV.addEventListener("click", function () {
    if (CALLOV.classList.contains("on") && REMOTE_V.srcObject) playRemote();
  });
  document.addEventListener("pointerdown", function () {
    if (CALLOV.classList.contains("on") && REMOTE_V.srcObject) playRemote();
  }, true);
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
  // Open the first conversation straight away so the chat is visible.
  if (contacts.length) openChat(contacts[0].id);
})();
