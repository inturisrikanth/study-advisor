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
  {
    id: "fit-vs-other-admit",
    category: "University & Program",
    question: "Why did you choose this admit over your other admits?",
    answer:
      "This program offers stronger coursework in distributed data systems and a co-op structure that aligns with my goal to work on production ML pipelines.",
    tips: ["Compare on 1–2 academic points.", "End with a decisive reason."]
  },
  {
    id: "program-deliverables",
    category: "University & Program",
    question: "What are the key deliverables or outcomes from your program?",
    answer:
      "A capstone with an industry partner, advanced coursework in data engineering, and practicum experience that prepares me for ML engineering roles.",
    tips: ["Name capstone/practicum.", "Tie outcomes to target roles."]
  },
  {
    id: "faculty-alignment",
    category: "University & Program",
    question: "Which faculty or labs align with your interests?",
    answer:
      "The systems and ML group matches my focus on scalable model serving. Their recent projects on real-time inference are directly relevant.",
    tips: ["Avoid listing many names.", "One lab + why it matters."]
  },
  {
    id: "deferral-question",
    category: "University & Program",
    question: "If the start term is deferred, what will you do?",
    answer:
      "I will continue upskilling through online coursework and applied projects, so I join the program with stronger preparation.",
    tips: ["Show proactive plan.", "Avoid sounding uncertain about studying."]
  },
  {
    id: "online-vs-oncampus",
    category: "University & Program",
    question: "Why on-campus instead of an online program?",
    answer:
      "On-campus learning provides access to labs, peer collaboration, and co-ops that are essential to my hands-on goals.",
    tips: ["Emphasize labs/networking.", "Keep it short."]
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

  {
    id: "work-experience-relevance",
    category: "Background",
    question: "How does your work experience relate to this program?",
    answer:
      "I worked on data pipelines and analytics dashboards. This program deepens my skills in scalable systems and model deployment.",
    tips: ["Connect experience → skill gaps → program."]
  },
  {
    id: "field-switch",
    category: "Background",
    question: "You’re switching fields—why is this credible?",
    answer:
      "My projects and certifications are already in data/ML. The degree formalizes the foundation and prepares me for production roles.",
    tips: ["Show prior steps taken.", "Be confident, not defensive."]
  },
  {
    id: "break-between-studies",
    category: "Background",
    question: "What did you do during your gap/break?",
    answer:
      "I completed internships and online coursework, and built two portfolio projects to strengthen my profile.",
    tips: ["List measurable activities.", "Avoid vague statements."]
  },
  {
    id: "influenced-by-someone",
    category: "Background",
    question: "Who influenced your decision to pursue this degree?",
    answer:
      "Mentors at work and alumni from this program shared how advanced systems skills accelerated their careers. Their guidance helped me decide.",
    tips: ["Don’t say “family pressure”.", "Keep it professional."]
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
  {
    id: "research-experience",
    category: "Academics",
    question: "Do you have research experience?",
    answer:
      "I worked on a course project analyzing streaming data and co-authored a short paper at a local symposium. It sparked my interest in scalable analytics.",
    tips: ["If no paper, cite a substantial project.", "Be specific."]
  },
  {
    id: "standardized-test-low",
    category: "Academics",
    question: "Your standardized test score is low—how will you cope?",
    answer:
      "My core grades and recent projects reflect my ability. I’ve improved my study methods and performed well in advanced subjects.",
    tips: ["Point to strong evidence.", "Stay positive, no excuses."]
  },
  {
    id: "waiver-awareness",
    category: "Academics",
    question: "Was your GRE/English test waived? Why?",
    answer:
      "The university waived it based on my prior academics and medium of instruction. I’m prepared for graduate-level work.",
    tips: ["Keep it factual.", "Do not over-explain."]
  },
  {
    id: "project-highlight",
    category: "Academics",
    question: "Describe a key academic project and your role.",
    answer:
      "I led a pipeline to process event data and built a feature store for model training. It improved training freshness and accuracy.",
    tips: ["Focus on your contribution + impact."]
  },
  {
    id: "academic-honesty",
    category: "Academics",
    question: "How do you ensure academic integrity?",
    answer:
      "I follow university honor codes, cite sources, and collaborate only within defined guidelines.",
    tips: ["Straightforward, values-based answer."]
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
  {
    id: "tuition-breakdown",
    category: "Finances",
    question: "What is your estimated tuition and living cost?",
    answer:
      "Based on the I-20 and university website, year-one tuition is approximately $X and living expenses about $Y. We’ve planned funds accordingly.",
    tips: ["Know your ballpark numbers.", "Stay consistent with I-20."]
  },
  {
    id: "sponsor-occupation",
    category: "Finances",
    question: "What is your sponsor’s occupation and income source?",
    answer:
      "My sponsor is a <profession> with stable income and savings earmarked for my education.",
    tips: ["Keep it concise.", "No unnecessary financial details."]
  },
  {
    id: "multiple-sponsors",
    category: "Finances",
    question: "You have multiple sponsors—why?",
    answer:
      "Family members are sharing responsibility and the funds are documented. This provides a comfortable safety margin.",
    tips: ["Stress documentation + sufficiency."]
  },
  {
    id: "recent-large-deposits",
    category: "Finances",
    question: "Explain the recent large deposits in your account.",
    answer:
      "They are consolidated family savings moved for fee planning. We have statements to show the source and timing.",
    tips: ["Avoid sounding evasive.", "Tie to legitimate sources."]
  },
  {
    id: "part-time-dependence",
    category: "Finances",
    question: "Are you relying on part-time work for tuition?",
    answer:
      "No. Tuition and living costs are covered by savings and a loan. Any on-campus role would be supplementary and within visa limits.",
    tips: ["Reassure self-sufficiency.", "Stay within regulations."]
  },
  {
    id: "currency-risk",
    category: "Finances",
    question: "How will you handle exchange rate fluctuations?",
    answer:
      "We’ve budgeted a buffer in local currency and USD to manage normal fluctuations without affecting my studies.",
    tips: ["Show prudence.", "Keep it simple."]
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
  {
    id: "preferred-role",
    category: "Career Plans",
    question: "Which exact roles are you targeting after graduation?",
    answer:
      "Data Engineer or ML Engineer roles focused on building pipelines, feature stores, and model serving systems.",
    tips: ["Use role names used in the market."]
  },
  {
    id: "internship-plan",
    category: "Career Plans",
    question: "What’s your plan for internships?",
    answer:
      "Leverage the university career center, alumni network, and faculty referrals. I’ll target roles that develop production data skills.",
    tips: ["Show a concrete plan.", "Avoid naming one company."]
  },
  {
    id: "salary-expectation",
    category: "Career Plans",
    question: "What salary do you expect after graduation?",
    answer:
      "It varies by company and location. My focus is on roles that offer growth in data platforms and applied ML.",
    tips: ["Avoid quoting exact figures.", "Focus on growth/fit."]
  },
  {
    id: "startup-vs-enterprise",
    category: "Career Plans",
    question: "Startup or large company—what do you prefer?",
    answer:
      "I’m open to both: startups for breadth and speed, enterprises for scale and mature systems. I’ll choose based on the learning fit.",
    tips: ["Balanced answer shows maturity."]
  },
  {
    id: "home-country-market",
    category: "Career Plans",
    question: "How will you use these skills in your home country?",
    answer:
      "Data platforms are scaling in my home market. I plan to apply these systems skills in sectors like fintech and logistics.",
    tips: ["Name 1–2 sectors back home."]
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
  {
    id: "family-dependents",
    category: "Home Ties",
    question: "Do your family members depend on you?",
    answer:
      "Yes, I share responsibilities at home. My long-term plan is to return and contribute locally after completing my degree.",
    tips: ["Reinforce return intent naturally."]
  },
  {
    id: "community-connections",
    category: "Home Ties",
    question: "What community connections do you have?",
    answer:
      "I’m active in local technical meetups and volunteer mentoring. I want to bring back specialized skills to these communities.",
    tips: ["Keep it authentic and brief."]
  },
  {
    id: "long-term-location",
    category: "Home Ties",
    question: "Where do you see yourself living long-term?",
    answer:
      "In my home country, leading data platform initiatives and supporting local tech growth.",
    tips: ["Simple and consistent with non-immigrant intent."]
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
  {
    id: "cpt-awareness",
    category: "Compliance",
    question: "What is CPT and when can you use it?",
    answer:
      "Curricular Practical Training is employment integral to the curriculum, typically available after completing required credits and with school authorization.",
    tips: ["Keep it accurate and brief."]
  },
  {
    id: "opt-awareness",
    category: "Compliance",
    question: "What is OPT and what are its limits?",
    answer:
      "Optional Practical Training allows up to 12 months of work in the field after graduation, with possible STEM extension as per rules.",
    tips: ["Don’t promise specifics.", "Show basic awareness."]
  },
  {
    id: "status-maintenance",
    category: "Compliance",
    question: "How will you maintain your F-1 status?",
    answer:
      "Stay full-time, report changes to the DSO, and work only within authorized limits.",
    tips: ["Short, confident answer."]
  },
  {
    id: "transfer-schools",
    category: "Compliance",
    question: "Will you transfer to another school?",
    answer:
      "I don’t plan to. I chose this program carefully for its curriculum and co-op opportunities.",
    tips: ["Reaffirm your committed choice."]
  },
  {
    id: "dependent-visa",
    category: "Compliance",
    question: "Will any dependents accompany you?",
    answer:
      "No. (If yes: My spouse will apply for an F-2 visa and will not work in the U.S., in line with regulations.)",
    tips: ["Be precise and compliant."]
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
  },
  {
    id: "flight-plan",
    category: "Logistics",
    question: "When do you plan to travel to the U.S.?",
    answer:
      "I plan to arrive 2–3 weeks before orientation to settle housing and complete onboarding tasks.",
    tips: ["Show practical planning.", "Don’t cut it too close."]
  },
  {
    id: "packing-priorities",
    category: "Logistics",
    question: "What are your packing priorities?",
    answer:
      "Documents, a laptop suitable for coursework, basic essentials, and items recommended by the university.",
    tips: ["Keep it simple.", "Mention documents first."]
  },
  {
    id: "health-insurance",
    category: "Logistics",
    question: "What about health insurance?",
    answer:
      "I’ll enroll in the university-recommended plan or its approved equivalent to ensure continuous coverage.",
    tips: ["Show awareness of mandatory coverage."]
  },
  {
    id: "transport-commute",
    category: "Logistics",
    question: "How will you commute to campus?",
    answer:
      "I’ve reviewed transit options near campus and will choose based on my housing location and schedule.",
    tips: ["No need for exact routes.", "Prepared yet flexible."]
  },
  {
    id: "orientation-tasks",
    category: "Logistics",
    question: "Which initial tasks will you complete on arrival?",
    answer:
      "Complete check-in with the DSO, set up bank account/phone, finalize housing, and attend orientation and advising.",
    tips: ["List 3–4 realistic tasks."]
  },
  {
    id: "weather-readiness",
    category: "Logistics",
    question: "Are you prepared for the local weather?",
    answer:
      "Yes. I’ve checked seasonal conditions and will plan appropriate clothing and commute timing.",
    tips: ["Shows practical awareness."]
  },
  {
    id: "emergency-plan",
    category: "Logistics",
    question: "What is your emergency plan in the U.S.?",
    answer:
      "I’ll maintain updated contacts with the university, keep key documents backed up, and follow campus safety guidance.",
    tips: ["Calm, responsible tone."]
  }

]
