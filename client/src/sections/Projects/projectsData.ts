export type ProjectKind = "farm" | "attendance" | "learning" | "parking";

export type Project = {
  id: string;
  numeral: string;
  kind: ProjectKind;
  title: string;
  subtitle: string;
  /** Short version shown on the score. */
  blurb: string;
  /** Longer story, one paragraph per entry (shown in the case file). */
  story: string[];
  features: string[];
  tech: string[];
  /** Architecture at a glance, taken from the project description. */
  flow: string[];
  contribution: string;
  /** Short motif played when the movement comes into view. */
  motif: string[];
  links: { label: string; href: string }[];
};

export const projects: Project[] = [
  {
    id: "mytuudle",
    numeral: "I",
    kind: "learning",
    title: "MyTuudle",
    subtitle: "A Java coding & learning platform",
    blurb:
      "A web-based coding and learning platform that makes programming practice more engaging, with an in-browser editor and a Java execution workflow.",
    story: [
      "MyTuudle brings together structured learning, coding exercises, an online code editor and a Java execution workflow, designed to make programming practice more engaging and accessible.",
      "I focused on connecting the frontend coding experience with backend services and code execution. An integrated Monaco Editor lets users write Java directly in the browser, while the backend handles application logic and communicates with the code-execution workflow.",
      "The project helped me explore the engineering challenges of an online coding platform, particularly code execution, backend integration, authentication and application architecture.",
    ],
    features: [
      "Browser-based Monaco code editor",
      "Java code compilation and execution workflow",
      "Learning content and coding exercises",
      "Backend APIs and database integration",
      "User authentication and application management",
    ],
    tech: ["React", "Node.js", "Express.js", "Supabase", "Monaco Editor", "Docker"],
    flow: ["Monaco editor", "Backend APIs", "Code execution", "Result"],
    contribution:
      "Full-stack development, backend integration, application architecture and the code-execution workflow.",
    motif: ["G5", "A5", "C6", "E6"],
    links: [
      { label: "Live application", href: "https://mytuudle.mitheshtharun.me" },
      { label: "GitHub", href: "https://github.com/mito-1315/mytuudle" },
    ],
  },
  {
    id: "parkit",
    numeral: "II",
    kind: "parking",
    title: "Parkit",
    subtitle: "Smart parking management system",
    blurb:
      "A connected parking system — mobile app, admin dashboard and central backend — replacing fragmented manual workflows with QR gates, slot allocation and live updates.",
    story: [
      "Parkit simplifies how parking facilities manage vehicles, parking slots, and entry and exit operations. The idea is to replace fragmented manual workflows with a connected system of a mobile application, an administrative dashboard and a central backend.",
      "The system includes QR-based gate workflows, parking sessions, slot allocation, vehicle management and real-time updates. Its architecture also includes camera and detection-related components.",
      "I developed it as a full-stack solution, focusing on how the mobile app, backend services, database and admin platform interact.",
    ],
    features: [
      "QR-based entry and exit workflows",
      "Parking session management",
      "Parking slot and zone management",
      "Vehicle and user management",
      "Administrative dashboard",
      "Real-time updates using Socket.IO",
      "Parking fee calculation and reporting",
      "Camera and detection-related service architecture",
    ],
    tech: [
      "Node.js",
      "Express.js",
      "TypeScript",
      "Prisma ORM",
      "PostgreSQL",
      "Socket.IO",
      "React",
      "Vite",
      "Flutter",
    ],
    flow: ["Mobile app", "Central backend", "Database", "Admin dashboard"],
    contribution:
      "Full-stack system development, backend architecture, API development, database integration and application workflows.",
    motif: ["A5", "C6", "E6", "A6"],
    links: [
      { label: "GitHub — Version 02", href: "https://github.com/mito-1315/parkit-v02" },
      { label: "GitHub — Version 01", href: "https://github.com/mito-1315/parkit-v01" },
    ],
  },
  {
    id: "smartsync",
    numeral: "III",
    kind: "attendance",
    title: "SmartSync Attendance",
    subtitle: "AI-powered face recognition attendance",
    blurb:
      "Upload classroom footage and get attendance back: faces are detected, students identified, and every record comes with visual evidence to verify.",
    story: [
      "SmartSync Attendance reduces the time and manual effort of classroom attendance. Instead of roll calls, teachers upload footage from CCTV or a smartphone. The system processes the video, detects faces, identifies students and generates attendance records with visual evidence for verification.",
      "It has an administrative portal for managing student information and training the recognition pipeline, and a teacher portal for uploading footage, reviewing results and exporting records.",
      "A key aspect is its asynchronous processing architecture: video processing runs independently while the frontend shows progress and results.",
    ],
    features: [
      "Classroom video upload",
      "Face detection and recognition",
      "Student registration and reference image management",
      "Automated attendance generation",
      "Visual face-crop evidence for verification",
      "Asynchronous video-processing workflow",
      "Attendance history and export",
      "Separate administrator and teacher portals",
    ],
    tech: [
      "React",
      "Vite",
      "Node.js",
      "Express.js",
      "MongoDB",
      "Python",
      "Flask",
      "YOLOv8-Face",
      "InsightFace",
      "ArcFace",
      "K-Nearest Neighbors",
    ],
    flow: ["Video upload", "Async processing", "Face recognition", "Attendance + evidence"],
    contribution:
      "Full-stack application development and integration of the computer-vision processing workflow with the backend and frontend.",
    motif: ["E5", "G5", "B5", "E6"],
    links: [{ label: "GitHub", href: "https://github.com/mito-1315/face-attendance" }],
  },
  {
    id: "uyir-mitra",
    numeral: "IV",
    kind: "farm",
    title: "Uyir Mitra",
    subtitle: "AI & IoT-based smart farming assistant",
    blurb:
      "A smart farming initiative that uses distributed sensor nodes, MQTT and dashboards to help farmers monitor crop conditions and make better decisions.",
    story: [
      "Uyir Mitra helps farmers monitor crop conditions and make better-informed agricultural decisions using IoT and intelligent analysis. The system explores a field-deployable architecture of distributed sensor nodes, environmental monitoring, data communication and dashboards.",
      "The broader concept is to help identify potential crop diseases, pest-related issues, nutrient deficiencies and irrigation requirements by analysing information collected from the field.",
      "The MVP connects backend services, a database, MQTT communication, firmware and multiple dashboards into one demonstration workflow.",
    ],
    features: [
      "Distributed smart farming node architecture",
      "Environmental and field-condition monitoring",
      "MQTT-based device communication",
      "Farmer administration dashboard",
      "Platform-level administration dashboard",
      "Alerts and node monitoring",
      "Simulation console connected to the backend decision pipeline",
      "Handheld node data and API integration",
    ],
    tech: [
      "IoT",
      "Embedded systems",
      "MQTT",
      "Node.js",
      "PostgreSQL",
      "Prisma",
      "Docker",
      "React dashboards",
      "Firmware",
    ],
    flow: ["Sensor nodes", "MQTT", "Backend + database", "Dashboards"],
    contribution:
      "System architecture, IoT and backend integration, dashboard workflows and development of the connected MVP.",
    motif: ["C5", "E5", "G5", "C6"],
    links: [{ label: "GitHub", href: "https://github.com/mito-1315/uyirmitra-v01" }],
  },
];
