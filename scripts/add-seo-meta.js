/**
 * One-off helper: injects canonical, favicon, theme-color and social meta into
 * every public page. Safe to re-run (skips pages that already have the block).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = (process.env.SITE_URL || "http://54.161.79.42").replace(/\/+$/, "");

const PAGES = {
  "index.html": "/",
  "courses.html": "/courses",
  "about.html": "/about",
  "industries.html": "/industries",
  "legal.html": "/legal",
  "services/managed-it-operations.html": "/services/managed-it-operations",
  "services/cloud-infrastructure.html": "/services/cloud-infrastructure",
  "services/cybersecurity.html": "/services/cybersecurity",
  "services/software-development.html": "/services/software-development",
  "services/it-training.html": "/services/it-training",
  "services/digital-agency.html": "/services/digital-agency",
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

for (const [file, route] of Object.entries(PAGES)) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) {
    console.log("skip (missing):", file);
    continue;
  }
  let html = fs.readFileSync(full, "utf8");
  if (html.includes('rel="canonical"')) {
    console.log("already done:", file);
    continue;
  }
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [, "TechNexa Solutions"])[1].trim();
  const desc = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [, ""])[1].trim();
  const url = SITE + (route === "/" ? "/" : route);

  const block = [
    "",
    "  <!-- SEO / social -->",
    `  <link rel="canonical" href="${url}" />`,
    '  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '  <link rel="alternate icon" href="/favicon.ico" />',
    '  <meta name="theme-color" content="#060912" />',
    '  <meta property="og:type" content="website" />',
    '  <meta property="og:site_name" content="TechNexa Solutions" />',
    `  <meta property="og:title" content="${esc(title)}" />`,
    `  <meta property="og:description" content="${esc(desc)}" />`,
    `  <meta property="og:url" content="${url}" />`,
    '  <meta name="twitter:card" content="summary" />',
    `  <meta name="twitter:title" content="${esc(title)}" />`,
    `  <meta name="twitter:description" content="${esc(desc)}" />`,
  ];

  if (route === "/") {
    block.push(
      '  <script type="application/ld+json">' +
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "TechNexa Solutions",
          url: SITE + "/",
          logo: SITE + "/favicon.svg",
          description: desc,
          email: "info@technexa.solutions",
          telephone: "+92-323-7469306",
          address: { "@type": "PostalAddress", addressCountry: "PK" },
          sameAs: ["https://wa.me/923237469306"],
        }) +
        "</script>"
    );
  }

  html = html.replace(/<\/head>/i, block.join("\n") + "\n</head>");
  fs.writeFileSync(full, html);
  console.log("updated:", file);
}
