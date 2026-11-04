import { clean } from "../utils/validation.js";

const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d"];
const LETTERS = ["a", "b", "c", "d"];

const TOPIC_SETS = {
  sql: [
    {
      question: "Which SQL clause is used to filter rows before grouping?",
      correct: "WHERE",
      wrong: ["HAVING", "ORDER BY", "LIMIT"]
    },
    {
      question: "What is the main purpose of an SQL JOIN?",
      correct: "Combine related rows from two or more tables",
      wrong: ["Encrypt the database", "Create a backup copy", "Delete duplicate tables"]
    },
    {
      question: "Which statement is true about a PRIMARY KEY?",
      correct: "It uniquely identifies each row in a table",
      wrong: ["It allows duplicate values", "It must always be a text column", "It can only be added after a JOIN"]
    },
    {
      question: "Which SQL command changes existing data in a table?",
      correct: "UPDATE",
      wrong: ["SELECT", "CREATE", "GRANT"]
    },
    {
      question: "What does GROUP BY do in a query?",
      correct: "Groups rows that share a value so aggregates can be calculated",
      wrong: ["Sorts the final result only", "Joins two databases", "Deletes grouped rows"]
    },
    {
      question: "Which index is most useful for speeding up lookups on a column?",
      correct: "A B-tree index on that column",
      wrong: ["A full table scan", "A foreign key constraint only", "A database dump"]
    },
    {
      question: "What is a transaction used for?",
      correct: "Treating several statements as one all-or-nothing unit",
      wrong: ["Formatting SQL output", "Creating a new user", "Compressing table data"]
    },
    {
      question: "Which JOIN returns only rows with matching values in both tables?",
      correct: "INNER JOIN",
      wrong: ["LEFT JOIN", "RIGHT JOIN", "FULL OUTER JOIN"]
    }
  ],
  react: [
    {
      question: "What is a React component?",
      correct: "A reusable piece of UI described in JavaScript or JSX",
      wrong: ["A database table", "A CSS preprocessor", "A network protocol"]
    },
    {
      question: "What are props in React?",
      correct: "Read-only values passed from a parent component",
      wrong: ["Mutable local state", "Browser cookies", "Server environment variables"]
    },
    {
      question: "Which hook stores local component state?",
      correct: "useState",
      wrong: ["useEffect", "useContext", "useRef"]
    },
    {
      question: "Why are keys important when rendering a list?",
      correct: "They help React identify which items changed",
      wrong: ["They style each list item", "They encrypt the list", "They make the list read-only"]
    },
    {
      question: "What does useEffect handle?",
      correct: "Side effects such as fetching data or subscriptions",
      wrong: ["Defining CSS classes", "Creating database tables", "Compiling JSX"]
    },
    {
      question: "What is the virtual DOM?",
      correct: "An in-memory representation React uses to update the real DOM efficiently",
      wrong: ["A browser extension", "A separate database", "A CSS layout engine"]
    },
    {
      question: "How does a child component send data back to its parent?",
      correct: "By calling a callback function passed through props",
      wrong: ["By editing the parent's state directly", "By writing to localStorage", "By changing the URL hash"]
    },
    {
      question: "Which syntax describes JSX?",
      correct: "HTML-like markup written inside JavaScript",
      wrong: ["A SQL query language", "A Python package manager", "A network routing table"]
    }
  ],
  javascript: [
    {
      question: "Which keyword creates a block-scoped variable that cannot be reassigned?",
      correct: "const",
      wrong: ["var", "let", "function"]
    },
    {
      question: "What does === compare?",
      correct: "Value and type without coercion",
      wrong: ["Value only with coercion", "Object references only", "Only strings"]
    },
    {
      question: "Which method creates a new array by transforming every item?",
      correct: "map",
      wrong: ["filter", "reduce", "find"]
    },
    {
      question: "What is a Promise used for?",
      correct: "Handling asynchronous operations",
      wrong: ["Styling HTML", "Declaring CSS variables", "Creating database indexes"]
    },
    {
      question: "What is a closure?",
      correct: "A function that keeps access to its lexical scope",
      wrong: ["A way to close the browser", "A CSS animation", "A database transaction"]
    },
    {
      question: "Which statement pauses an async function until a Promise settles?",
      correct: "await",
      wrong: ["yield", "return", "throw"]
    },
    {
      question: "What does the event loop do?",
      correct: "Coordinates queued callbacks with the call stack",
      wrong: ["Compiles JavaScript to machine code", "Stores cookies", "Creates HTML elements automatically"]
    },
    {
      question: "Which object represents the browser page in the DOM?",
      correct: "document",
      wrong: ["window.location", "navigator", "localStorage"]
    }
  ],
  networking: [
    {
      question: "What is the main role of a router?",
      correct: "Forward packets between different networks",
      wrong: ["Store web pages", "Encrypt user passwords", "Assign CSS styles"]
    },
    {
      question: "Which protocol translates domain names into IP addresses?",
      correct: "DNS",
      wrong: ["DHCP", "FTP", "SMTP"]
    },
    {
      question: "Which device forwards frames within the same LAN?",
      correct: "Switch",
      wrong: ["Router", "Firewall", "Modem"]
    },
    {
      question: "What does a subnet mask define?",
      correct: "Which part of an IP address identifies the network",
      wrong: ["The website name", "The router password", "The cable type"]
    },
    {
      question: "Which transport protocol is connection-oriented and reliable?",
      correct: "TCP",
      wrong: ["UDP", "ICMP", "ARP"]
    },
    {
      question: "What is VLAN used for?",
      correct: "Logically segmenting a physical network",
      wrong: ["Increasing monitor brightness", "Encrypting email", "Compressing images"]
    },
    {
      question: "Which OSI layer handles logical addressing and routing?",
      correct: "Network layer",
      wrong: ["Physical layer", "Data link layer", "Application layer"]
    },
    {
      question: "What does DHCP provide to clients?",
      correct: "IP configuration such as address, gateway and DNS",
      wrong: ["Web page content", "Email storage", "Firewall rules only"]
    }
  ],
  cybersecurity: [
    {
      question: "Which trio describes the CIA triad?",
      correct: "Confidentiality, Integrity and Availability",
      wrong: ["Control, Inspection and Auditing", "Cryptography, Identity and Access", "Compliance, Isolation and Authentication"]
    },
    {
      question: "What is phishing?",
      correct: "A social-engineering attack that tricks users into revealing information",
      wrong: ["A network cabling standard", "A database backup method", "A type of firewall rule"]
    },
    {
      question: "What does multi-factor authentication add?",
      correct: "A second independent verification factor",
      wrong: ["A second password field", "A public IP address", "A new user role"]
    },
    {
      question: "What is the principle of least privilege?",
      correct: "Grant only the access needed to perform a task",
      wrong: ["Give every user administrator rights", "Disable all logging", "Share one account across teams"]
    },
    {
      question: "What does a firewall do?",
      correct: "Filter network traffic according to security rules",
      wrong: ["Store backups", "Compile source code", "Assign IP addresses"]
    },
    {
      question: "Why should security patches be applied promptly?",
      correct: "They close known vulnerabilities that attackers can exploit",
      wrong: ["They make passwords optional", "They remove the need for backups", "They disable encryption"]
    },
    {
      question: "What is encryption mainly used for?",
      correct: "Protecting data confidentiality",
      wrong: ["Increasing disk capacity", "Speeding up every query", "Replacing authentication"]
    },
    {
      question: "What is an IDS designed to do?",
      correct: "Detect suspicious activity and raise alerts",
      wrong: ["Automatically delete all files", "Replace a router", "Create user accounts"]
    }
  ],
  docker: [
    {
      question: "What is a Docker image?",
      correct: "A read-only template used to create containers",
      wrong: ["A running virtual machine", "A database table", "A network cable"]
    },
    {
      question: "What is a Docker container?",
      correct: "A runnable isolated process created from an image",
      wrong: ["A source-code repository", "A physical server", "A DNS record"]
    },
    {
      question: "Which file defines how a Docker image is built?",
      correct: "Dockerfile",
      wrong: ["docker-compose.yml", "package.json", "index.html"]
    },
    {
      question: "What is a Docker volume used for?",
      correct: "Persisting data outside the container lifecycle",
      wrong: ["Increasing CPU speed", "Creating user accounts", "Routing network packets"]
    },
    {
      question: "What does Docker Compose manage?",
      correct: "Multi-container applications defined in YAML",
      wrong: ["Only single containers", "Kubernetes clusters", "Git branches"]
    },
    {
      question: "What is a container registry?",
      correct: "A repository for storing and distributing images",
      wrong: ["A firewall appliance", "A database index", "A monitoring dashboard"]
    },
    {
      question: "Why use multi-stage builds?",
      correct: "Keep final images small by separating build and runtime stages",
      wrong: ["Run multiple containers on one host", "Avoid using a Dockerfile", "Disable caching"]
    },
    {
      question: "Which command lists running containers?",
      correct: "docker ps",
      wrong: ["docker build", "docker pull", "docker login"]
    }
  ],
  kubernetes: [
    {
      question: "What is a Kubernetes Pod?",
      correct: "The smallest deployable unit, containing one or more containers",
      wrong: ["A physical server", "A database table", "A network switch"]
    },
    {
      question: "Which object exposes a stable network endpoint for Pods?",
      correct: "Service",
      wrong: ["ConfigMap", "Secret", "Namespace"]
    },
    {
      question: "What does a Deployment manage?",
      correct: "Replica sets and rolling updates for Pods",
      wrong: ["Only persistent volumes", "DNS records", "User passwords"]
    },
    {
      question: "What is a Namespace used for?",
      correct: "Dividing cluster resources between teams or environments",
      wrong: ["Encrypting Pod traffic", "Storing container images", "Compiling YAML"]
    },
    {
      question: "What does an Ingress provide?",
      correct: "HTTP routing into cluster services",
      wrong: ["Persistent disk storage", "Container image builds", "Node provisioning"]
    },
    {
      question: "Which object stores non-sensitive configuration?",
      correct: "ConfigMap",
      wrong: ["Secret", "ServiceAccount", "NetworkPolicy"]
    },
    {
      question: "What is a common reason for a Pod CrashLoopBackOff?",
      correct: "The container repeatedly starts and exits with an error",
      wrong: ["The node has too much memory", "The image is public", "The Service has no selector"]
    },
    {
      question: "Which command shows Pods in a namespace?",
      correct: "kubectl get pods -n <namespace>",
      wrong: ["kubectl apply -f", "kubectl delete node", "docker ps"]
    }
  ],
  linux: [
    {
      question: "Which command changes file permissions?",
      correct: "chmod",
      wrong: ["chown", "grep", "systemctl"]
    },
    {
      question: "What does systemctl manage?",
      correct: "systemd services and units",
      wrong: ["User passwords", "Disk partitions only", "Network cables"]
    },
    {
      question: "Which command searches text inside files?",
      correct: "grep",
      wrong: ["ls", "cd", "mkdir"]
    },
    {
      question: "What is cron used for?",
      correct: "Scheduling recurring tasks",
      wrong: ["Compiling C code", "Managing DNS", "Editing images"]
    },
    {
      question: "Which permission allows a user to execute a file?",
      correct: "x",
      wrong: ["r", "w", "s"]
    },
    {
      question: "What does SSH provide?",
      correct: "Encrypted remote shell access",
      wrong: ["Local file compression", "DNS resolution", "Web page rendering"]
    },
    {
      question: "Which command shows the current working directory?",
      correct: "pwd",
      wrong: ["ls", "cd", "touch"]
    },
    {
      question: "What is a package manager used for?",
      correct: "Installing, updating and removing software packages",
      wrong: ["Compiling the kernel only", "Managing monitor settings", "Creating VLANs"]
    }
  ],
  python: [
    {
      question: "Which data type stores an ordered, mutable collection?",
      correct: "list",
      wrong: ["tuple", "string", "frozenset"]
    },
    {
      question: "How do you define a function in Python?",
      correct: "def",
      wrong: ["function", "fn", "lambda"]
    },
    {
      question: "What is a dictionary?",
      correct: "A collection of key-value pairs",
      wrong: ["An ordered list of numbers", "A type of loop", "A file permission"]
    },
    {
      question: "Which statement handles exceptions?",
      correct: "try/except",
      wrong: ["if/else", "for/while", "with/as"]
    },
    {
      question: "What does a virtual environment isolate?",
      correct: "Project-specific Python packages",
      wrong: ["Network interfaces", "Operating-system users", "Database tables"]
    },
    {
      question: "Which library is commonly used for data analysis?",
      correct: "pandas",
      wrong: ["requests", "flask", "pygame"]
    },
    {
      question: "What is a list comprehension?",
      correct: "A concise way to build a list from an iterable",
      wrong: ["A way to import modules", "A database query", "A type of exception"]
    },
    {
      question: "Which keyword imports a module?",
      correct: "import",
      wrong: ["include", "require", "using"]
    }
  ],
  cloud: [
    {
      question: "Which cloud model provides virtual machines and storage?",
      correct: "IaaS",
      wrong: ["SaaS", "PaaS", "FaaS"]
    },
    {
      question: "What is an availability zone?",
      correct: "An isolated location within a cloud region",
      wrong: ["A type of database index", "A billing account", "A DNS record"]
    },
    {
      question: "What does IAM manage?",
      correct: "Identities and their permissions",
      wrong: ["Object storage buckets", "Virtual network cables", "Container images"]
    },
    {
      question: "Which service is used for scalable object storage?",
      correct: "Object storage such as S3 or OBS",
      wrong: ["A relational database", "A load balancer", "A DNS server"]
    },
    {
      question: "What is auto-scaling?",
      correct: "Automatically adjusting capacity based on demand",
      wrong: ["Manually resizing a disk", "Encrypting backups", "Creating user accounts"]
    },
    {
      question: "What is a VPC?",
      correct: "A logically isolated virtual network in the cloud",
      wrong: ["A physical data center", "A container registry", "A monitoring agent"]
    },
    {
      question: "Which model lets customers use software over the internet?",
      correct: "SaaS",
      wrong: ["IaaS", "PaaS", "On-premises"]
    },
    {
      question: "Why are regions important for cloud design?",
      correct: "They affect latency, compliance and disaster recovery",
      wrong: ["They determine the programming language", "They replace backups", "They remove the need for IAM"]
    }
  ],
  git: [
    {
      question: "What does git commit do?",
      correct: "Records a snapshot of staged changes",
      wrong: ["Uploads code to production", "Deletes the repository", "Creates a new branch"]
    },
    {
      question: "What is a branch in Git?",
      correct: "A movable pointer to a line of commits",
      wrong: ["A backup server", "A type of merge conflict", "A remote database"]
    },
    {
      question: "What does git pull do?",
      correct: "Fetches remote changes and integrates them",
      wrong: ["Deletes local changes", "Creates a new repository", "Publishes a package"]
    },
    {
      question: "What is a merge conflict?",
      correct: "When Git cannot automatically combine changes",
      wrong: ["When a branch is deleted", "When a commit is unsigned", "When a remote is unreachable"]
    },
    {
      question: "What is the purpose of a pull request?",
      correct: "Review and discuss changes before merging",
      wrong: ["Download a repository", "Delete a branch", "Configure DNS"]
    },
    {
      question: "What does git stash do?",
      correct: "Temporarily saves uncommitted changes",
      wrong: ["Permanently deletes commits", "Creates a remote", "Runs tests"]
    },
    {
      question: "What is the difference between merge and rebase?",
      correct: "Merge preserves history; rebase rewrites commits onto another base",
      wrong: ["They are identical", "Merge deletes history; rebase preserves it", "Rebase only works on remote branches"]
    },
    {
      question: "Which file tells Git what to ignore?",
      correct: ".gitignore",
      wrong: ["package.json", "README.md", "Dockerfile"]
    }
  ],
  devops: [
    {
      question: "What is CI?",
      correct: "Automatically building and testing changes",
      wrong: ["Manually deploying to production", "Creating database backups", "Writing documentation"]
    },
    {
      question: "What is infrastructure as code?",
      correct: "Managing infrastructure through versioned configuration files",
      wrong: ["Installing software by hand", "Writing application code only", "Using spreadsheets for servers"]
    },
    {
      question: "What is the purpose of a deployment pipeline?",
      correct: "Automate build, test and release steps",
      wrong: ["Replace source control", "Store user passwords", "Design user interfaces"]
    },
    {
      question: "Why is observability important?",
      correct: "It helps teams understand system health and diagnose issues",
      wrong: ["It makes code compile faster", "It removes the need for testing", "It encrypts databases"]
    },
    {
      question: "What is a rollback strategy?",
      correct: "A plan to restore the previous working version",
      wrong: ["A way to delete all logs", "A method for writing CSS", "A type of database index"]
    },
    {
      question: "What does a build artifact contain?",
      correct: "The packaged output produced by a build",
      wrong: ["Only source-code comments", "A DNS record", "A user password"]
    },
    {
      question: "What is blue-green deployment?",
      correct: "Running two environments and switching traffic between them",
      wrong: ["Deploying only at night", "Using two databases permanently", "A CSS color scheme"]
    },
    {
      question: "Which practice improves release reliability?",
      correct: "Automated testing and small, frequent changes",
      wrong: ["Large manual releases", "Disabling monitoring", "Skipping code review"]
    }
  ]
};

const GENERIC_QUESTIONS = [
  {
    question: "Which statement best describes {topic}?",
    correct: "It is a concept used to solve a specific set of technical problems",
    wrong: ["It is only a graphical design tool", "It replaces all security controls", "It is a type of network cable"]
  },
  {
    question: "What is the best first step when learning {topic}?",
    correct: "Understand the core concepts and practise with small examples",
    wrong: ["Memorise every command without context", "Skip the fundamentals", "Only read the glossary"]
  },
  {
    question: "Which practice helps verify knowledge of {topic}?",
    correct: "Applying it in a hands-on lab or project",
    wrong: ["Avoiding all practical work", "Copying answers without testing", "Ignoring feedback"]
  },
  {
    question: "Why is documentation important when working with {topic}?",
    correct: "It records decisions and helps others understand the work",
    wrong: ["It replaces testing", "It guarantees security", "It removes the need for backups"]
  },
  {
    question: "Which approach is most professional when troubleshooting {topic}?",
    correct: "Reproduce the issue, isolate the cause and verify the fix",
    wrong: ["Change random settings until it works", "Restart every service repeatedly", "Ignore the error message"]
  },
  {
    question: "What does a good {topic} solution prioritise?",
    correct: "Correctness, clarity and maintainability",
    wrong: ["Maximum complexity", "Hidden dependencies", "Unverified assumptions"]
  },
  {
    question: "Which habit improves quality when using {topic}?",
    correct: "Reviewing work and testing edge cases",
    wrong: ["Skipping validation", "Hard-coding secrets", "Removing all comments"]
  },
  {
    question: "What is a safe way to introduce {topic} into production?",
    correct: "Test in a controlled environment and roll out gradually",
    wrong: ["Deploy directly without a backup", "Disable logging first", "Make every change at once"]
  }
];

const TOPIC_KEYWORDS = [
  ["sql", ["sql", "database", "mysql", "query", "join", "normalization"]],
  ["react", ["react", "jsx", "component", "hook"]],
  ["javascript", ["javascript", "js", "node", "closure", "promise"]],
  ["networking", ["network", "ccna", "ccnp", "cisco", "routing", "subnet", "vlan"]],
  ["cybersecurity", ["security", "cyber", "ceh", "cissp", "pentest", "phishing", "hacking"]],
  ["docker", ["docker", "container", "image", "compose"]],
  ["kubernetes", ["kubernetes", "k8s", "pod", "cluster", "openshift"]],
  ["linux", ["linux", "unix", "bash", "shell", "red hat", "kali"]],
  ["python", ["python", "pandas", "django", "flask"]],
  ["cloud", ["cloud", "aws", "azure", "gcp", "huawei cloud", "iaas", "saas", "paas"]],
  ["git", ["git", "github", "version control", "branch", "commit"]],
  ["devops", ["devops", "ci/cd", "jenkins", "terraform", "ansible", "pipeline", "prometheus"]]
];

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hash(value) {
  let result = 0;
  for (const character of String(value || "")) {
    result = (result * 31 + character.charCodeAt(0)) >>> 0;
  }
  return result;
}

function topicKey(topic) {
  const lower = String(topic || "").toLowerCase();
  for (const [key, keywords] of TOPIC_KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return key;
  }
  return "generic";
}

function buildQuestion(template, topic, index) {
  const correct = template.correct.replaceAll("{topic}", topic);
  const wrong = template.wrong.map((option) => option.replaceAll("{topic}", topic));
  const options = [correct, ...wrong];

  // Rotate the correct answer so it is not always option A.
  const correctIndex = index % 4;
  const rotated = options.slice(1);
  rotated.splice(correctIndex, 0, correct);
  const finalOptions = rotated.slice(0, 4);
  while (finalOptions.length < 4) finalOptions.push(`None of the above`);

  return {
    question: template.question.replaceAll("{topic}", topic),
    option_a: finalOptions[0],
    option_b: finalOptions[1],
    option_c: finalOptions[2],
    option_d: finalOptions[3],
    correct: LETTERS[finalOptions.indexOf(correct)],
    marks: 1
  };
}

export function buildLocalQuestions(topic, count = 5) {
  const safeTopic = titleCase(clean(topic, 200)) || "this topic";
  const key = topicKey(safeTopic);
  const primary = key === "generic" ? GENERIC_QUESTIONS : TOPIC_SETS[key];
  const start = hash(safeTopic) % primary.length;
  const questions = [];

  for (let index = 0; index < count; index += 1) {
    const template =
      index < primary.length
        ? primary[(start + index) % primary.length]
        : GENERIC_QUESTIONS[(start + index) % GENERIC_QUESTIONS.length];
    questions.push(buildQuestion(template, safeTopic, index));
  }

  return questions;
}

function normalizeQuestion(raw, topic, index) {
  if (!raw || typeof raw !== "object") return null;
  const question = clean(raw.question || raw.title || raw.text, 2000);
  if (question.length < 5) return null;

  const options = OPTION_KEYS.map((key) => clean(raw[key], 400));
  if (options.filter(Boolean).length < 2) return null;

  // Fill missing options with safe placeholders so the quiz editor stays usable.
  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    if (!options[optionIndex]) options[optionIndex] = `Option ${LETTERS[optionIndex].toUpperCase()}`;
  }

  const rawCorrect = String(raw.correct ?? raw.answer ?? "a").trim().toLowerCase();
  let correct = rawCorrect.slice(0, 1);
  if (!LETTERS.includes(correct)) {
    const matched = options.findIndex((option) => option.toLowerCase() === rawCorrect);
    correct = LETTERS[matched >= 0 ? matched : index % 4];
  }

  return {
    question,
    option_a: options[0],
    option_b: options[1],
    option_c: options[2],
    option_d: options[3],
    correct,
    marks: Math.max(0.5, Number(raw.marks || 1))
  };
}

function parseJsonContent(content) {
  const text = String(content || "").trim();
  if (!text) return null;

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function requestGemini({ apiKey, model, topic, count }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You write multiple-choice exam questions for an IT training institute. Return strict JSON: { "questions": [{ "question": string, "option_a": string, "option_b": string, "option_c": string, "option_d": string, "correct": "a"|"b"|"c"|"d", "marks": number }] }. Do not add markdown or commentary.\n\nCreate exactly ${count} accurate multiple-choice questions about "${topic}" for a professional IT course. Vary the position of the correct answer.`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini returned ${response.status}: ${text.slice(0, 180)}`);
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseJsonContent(text);
    const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
    if (!Array.isArray(rawQuestions)) throw new Error("Gemini response did not contain a questions array");

    return rawQuestions
      .map((question, index) => normalizeQuestion(question, topic, index))
      .filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

async function requestOpenAI({ apiKey, model, topic, count }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.5,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write multiple-choice exam questions for an IT training institute. Return strict JSON: { \"questions\": [{ \"question\": string, \"option_a\": string, \"option_b\": string, \"option_c\": string, \"option_d\": string, \"correct\": \"a\"|\"b\"|\"c\"|\"d\", \"marks\": number }] }. Do not add markdown or commentary."
          },
          {
            role: "user",
            content: `Create exactly ${count} accurate multiple-choice questions about "${topic}" for a professional IT course. Vary the position of the correct answer.`
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI returned ${response.status}: ${text.slice(0, 180)}`);
    }

    const payload = await response.json();
    const parsed = parseJsonContent(payload.choices?.[0]?.message?.content);
    const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
    if (!Array.isArray(rawQuestions)) throw new Error("OpenAI response did not contain a questions array");

    return rawQuestions
      .map((question, index) => normalizeQuestion(question, topic, index))
      .filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateQuizQuestions({ topic, count, apiKey, model, geminiApiKey, geminiModel }) {
  const safeTopic = clean(topic, 200);
  const safeCount = Math.max(1, Math.min(10, Number(count) || 5));

  if (geminiApiKey) {
    try {
      const questions = await requestGemini({
        apiKey: geminiApiKey,
        model: geminiModel || "gemini-1.5-flash",
        topic: safeTopic,
        count: safeCount
      });

      if (questions.length) {
        return {
          questions: questions.slice(0, safeCount),
          source: "gemini",
          warning: ""
        };
      }
    } catch (error) {
      console.warn(`[quiz-generator] Gemini request failed, trying OpenAI: ${error.message}`);
    }
  }

  if (apiKey) {
    try {
      const questions = await requestOpenAI({
        apiKey,
        model: model || "gpt-4o-mini",
        topic: safeTopic,
        count: safeCount
      });

      if (questions.length) {
        return {
          questions: questions.slice(0, safeCount),
          source: "openai",
          warning: ""
        };
      }
    } catch (error) {
      console.warn(`[quiz-generator] OpenAI request failed, using built-in generator: ${error.message}`);
    }
  }

  return {
    questions: buildLocalQuestions(safeTopic, safeCount),
    source: "builtin",
    warning: geminiApiKey || apiKey
      ? "Live AI was unavailable, so TechNexa used its built-in question generator."
      : "Built-in question generator used. Add GEMINI_API_KEY or OPENAI_API_KEY to enable live AI generation."
  };
}
