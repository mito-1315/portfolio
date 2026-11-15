
export type Skill = {
  name: string;
  category: string;
  description: string;
  note: string;
};

export type SkillCategory = {
  name: string;
  skills: Skill[];
};

export const skillCategories: SkillCategory[] = [
  {
    name: "Languages",
    skills: [
      {
        name: "JavaScript",
        category: "Languages",
        description: "A versatile programming language I use to build interactive web applications and dynamic experiences.",
        note: "C5",
      },
      {
        name: "TypeScript",
        category: "Languages",
        description: "Adding type safety and structure to JavaScript applications, making larger codebases easier to maintain.",
        note: "D5",
      },
      {
        name: "Python",
        category: "Languages",
        description: "Used for backend development, automation, data processing and machine learning experiments.",
        note: "E5",
      },
      {
        name: "Java",
        category: "Languages",
        description: "Working with object-oriented programming, application development and problem-solving.",
        note: "G5",
      },
      {
        name: "C",
        category: "Languages",
        description: "Exploring low-level programming, memory concepts and embedded system fundamentals.",
        note: "A5",
      },
      {
        name: "R",
        category: "Languages",
        description: "A language for statistical computing, data analysis and experimentation.",
        note: "C6",
      },
    ],
  },
  {
    name: "Frontend",
    skills: [
      {
        name: "React",
        category: "Frontend",
        description: "Building component-driven user interfaces with reusable components and state-driven interactions.",
        note: "D5",
      },
      {
        name: "React Native",
        category: "Frontend",
        description: "Developing cross-platform mobile applications using React-based development patterns.",
        note: "E5",
      },
      {
        name: "HTML",
        category: "Frontend",
        description: "Structuring accessible and meaningful content for web applications.",
        note: "G5",
      },
      {
        name: "CSS",
        category: "Frontend",
        description: "Creating responsive layouts, visual systems, transitions and interactive web experiences.",
        note: "A5",
      },
    ],
  },
  {
    name: "Backend",
    skills: [
      {
        name: "Node.js",
        category: "Backend",
        description: "Building server-side applications, APIs and asynchronous services using JavaScript.",
        note: "C5",
      },
      {
        name: "Express",
        category: "Backend",
        description: "Creating API routes, middleware and backend application structures.",
        note: "E5",
      },
      {
        name: "FastAPI",
        category: "Backend",
        description: "Developing Python APIs and backend services.",
        note: "G5",
      },
    ],
  },
  {
    name: "AI & Machine Learning",
    skills: [
      {
        name: "TensorFlow",
        category: "AI & Machine Learning",
        description: "Experimenting with machine learning and deep learning workflows.",
        note: "D5",
      },
      {
        name: "PyTorch",
        category: "AI & Machine Learning",
        description: "Exploring neural networks and model development.",
        note: "F5",
      },
      {
        name: "Scikit-learn",
        category: "AI & Machine Learning",
        description: "Working with traditional machine learning algorithms and model evaluation.",
        note: "A5",
      },
    ],
  },
  {
    name: "Databases",
    skills: [
      {
        name: "MongoDB",
        category: "Databases",
        description: "Working with document-oriented data models and database operations.",
        note: "C5",
      },
      {
        name: "PostgreSQL",
        category: "Databases",
        description: "Working with relational data, structured queries and application databases.",
        note: "D5",
      },
      {
        name: "MySQL",
        category: "Databases",
        description: "Managing structured relational data.",
        note: "F5",
      },
      {
        name: "Firebase",
        category: "Databases",
        description: "Using managed backend services and application infrastructure.",
        note: "A5",
      },
    ],
  },
  {
    name: "Tools & Infrastructure",
    skills: [
      {
        name: "Git",
        category: "Tools & Infrastructure",
        description: "Tracking code changes and managing development history.",
        note: "D5",
      },
      {
        name: "GitHub",
        category: "Tools & Infrastructure",
        description: "Hosting repositories and collaborating on software projects.",
        note: "E5",
      },
      {
        name: "Docker",
        category: "Tools & Infrastructure",
        description: "Containerizing applications and creating consistent development environments.",
        note: "G5",
      },
      {
        name: "Terraform",
        category: "Tools & Infrastructure",
        description: "Exploring infrastructure as code and repeatable infrastructure configuration.",
        note: "B5",
      },
    ],
  },
  {
    name: "Hardware & IoT",
    skills: [
      {
        name: "ESP32",
        category: "Hardware & IoT",
        description: "Building connected embedded devices and IoT applications.",
        note: "C5",
      },
      {
        name: "Embedded Systems",
        category: "Hardware & IoT",
        description: "Working across firmware, microcontrollers and hardware-level interactions.",
        note: "E5",
      },
      {
        name: "Hardware Integration",
        category: "Hardware & IoT",
        description: "Connecting software applications with physical components and peripherals.",
        note: "G5",
      },
    ],
  },
];

export const allSkills = skillCategories.flatMap(
  (category) => category.skills
);
