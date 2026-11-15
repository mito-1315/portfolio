/**
 * The site is one piece of music in movements. Each entry lists the section
 * ids it contains, so the indicator can tell which movement is playing.
 */
export type MovementInfo = {
  numeral: string;
  name: string;
  sections: string[];
};

export const movements: MovementInfo[] = [
  { numeral: "I", name: "Prelude", sections: ["home", "about"] },
  { numeral: "II", name: "Instruments", sections: ["skills"] },
  { numeral: "III", name: "The Score", sections: ["projects"] },
  { numeral: "IV", name: "The Melody Line", sections: ["experience", "leadership"] },
  { numeral: "V", name: "The Music Room", sections: ["music", "recommend"] },
  { numeral: "VI", name: "Coda", sections: ["contact"] },
];
