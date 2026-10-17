/**
 * Generates service detail pages in /services
 * Run: node scripts/generate-services.js
 * Edit content below, re-run to regenerate.
 */
const fs = require("fs");
const path = require("path");

const WHY = [
  ["01", "Security-First Operations", "Every process is built around security best practices and zero-trust principles."],
  ["02", "Cloud & Hybrid Expertise", "AWS, Azure and on-prem — we design the right mix for your workload."],
  ["03", "24×7 Monitoring", "Round-the-clock NOC watching your systems so problems never sleep unwatched."],
  ["04", "Certified Engineers", "CISSP, AWS, CCNA and CompTIA certified professionals on every engagement."],
  ["05", "Continuous Optimization", "Regular reviews keep your environment fast, cheap and up to date."],
  ["06", "Scalable Partnership", "From startup to enterprise — services scale exactly as your business grows."],
];

const services = [
  {
    slug: "cloud-infrastructure",
    title: "Cloud & Infrastructure",
    meta: "CyberNexa Cloud & Infrastructure — migration, optimization and 24x7 managed cloud operations on AWS and Azure.",
    heroBtn: "Talk to a Cloud Engineer",
    h1a: "Cloud & Infrastructure That",
    h1b: "Scales With Your Business",
    desc: "Migrate, optimize and operate your cloud with confidence. From landing zones to 24×7 managed operations, we help you cut costs and scale securely across AWS, Azure and hybrid environments.",
    s1Eyebrow: "What We Deliver",
    s1TitleA: "End-to-End Cloud Services,",
    s1TitleB: "Built for Scale",
    s1Desc: "Everything you need to move to the cloud and stay there — architecture, migration, cost control and ongoing operations.",
    cards: [
      ["☁️", "violet", "Cloud Migration", "Lift-and-shift or replatform — zero-downtime migrations to AWS and Azure."],
      ["🏗️", "indigo", "Landing Zone & Architecture", "Well-architected foundations with security, networking and governance built in."],
      ["⚙️", "cyan", "Cost Optimization", "Cut cloud waste with rightsizing, autoscaling and reserved capacity planning."],
      ["🔧", "pink", "Managed Cloud Operations", "Patching, scaling, backups and updates handled around the clock."],
      ["🔗", "orange", "Hybrid & Networking", "VPN, Direct Connect and multi-cloud networking that just works."],
      ["🛡️", "green", "Cloud Security", "IAM hardening, guardrails, encryption and continuous compliance checks."],
    ],
    stats: [["99.95%", "Uptime SLA"], ["30%", "Avg. Cost Saved"], ["24×7", "Cloud NOC"]],
    ctaTitle: "Ready to Move to the Cloud?",
    ctaDesc: "Get a free architecture review and migration roadmap — no obligation, pure insight.",
  },
  {
    slug: "cybersecurity",
    title: "Managed Cybersecurity",
    meta: "CyberNexa Managed Cybersecurity — 24x7 SOC monitoring, penetration testing and incident response.",
    heroBtn: "Speak with a Security Engineer",
    h1a: "Cybersecurity That",
    h1b: "Protects What Matters Most",
    desc: "Reduce risk with 24×7 SOC monitoring, penetration testing and incident response. We detect threats early, respond fast and keep your business compliant and resilient.",
    s1Eyebrow: "What We Protect",
    s1TitleA: "Complete Security Coverage,",
    s1TitleB: "Delivered as a Service",
    s1Desc: "Layered defenses across people, process and technology — from detection to recovery.",
    cards: [
      ["🔒", "violet", "24×7 SOC Monitoring", "Threat detection and response around the clock by security analysts."],
      ["🎯", "indigo", "Penetration Testing", "Find and fix vulnerabilities before attackers find them."],
      ["🚨", "cyan", "Incident Response", "Contain, eradicate and recover with a tested response playbook."],
      ["📋", "pink", "Governance & Compliance", "ISO 27001, SOC 2 and PCI-DSS readiness with audit support."],
      ["🔑", "orange", "Identity & Access Management", "Zero-trust access controls, MFA and least-privilege enforcement."],
      ["🧠", "green", "Security Awareness Training", "Turn your employees into a human firewall against phishing."],
    ],
    stats: [["< 15 min", "Incident Response SLA"], ["24×7", "SOC Coverage"], ["100%", "Audit Support"]],
    ctaTitle: "How Secure Is Your Business Today?",
    ctaDesc: "Book a free security assessment and find your biggest risks before the attackers do.",
  },
  {
    slug: "software-development",
    title: "Software House",
    meta: "CyberNexa Software House — custom web apps, mobile apps, APIs and enterprise software.",
    heroBtn: "Start Your Project",
    h1a: "Custom Software That",
    h1b: "Powers Your Digital Growth",
    desc: "From idea to production — web apps, mobile apps, APIs and enterprise software built with modern, scalable tech stacks by senior developers.",
    s1Eyebrow: "What We Build",
    s1TitleA: "Software Solutions,",
    s1TitleB: "Engineered to Last",
    s1Desc: "Full-cycle development with clean code, automated testing and CI/CD built in from day one.",
    cards: [
      ["🌐", "violet", "Web Applications", "React, Next.js and Node.js full-stack apps that scale."],
      ["📱", "indigo", "Mobile Apps", "Flutter and React Native — one codebase, both stores."],
      ["🔌", "cyan", "API Development", "REST and GraphQL APIs with documentation and versioning."],
      ["🛒", "pink", "E-Commerce", "Shopify, WooCommerce and fully custom online stores."],
      ["🧩", "orange", "Enterprise Software", "ERP, CRM and internal tools tailored to your workflow."],
      ["🔄", "green", "Legacy Modernization", "Rebuild old systems — monolith to microservices, done safely."],
    ],
    stats: [["250+", "Projects Delivered"], ["40+", "Technologies"], ["98%", "On-Time Delivery"]],
    ctaTitle: "Have an Idea to Build?",
    ctaDesc: "Share your requirements and get a free estimate with timeline within 48 hours.",
  },
  {
    slug: "it-training",
    title: "IT Training Academy",
    meta: "CyberNexa IT Training Academy — cybersecurity, cloud, development and networking courses with labs.",
    heroBtn: "Explore Courses",
    h1a: "IT Training That",
    h1b: "Builds Real Careers",
    desc: "Hands-on courses taught by certified instructors — real labs, real projects and certification prep that gets you hired.",
    s1Eyebrow: "What We Teach",
    s1TitleA: "Courses for Every",
    s1TitleB: "IT Career Path",
    s1Desc: "Beginner to advanced programs with lab environments, portfolio projects and exam preparation.",
    cards: [
      ["🛡️", "violet", "Cybersecurity Courses", "CEH, SOC analyst and ethical hacking with hands-on labs."],
      ["💻", "indigo", "Development Courses", "Web, mobile and Python programming from zero to portfolio."],
      ["☁️", "cyan", "Cloud & DevOps", "AWS, Docker, Kubernetes and CI/CD pipelines in real environments."],
      ["🌐", "pink", "Networking Courses", "CCNA and enterprise networking with packet-tracer labs."],
      ["📜", "orange", "Certification Prep", "CompTIA, AWS and CISSP exam readiness with mock tests."],
      ["🏢", "green", "Corporate Training", "Custom upskilling programs for your whole team."],
    ],
    stats: [["120+", "Students Trained"], ["10+", "Courses"], ["95%", "Completion Rate"]],
    ctaTitle: "Ready to Start Learning?",
    ctaDesc: "Talk to an advisor and pick the right course for your career goal — free counselling.",
  },
  {
    slug: "digital-agency",
    title: "Digital Agency",
    meta: "CyberNexa Digital Agency — brand identity, UI/UX design, SEO and performance marketing.",
    heroBtn: "Talk to a Strategist",
    h1a: "Digital Experiences That",
    h1b: "Turn Visitors Into Customers",
    desc: "Brand identity, UI/UX design, SEO and digital marketing that grows your reach and turns traffic into revenue.",
    s1Eyebrow: "What We Do",
    s1TitleA: "Creative & Marketing,",
    s1TitleB: "Measurable Results",
    s1Desc: "Full-service digital — from your first logo to campaigns that report real ROI.",
    cards: [
      ["🎨", "violet", "Brand Identity", "Logos, guidelines and brand systems people remember."],
      ["🖌️", "indigo", "UI/UX Design", "Research-driven interfaces that are beautiful and convert."],
      ["🔍", "cyan", "SEO", "Technical and content SEO that climbs Google rankings."],
      ["📣", "pink", "Social Media", "Content strategy and campaigns that build community."],
      ["💹", "orange", "Performance Marketing", "Google and Meta ads with transparent ROI tracking."],
      ["✍️", "green", "Content Creation", "Copywriting, video and graphics that sell."],
    ],
    stats: [["150+", "Projects Launched"], ["3×", "Average ROI"], ["14 Days", "First Results"]],
    ctaTitle: "Ready to Grow Online?",
    ctaDesc: "Get a free digital audit of your brand — websites, SEO and ads reviewed in one call.",
  },
];

function page(s) {
  const cards = s.cards
    .map(
      ([icon, cls, title, desc]) => `
        <article class="card reveal">
          <div class="card-icon ${cls}">${icon}</div>
          <h3>${title}</h3>
          <p>${desc}</p>
        </article>`
    )
    .join("");

  const why = WHY.map(
    ([num, title, desc], i) => `
        <div class="course reveal delay-${i % 4}">
          <div class="course-top"><span class="course-tag">${num}</span><h3>${title}</h3></div>
          <p>${desc}</p>
        </div>`
  ).join("");

  const stats = s.stats
    .map(([val, label]) => `<div class="stat"><strong>${val}</strong><span>${label}</span></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${s.meta}" />
  <title>${s.title} | CyberNexa Solutions</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

  <link rel="stylesheet" href="../css/style.css" />
</head>
<body>

  <!-- ============ NAVBAR ============ -->
  <header class="navbar scrolled" id="navbar">
    <div class="container nav-inner">
      <a href="../" class="logo">
        <span class="logo-mark">◆</span>
        <span class="logo-text">Cyber<span class="accent">Nexa</span></span>
      </a>

      <nav class="nav-links" id="navLinks">
        <a href="../">Home</a>

        <div class="dropdown open">
          <button class="drop-btn" type="button">Services </button>
          <div class="dropdown-menu">
            <a href="/services/managed-it-operations">Managed IT Operations</a>
            <a href="/services/cloud-infrastructure">Cloud &amp; Infrastructure</a>
            <a href="/services/cybersecurity">Managed Cybersecurity</a>
            <a href="/services/software-development">Software House</a>
            <a href="/services/it-training">IT Training Academy</a>
            <a href="/services/digital-agency">Digital Agency</a>
          </div>
        </div>

        <div class="dropdown">
          <button class="drop-btn" type="button">Industries </button>
          <div class="dropdown-menu">
            <a href="/industries#health">Health Care</a>
            <a href="/industries#finance">Finance</a>
            <a href="/industries#retail">Retail</a>
            <a href="/industries#legal">Legal</a>
            <a href="/industries#education">Higher Education</a>
          </div>
        </div>

        <div class="dropdown">           <button class="drop-btn" type="button">Courses </button>           <div class="dropdown-menu">             <a href="/courses#cybersecurity">Cybersecurity</a>             <a href="/courses#networking">Networking</a>             <a href="/courses#devops">DevOps</a>             <a href="/courses#linux">Linux &amp; Unix</a>             <a href="/courses#cloud">Cloud Computing</a>             <a href="/courses#sysadmin">System Administration</a>             <a href="/courses#marketing">Digital Marketing</a>             <a href="/courses#programming">Programming</a>             <a href="/courses#designing">Designing</a>             <a href="/courses"><strong>All Courses</strong></a>           </div>         </div> 
        <div class="dropdown">
          <button class="drop-btn" type="button">Company </button>
          <div class="dropdown-menu">
            <a href="/about">About Us</a>
            <a href="/#training">Training</a>
            <a href="/#contact">Contact</a>
          </div>
        </div>

        <a href="/#contact" class="btn btn-small">Talk to an Expert</a>
      </nav>

      <button class="hamburger" id="hamburger" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <!-- ============ SERVICE HERO ============ -->
  <section class="hero hero-short" id="home">
    <div class="hero-glow"></div>
    <div class="hero-grid"></div>

    <div class="container hero-content">
      <a href="/#contact" class="btn btn-ghost reveal">💬 ${s.heroBtn}</a>
      <h1 class="reveal delay-1" style="margin-top: 26px;">
        ${s.h1a}<br />
        <span class="gradient-text">${s.h1b}</span>
      </h1>
      <p class="hero-sub reveal delay-2">${s.desc}</p>
    </div>
  </section>

  <!-- ============ WHAT WE DELIVER ============ -->
  <section class="section" id="services">
    <div class="container">
      <div class="section-head reveal">
        <span class="eyebrow">${s.s1Eyebrow}</span>
        <h2>${s.s1TitleA} <span class="gradient-text">${s.s1TitleB}</span></h2>
        <p>${s.s1Desc}</p>
      </div>

      <div class="cards-grid">${cards}
      </div>
    </div>
  </section>

  <!-- ============ WHY CHOOSE US ============ -->
  <section class="section section-alt" id="why">
    <div class="container">
      <div class="section-head reveal">
        <span class="eyebrow">Why Choose CyberNexa?</span>
        <h2>A Strategic IT Partner, <span class="gradient-text">Not Just a Service Provider</span></h2>
        <p>Proactive management, enterprise expertise and security-first operations — reduce complexity, control costs and accelerate growth.</p>
      </div>

      <div class="course-grid">${why}
      </div>

      <div style="text-align:center; margin-top: 46px;" class="reveal">
        <a href="/#contact" class="btn btn-primary">Schedule Technical Consultation</a>
      </div>
    </div>
  </section>

  <!-- ============ STATS BAND ============ -->
  <section class="section" id="stats">
    <div class="container">
      <div class="section-head reveal">
        <span class="eyebrow">By The Numbers</span>
        <h2>Results That <span class="gradient-text">Speak For Themselves</span></h2>
        <p>Measurable outcomes from real engagements — the numbers behind our service promise.</p>
      </div>

      <div class="hero-stats stats-3 reveal">${stats}
      </div>
    </div>
  </section>

  <!-- ============ CTA ============ -->
  <section class="cta-band" id="contact">
    <div class="container cta-inner reveal">
      <div class="cta-text">
        <h2>${s.ctaTitle}</h2>
        <p>${s.ctaDesc}</p>
      </div>
      <div class="cta-actions">
        <a href="mailto:umair799283@gmail.com" class="btn btn-primary btn-lg">✉️ umair799283@gmail.com</a>
        <a href="tel:+923237469306" class="btn btn-ghost btn-lg">📞 +92 323 7469306</a>
      </div>
    </div>
  </section>

  <!-- ============ FOOTER ============ -->
  <footer class="footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="../" class="logo">
          <span class="logo-mark">◆</span>
          <span class="logo-text">Cyber<span class="accent">Nexa</span></span>
        </a>
        <p>Your trusted technology partner — delivering secure, scalable IT solutions that simplify operations and empower growth.</p>
        <div class="socials">
          <a href="#" aria-label="Facebook">ⓕ</a>
          <a href="#" aria-label="Instagram">◎</a>
          <a href="#" aria-label="X / Twitter">𝕏</a>
          <a href="#" aria-label="LinkedIn">in</a>
        </div>
      </div>

      <div class="footer-col">
        <h4>Sitemap</h4>
        <a href="../">Home</a>
        <a href="/#services">Services</a>
        <a href="/industries">Industries</a>
        <a href="/courses">Courses</a>
        <a href="/about">About</a>
        <a href="/legal">Legal</a>
      </div>

      <div class="footer-col">
        <h4>Services</h4>
        <a href="/services/managed-it-operations">Managed IT Operations</a>
        <a href="/services/cloud-infrastructure">Cloud &amp; Infrastructure</a>
        <a href="/services/cybersecurity">Managed Cybersecurity</a>
        <a href="/services/it-training">IT Training Academy</a>
      </div>

      <div class="footer-col">
        <h4>Contact</h4>
        <a href="mailto:umair799283@gmail.com">umair799283@gmail.com</a>
        <a href="tel:+923237469306">+92 323 7469306</a>
        <span class="footer-addr">Your City, Your Country</span>
      </div>
    </div>

    <div class="container footer-bottom">
      <span>© <span id="year">2026</span> CyberNexa Solutions. All rights reserved. | <a href="/legal" style="color:var(--muted)">Legal</a></span>
      <span class="footer-tag">MANAGED · MODERN · SECURE</span>
    </div>
  </footer>

  <script src="../js/script.js"></script>
</body>
</html>
`;
}

const outDir = path.join(__dirname, "..", "services");
fs.mkdirSync(outDir, { recursive: true });

for (const s of services) {
  const file = path.join(outDir, `${s.slug}.html`);
  fs.writeFileSync(file, page(s), "utf-8");
  console.log(`✅ Generated: services/${s.slug}.html`);
}

console.log("Done — 5 service pages generated.");
