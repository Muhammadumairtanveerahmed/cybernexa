/* ==========================================================
   CyberNexa — Dynamic course catalog loader
   Fetches /api/courses and renders:
   - courses.html catalog (course blocks + category chips + count)
   - index.html featured courses (homepage)
   Re-renders automatically whenever an admin adds/edits/deletes
   a course, so the public site always mirrors the admin panel.
   ========================================================== */
(function () {
  "use strict";

  var CATEGORY_META = [
    { name: "Cybersecurity", slug: "cybersecurity", icon: '<i class="fa-solid fa-shield-halved"></i>', blurb: "Offensive and defensive security — become the person who stops breaches." },
    { name: "Networking", slug: "networking", icon: '<i class="fa-solid fa-globe"></i>', blurb: "Routing, switching and enterprise network engineering." },
    { name: "DevOps", slug: "devops", icon: '<i class="fa-solid fa-gear"></i>', blurb: "Build, ship and run software faster with automation and infrastructure as code." },
    { name: "Linux & Unix", slug: "linux", icon: '<i class="fa-brands fa-linux"></i>', blurb: "Administration and certification on the world's most used platforms." },
    { name: "Cloud Computing", slug: "cloud", icon: '<i class="fa-solid fa-cloud"></i>', blurb: "AWS, Azure and GCP — architectures that scale globally." },
    { name: "System Administration", slug: "sysadmin", icon: '<i class="fa-solid fa-desktop"></i>', blurb: "Windows Server, AD and enterprise infrastructure operations." },
    { name: "Digital Marketing", slug: "marketing", icon: '<i class="fa-solid fa-chart-line"></i>', blurb: "SEO, ads and campaigns that turn visitors into customers." },
    { name: "Programming", slug: "programming", icon: '<i class="fa-solid fa-laptop-code"></i>', blurb: "Frontend, backend and languages — build production-ready software." },
    { name: "Designing", slug: "designing", icon: '<i class="fa-solid fa-palette"></i>', blurb: "Visual skills that get hired." }
  ];

  function catMeta(name) {
    for (var i = 0; i < CATEGORY_META.length; i++) {
      if (CATEGORY_META[i].name === name) return CATEGORY_META[i];
    }
    return {
      slug: String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      icon: '<i class="fa-solid fa-book-open"></i>',
      blurb: ""
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function courseCard(c, delay) {
    var metaChips = "";
    var parts = String(c.meta || "").split("|");
    var last = parts.length - 1;
    parts.forEach(function (p, i) {
      p = p.trim();
      if (!p) return;
      metaChips += "<span>" + esc(p) + "</span>";
      if (i < last) metaChips += "<span>\u00B7</span>";
    });
    var d = delay ? " delay-" + delay : "";
    return (
      '<div class="course reveal' + d + '">' +
        '<div class="course-top"><span class="course-tag">' + esc(c.tag || "Course") + "</span><h3>" + esc(c.title) + "</h3></div>" +
        "<p>" + esc(c.shortDesc || c.description || "") + "</p>" +
        '<div class="course-meta">' + metaChips + "</div>" +
        '<button type="button" class="enroll-btn" data-course-cat="' + esc(c.category) + '" data-course-title="' + esc(c.title) +
        '" data-course-desc="' + esc(c.description || "") + '" data-course-meta="' + esc(c.meta || "") +
        '" data-course-price="' + esc(c.price || "PKR 20,000") + '">Enroll Now</button>' +
      "</div>"
    );
  }

  var catCount = 0;
  function bindReveals(scope) {
    var els = scope.querySelectorAll(".reveal:not(.visible)");
    if (!els.length) return;
    catCount += els.length;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("visible"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("visible"); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { obs.observe(el); });
  }

  function renderCourses(data) {
    var courses = data.courses || [];

    // Course count (courses.html hero: "41 Courses.")
    var countEl = document.getElementById("courseCount");
    if (countEl) countEl.textContent = courses.length;

    // Full catalog (courses.html)
    var catalog = document.getElementById("courseCatalog");
    if (catalog) {
      var groups = {};
      courses.forEach(function (c) { (groups[c.category] = groups[c.category] || []).push(c); });
      var keys = CATEGORY_META.map(function (m) { return m.name; });
      Object.keys(groups).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });

      var html = "";
      keys.forEach(function (name) {
        if (!groups[name]) return;
        var m = catMeta(name);
        html +=
          '<div class="cat-block" id="' + m.slug + '">' +
            '<div class="cat-head reveal"><div class="ic">' + m.icon + "</div><div><h2>" + esc(name) + "</h2><p>" + esc(m.blurb) + "</p></div></div>" +
            '<div class="course-grid">' + groups[name].map(function (c, i) { return courseCard(c, i % 4); }).join("") + "</div>" +
          "</div>";
      });
      catalog.innerHTML = html;
      bindReveals(catalog);

      var chips = document.getElementById("catChips");
      if (chips) {
        chips.innerHTML = keys.map(function (name) {
          var m = catMeta(name);
          return '<a href="#' + m.slug + '">' + m.icon + " " + esc(name) + "</a>";
        }).join("");
      }
    }

    // Featured courses (index.html homepage)
    var feat = document.getElementById("featuredCourses");
    if (feat) {
      var featured = courses.filter(function (c) { return c.featured; });
      if (!featured.length) featured = courses.slice(0, 8);
      feat.innerHTML = featured.map(function (c, i) { return courseCard(c, i % 4); }).join("");
      bindReveals(feat);
    }
  }

  function loadCourses() {
    var anyTarget =
      document.getElementById("courseCatalog") ||
      document.getElementById("featuredCourses") ||
      document.getElementById("courseCount") ||
      document.getElementById("catChips");
    if (!anyTarget) return;
    fetch("/api/courses", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) renderCourses(d); })
      .catch(function () { /* fetch failed — sections stay empty on purpose */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadCourses);
  } else {
    loadCourses();
  }
})();