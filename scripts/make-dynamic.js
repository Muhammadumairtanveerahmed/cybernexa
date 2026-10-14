/* One-time migration: swap static course markup for dynamic containers.
   - courses.html: remove the 9 hardcoded cat-blocks → <div id="courseCatalog">
   - index.html:  remove the 8 hardcoded featured cards → <div id="featuredCourses">
   Handles CRLF or LF line endings. Safe to re-run (skips already-done work).
   Run: node scripts/make-dynamic.js */
const fs = require("fs");
const path = require("path");

const crlf = /(\r\n|\n|\r)/g; // detect primary EOL
function readNorm(file) {
  const raw = fs.readFileSync(file, "utf8");
  const eol = /\r\n/.test(raw) ? "\r\n" : "\n";
  return { text: raw.replace(/\r\n/g, "\n"), eol };
}

// --- courses.html ---
{
  const file = path.join(__dirname, "..", "courses.html");
  const { text, eol } = readNorm(file);
  if (text.indexOf("courseCatalog") === -1 && text.indexOf("<!-- CYBERSECURITY -->") !== -1) {
    const a = "      <!-- CYBERSECURITY -->";
    const cta = "  <!-- ============ CTA ============ -->";
    const start = text.indexOf(a);
    const end = text.lastIndexOf("  </section>", text.indexOf(cta));
    if (start < 0 || end < 0 || end < start) {
      console.error("courses anchors fail", start, end);
      process.exit(1);
    }
    const out =
      text.slice(0, start) +
      '      <div id="courseCatalog"></div>\n    </div>\n' +
      text.slice(end);
    fs.writeFileSync(file, out.replace(/\n/g, eol), "utf8");
    console.log("courses.html catalog replaced — removed", end - start, "chars");
  } else {
    console.log("courses.html already dynamic — skipped");
  }
}

// --- index.html ---
{
  const file = path.join(__dirname, "..", "index.html");
  const { text, eol } = readNorm(file);
  if (text.indexOf("featuredCourses") === -1) {
    const after = text.indexOf('      <div style="text-align:center; margin-top: 46px;"', 0);
    const gridStart = text.indexOf('<div class="course-grid">');
    if (after < 0 || gridStart < 0 || gridStart > after) {
      console.error("index anchors fail", gridStart, after);
      process.exit(1);
    }
    // The grid's own closing </div> is the last 6-space-indented one before the view-all wrapper
    const fEnd = text.lastIndexOf("      </div>", after);
    const out =
      text.slice(0, gridStart) +
      '<div class="course-grid" id="featuredCourses"></div>' +
      text.slice(fEnd + 12);
    fs.writeFileSync(file, out.replace(/\n/g, eol), "utf8");
    console.log("index.html featured cards replaced");
  } else {
    console.log("index.html already dynamic — skipped");
  }
}