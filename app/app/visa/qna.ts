// app/app/visa/qna.ts
export type VisaQA = {
  id: string
  category:
    | "Background"
    | "University & Program"
    | "Academics"
    | "Finances"
    | "Career Plans"
    | "Home Ties"
    | "Compliance"
    | "Logistics"
  question: string
  answer: string
  tips?: string[]
}

export const VISA_QA: VisaQA[] = [
  // ---------- University & Program ----------
  {
    id: "which-university",
    category: "University & Program",
    question: "Which university are you going to in the U.S.?",
    answer:
      "I have an admit from Northeastern University for the MS in Data Science. The curriculum aligns with my background and the co-op program supports my career goal in applied machine learning.",
    tips: ["Answer in one sentence first.", "State degree + program + one clear reason."]
  },
  {
    id: "why-this-university",
    category: "University & Program",
    question: "Why did you choose this university?",
    answer:
      "I chose it for its strong industry connections, coursework in ML systems, and research groups that match my interests. Internship outcomes are consistently strong.",
    tips: ["Avoid “because friends are there”.", "Tie your choice to academics and outcomes."]
  },
  {
    id: "why-this-program",
    category: "University & Program",
    question: "Why this program?",
    answer:
      "The program focuses on scalable data systems and model deployment, which fits my experience and the roles I’m targeting after graduation.",
    tips: ["Mention 1–2 focus areas from the curriculum.", "Keep it concise."]
  },
  {
    id: "how-did-you-choose",
    category: "University & Program",
    question: "How did you shortlist your universities?",
    answer:
      "I compared curriculum depth, faculty interests, co-op options, and alumni outcomes, then prioritized programs that match my skill gaps and goals.",
    tips: ["Show a methodical approach.", "Don’t say rank alone."]
  },
  {
    id: "alternatives-admits",
    category: "University & Program",
    question: "Which other universities did you apply to or get admits from?",
    answer:
      "I applied to programs with similar strengths. I chose this one because its coursework and co-op model best fit my goals.",
    tips: ["Be honest about admits/declines.", "Always end with why you chose this one."]
  },

  // ---------- Background ----------
  {
    id: "why-usa",
    category: "Background",
    question: "Why do you want to study in the USA?",
    answer:
      "The U.S. offers industry-integrated curricula and access to labs and internships in my field. This exposure will help me build practical skills I can apply in my home country.",
    tips: ["Emphasize academics + industry exposure.", "Subtly reaffirm non-immigrant intent."]
  },
  {
    id: "why-now",
    category: "Background",
    question: "Why are you pursuing this degree now?",
    answer:
      "I’ve gained foundational experience and identified gaps in advanced data systems. This program helps me bridge those gaps before moving into specialized roles.",
    tips: ["Show timing logic.", "Avoid vague motivations."]
  },
  {
    id: "family-in-usa",
    category: "Background",
    question: "Do you have relatives in the U.S.?",
    answer:
      "No. (If yes: I have close relatives in <city>. They are not sponsoring my education, and my plans remain focused on study and returning per visa regulations.)",
    tips: ["Answer truthfully.", "Clarify independence of plans and funding."]
  },

  // ---------- Academics ----------
  {
    id: "academic-background",
    category: "Academics",
    question: "Tell me about your academic background.",
    answer:
      "I completed a B.Tech in Computer Science with strong coursework in algorithms and databases, and projects in data engineering that led me to this specialization.",
    tips: ["Pick 2–3 relevant courses/projects.", "Be outcome-oriented."]
  },
  {
    id: "backlogs-gaps",
    category: "Academics",
    question: "Why do you have backlogs or a gap?",
    answer:
      "I faced a brief personal/health challenge during that term. I addressed it, improved my study plan, and my later semesters reflect consistent performance.",
    tips: ["Take ownership briefly.", "Show documented improvement."]
  },
  {
    id: "low-gpa",
    category: "Academics",
    question: "Your GPA seems low. Why?",
    answer:
      "In early semesters I balanced heavy coursework with commitments that stretched my time. I corrected this and my final semesters show stronger grades in core subjects.",
    tips: ["Avoid excuses.", "Point to upward trend and key subjects."]
  },
  {
    id: "english-prep",
    category: "Academics",
    question: "How did you prepare for English proficiency?",
    answer:
      "I prepared with timed practice tests and focused on academic writing and listening skills. My score reflects readiness for graduate-level coursework.",
    tips: ["Keep it simple.", "Mention one specific practice method."]
  },

  // ---------- Finances ----------
  {
    id: "funding-source",
    category: "Finances",
    question: "Who is funding your education?",
    answer:
      "My parents are sponsoring my education and I have personal savings. We have sufficient liquid funds to cover tuition and living expenses for the program’s duration.",
    tips: ["Be direct.", "Be consistent with documents."]
  },
  {
    id: "living-expenses",
    category: "Finances",
    question: "How will you manage your living expenses?",
    answer:
      "We have planned for living expenses through family support and savings. I will also explore on-campus roles permitted by the university.",
    tips: ["Don’t over-promise off-campus work.", "Stick to permitted options."]
  },
  {
    id: "scholarship-ga-ra",
    category: "Finances",
    question: "Do you have any scholarship or assistantship?",
    answer:
      "Not currently. The program offers assistantships after enrollment based on fit, and I plan to apply when eligible.",
    tips: ["It’s fine to say no.", "Show awareness of the process."]
  },
  {
    id: "education-loan",
    category: "Finances",
    question: "Are you taking an education loan?",
    answer:
      "I am approved for a loan amount that covers tuition and part of living expenses, with disbursement scheduled per university timelines.",
    tips: ["Share only what’s finalized.", "Amounts should match paperwork."]
  },
  {
    id: "proof-of-funds-specifics",
    category: "Finances",
    question: "Can you explain your proof of funds?",
    answer:
      "Funds are in family savings and an approved education loan. The totals comfortably cover year-one tuition and living costs, with additional reserves for year two.",
    tips: ["Stay high-level; no itemized list needed.", "Be consistent with bank/loan letters."]
  },

  // ---------- Career Plans ----------
  {
    id: "career-plan-short",
    category: "Career Plans",
    question: "What are your short-term career plans after graduation?",
    answer:
      "I plan to work in data/ML engineering roles to build production data pipelines and model deployment systems.",
    tips: ["Be role-specific.", "Avoid naming a single employer."]
  },
  {
    id: "career-plan-long",
    category: "Career Plans",
    question: "What are your long-term plans?",
    answer:
      "I aim to lead data platform initiatives and contribute to applied AI solutions relevant to my home country’s industry needs.",
    tips: ["Connect back to home-country impact.", "Stay realistic."]
  },
  {
    id: "return-to-home",
    category: "Career Plans",
    question: "Will you return to your home country?",
    answer:
      "Yes. My career plans, family ties, and long-term opportunities are in my home country. The skills I gain will be applied there.",
    tips: ["Reaffirm non-immigrant intent.", "Tie skills to home-market needs."]
  },
  {
    id: "how-program-helps",
    category: "Career Plans",
    question: "How will this program help your career?",
    answer:
      "It fills specific gaps in scalable data systems and gives me practical project experience, making me competitive for the roles I’m targeting.",
    tips: ["Name 1–2 concrete skill gaps.", "Link to job functions."]
  },

  // ---------- Home Ties ----------
  {
    id: "home-ties",
    category: "Home Ties",
    question: "What ties do you have to your home country?",
    answer:
      "My immediate family and long-term plans are in my home country. I intend to leverage the skills I gain to contribute to local industry growth.",
    tips: ["Mention family/professional ties.", "Keep tone natural."]
  },
  {
    id: "property-family",
    category: "Home Ties",
    question: "Do you or your family own property or businesses?",
    answer:
      "Yes, my family maintains long-term assets and responsibilities locally. My plans are to return and work in the same market.",
    tips: ["Answer truthfully.", "Avoid sounding like you’re applying for PR."]
  },
  {
    id: "marital-status",
    category: "Home Ties",
    question: "What is your marital status?",
    answer:
      "I am single. My family is in my home country, and my plans are to return after studies to pursue my career there.",
    tips: ["Keep it factual.", "Reinforce ties briefly if relevant."]
  },

  // ---------- Compliance ----------
  {
    id: "visa-history",
    category: "Compliance",
    question: "Have you ever been refused a visa?",
    answer:
      "No. (If yes: I was refused in <year> due to <reason>. I’ve strengthened my application with clearer funding and admission details.)",
    tips: ["Be truthful.", "Explain what changed if applicable."]
  },
  {
    id: "travel-history",
    category: "Compliance",
    question: "What is your travel history?",
    answer:
      "I have domestic travel and limited international travel. My focus has been academics and work; this program is my first extended study abroad.",
    tips: ["Don’t inflate travel.", "Calm, straightforward delivery."]
  },
  {
    id: "sevis-i20-awareness",
    category: "Compliance",
    question: "What do you understand about SEVIS and the I-20?",
    answer:
      "The I-20 confirms my admission and program details; SEVIS maintains my student status. I must stay full-time and comply with reporting rules.",
    tips: ["Show basic awareness.", "Avoid turning it into a lecture."]
  },

  // ---------- Logistics ----------
  {
    id: "housing-logistics",
    category: "Logistics",
    question: "Where will you stay in the U.S.?",
    answer:
      "I’ve explored university housing and nearby options. I’ll finalize accommodation after orientation dates and roommate availability are confirmed.",
    tips: ["Sound prepared, not uncertain.", "No need for exact addresses."]
  },
  {
    id: "start-date-readiness",
    category: "Logistics",
    question: "When does your program start and are you prepared?",
    answer:
      "My program begins in <month>. I’ve reviewed the orientation schedule and key course dates and planned travel accordingly.",
    tips: ["Know your start month.", "Mention orientation awareness."]
  },
  {
    id: "campus-location",
    category: "Logistics",
    question: "Where is your university located?",
    answer:
      "It’s in <city, state>. I’ve reviewed commute options and living costs in that area.",
    tips: ["Say city/state confidently.", "One practical detail shows prep."]
  },
  {
    id: "part-time-work",
    category: "Logistics",
    question: "Do you plan to work part-time?",
    answer:
      "I may explore on-campus roles permitted under my visa, ensuring academics remain my priority.",
    tips: ["Stay within visa limits.", "Don’t rely on off-campus work."]
  }
]
