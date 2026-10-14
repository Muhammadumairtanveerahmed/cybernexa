/**
 * Seed generator — extracts the 41 course cards from courses.html
 * and writes them to data/courses.json (used as the single source
 * of truth for the dynamic course catalog + admin manager).
 * Run: node scripts/seed-courses.js
 */
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "courses.html"), "utf-8");

// Courses featured on the homepage (exact catalog titles)
const FEATURED_TITLES = [
  "Certified Ethical Hacker (CEH)",
  "Cisco CCNA",
  "AWS Solutions Architect \u2013 Associate",
  "Python Programming",
  "DevOps Engineering (Full Program)",
  "Microsoft Azure",
  "Front-End Web Development",
  "SIEM & Incident Monitoring",
];

const re =
  /data-course-cat="([^"]*)" data-course-title="([^"]*)" data-course-desc="([^"]*)" data-course-meta="([^"]*)" data-course-price="([^"]*)"/g;

const courses = [];
let m;
while ((m = re.exec(html))) {
  const [, category, title, desc, meta, price] = m;
  const before = html.slice(Math.max(0, m.index - 800), m.index);

  // Short tag + short description from the card markup that precedes the button
  let tag = "";
  const tags = before.match(/<span class="course-tag">([^<]*)<\/span>/g);
  if (tags) tag = tags[tags.length - 1].replace(/^<span class="course-tag">/, "").replace(/<\/span>$/, "").trim();

  let short = "";
  const ps = before.match(/<p>([\s\S]*?)<\/p>/g);
  if (ps) short = ps[ps.length - 1].replace(/^<p>/, "").replace(/<\/p>$/, "")
    .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();

  const featured = FEATURED_TITLES.indexOf(title) !== -1;

  courses.push({
    id: "c_" + String(courses.length + 1).padStart(2, "0"),
    title: title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
    category: category.replace(/&amp;/g, "&"),
    tag,
    shortDesc: short,
    description: desc.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
    meta: meta.replace(/&amp;/g, "&"),
    price: price.replace(/&amp;/g, "&"),
    featured,
    active: true,
    sortOrder: courses.length,
  });
}

const outFile = path.join(__dirname, "..", "data", "courses.json");
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(courses, null, 2), "utf-8");

const featured = courses.filter((c) => c.featured).map((c) => c.title);
console.log(`Seeded ${courses.length} courses → data/courses.json`);
console.log(`Featured (${featured.length}):`);
featured.forEach((t) => console.log("  ⭐ " + t));