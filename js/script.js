/* ==========================================================
   CyberNexa Solutions — Interactions
   ========================================================== */

// ---------- Student / Teacher portal links in the main nav ----------
// Injected on every page so the portal is reachable from the whole website.
(async () => {
  const nav = document.getElementById("navLinks");
  if (!nav) return;
  const cta = nav.querySelector(".btn.btn-small");

  const login = document.createElement("a");
  login.href = "/portal/login";
  login.textContent = "Login";
  login.className = "btn btn-ghost btn-small";

  const register = document.createElement("a");
  register.href = "/portal/register";
  register.textContent = "Register";
  register.className = "btn btn-small";

  nav.insertBefore(login, cta || null);
  nav.insertBefore(register, cta || null);

  try {
    const res = await fetch("/api/me", { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (data && data.user) {
      login.href = "/portal/dashboard";
      login.textContent = data.user.name.split(" ")[0] + " · " + (data.user.role === "teacher" ? "Teacher" : "Student");
      login.className = "btn btn-small";
      register.remove();
    }
  } catch (e) {
    /* not signed in / offline — keep the Login + Register buttons */
  }
})();

// ---------- Navbar scroll effect ----------
const navbar = document.getElementById("navbar");

const onScroll = () => {
  navbar.classList.toggle("scrolled", window.scrollY > 40);
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// ---------- Dropdown menus (mobile click toggle) ----------
document.querySelectorAll(".dropdown .drop-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const dd = btn.parentElement;
    const wasOpen = dd.classList.contains("open");
    document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
    if (!wasOpen) dd.classList.add("open");
  });
});
document.addEventListener("click", () => {
  document.querySelectorAll(".dropdown.open").forEach((d) => d.classList.remove("open"));
});

// ---------- Mobile menu ----------
const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("navLinks");

hamburger.addEventListener("click", () => {
  hamburger.classList.toggle("open");
  navLinks.classList.toggle("open");
});

// Close menu when a link is clicked
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    hamburger.classList.remove("open");
    navLinks.classList.remove("open");
  });
});

// ---------- Scroll reveal ----------
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  revealElements.forEach((el) => revealObserver.observe(el));
} else {
  // Fallback: show everything
  revealElements.forEach((el) => el.classList.add("visible"));
}

// ---------- Animated counters ----------
const counters = document.querySelectorAll("[data-count]");
let countersStarted = false;

const animateCounters = () => {
  counters.forEach((counter) => {
    const target = parseInt(counter.dataset.count, 10);
    const duration = 1600;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
};

if (counters.length) {
  const statsSection = document.querySelector(".hero-stats");
  if ("IntersectionObserver" in window && statsSection) {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !countersStarted) {
            countersStarted = true;
            animateCounters();
            counterObserver.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    counterObserver.observe(statsSection);
  } else {
    animateCounters();
  }
}

// ---------- Footer year ----------
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---------- Validation helpers ----------
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

// Common email typos and their suggested fix
const EMAIL_TYPOS = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmailo.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "hotmail.co": "hotmail.com",
};

// Throw-away email providers — not accepted
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "yopmail.com", "throwaway.email", "trashmail.com",
  "fakeinbox.com", "maildrop.cc", "sharklasers.com",
];

function isValidEmail(v) {
  v = String(v || "").trim();
  return v.length <= 100 && EMAIL_RE.test(v) && !v.includes("..") && !v.includes(".@") && !v.includes("@.");
}

// Extra email check: typo or disposable address gives a helpful message, otherwise ""
function emailIssue(v) {
  const domain = String(v || "").trim().toLowerCase().split("@")[1] || "";
  if (EMAIL_TYPOS[domain]) return "This looks like a typo — did you mean " + EMAIL_TYPOS[domain] + "?";
  if (DISPOSABLE_DOMAINS.indexOf(domain) !== -1) return "Please use a permanent email like Gmail, Yahoo or Outlook";
  return "";
}

function isValidPKPhone(v) {
  let s = String(v || "").replace(/[\s()-]/g, "");
  if (!/^(\+92|0092|92|0)?3\d{9}$/.test(s)) return false;
  // Normalize to local 03XXXXXXXXX form
  if (s.indexOf("+92") === 0) s = "0" + s.slice(3);
  else if (s.indexOf("0092") === 0) s = "0" + s.slice(4);
  else if (s.length === 12 && s.indexOf("92") === 0) s = "0" + s.slice(2);
  else if (s.length === 10 && s[0] === "3") s = "0" + s;
  const prefix = Number(s.slice(0, 4));
  // Real Pakistani mobile ranges: 0300–0349 (+ SCOM 0355)
  if (!((prefix >= 300 && prefix <= 349) || prefix === 355)) return false;
  // Obviously fake repeating number (03000000000 etc.)
  if (/^(\d)\1{8}$/.test(s.slice(2))) return false;
  return true;
}

// ---------- Contact form (PHP backend) ----------
const contactForm = document.getElementById("contactForm");

if (contactForm) {
  const btn = document.getElementById("formBtn");
  const resp = document.getElementById("formResponse");

  const showErrors = (errors) => {
    contactForm.querySelectorAll(".field-error").forEach((el) => {
      el.textContent = errors[el.dataset.for] || "";
    });
  };

  // Live checks when leaving a field (empty fields are caught on submit)
  const fieldChecks = {
    name: (v) => (v.length < 2 ? "Name must be at least 2 characters" : v.length > 80 ? "Name must be under 80 characters" : ""),
    email: (v) => (!isValidEmail(v) ? "Please enter a valid email address" : emailIssue(v)),
    phone: (v) => (v && !isValidPKPhone(v) ? "Enter a valid mobile number (e.g. 0300 1234567)" : ""),
    message: (v) => (v.length < 5 ? "Message must be at least 5 characters" : v.length > 1000 ? "Message must be under 1000 characters" : ""),
  };
  Object.keys(fieldChecks).forEach((key) => {
    const el = contactForm.querySelector(`[name="${key}"]`);
    if (!el) return;
    const span = contactForm.querySelector(`.field-error[data-for="${key}"]`);
    el.addEventListener("blur", () => {
      const v = el.value.trim();
      if (!v) { if (span) span.textContent = ""; el.classList.remove("invalid"); return; }
      const err = fieldChecks[key](v);
      if (span) span.textContent = err;
      el.classList.toggle("invalid", !!err);
    });
    el.addEventListener("input", () => {
      if (span && span.textContent) span.textContent = "";
      el.classList.remove("invalid");
    });
  });

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showErrors({});
    resp.textContent = "";
    resp.className = "form-response";

    const data = {
      name: contactForm.name.value.trim(),
      email: contactForm.email.value.trim(),
      phone: contactForm.phone.value.trim(),
      message: contactForm.message.value.trim(),
    };

    // Client-side validation checks
    const local = {};
    if (data.name.length < 2) local.name = "Name must be at least 2 characters";
    else if (data.name.length > 80) local.name = "Name must be under 80 characters";
    if (!isValidEmail(data.email)) local.email = "Please enter a valid email address";
    else { const issue = emailIssue(data.email); if (issue) local.email = issue; }
    if (data.phone && !isValidPKPhone(data.phone)) local.phone = "Enter a valid mobile number (e.g. 0300 1234567)";
    if (data.message.length < 5) local.message = "Message must be at least 5 characters";
    else if (data.message.length > 1000) local.message = "Message must be under 1000 characters";
    if (Object.keys(local).length) {
      showErrors(local);
      const firstKey = Object.keys(local)[0];
      const firstEl = contactForm.querySelector(`[name="${firstKey}"]`);
      if (firstEl) firstEl.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (json.ok) {
        resp.textContent = json.msg;
        resp.classList.add("ok");
        contactForm.reset();
      } else {
        if (json.errors) showErrors(json.errors);
        resp.textContent = (json.msg || "Please check the form");
        resp.classList.add("err");
      }
    } catch (err) {
      resp.textContent = "Could not connect to the server";
      resp.classList.add("err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Send Message";
    }
  });
}

// ---------- Course price modal + enrollment ----------
(function () {
  var modal = document.getElementById("courseModal");
  if (!modal) return;
  var catEl = document.getElementById("cm-cat");
  var titleEl = document.getElementById("cm-title");
  var descEl = document.getElementById("cm-desc");
  var metaEl = document.getElementById("cm-meta");
  var priceEl = document.getElementById("cm-price");
  var form = document.getElementById("enrollForm");
  var nameI = document.getElementById("ef-name");
  var emailI = document.getElementById("ef-email");
  var phoneI = document.getElementById("ef-phone");
  var sendBtn = document.getElementById("ef-send");
  var statusEl = document.getElementById("ef-msg");
  var current = { course: "", price: "" };

  var typeSel = document.getElementById("ef-enrollmentType");
  var fileInputs = {
    cnic: document.getElementById("ef-cnic"),
    photo: document.getElementById("ef-photo"),
    payment: document.getElementById("ef-payment"),
    qualification: document.getElementById("ef-qualification"),
    other: document.getElementById("ef-other"),
  };
  var REQUIRED_FILES = {
    cnic: "CNIC / B-Form is required",
    photo: "Recent Photograph is required",
    payment: "Payment Proof / Receipt is required",
  };
  var MAX_BYTES = 10 * 1024 * 1024;

  var errEls = {
    name: document.getElementById("ef-name-err"),
    email: document.getElementById("ef-email-err"),
    phone: document.getElementById("ef-phone-err"),
    enrollmentType: document.getElementById("ef-enrollmentType-err"),
    cnic: document.getElementById("ef-cnic-err"),
    photo: document.getElementById("ef-photo-err"),
    payment: document.getElementById("ef-payment-err"),
    qualification: document.getElementById("ef-qualification-err"),
    other: document.getElementById("ef-other-err"),
    files: document.getElementById("ef-msg"),
  };

  function clearErr(field) {
    if (errEls[field]) errEls[field].textContent = "";
    var input = document.getElementById("ef-" + field);
    if (input && input.classList) input.classList.remove("invalid");
  }

  function setErr(field, msg) {
    if (errEls[field]) errEls[field].textContent = msg;
    var input = document.getElementById("ef-" + field);
    if (input && input.classList) input.classList.add("invalid");
  }

  function fileFieldError(field) {
    var input = fileInputs[field];
    if (!input) return "";
    var files = input.files;
    if (REQUIRED_FILES[field] && (!files || files.length === 0)) return REQUIRED_FILES[field];
    if (files) {
      for (var i = 0; i < files.length; i++) {
        if (files[i].size > MAX_BYTES) return "\u201C" + files[i].name + "\u201D is larger than 10 MB";
      }
    }
    return "";
  }

  // Show the chosen file name(s) under each upload field
  Object.keys(fileInputs).forEach(function (field) {
    var input = fileInputs[field];
    if (!input) return;
    input.addEventListener("change", function () {
      var nameEl = document.getElementById("ef-" + field + "-name");
      var files = input.files;
      if (nameEl) {
        if (!files || !files.length) nameEl.textContent = "";
        else if (files.length === 1) nameEl.textContent = files[0].name;
        else nameEl.textContent = files.length + " files selected";
      }
      clearErr(field);
    });
  });

  // Per-field validation — returns error message or "" if OK
  function validateField(field) {
    var v = (document.getElementById("ef-" + field).value || "").trim();
    if (field === "name") {
      if (!v) return "Name is required";
      if (v.length < 2) return "Name must be at least 2 characters";
      if (v.length > 80) return "Name must be under 80 characters";
      if (!/^[a-zA-Z .'-]+$/.test(v)) return "Name can only contain letters, spaces, dots and dashes";
    }
    if (field === "email") {
      if (!v) return "Email is required";
      if (!isValidEmail(v)) return "Please enter a valid email address";
      var issue = emailIssue(v);
      if (issue) return issue;
    }
    if (field === "phone") {
      if (v && !isValidPKPhone(v)) return "Enter a valid mobile number (e.g. 0300 1234567)";
    }
    return "";
  }

  // Live checks: validate when the user leaves a field, clear while typing
  ["name", "email", "phone"].forEach(function (field) {
    var input = document.getElementById("ef-" + field);
    if (!input) return;
    input.addEventListener("blur", function () {
      var err = validateField(field);
      if (err) setErr(field, err); else clearErr(field);
    });
    input.addEventListener("input", function () { clearErr(field); });
  });

  function status(text, isError) {
    statusEl.textContent = text;
    statusEl.className = "enroll-status " + (isError ? "err" : "ok");
  }

  function openModal() {
    statusEl.textContent = "";
    statusEl.className = "enroll-status";
    ["name", "email", "phone", "enrollmentType", "cnic", "photo", "payment", "qualification", "other"].forEach(clearErr);
    Object.keys(fileInputs).forEach(function (field) {
      var nameEl = document.getElementById("ef-" + field + "-name");
      if (nameEl) nameEl.textContent = "";
    });
    if (typeSel) typeSel.value = "";
    Object.keys(fileInputs).forEach(function (field) { if (fileInputs[field]) fileInputs[field].value = ""; });
    form.style.display = "";
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  // Event delegation — works for both static cards and courses
  // rendered dynamically by js/courses.js
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest(".enroll-btn") : null;
    if (!btn || !btn.hasAttribute("data-course-title") || !modal) return;
    catEl.textContent = btn.getAttribute("data-course-cat") || "Course";
    titleEl.textContent = btn.getAttribute("data-course-title") || "";
    descEl.textContent = btn.getAttribute("data-course-desc") || "";
    metaEl.innerHTML = "";
    (btn.getAttribute("data-course-meta") || "").split("|").forEach(function (part) {
      if (!part) return;
      var s = document.createElement("span");
      s.textContent = part.trim();
      metaEl.appendChild(s);
      var dot = document.createElement("span");
      dot.textContent = "\u00B7";
      metaEl.appendChild(dot);
    });
    if (metaEl.lastChild) metaEl.removeChild(metaEl.lastChild);
    priceEl.textContent = btn.getAttribute("data-course-price") || "Contact us";
    current.course = btn.getAttribute("data-course-title") || "";
    current.price = btn.getAttribute("data-course-price") || "";
    openModal();
  });

  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = nameI.value.trim();
      var email = emailI.value.trim();
      var phone = phoneI.value.trim();
      var enrollmentType = typeSel ? typeSel.value : "";

      var firstBad = null;
      var checks = [["name", nameI], ["email", emailI], ["phone", phoneI]];
      checks.forEach(function (pair) {
        var err = validateField(pair[0]);
        if (err) { setErr(pair[0], err); if (!firstBad) firstBad = pair[1]; }
        else clearErr(pair[0]);
      });

      // Enrollment type
      if (!enrollmentType) {
        setErr("enrollmentType", "Please select Online or On-Site");
        if (!firstBad) firstBad = typeSel;
      }

      // Required documents + size checks
      ["cnic", "photo", "payment", "qualification", "other"].forEach(function (field) {
        var err = fileFieldError(field);
        if (err) { setErr(field, err); if (!firstBad) firstBad = fileInputs[field]; }
        else clearErr(field);
      });

      if (firstBad) { if (firstBad.focus) firstBad.focus(); return; }

      sendBtn.disabled = true;
      sendBtn.textContent = "Sending\u2026";

      var fd = new FormData();
      fd.append("course", current.course);
      fd.append("price", current.price);
      fd.append("name", name);
      fd.append("email", email);
      fd.append("phone", phone);
      fd.append("enrollmentType", enrollmentType);
      Object.keys(fileInputs).forEach(function (field) {
        var input = fileInputs[field];
        if (!input || !input.files) return;
        for (var i = 0; i < input.files.length; i++) fd.append(field, input.files[i]);
      });

      fetch("/api/enroll", { method: "POST", body: fd })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); })
        .then(function (res) {
          var d = res.data;
          if (d && d.ok) {
            form.style.display = "none";
            status(d.msg, false);
          } else {
            var msg = d && d.msg;
            if (d && d.errors) {
              Object.keys(d.errors).forEach(function (k) {
                if (errEls[k] && errEls[k] !== statusEl) setErr(k, d.errors[k]);
              });
              var keys = Object.keys(d.errors);
              if (keys.length) msg = d.errors[keys[0]];
            }
            status(msg || "Something went wrong. Please try again.", true);
          }
        })
        .catch(function () {
          status("Network error — please check your connection and try again.", true);
        })
        .finally(function () {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send Enrollment Request";
        });
    });
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  document.getElementById("modalClose").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });
})();

// ==========================================================
// SITE-WIDE ENHANCEMENTS
// ==========================================================

// ---------- FAQ accordion ----------
document.querySelectorAll(".faq-item").forEach(function (item) {
  var q = item.querySelector(".faq-q");
  var a = item.querySelector(".faq-a");
  if (!q || !a) return;
  q.addEventListener("click", function () {
    var wasOpen = item.classList.contains("open");
    document.querySelectorAll(".faq-item.open").forEach(function (o) {
      o.classList.remove("open");
      var oq = o.querySelector(".faq-q");
      var oa = o.querySelector(".faq-a");
      if (oq) oq.setAttribute("aria-expanded", "false");
      if (oa) oa.style.maxHeight = "";
    });
    if (!wasOpen) {
      item.classList.add("open");
      q.setAttribute("aria-expanded", "true");
      a.style.maxHeight = a.scrollHeight + "px";
    }
  });
});

// ---------- Floating actions: WhatsApp + back to top ----------
(function () {
  if (document.querySelector(".float-actions")) return;
  var wrap = document.createElement("div");
  wrap.className = "float-actions";
  wrap.innerHTML =
    '<a class="float-btn pulse-anim" href="https://wa.me/923237469306?text=Hi%20CyberNexa%2C%20I%20need%20help%20with%20" target="_blank" rel="noopener" aria-label="Chat on WhatsApp" title="Chat with us on WhatsApp"><svg class="wa-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></a>' +
    '<button class="float-btn to-top" id="toTopBtn" type="button" aria-label="Back to top" title="Back to top"><span class="to-top-txt">TOP</span></button>';
  document.body.appendChild(wrap);

  var topBtn = document.getElementById("toTopBtn");
  var toggle = function () {
    if (window.scrollY > 600) topBtn.classList.add("show");
    else topBtn.classList.remove("show");
  };
  window.addEventListener("scroll", toggle, { passive: true });
  toggle();
  topBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

// ---------- Footer newsletter (injected site-wide) ----------
(function () {
  var footer = document.querySelector(".footer");
  if (!footer || document.getElementById("newsletterForm")) return;
  var bottom = footer.querySelector(".footer-bottom");
  var parent = bottom ? bottom.parentNode : footer;

  var box = document.createElement("div");
  box.className = "footer-newsletter";
  box.innerHTML =
    '<div class="fn-text"><strong><i class="fa-solid fa-lock"></i> Stay ahead of security threats</strong><span>Monthly tips on cybersecurity, cloud and IT careers. No spam, unsubscribe anytime.</span></div>' +
    '<form id="newsletterForm" novalidate><input type="email" id="nl-email" placeholder="Your email address" maxlength="100" autocomplete="email" aria-label="Email address" /><button type="submit" class="btn btn-primary" id="nl-btn">Subscribe</button></form>' +
    '<p class="fn-msg" id="nl-msg" role="status"></p>';

  if (bottom) parent.insertBefore(box, bottom);
  else footer.appendChild(box);

  var form = document.getElementById("newsletterForm");
  var input = document.getElementById("nl-email");
  var btn = document.getElementById("nl-btn");
  var msg = document.getElementById("nl-msg");

  var show = function (text, isErr) {
    msg.textContent = text;
    msg.className = "fn-msg " + (isErr ? "err" : "ok");
  };

  input.addEventListener("input", function () {
    input.classList.remove("invalid");
    if (msg.textContent) msg.textContent = "";
  });
  input.addEventListener("blur", function () {
    var v = input.value.trim();
    if (!v) return;
    if (!isValidEmail(v)) { input.classList.add("invalid"); show("Please enter a valid email address", true); }
    else {
      var issue = emailIssue(v);
      if (issue) { input.classList.add("invalid"); show(issue, true); }
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value.trim();
    input.classList.remove("invalid");
    if (!isValidEmail(v)) { input.classList.add("invalid"); show("Please enter a valid email address", true); input.focus(); return; }
    var issue = emailIssue(v);
    if (issue) { input.classList.add("invalid"); show(issue, true); input.focus(); return; }

    btn.disabled = true;
    btn.textContent = "Subscribing…";
    fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: v })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) {
          show(d.msg || "Subscribed! Thank you.", false);
          input.value = "";
        } else {
          var m = d && d.msg;
          if (!m && d && d.errors) {
            var keys = Object.keys(d.errors);
            if (keys.length) m = d.errors[keys[0]];
          }
          input.classList.add("invalid");
          show(m || "Something went wrong. Please try again.", true);
        }
      })
      .catch(function () { show("Network error — please try again.", true); })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Subscribe";
      });
  });
})();