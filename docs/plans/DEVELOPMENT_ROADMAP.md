# Mithesh's Musical Portfolio --- Development Roadmap

> **Project direction:** A portfolio in a different key.\
> **Core idea:** The Sound of a Developer --- an experiment in sound,
> software, creativity, and interaction.

This file is the project roadmap. Work through it in order, one phase
and one milestone at a time. Do not try to build every feature at once.

------------------------------------------------------------------------

## How to use this roadmap with ChatGPT

1.  Keep this file at the root of the repository as
    `DEVELOPMENT_ROADMAP.md`.
2.  Work on the current phase only. Do not jump ahead unless a
    dependency requires it.
3.  When you want guidance, share:
    -   the current phase and step;
    -   the relevant files or folder structure;
    -   the code or error you are stuck on;
    -   what you expected to happen and what actually happened.
4.  Ask for the next small implementation step, not the entire remaining
    project.
5.  After completing a milestone, test it, commit it to Git, and mark
    its checkbox below.
6.  If a design or technical decision changes, update this roadmap so it
    remains the source of truth.

**Suggested prompt to continue work:**

> We are working on the Musical Portfolio roadmap. We have completed
> Phase \[X\], Step \[Y\]. Here is my current folder
> structure/code/output. Guide me through the next step in small,
> practical increments. Explain where each file goes and how I can test
> it.

### Working rules

-   Build one responsive website with one codebase, not separate desktop
    and mobile websites.
-   Establish responsive structure as each section is built. Do a quick
    mobile check after every section; do the detailed mobile polish in
    the responsive phase.
-   Build the working experience before adding decorative complexity.
-   Keep the first screen fast. Do not load the 3D piano, large audio
    files, or nonessential content before they are needed.
-   Do not autoplay audio. Start playback only after a visitor chooses
    to interact.
-   Keep music playback persistent between sections by keeping the
    player mounted at the app level.
-   Respect reduced-motion preferences and provide graceful fallbacks
    for 3D effects.
-   Use real project details and evidence. Do not invent outcomes,
    metrics, roles, or experience.
-   Keep secrets and API keys out of Git. Use environment variables.
-   Prefer small commits with clear messages.

------------------------------------------------------------------------

# Project overview

## Visual identity

-   Warm-white / white background, near-black typography.
-   Subtle light-grey musical staff motif: repeated groups of five
    horizontal lines, followed by generous blank space, then another
    group.
-   Fine line weight and low contrast; the background should feel
    editorial, not like graph paper.
-   Occasional restrained blue and orange accents.
-   Typography direction:
    -   **Instrument Serif** for expressive display headlines.
    -   **Inter** for body and interface text.
    -   **DM Mono** for technical labels and small metadata.
-   Spacious, cinematic, minimal, playful, and carefully animated.

## Main experience

1.  Brief loading / opening transition.
2.  Visitor chooses a mood or listening direction.
3.  Hero introduction.
4.  About.
5.  Skills and technologies.
6.  Selected projects / case studies.
7.  Experience timeline.
8.  Music Room with a particle grand piano and virtual piano.
9.  Guess the Song game.
10. Beyond the Code --- interests and small interactions.
11. Built, Not Generated --- development story and process.
12. Leadership and impact.
13. Visitor recommendation wall.
14. Contact finale.

## Agreed technical direction

### Frontend

-   React + Vite + TypeScript
-   CSS for layout, responsive design, and visual styling
-   GSAP + ScrollTrigger for scroll-driven animation
-   Three.js with React Three Fiber and Drei for selected 3D scenes
-   Tone.js for virtual instrument sound generation
-   Web Audio API / HTML Audio for the persistent music player and audio
    visualisation
-   Lucide React for interface icons

### Backend

-   Node.js + Express + TypeScript
-   PostgreSQL + Prisma
-   Zod for request validation
-   Authentication and protected admin routes
-   Object storage / CDN for large media such as audio, posters, and
    images

The portfolio should still render its core content if the backend is
unavailable. Start with local data and connect the API when the frontend
structure is stable.

------------------------------------------------------------------------

# Development phases

## Phase 0 --- Project setup and baseline

**Goal:** Create a clean, runnable repository and establish the
development workflow.

### Steps

-   [ ] Confirm Node.js LTS, npm, Git, and VS Code are installed.
-   [ ] Create the repository and initialise Git.
-   [ ] Create the React + Vite + TypeScript client.
-   [ ] Create the Express + TypeScript server folder.
-   [ ] Install the initial frontend and backend dependencies.
-   [ ] Configure formatting and linting.
-   [ ] Add `.gitignore` and `.env.example`.
-   [ ] Create `main` and `develop` branches.
-   [ ] Run the frontend and backend locally.
-   [ ] Add this roadmap to the repository root as
    `DEVELOPMENT_ROADMAP.md`.
-   [ ] Make the first Git commit.

### Completion check

-   Frontend starts without errors.
-   Backend starts and responds to a basic health-check route.
-   Git repository is clean and the roadmap is committed.

**Suggested commit:** `chore: initialize portfolio project`

------------------------------------------------------------------------

## Phase 1 --- Frontend foundation and design system

**Goal:** Build the visual foundation before creating the full page.

### Steps

-   [ ] Establish the client folder structure.
-   [ ] Add global CSS reset and base styles.
-   [ ] Define design tokens: colours, typography, spacing, radii,
    shadows, and motion timings.
-   [ ] Add and test the chosen fonts.
-   [ ] Build the repeated five-line musical staff background.
-   [ ] Make the staff responsive and subtle at different screen sizes.
-   [ ] Create reusable layout/container components.
-   [ ] Create basic buttons, links, labels, and section-heading styles.
-   [ ] Add a simple navigation structure.
-   [ ] Add a minimal loading/entry state without delaying the actual
    site.
-   [ ] Check the foundation at desktop and mobile widths.

### Completion check

The page has a consistent visual language, the staff motif works at all
widths, and reusable styles are ready for the sections.

**Suggested commit:** `feat: establish portfolio design system`

------------------------------------------------------------------------

## Phase 2 --- Page structure and core content

**Goal:** Build every main section as a clean, responsive page before
adding advanced animation.

### Steps

-   [ ] Create the main page and section order.
-   [ ] Build the hero section with name, role, introduction, and calls
    to action.
-   [ ] Build the About section.
-   [ ] Build the Skills section and group technologies clearly.
-   [ ] Build the Projects section with reusable project cards.
-   [ ] Create a detailed case-study layout for each selected project.
-   [ ] Build the Experience timeline.
-   [ ] Build the Beyond the Code interests section.
-   [ ] Build the Built, Not Generated development-story section.
-   [ ] Build Leadership and Impact.
-   [ ] Build the Recommendations section placeholder.
-   [ ] Build the Contact finale and footer.
-   [ ] Add the actual resume link or a temporary clearly marked
    placeholder.
-   [ ] Review the content for accuracy and remove unsupported claims.
-   [ ] Complete a quick mobile layout pass for every section.

### Content to prepare

-   [ ] Final profile introduction and role description.
-   [ ] Skills list based on actual experience.
-   [ ] Project summaries, responsibilities, technologies, screenshots,
    and architecture.
-   [ ] Accurate internship / experience dates and descriptions.
-   [ ] Leadership role and bus-route optimisation contribution.
-   [ ] Resume PDF and contact links.
-   [ ] Optional project demos and source-code links.

### Completion check

The whole portfolio can be browsed from top to bottom. It may be
visually simple, but all sections and content are present and
responsive.

**Suggested commit:** `feat: build portfolio section structure`

------------------------------------------------------------------------

## Phase 3 --- Music mood selection and persistent audio player

**Goal:** Make music part of the experience without interrupting
navigation.

### Steps

-   [ ] Design the mood-selection screen: Calm, Focused, Energetic,
    Nostalgic, and Curious.
-   [ ] Let visitors choose a mood or playlist before entering the
    experience.
-   [ ] Build a compact music player dock.
-   [ ] Add play/pause, previous/next, progress, volume, track title,
    and artist.
-   [ ] Add an expanded player view with artwork and playlist/queue
    details.
-   [ ] Keep the player mounted above the page sections so playback
    continues during scrolling.
-   [ ] Use audio only after an explicit visitor interaction.
-   [ ] Handle loading, playback errors, track completion, and
    unavailable audio.
-   [ ] Add mute / pause controls that are easy to find.
-   [ ] Test playback on desktop and mobile browsers.
-   [ ] Avoid preloading the entire music library.

### Completion check

A visitor can select a mood, start music, scroll through the site, and
control playback without the music restarting between sections.

**Suggested commit:**
`feat: add mood selection and persistent music player`

------------------------------------------------------------------------

## Phase 4 --- GSAP motion and scroll experience

**Goal:** Add intentional movement after the page structure is stable.

### Steps

-   [ ] Install and configure GSAP and ScrollTrigger.
-   [ ] Create a small shared animation utility layer.
-   [ ] Animate the hero headline and supporting content.
-   [ ] Add subtle entrance animations to section content.
-   [ ] Add layered parallax to the musical staff and selected
    decorative elements.
-   [ ] Create project showcase transitions.
-   [ ] Add the experience timeline movement.
-   [ ] Use pinned or horizontal scroll only where it improves the
    story.
-   [ ] Keep the main navigation primarily vertical and natural.
-   [ ] Add reduced-motion handling.
-   [ ] Ensure all GSAP animations are cleaned up correctly when
    components unmount.
-   [ ] Test scroll performance on a mid-range phone.

### Completion check

Motion supports the content rather than competing with it. Scrolling
remains predictable, responsive, and usable.

**Suggested commit:** `feat: add scroll animations and parallax`

------------------------------------------------------------------------

## Phase 5 --- Music Room and particle grand piano

**Goal:** Build the signature visual scene.

### Important visual direction

Use the supplied orange particle / point-cloud reference for its fine
dotted, technical 3D rendering style only. The particles must form a
**recognisable grand piano** --- body, curved outer rim, keyboard, lid,
legs, and music stand.

Do **not** turn the particles into circular rings, a vinyl record, a
turntable, a central needle, or concentric circles.

### Steps

-   [ ] Source or create a suitable grand-piano 3D model.
-   [ ] Inspect and optimise the model in Blender if necessary.
-   [ ] Export a web-friendly `.glb` / `.gltf` model.
-   [ ] Create a dedicated React Three Fiber scene.
-   [ ] Sample points from the grand-piano model surface.
-   [ ] Render the points with a fine particle material.
-   [ ] Create the starting musical-note / particle positions.
-   [ ] Animate particles from the starting positions into the
    grand-piano shape.
-   [ ] Add subtle camera movement and depth.
-   [ ] Coordinate the scene with the musical staff parallax.
-   [ ] Trigger the scene only when the visitor approaches the Music
    Room.
-   [ ] Reduce particle count and effects on lower-powered devices.
-   [ ] Provide a static or lightweight fallback if WebGL is
    unavailable.
-   [ ] Test on desktop and mobile.

### Completion check

The scene clearly reads as a grand piano, loads only when needed, and
does not damage scrolling or page performance.

**Suggested commit:** `feat: create particle grand piano scene`

------------------------------------------------------------------------

## Phase 6 --- Functional virtual piano

**Goal:** Let visitors actually play notes.

### Steps

-   [ ] Build the piano keyboard interface separately from the particle
    scene.
-   [ ] Add octave controls.
-   [ ] Add a musical-scale selector; keep scale and octave as separate
    settings.
-   [ ] Add instrument choices such as sampled grand piano, electric
    piano, and synth.
-   [ ] Integrate Tone.js and suitable licensed samples.
-   [ ] Support mouse, touch, and computer-keyboard input.
-   [ ] Support multiple simultaneous notes.
-   [ ] Add record, playback, and clear controls.
-   [ ] Consider MIDI export as a later enhancement.
-   [ ] Make keys comfortable to use on touchscreens.
-   [ ] Test audio latency and browser audio-context behaviour.

### Completion check

Visitors can play the piano on desktop and mobile, change octave and
scale independently, and record/play a short phrase.

**Suggested commit:** `feat: add interactive virtual piano`

------------------------------------------------------------------------

## Phase 7 --- Guess the Song game

**Goal:** Add a small music-based game that is fun and easy to
understand.

### Steps

-   [ ] Define the game rules and scoring.
-   [ ] Create a question format for a notation clue, audio clue, answer
    choices, and explanation.
-   [ ] Add replay-audio and reveal-answer controls.
-   [ ] Add difficulty levels.
-   [ ] Add score and progress feedback.
-   [ ] Allow visitors to try identifying a tune by listening or reading
    the clue.
-   [ ] Optionally let visitors play the clue on the virtual piano.
-   [ ] Use original, licensed, or otherwise permitted audio and
    arrangements.
-   [ ] Test the game on mobile.

### Completion check

The game can run from beginning to end, provides clear feedback, and
uses content that is safe to publish.

**Suggested commit:** `feat: add guess the song game`

------------------------------------------------------------------------

## Phase 8 --- Beyond the Code interactions

**Goal:** Present personal interests through small, purposeful
interactions.

### Possible experiences

-   Cinema: a curated movie-poster collection with details.
-   Guitar: clickable strings or chord interactions.
-   Football: a small ball-control or penalty interaction.
-   Valorant: a subtle minimap, crosshair, or hidden keyboard
    interaction.
-   Writing: a digital manuscript / notes experience.
-   Hidden details: shooting stars, a secret message, or a small
    terminal easter egg.

### Steps

-   [ ] Choose which interactions are worth building.
-   [ ] Keep each interaction optional and easy to exit.
-   [ ] Build the cinema / poster collection.
-   [ ] Build the selected music or guitar interaction.
-   [ ] Build one or two other chosen mini-interactions.
-   [ ] Add sound effects only when useful and keep them muteable.
-   [ ] Make every interaction usable without a mouse hover.
-   [ ] Test mobile performance and touch behaviour.

### Completion check

The section feels personal and playful without making the portfolio
difficult to navigate.

**Suggested commit:** `feat: add interactive interests section`

------------------------------------------------------------------------

## Phase 9 --- Built, Not Generated development journal

**Goal:** Document how the portfolio was genuinely designed and built.

### Steps

-   [ ] Create a dated development-log format.
-   [ ] Record important design decisions and why they were made.
-   [ ] Capture screenshots of major milestones.
-   [ ] Record meaningful technical challenges and fixes.
-   [ ] Show selected architecture, folder structure, and implementation
    details.
-   [ ] Document the role of AI tools honestly: ideation, guidance,
    debugging, and collaboration.
-   [ ] Distinguish your own decisions, implementation, integration, and
    testing from AI-assisted work.
-   [ ] Add the timeline to the portfolio.

### Completion check

The section tells a truthful, evidence-backed story of the work rather
than making vague claims.

**Suggested commit:** `feat: document portfolio development process`

------------------------------------------------------------------------

## Phase 10 --- Express backend and database

**Goal:** Introduce dynamic content and admin functionality without
making the public site dependent on the API.

### Steps

-   [ ] Configure the Express + TypeScript application.
-   [ ] Add environment configuration and a health-check endpoint.
-   [ ] Configure PostgreSQL.
-   [ ] Design the Prisma schema for projects, experience, tracks,
    playlists, movies, recommendations, quiz questions, and site
    settings.
-   [ ] Add migrations and seed data.
-   [ ] Add request validation with Zod.
-   [ ] Create public read endpoints.
-   [ ] Create recommendation submission endpoint.
-   [ ] Add rate limiting, secure headers, CORS rules, and error
    handling.
-   [ ] Add authentication for admin routes.
-   [ ] Add protected create/update/delete endpoints.
-   [ ] Store large media in object storage / CDN and save metadata or
    URLs in the database.
-   [ ] Connect the frontend to the API through a small service layer.
-   [ ] Keep local fallback content or graceful loading/error states.
-   [ ] Test API routes and database operations.

### Initial API route plan

-   `GET /api/health`
-   `GET /api/content`
-   `GET /api/projects`
-   `GET /api/experience`
-   `GET /api/music/playlists`
-   `GET /api/music/tracks`
-   `GET /api/movies`
-   `POST /api/recommendations`
-   `GET /api/quiz`
-   `GET /api/resume`
-   `POST /api/admin/login`
-   Protected `/api/admin/*` routes for content management

### Completion check

The public portfolio can load dynamic content, visitors can submit
recommendations safely, and authenticated admin operations work.

**Suggested commit:** `feat: add portfolio API and database`

------------------------------------------------------------------------

## Phase 11 --- Admin dashboard

**Goal:** Manage portfolio content without editing code for every
update.

### Steps

-   [ ] Build admin login.
-   [ ] Build a responsive admin layout.
-   [ ] Add project management.
-   [ ] Add experience management.
-   [ ] Add music track and playlist management.
-   [ ] Add movie and poster management.
-   [ ] Add Guess the Song question management.
-   [ ] Add recommendation moderation and approval.
-   [ ] Add development-log management.
-   [ ] Add resume and site-settings management.
-   [ ] Add image/audio upload validation and limits.
-   [ ] Protect every admin API route.
-   [ ] Test permissions and invalid inputs.

### Completion check

You can safely update the key portfolio content through the admin
dashboard.

**Suggested commit:** `feat: add portfolio admin dashboard`

------------------------------------------------------------------------

## Phase 12 --- Responsive refinement and accessibility

**Goal:** Make the complete experience robust across phones, tablets,
and desktops.

### Steps

-   [ ] Test at approximately 360px, 390px, 430px, 768px, 1024px, and
    wide desktop widths.
-   [ ] Fix horizontal overflow and clipped content.
-   [ ] Check typography, spacing, and section heights.
-   [ ] Ensure touch targets are comfortably sized.
-   [ ] Replace hover-only interactions with tap / focus alternatives.
-   [ ] Simplify or disable heavy parallax on small or low-powered
    devices.
-   [ ] Keep the experience timeline vertical on mobile.
-   [ ] Keep project showcases stacked on mobile rather than forcing
    horizontal pinning.
-   [ ] Make the music player compact and usable on small screens.
-   [ ] Make the virtual piano practical on touchscreens.
-   [ ] Check keyboard navigation and visible focus states.
-   [ ] Add useful labels and alternative text.
-   [ ] Check colour contrast.
-   [ ] Respect `prefers-reduced-motion`.
-   [ ] Test portrait and landscape orientation.

### Completion check

No core feature requires a desktop mouse, and the mobile experience
feels intentionally designed rather than squeezed down.

**Suggested commit:** `fix: refine responsive layout and accessibility`

------------------------------------------------------------------------

## Phase 13 --- Performance, security, and quality assurance

**Goal:** Make the portfolio stable, fast, and safe to publish.

### Steps

-   [ ] Lazy-load below-the-fold sections where useful.
-   [ ] Lazy-load the 3D piano scene and other heavy features.
-   [ ] Compress and resize images; use modern formats such as WebP /
    AVIF.
-   [ ] Compress 3D models and reduce unnecessary geometry.
-   [ ] Avoid loading every audio track at startup.
-   [ ] Pause or reduce off-screen animations.
-   [ ] Check for memory leaks and repeated event listeners.
-   [ ] Check React console warnings and browser errors.
-   [ ] Test API error handling and rate limits.
-   [ ] Verify authentication and environment secrets.
-   [ ] Run production builds.
-   [ ] Test the site on real devices and different browsers.
-   [ ] Check Lighthouse / Core Web Vitals and address major issues.
-   [ ] Add a custom not-found page and useful error states.

### Completion check

The production build works reliably, the first screen loads quickly, and
heavy experiences do not block the rest of the site.

**Suggested commit:** `perf: optimise portfolio and prepare release`

------------------------------------------------------------------------

## Phase 14 --- Deployment and launch

**Goal:** Publish the portfolio and establish a reliable update
workflow.

### Steps

-   [ ] Choose hosting for the frontend.
-   [ ] Choose hosting for the Express API and PostgreSQL database.
-   [ ] Configure production environment variables.
-   [ ] Configure the production database and run migrations.
-   [ ] Configure object storage / CDN for media.
-   [ ] Configure domain and HTTPS.
-   [ ] Configure CORS and allowed origins.
-   [ ] Deploy the frontend.
-   [ ] Deploy the backend.
-   [ ] Test all public and admin flows in production.
-   [ ] Verify resume, project links, audio, posters, and recommendation
    submission.
-   [ ] Add basic uptime / error monitoring.
-   [ ] Create a backup plan for database and media.
-   [ ] Merge the stable release into `main`.
-   [ ] Publish the launch announcement.

### Completion check

The live website works on desktop and mobile, dynamic features are
connected, and the repository has a repeatable release process.

**Suggested commit:** `release: launch portfolio`

------------------------------------------------------------------------

## Phase 15 --- Optional experimental features

These are intentionally postponed until the main portfolio is complete.

### Audio-to-notes / AI transcription experiment

-   [ ] Research a suitable open-source audio-to-MIDI model such as
    Basic Pitch.
-   [ ] Define supported upload formats, size limits, and clip duration.
-   [ ] Build an upload and processing flow.
-   [ ] Convert the result into a note / piano-roll representation.
-   [ ] Play the transcription through the virtual piano.
-   [ ] Investigate MIDI or sheet-music export.
-   [ ] Explain that transcription may be inaccurate, especially for
    dense polyphonic audio.
-   [ ] Process files securely and define a deletion/retention policy.

### Other optional improvements

-   [ ] MIDI export.
-   [ ] More instruments and piano samples.
-   [ ] More Guess the Song categories.
-   [ ] Additional easter eggs.
-   [ ] Advanced visualiser modes.
-   [ ] More detailed analytics, only if genuinely useful and
    privacy-conscious.

------------------------------------------------------------------------

# Suggested repository structure

Create folders as they become necessary; do not create dozens of empty
files on day one.

``` text
mithesh-portfolio/
├── client/
│   ├── public/
│   │   ├── assets/
│   │   │   ├── music/
│   │   │   ├── posters/
│   │   │   ├── piano/
│   │   │   └── icons/
│   │   └── models/
│   └── src/
│       ├── assets/
│       ├── components/
│       │   ├── common/
│       │   ├── navigation/
│       │   ├── music/
│       │   ├── piano/
│       │   └── three/
│       ├── sections/
│       ├── animations/
│       ├── hooks/
│       ├── services/
│       ├── data/
│       ├── styles/
│       ├── App.tsx
│       └── main.tsx
├── server/
│   ├── prisma/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       └── app.ts
├── DEVELOPMENT_ROADMAP.md
├── .gitignore
└── README.md
```

------------------------------------------------------------------------

# Milestone tracker

Use this short tracker to see the overall status at a glance.

-   [ ] Phase 0 --- Project setup
-   [ ] Phase 1 --- Design system
-   [ ] Phase 2 --- Core sections and content
-   [ ] Phase 3 --- Mood selection and music player
-   [ ] Phase 4 --- GSAP and scroll experience
-   [ ] Phase 5 --- Particle grand piano
-   [ ] Phase 6 --- Virtual piano
-   [ ] Phase 7 --- Guess the Song
-   [ ] Phase 8 --- Beyond the Code interactions
-   [ ] Phase 9 --- Development journal
-   [ ] Phase 10 --- Express backend and database
-   [ ] Phase 11 --- Admin dashboard
-   [ ] Phase 12 --- Responsive and accessibility refinement
-   [ ] Phase 13 --- Performance and quality assurance
-   [ ] Phase 14 --- Deployment and launch
-   [ ] Phase 15 --- Optional experiments

## What we should do first

Start with **Phase 0 only**. Once the repository runs locally and the
first commit is made, move to Phase 1. We will make decisions and
implement the project incrementally, testing each step before moving on.
