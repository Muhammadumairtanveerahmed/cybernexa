import courses from "./courses.json";

export const brand = {
  name: "TechNexa",
  tagline: "Managed · Modern · Secure",
  email: "umair799283@gmail.com",
  phone: "+92-323-7469306",
  phoneHref: "tel:+923237469306",
  whatsapp: "https://wa.me/923237469306",
  address: "Pakistan · Serving clients worldwide"
};

export const navMenus = [
  {
    label: "Services",
    links: [
      { label: "Managed IT Operations", to: "/services/managed-it-operations" },
      { label: "Cloud & Infrastructure", to: "/services/cloud-infrastructure" },
      { label: "Managed Cybersecurity", to: "/services/cybersecurity" },
      { label: "Software House", to: "/services/software-development" },
      { label: "IT Training Academy", to: "/services/it-training" },
      { label: "Digital Agency", to: "/services/digital-agency" }
    ]
  },
  {
    label: "Industries",
    links: [
      { label: "Health Care", to: "/industries#health" },
      { label: "Finance", to: "/industries#finance" },
      { label: "Retail", to: "/industries#retail" },
      { label: "Legal", to: "/industries#legal" },
      { label: "Higher Education", to: "/industries#education" }
    ]
  },
  {
    label: "Courses",
    links: [
      { label: "Cybersecurity", to: "/courses#cybersecurity" },
      { label: "Networking", to: "/courses#networking" },
      { label: "DevOps", to: "/courses#devops" },
      { label: "Linux & Unix", to: "/courses#linux" },
      { label: "Cloud Computing", to: "/courses#cloud" },
      { label: "System Administration", to: "/courses#sysadmin" },
      { label: "Digital Marketing", to: "/courses#marketing" },
      { label: "Programming", to: "/courses#programming" },
      { label: "Designing", to: "/courses#designing" },
      { label: "All Courses", to: "/courses" }
    ]
  },
  {
    label: "Company",
    links: [
      { label: "About Us", to: "/about" },
      { label: "Training", to: "/#training" },
      { label: "Contact", to: "/#contact" }
    ]
  }
];

export const services = [
  {
    title: "Managed Cybersecurity",
    to: "/services/cybersecurity",
    icon: "fa-shield-halved",
    color: "violet",
    text: "24x7 SOC monitoring, penetration testing and incident response that keeps your business audit-ready."
  },
  {
    title: "Cloud & Infrastructure",
    to: "/services/cloud-infrastructure",
    icon: "fa-cloud",
    color: "indigo",
    text: "Migration, optimization and managed cloud operations on AWS, Azure and hybrid environments."
  },
  {
    title: "Software House",
    to: "/services/software-development",
    icon: "fa-laptop-code",
    color: "cyan",
    text: "Custom web apps, mobile apps, APIs and enterprise software engineered to last."
  },
  {
    title: "Managed IT Operations",
    to: "/services/managed-it-operations",
    icon: "fa-gear",
    color: "pink",
    text: "24x7 helpdesk, endpoint management, monitoring, backup and disaster recovery."
  },
  {
    title: "IT Training Academy",
    to: "/services/it-training",
    icon: "fa-graduation-cap",
    color: "orange",
    text: "Hands-on cybersecurity, cloud, development and networking courses with labs and certification prep."
  },
  {
    title: "Digital Agency",
    to: "/services/digital-agency",
    icon: "fa-palette",
    color: "green",
    text: "Brand identity, UI/UX, SEO and performance marketing that turns visitors into customers."
  }
];

export const stats = [
  { value: 8, suffix: "+", label: "Years Experience" },
  { value: 250, suffix: "+", label: "Projects Delivered" },
  { value: 120, suffix: "+", label: "Students Trained" },
  { value: 24, suffix: "/7", label: "Support" }
];

export const process = [
  {
    num: "01",
    title: "Assess",
    tagline: "Understand · Evaluate · Strategize",
    text: "We audit your current environment, identify risks and map the fastest path to a stable, secure foundation."
  },
  {
    num: "02",
    title: "Deploy",
    tagline: "Implement · Integrate · Optimize",
    text: "Our engineers build, migrate and integrate the right stack with minimal disruption to your team."
  },
  {
    num: "03",
    title: "Manage",
    tagline: "Monitor · Secure · Evolve",
    text: "We monitor around the clock, patch proactively and keep improving as your business grows."
  }
];

export const aboutChecklist = [
  "CISSP, AWS and CEH certified engineers",
  "24x7 monitoring and response",
  "Vendor-neutral technology advice",
  "Transparent, predictable pricing",
  "Local presence with global standards"
];

export const divisions = [
  {
    title: "TechNexa Solutions",
    to: "/services/managed-it-operations",
    color: "violet",
    icon: "fa-shield-halved",
    text: "Managed IT, cybersecurity and cloud operations for growing businesses."
  },
  {
    title: "TechNexa Trainings",
    to: "/services/it-training",
    color: "cyan",
    icon: "fa-graduation-cap",
    text: "Career-focused IT training with labs, projects and certification preparation."
  },
  {
    title: "TechNexa Digital",
    to: "/services/digital-agency",
    color: "pink",
    icon: "fa-palette",
    text: "Brand, design and performance marketing for the digital-first economy."
  }
];

export const certifications = [
  { name: "CEH", sub: "Ethical Hacking" },
  { name: "CompTIA", sub: "Security+ / Network+" },
  { name: "AWS", sub: "Cloud Practitioner" },
  { name: "Microsoft", sub: "Azure & M365" },
  { name: "Cisco", sub: "CCNA / CCNP" },
  { name: "Linux", sub: "RHCSA / RHCE" },
  { name: "Kubernetes", sub: "CKA / CKAD" },
  { name: "ISO 27001", sub: "Security Management" }
];

export const testimonials = [
  {
    quote:
      "TechNexa rebuilt our network security from scratch. Zero incidents in 14 months and our audit passed the first time.",
    name: "Ahmed Khan",
    role: "IT Manager · Logistics Company, Lahore",
    initials: "AK"
  },
  {
    quote:
      "Their cloud migration cut our monthly infrastructure cost by 38% and gave us room to scale without hiring a bigger team.",
    name: "Sara Fatima",
    role: "Operations Lead · E-commerce Startup",
    initials: "SF"
  },
  {
    quote:
      "I finished the CEH training and passed on my first attempt. The labs felt like real incident response work.",
    name: "Muhammad Hassan",
    role: "Security Analyst · Training Graduate",
    initials: "MH"
  }
];

export const faqs = [
  {
    q: "Do you provide on-site support?",
    a: "Yes. We support businesses on-site in Lahore and remotely across Pakistan and international clients."
  },
  {
    q: "How do I enroll in a course?",
    a: "Choose a course, click Enroll Now and submit the form with your CNIC, photo and payment receipt. The academy fee is PKR 20,000 and installments are available on request."
  },
  {
    q: "Are classes online or on-site?",
    a: "Both. You can join instructor-led online classes or attend on-site sessions at our campus. Labs and projects are included."
  },
  {
    q: "Do you offer a free consultation?",
    a: "Yes. Book a free 30-minute consultation and we will review your current setup, risks and next steps."
  },
  {
    q: "How fast do you respond to incidents?",
    a: "Critical security incidents are acknowledged within 30 minutes. Standard support requests are handled the same business day."
  },
  {
    q: "Which industries do you serve?",
    a: "Health care, finance, retail, legal, higher education and technology companies. We adapt controls and workflows to each sector."
  }
];

export const industries = [
  {
    id: "health",
    tag: "Health Care",
    title: "Secure & Compliant Health IT",
    icon: "fa-hospital",
    text: "HIPAA-aware infrastructure, EHR/EMR integration, device networking and 24x7 uptime for patient-critical systems.",
    meta: ["EHR Integration", "Data Privacy", "Zero Downtime"]
  },
  {
    id: "finance",
    tag: "Finance",
    title: "Bank-Grade Security & Controls",
    icon: "fa-credit-card",
    text: "PCI-DSS aligned controls, fraud monitoring and audit-ready reporting for banks, fintechs and insurance teams.",
    meta: ["PCI-DSS", "Fraud Monitoring", "Audit Ready"]
  },
  {
    id: "retail",
    tag: "Retail",
    title: "Omnichannel & POS Reliability",
    icon: "fa-bag-shopping",
    text: "E-commerce platforms, POS support and peak-season scaling that keep every store and channel selling.",
    meta: ["E-Commerce", "POS Support", "Peak Scaling"]
  },
  {
    id: "legal",
    tag: "Legal",
    title: "Confidential By Design",
    icon: "fa-scale-balanced",
    text: "Document management, encryption and retention workflows built for privileged client communication.",
    meta: ["DMS Setup", "Encryption", "Retention"]
  },
  {
    id: "education",
    tag: "Higher Education",
    title: "Campus-Ready Digital Infrastructure",
    icon: "fa-graduation-cap",
    text: "LMS platforms, campus networks and student-data protection for universities and training institutes.",
    meta: ["LMS", "Campus Networks", "Student Data"]
  }
];

export const servicePages = {
  "managed-it-operations": {
    badge: "Managed IT Operations",
    heroButton: "Speak with an Engineer",
    heroTitle: "Proactive IT Operations That",
    heroAccent: "Keep Your Business Running",
    heroSub:
      "24x7 helpdesk, endpoint management, monitoring, backup and disaster recovery — delivered as a predictable service.",
    sectionEyebrow: "What We Manage",
    sectionTitle: "Comprehensive IT Operations,",
    sectionAccent: "Delivered as a Service",
    cards: [
      { title: "End User Support", icon: "fa-headset", color: "violet", text: "Fast, friendly helpdesk support for every employee and device." },
      { title: "Endpoint Management", icon: "fa-laptop-code", color: "indigo", text: "Standardized, patched and protected laptops, desktops and mobile devices." },
      { title: "Infrastructure Management", icon: "fa-desktop", color: "cyan", text: "Servers, networks and virtualization managed with clear SLAs." },
      { title: "Monitoring & Maintenance", icon: "fa-chart-column", color: "pink", text: "Proactive monitoring, patching and capacity planning." },
      { title: "Backup & Disaster Recovery", icon: "fa-floppy-disk", color: "orange", text: "Tested backups and recovery plans that protect business continuity." },
      { title: "IT Asset Lifecycle", icon: "fa-box", color: "green", text: "Procurement, deployment, tracking and secure retirement of IT assets." }
    ],
    stats: [
      { value: "15 min", label: "Critical Response SLA" },
      { value: "99%", label: "Infrastructure Availability" },
      { value: "24x7x365", label: "Proactive Monitoring" }
    ],
    ctaTitle: "Ready to Modernize Your IT?",
    ctaText: "Strengthen security, reduce downtime and let your team focus on business while we run your IT."
  },
  cybersecurity: {
    badge: "Managed Cybersecurity",
    heroButton: "Speak with a Security Engineer",
    heroTitle: "Cybersecurity That",
    heroAccent: "Protects What Matters Most",
    heroSub:
      "24x7 SOC monitoring, penetration testing, incident response and compliance support for a threat landscape that never sleeps.",
    sectionEyebrow: "What We Protect",
    sectionTitle: "Complete Security Coverage,",
    sectionAccent: "Delivered as a Service",
    cards: [
      { title: "24x7 SOC Monitoring", icon: "fa-lock", color: "violet", text: "Continuous detection and response across endpoints, identity and cloud." },
      { title: "Penetration Testing", icon: "fa-bullseye", color: "indigo", text: "Real-world attack simulations with prioritized remediation guidance." },
      { title: "Incident Response", icon: "fa-triangle-exclamation", color: "cyan", text: "Containment, investigation and recovery when every minute matters." },
      { title: "Governance & Compliance", icon: "fa-clipboard-list", color: "pink", text: "ISO 27001, PCI-DSS and audit-ready controls and evidence." },
      { title: "Identity & Access", icon: "fa-key", color: "orange", text: "MFA, least privilege and identity lifecycle management." },
      { title: "Security Awareness", icon: "fa-brain", color: "green", text: "Phishing simulations and training that change employee behavior." }
    ],
    stats: [
      { value: "< 15 min", label: "Incident Response SLA" },
      { value: "24x7", label: "SOC Coverage" },
      { value: "100%", label: "Audit Support" }
    ],
    ctaTitle: "How Secure Is Your Business Today?",
    ctaText: "Book a free security assessment and get a clear, prioritized remediation plan."
  },
  "cloud-infrastructure": {
    badge: "Cloud & Infrastructure",
    heroButton: "Talk to a Cloud Engineer",
    heroTitle: "Cloud & Infrastructure That",
    heroAccent: "Scales With Your Business",
    heroSub:
      "Migration, landing zones, cost optimization and managed cloud operations on AWS, Azure and hybrid environments.",
    sectionEyebrow: "What We Deliver",
    sectionTitle: "End-to-End Cloud Services,",
    sectionAccent: "Built for Scale",
    cards: [
      { title: "Cloud Migration", icon: "fa-cloud", color: "violet", text: "Assessment, migration waves and cutover plans with minimal downtime." },
      { title: "Landing Zone & Architecture", icon: "fa-helmet-safety", color: "indigo", text: "Secure, scalable foundations for every workload." },
      { title: "Cost Optimization", icon: "fa-gear", color: "cyan", text: "Right-sizing, reserved capacity and waste elimination." },
      { title: "Managed Cloud Operations", icon: "fa-screwdriver-wrench", color: "pink", text: "24x7 operations, patching and incident response." },
      { title: "Hybrid & Networking", icon: "fa-link", color: "orange", text: "Connectivity, VPN, DNS and multi-cloud networking." },
      { title: "Cloud Security", icon: "fa-shield-halved", color: "green", text: "Guardrails, identity, encryption and continuous compliance." }
    ],
    stats: [
      { value: "99.95%", label: "Uptime SLA" },
      { value: "30%", label: "Avg. Cost Saved" },
      { value: "24x7", label: "Cloud NOC" }
    ],
    ctaTitle: "Ready to Move to the Cloud?",
    ctaText: "Get a free architecture review and a practical migration roadmap."
  },
  "software-development": {
    badge: "Software House",
    heroButton: "Start Your Project",
    heroTitle: "Custom Software That",
    heroAccent: "Powers Your Digital Growth",
    heroSub:
      "Web apps, mobile apps, APIs and enterprise software built with clean architecture, testing and long-term support.",
    sectionEyebrow: "What We Build",
    sectionTitle: "Software Solutions,",
    sectionAccent: "Engineered to Last",
    cards: [
      { title: "Web Applications", icon: "fa-globe", color: "violet", text: "Fast, accessible React and server-rendered applications." },
      { title: "Mobile Apps", icon: "fa-mobile-screen-button", color: "indigo", text: "iOS and Android experiences from one maintainable codebase." },
      { title: "API Development", icon: "fa-plug", color: "cyan", text: "Secure REST and real-time APIs with clear documentation." },
      { title: "E-Commerce", icon: "fa-cart-shopping", color: "pink", text: "Storefronts, payments, inventory and order operations." },
      { title: "Enterprise Software", icon: "fa-puzzle-piece", color: "orange", text: "Workflow, reporting and integration platforms for growing teams." },
      { title: "Legacy Modernization", icon: "fa-rotate", color: "green", text: "Incremental upgrades without risky big-bang rewrites." }
    ],
    stats: [
      { value: "250+", label: "Projects Delivered" },
      { value: "40+", label: "Technologies" },
      { value: "98%", label: "On-Time Delivery" }
    ],
    ctaTitle: "Have an Idea to Build?",
    ctaText: "Tell us the problem and get a free estimate within 48 hours."
  },
  "it-training": {
    badge: "IT Training Academy",
    heroButton: "Explore Courses",
    heroTitle: "IT Training That",
    heroAccent: "Builds Real Careers",
    heroSub:
      "Hands-on cybersecurity, cloud, development and networking courses with labs, projects and certification preparation.",
    sectionEyebrow: "What We Teach",
    sectionTitle: "Courses for Every",
    sectionAccent: "IT Career Path",
    cards: [
      { title: "Cybersecurity", icon: "fa-shield-halved", color: "violet", text: "CEH, CISSP, penetration testing and SOC operations." },
      { title: "Development", icon: "fa-laptop-code", color: "indigo", text: "Web, mobile, APIs and modern JavaScript." },
      { title: "Cloud & DevOps", icon: "fa-cloud", color: "cyan", text: "AWS, Azure, Docker, Kubernetes and CI/CD." },
      { title: "Networking", icon: "fa-globe", color: "pink", text: "CCNA, CCNP, routing, switching and security." },
      { title: "Certification Prep", icon: "fa-scroll", color: "orange", text: "Exam-focused labs, mock tests and study plans." },
      { title: "Corporate Training", icon: "fa-building", color: "green", text: "Custom upskilling programs for teams." }
    ],
    stats: [
      { value: "120+", label: "Students Trained" },
      { value: "10+", label: "Courses" },
      { value: "95%", label: "Completion Rate" }
    ],
    ctaTitle: "Ready to Start Learning?",
    ctaText: "Talk to a counselor and choose the right course for your career goal."
  },
  "digital-agency": {
    badge: "Digital Agency",
    heroButton: "Talk to a Strategist",
    heroTitle: "Digital Experiences That",
    heroAccent: "Turn Visitors Into Customers",
    heroSub:
      "Brand identity, UI/UX, SEO, social media and performance marketing with measurable business outcomes.",
    sectionEyebrow: "What We Do",
    sectionTitle: "Creative & Marketing,",
    sectionAccent: "Measurable Results",
    cards: [
      { title: "Brand Identity", icon: "fa-palette", color: "violet", text: "Positioning, visual systems and brand guidelines." },
      { title: "UI/UX Design", icon: "fa-paintbrush", color: "indigo", text: "Research-led interfaces that convert and retain." },
      { title: "SEO", icon: "fa-magnifying-glass", color: "cyan", text: "Technical SEO, content strategy and authority building." },
      { title: "Social Media", icon: "fa-bullhorn", color: "pink", text: "Content calendars, community and campaign management." },
      { title: "Performance Marketing", icon: "fa-chart-line", color: "orange", text: "Paid search and social with clear ROI reporting." },
      { title: "Content Creation", icon: "fa-pen-nib", color: "green", text: "Copy, video and design assets for every channel." }
    ],
    stats: [
      { value: "150+", label: "Projects Launched" },
      { value: "3x", label: "Average ROI" },
      { value: "14 Days", label: "First Results" }
    ],
    ctaTitle: "Ready to Grow Online?",
    ctaText: "Get a free digital audit and a 90-day growth plan."
  }
};

export const whyChooseCards = [
  { num: "01", title: "Security-First Operations", text: "Every engagement starts with risk, identity and data protection." },
  { num: "02", title: "Cloud & Hybrid Expertise", text: "AWS, Azure and hybrid architectures designed for scale." },
  { num: "03", title: "24x7 Monitoring", text: "Around-the-clock visibility with clear escalation paths." },
  { num: "04", title: "Certified Engineers", text: "CISSP, CEH, AWS, Cisco and Linux certified specialists." },
  { num: "05", title: "Continuous Optimization", text: "We measure, tune and improve every month." },
  { num: "06", title: "Scalable Partnership", text: "Flexible support that grows with your business." }
];

export const categoryMeta = [
  { slug: "cybersecurity", name: "Cybersecurity", icon: "fa-shield-halved", blurb: "Defensive and offensive security skills for modern SOC and red-team roles." },
  { slug: "networking", name: "Networking", icon: "fa-network-wired", blurb: "Routing, switching and network security from CCNA to CCNP." },
  { slug: "devops", name: "DevOps", icon: "fa-infinity", blurb: "CI/CD, containers, Kubernetes and platform engineering." },
  { slug: "linux", name: "Linux & Unix", icon: "fa-terminal", blurb: "Administration, scripting and hardening for production systems." },
  { slug: "cloud", name: "Cloud Computing", icon: "fa-cloud", blurb: "AWS, Azure and cloud architecture with hands-on labs." },
  { slug: "sysadmin", name: "System Administration", icon: "fa-server", blurb: "Windows, Linux and infrastructure operations." },
  { slug: "marketing", name: "Digital Marketing", icon: "fa-bullhorn", blurb: "SEO, social and performance marketing that drives revenue." },
  { slug: "programming", name: "Programming", icon: "fa-code", blurb: "Web, mobile and backend development with modern tools." },
  { slug: "designing", name: "Designing", icon: "fa-palette", blurb: "UI/UX, graphic design and brand systems." }
];

export const allCourses = courses;
