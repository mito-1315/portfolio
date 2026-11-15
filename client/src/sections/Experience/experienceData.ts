export type ExperienceKind = "vision" | "data" | "cloud" | "held";

export type Contribution = {
  /** Optional name, e.g. a product built during the role. */
  title?: string;
  text: string;
};

export type Chapter = {
  id: string;
  numeral: string;
  kind: ExperienceKind;
  company: string;
  role: string;
  location?: string;
  period?: string;
  /** One-line framing of the chapter. */
  summary: string;
  contributions: Contribution[];
  /** Short focus tags shown under the contributions. */
  focus: string[];
  milestone?: boolean;
  /** Pitch played when the chapter comes into view. */
  pitch: string;
};

/**
 * Source of truth: the author's resume (23 June version), oldest chapter
 * first so the journey reads as progression. Dates are month–year as written.
 */
export const chapters: Chapter[] = [
  {
    id: "wedigistudio",
    numeral: "I",
    kind: "vision",
    company: "WeDigiStudio",
    role: "Computer Vision Intern",
    location: "Chennai, Tamil Nadu",
    period: "March 2025 – May 2025",
    summary:
      "My first step into applied machine learning: driver monitoring and safety-related systems across embedded hardware and machine learning, from preparing data to shrinking models to run at the edge.",
    contributions: [
      { text: "Annotated and reviewed a dataset of 50,000 images using Roboflow." },
      { text: "Trained quantized models using EdgeAI TensorLab." },
      { text: "Worked with a mentor to optimise model size and accuracy." },
    ],
    focus: [
      "Computer vision",
      "Dataset preparation",
      "Model training",
      "Edge-AI optimisation",
    ],
    pitch: "C5",
  },
  {
    id: "rentmachi",
    numeral: "II",
    kind: "data",
    company: "RentMachi",
    role: "Backend Developer",
    location: "Chennai, Tamil Nadu",
    period: "June 2025 – October 2025",
    summary:
      "Building a backend from the ground up, together with a three-member team and the CTO.",
    contributions: [
      {
        text: "Built the backend architecture from scratch with a three-member team and the CTO, using Node.js and Express.js.",
      },
      { text: "Developed server logic and optimised database performance." },
      {
        text: "Worked on scalability, security and efficiency across backend systems.",
      },
    ],
    focus: ["Node.js", "Express.js", "Team collaboration", "Scalability", "Security"],
    pitch: "E5",
  },
  {
    id: "firstsource",
    numeral: "III",
    kind: "cloud",
    company: "Firstsource",
    role: "Backend Developer Intern",
    location: "Chennai, Tamil Nadu",
    period: "December 2025 – May 2026",
    summary:
      "Two products built inside a professional IT environment, working remotely.",
    contributions: [
      {
        title: "Nervecentre",
        text: "An executive dashboard to monitor critical emails and chats, with intelligent filtering, Teams notifications and Microsoft Graph API integration.",
      },
      {
        title: "AskHR",
        text: "An AI-powered HR support system with Level 1 query handling, automated ticketing and SLA-based escalation workflows.",
      },
    ],
    focus: [
      "Microsoft Graph API",
      "Microsoft Teams",
      "Outlook",
      "Scrum",
      "Azure (basic)",
    ],
    pitch: "G5",
  },
  {
    id: "presidio",
    numeral: "IV",
    kind: "held",
    company: "Presidio",
    role: "Placement milestone",
    summary: "Selected for an opportunity at Presidio.",
    contributions: [],
    focus: [],
    milestone: true,
    pitch: "C6",
  },
];

/**
 * Prior work whose role title and dates are not confirmed yet. Shown as a
 * separate note, deliberately outside the dated timeline.
 */
export const untimedWork = {
  company: "BrakesIndia",
  title: "Driver Drowsiness Assistance System",
  summary:
    "A driver-safety system that detects risky driver behaviour and raises low, medium and high alerts, inside a broader fleet application.",
  detects: [
    "Driver distraction",
    "Mobile phone usage",
    "Smoking",
    "Eye closure",
    "Yawning",
  ],
  platform: [
    "Driver and owner logs",
    "GPS tracking",
    "Reports and alerts",
    "Driver video",
    "Subscription management",
    "Alert configuration",
    "OBD-related logs",
  ],
};

export const education = {
  degree: "Bachelor of Engineering in Computer Science",
  school: "Rajalakshmi Engineering College, Chennai, Tamil Nadu",
  detail: "Current CGPA 8.12 · Expected graduation May 2027",
  earlier: [
    "Higher Secondary (12th) · 9.38 CGPA · 2023",
    "Secondary (10th) · 9.07 CGPA · 2021",
  ],
};

export const professionalSummary: string[] = [
  "I'm a developer interested in building practical software systems that connect full-stack development, intelligent applications and hardware.",
  "My projects have let me explore different areas of engineering, from browser-based coding platforms and computer vision to smart parking, embedded AI and IoT-based agriculture.",
  "I enjoy understanding how systems work beneath the interface, connecting different technologies and turning ideas into functional applications.",
  "My approach to development is driven by curiosity, experimentation and the satisfaction of making an idea work in the real world.",
];
