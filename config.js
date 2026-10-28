/*
 * EVENT SETTINGS
 * ------------------------------------------------------------------
 * Everything the organisers may need to change lives in this file.
 * If you change fees, games or age groups here, make the SAME change in
 * apps-script/Code.gs, because the server recalculates every fee before
 * taking payment (so nobody can change the price in their browser).
 */
window.EVENT_CONFIG = {
  // ---- Event details (placeholders until finalised) ----
  organiserName: "Shree Patidar Yuvak Mandal, Dombivali",
  eventName: "Yuva Utkarsh Khel Mahotsav 2.0",
  tagline: "Sports and games for every age, from 5 to 50-plus.",
  dates: "25, 26 and 27 December 2026 (tentative)",
  venue: "Venue to be announced",
  organiserContact: "Contact number to be announced",

  // Last moment to register, in Indian time. null = always open.
  // Example: "2026-12-15T23:59:00+05:30"
  registrationDeadline: null,

  // Ages are counted on this date (first day of the event).
  ageReferenceDate: "2026-12-25",

  // Paste the Google Apps Script "Web app URL" here (see README).
  // Leave empty to run the site in demo mode: no data saved, no payment.
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbxRzx0DU1F2kivHXLxjR6_jBvZudXcHH2-kb2Pu1tcblz-wMK0jcYzUD5L4r5IWV2d5/exec",

  // ---- Fees (₹) ----
  individualFee: 50, // per player, per individual or pair game

  // ---- Age groups ----
  // 45 years exactly falls in 31–45; "Above 45" starts at 46.
  ageGroups: [
    { id: "g1", label: "5–8",      min: 5,  max: 8,   color: "#1E7BD8" },
    { id: "g2", label: "9–13",     min: 9,  max: 13,  color: "#2E9E4F" },
    { id: "g3", label: "14–18",    min: 14, max: 18,  color: "#E8590C" },
    { id: "g4", label: "19–30",    min: 19, max: 30,  color: "#8A3FD1" },
    { id: "g5", label: "31–45",    min: 31, max: 45,  color: "#0B8C85" },
    { id: "g6", label: "Above 45", min: 46, max: 120, color: "#9C5B2E" }
  ],

  // ---- Games ----
  // type: "individual" (₹50 per player), "pair" (₹50 per player, asks for
  // partner's name) or "team" (one fee per team, registered as a team).
  activities: [
    { id: "limbu",      name: "Limbu Chamchi",        type: "individual", groups: ["g1", "g2", "g6"] },
    { id: "sack",       name: "Sack Race",            type: "individual", groups: ["g1", "g2", "g3", "g4", "g5", "g6"] },
    { id: "book",       name: "Book Balance",         type: "individual", groups: ["g1", "g2", "g6"] },
    { id: "potato",     name: "Potato Race",          type: "individual", groups: ["g1", "g2"] },
    { id: "run100",     name: "100 m Race",           type: "individual", groups: ["g1", "g2", "g3", "g4", "g5", "g6"] },
    { id: "crab",       name: "Crab Walk",            type: "individual", groups: ["g1", "g2"] },
    { id: "obstacle",   name: "Obstacle Marathon",    type: "individual", groups: ["g1", "g2"] },
    { id: "relay300",   name: "300 m Relay",          type: "individual", groups: ["g3", "g4", "g5"] },
    { id: "threeleg",   name: "Three-Legged Race",    type: "pair",       groups: ["g2", "g3", "g4", "g5"] },
    { id: "badsingles", name: "Badminton Singles",    type: "individual", groups: ["g3", "g4", "g5", "g6"] },
    { id: "baddoubles", name: "Badminton Doubles",    type: "pair",       groups: ["g3", "g4", "g5", "g6"] },
    { id: "chess",      name: "Chess",                type: "individual", groups: ["g3", "g4", "g5", "g6"] },
    { id: "carrom",     name: "Carrom",               type: "individual", groups: ["g3", "g4", "g5", "g6"] },
    { id: "hathgadi",   name: "Hathgadi Race",        type: "pair",       groups: ["g3", "g4", "g5"] },
    { id: "aim",        name: "Aim Game",             type: "individual", groups: ["g3", "g4", "g5"] },
    { id: "shotput",    name: "Shot Put",             type: "individual", groups: ["g4", "g5", "g6"] },
    { id: "tt",         name: "Table Tennis",         type: "individual", groups: ["g4", "g5"] },
    { id: "longjump",   name: "Long Jump",            type: "individual", groups: ["g1", "g2", "g3", "g4", "g5"] },
    { id: "couple",     name: "Couple Game",          type: "pair",       groups: ["g4", "g5"] },
    { id: "hurdle",     name: "Hurdle Race",          type: "individual", groups: ["g5", "g6"] },

    { id: "tug",        name: "Tug of War",           type: "team", fee: 300,  teamMin: 2, groups: ["g3", "g4", "g5"] },
    { id: "dodgeball",  name: "Dodgeball",            type: "team", fee: 600,  teamMin: 2, groups: ["g3", "g4", "g5"] },
    { id: "ballthrow",  name: "Ball Throw (Women)",   type: "team", fee: 600,  teamMin: 2, groups: ["g4", "g5"], womenOnly: true },
    { id: "vbshoot",    name: "Volleyball Shooting",  type: "team", fee: 2100, teamMin: 2, groups: ["g4", "g5", "g6"] },
    { id: "vbpass",     name: "Volleyball Passing",   type: "team", fee: 2100, teamMin: 2, groups: ["g5"] }
  ]
};
