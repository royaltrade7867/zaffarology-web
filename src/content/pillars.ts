/**
 * Exact content transcribed from the "5-Success Pillars" workbook PDF,
 * with the word "workbook" replaced by "app" per project requirement.
 * Field behaviour (static vs dynamic) follows plan v2.
 */

export type StepKind =
  | 'static' // heading + subtext only, no input
  | 'text' // single text input
  | 'goal-list' // dynamic list: goal text + goal date
  | 'problem-list' // dynamic list of problems, each with up to 20 solutions
  | 'dynamic-list' // dynamic list of text entries
  | 'fixed-5'; // five numbered text inputs

export interface PillarStep {
  num: string;
  heading: string;
  subtext?: string;
  kind: StepKind;
  fieldKey: string;
  listLabel?: string;
}

export interface Pillar {
  id: number;
  title: string;
  tagline: string;
  steps: PillarStep[];
  summary: string;
  coreTruth: string;
  zaffarSays: string;
  /** pillars with their own dedicated screens */
  special?: 'daily' | 'huddles' | 'records' | 'systems';
}

export const APP_TITLE = 'Zaffarology';
export const APP_MOTTO = 'MASTER YOUR MIND, BUILD YOUR LEGACY';
export const APP_BADGE = '30 Years Of Business Success';
export const APP_QUESTION = 'How can you achieve 30 years of business success in just 3 years?';

export const HOW_TO_USE = {
  title: 'How to Use This App',
  purposeTitle: 'Purpose of This App',
  sections: [
    {
      heading: 'Purpose of This App',
      body: 'This app is designed to help participants understand, reflect on, and take immediate action on each Success Pillar. It is not only a reading tool, but a practical guide for personal and business growth.',
    },
    {
      heading: 'Read, Understand and Reflect',
      body: 'Participants should carefully read and understand each Success Pillar. As they go through the app, they should write their own notes, reflect on the key lessons, and connect the ideas to their own life, business, goals and challenges.',
    },
    {
      heading: 'Complete the Key Takeaways',
      body: 'After each Success Pillar, participants should complete the key takeaways. This will help them identify the most important lessons, remember the main points, and clearly understand what needs to be applied.',
    },
    {
      heading: 'Take Practical Action',
      body: 'The most important part of this app is execution. Participants should not only read the app, they must apply it. Each participant should identify practical actions they can implement in their personal or business life.',
    },
    {
      heading: 'Apply Within One Week',
      body: 'Participants should aim to implement the lessons and action points within one week of the workshop. Ideally, action should begin immediately after the workshop while the learning, motivation and commitment are still fresh.',
    },
    {
      heading: 'Final Message',
      body: 'Success comes from understanding, commitment, consistent action and persistence. When knowledge is followed by action, real transformation begins.',
    },
  ],
  zaffarSays:
    'Success in any project comes from clear goals, daily action, consistent follow-up, and persistence.',
  zaffarSays2:
    'Success is not in planning, talking, or waiting. Real results come from execution, execution, and execution.',
};

export const PILLARS: Pillar[] = [
  {
    id: 1,
    title: 'EXACT GOAL AND PLAN',
    tagline: 'Turn your dreams into clear goals, daily action, and real achievement',
    steps: [
      {
        num: '01',
        heading: 'Knowing Your Exact Goal',
        subtext: 'Knowing Your Exact Plan',
        kind: 'goal-list',
        fieldKey: 'p1_goals',
        listLabel: 'Goal',
      },
    ],
    summary:
      'You must first understand how your brain works, because your thoughts control your emotions, actions, and results. Success starts with awareness of your mind and a decision to change from within.\n\nClear goals give your dream direction and turn confusion into action. Learning from the right people helps you grow faster and avoid mistakes. Daily action builds momentum, discipline, persistence, and real achievement.',
    coreTruth:
      'Success is built on the right mindset, clear goals, daily action, guidance and persistence, always asking your brain two powerful questions: How? and What is the solution?',
    zaffarSays: 'Dreams become reality only when backed by clear vision and consistent execution.',
  },
  {
    id: 2,
    title: 'PROBLEM SOLVING',
    tagline: 'Turn every problem into a clear solution through action, persistence, and learning',
    steps: [
      {
        num: '01',
        heading: 'Diagnose The Real Problem',
        subtext: 'Understand the root cause clearly before doing anything',
        kind: 'problem-list',
        fieldKey: 'p2_problems',
        listLabel: 'Problem',
      },
    ],
    // workbook step 02 text - rendered per-problem inside the solutions list
    summary:
      'Great problem solving begins by diagnosing the real problem, not reacting to the surface issue. Once the root cause is clear, explore different solutions before choosing the best one. A practical plan turns your chosen solution into focused and measurable action.\n\nAction gives feedback, and adaptation helps you improve until the problem is solved. Every miracle usually comes after persistence, learning, and at least 20 serious attempts.',
    coreTruth:
      'Great problem solvers diagnose deeply, plan carefully, act boldly, and persist relentlessly, knowing every miracle is earned through at least 20 attempts.',
    zaffarSays: 'Every problem is an opportunity, those who solve faster, grow faster.',
  },
  {
    id: 3,
    title: 'AM PLANNING & PM ACHIEVEMENT (MONEY)',
    // AM/PM section text lives in P3_CONTENT below (dedicated daily-tracker screen)
    tagline: 'One daily rhythm that compounds over 90 days',
    special: 'daily',
    steps: [],
    summary:
      'AM Planning means choosing 1-5 money-making actions before the day begins. PM Achievement means checking at night whether those actions were completed. This simple daily rhythm creates focus, discipline, and accountability.\n\nIf the tasks are not completed, carry it forward and do it the next day. Repeated for 90 days, this process builds consistency, momentum and business growth.',
    coreTruth:
      '1-5 focused, income producing actions each morning, followed by an honest nightly review, build client trust and compound into business growth within 90 days.',
    zaffarSays: 'Plan, act, review, stay consistent and persist.',
  },
  {
    id: 4,
    title: '2-MINUTE HUDDLE MEETINGS (ACCOUNTABILITY MEETINGS)',
    tagline: 'A fast daily check-in to track progress, confirm ownership, and lock in deadlines',
    special: 'huddles',
    steps: [
      {
        num: '01',
        heading: 'Assign Project or Task',
        subtext: 'Set a clear agenda with a due date and accountable person for every task or project',
        kind: 'static',
        fieldKey: 'p4_assign_task',
      },
      {
        num: '02',
        heading: 'Assign Accountability',
        subtext: 'Every task must have one clearly named person responsible for completion',
        kind: 'static',
        fieldKey: 'p4_accountability',
      },
      {
        num: '03',
        heading: 'Set a Due Date',
        subtext: 'Every task must have a clear completion deadline before the huddle ends',
        kind: 'static',
        fieldKey: 'p4_due_date',
      },
      {
        num: '04',
        heading: 'Three Words Only',
        subtext:
          'Each person must report their status in three words: completed, not completed, or new date',
        kind: 'static',
        fieldKey: 'p4_three_words',
      },
      {
        num: '05',
        heading: 'Submit If Absent',
        subtext:
          'If absent, send your update in advance using three words: completed, not completed, or new due date',
        kind: 'static',
        fieldKey: 'p4_absent',
      },
    ],
    summary:
      '2-minute huddles keep the team focused. Every meeting needs a clear agenda. Every task needs one owner and one due date.\n\nUpdates must be short and clear. If a task is missed three times, discuss one-on-one.',
    coreTruth:
      'Huddle discussions must stay confidential, respectful, and focused on results, not blame. If a task is missed three times, hold a one-on-one meeting to find the root cause and move it forward.',
    zaffarSays: 'Short huddles, clear ownership, real results.',
  },
  {
    id: 5,
    title: 'DEPARTMENT OF LOYALTY',
    tagline:
      'Loyalty is earned when people feel genuinely valued, protected, respected, and proud to grow with you, not used by you',
    steps: [
      {
        num: '01',
        heading: 'Loyalty Idea',
        kind: 'dynamic-list',
        fieldKey: 'p5_ideas',
        listLabel: 'Loyalty Idea',
      },
    ],
    summary:
      'Loyalty is built through genuine relationships, not money, gifts, or favours. People stay loyal when they feel valued, respected, supported, and understood. Consistency, honesty, and reliability build trust over time.\n\nRespect, care, appreciation, and positive experiences strengthen commitment. True loyalty grows when people feel genuinely cared for, not just used for business.',
    coreTruth:
      'Loyalty is the foundation of strong relationships at work, with clients and in life. Build such deep trust that you could ask, "Would you marry me?" Once that level of trust exists, making a sale becomes a very small step.',
    zaffarSays: 'Loyalty is earned through trust, care, respect, and consistency.',
  },
  {
    id: 6,
    title: 'DEPARTMENT OF AI',
    tagline: 'AI drives innovation, efficiency and advantage. Build a future-ready organisation',
    steps: [
      {
        num: '01',
        heading: 'Identify The Need',
        subtext: 'Find where AI can save time and improve results',
        kind: 'dynamic-list',
        fieldKey: 'p6_needs',
        listLabel: 'Need',
      },
      {
        num: '02',
        heading: 'Found The Right Solution',
        subtext: 'Train staff to use AI effectively, finalise the system and set a clear implementation date.',
        kind: 'dynamic-list',
        fieldKey: 'p6_solutions',
        listLabel: 'Solution',
      },
    ],
    summary:
      'AI is no longer a future concept; it is a transformative tool driving innovation, efficiency, and competitive advantage. Build a future-ready organisation.',
    coreTruth:
      'AI gives a business advantage when used with proper testing, training, human judgement, and continuous improvement.',
    zaffarSays:
      'A company that does not use AI will stay behind, but AI without human judgement and supervision is also no good.',
  },
  {
    id: 7,
    title: 'DEPARTMENT OF RECORD KEEPING',
    tagline:
      'A critical yet overlooked pillar of success; 25-30% of work time is wasted searching for documents',
    special: 'records',
    steps: [
      {
        num: '01',
        heading: 'Categorise And Store Alphabetically',
        subtext:
          'Store all digital files in one central system, organised alphabetically, so any document can be found within 30 seconds',
        kind: 'static',
        fieldKey: 'p7_categorise',
      },
    ],
    summary:
      'An alphabetical filing system makes it much easier to find documents within 30 seconds. Every staff member must be trained to use the system properly, because if the right file cannot be found immediately, the business may lose valuable time, momentum, and major opportunities.',
    coreTruth:
      'Good record keeping must be simple, alphabetical, consistent, and easy for everyone to use.',
    zaffarSays:
      'File everything alphabetically, train everyone properly, and make every document easy to find.',
  },
  {
    id: 8,
    title: 'BUSINESS SYSTEMS',
    tagline: 'Business systems define roles, structure and goals, supported by training and reviews',
    special: 'systems',
    steps: [],
    summary:
      'Business systems create clarity by defining roles, responsibilities, expected effort, outcomes, timelines, training, evaluations, and growth pathways, with fortnightly reviews once work has commenced, so every task moves from plan to result.',
    coreTruth:
      'Business growth follows clear systems: responsibility, accountability, sustainability, scalability, and automation. Without accountability, performance becomes HELLABILITY.',
    zaffarSays: 'Responsibility plus accountability creates sustainability, scalability, and automation.',
  },
];

/** Pillar 8 - Business Systems field definitions (workbook page 18, v2 field spec) */
export const SYSTEM_FIELDS = {
  header: [
    { key: 'department', label: 'Department' },
    { key: 'system_name', label: 'System Name' },
    { key: 'system_no', label: 'System No' },
  ],
  reportingFrequencyOptions: ['Daily', 'Weekly', 'Monthly', 'Annually', 'Custom'] as const,
  singles: [
    { num: '02', key: 'responsible_person', label: 'Responsible Person', subtext: 'Who is responsible for completing the task?' },
    { num: '03', key: 'accountable_person', label: 'Accountable Person', subtext: 'Who is answerable if the task is not completed?' },
    { num: '04', key: 'guide_person', label: 'Guide, Helper and Reporting Person', subtext: 'Who will guide, support, and report progress?' },
    { num: '05', key: 'job_progression', label: 'Staff Job Progression', subtext: 'What is the next career step for this staff member?' },
    { num: '07', key: 'effort_questions', label: 'Effort Questions', subtext: 'What effort are expected clearly?' },
    { num: '08', key: 'result_questions', label: 'Result Questions', subtext: 'What result are expected clearly?' },
    { num: '09', key: 'how_process', label: 'How (Step-By-Step Process)', subtext: 'What is the step-by-step process to complete it?' },
    { num: '12', key: 'fortnightly_review', label: 'Fortnightly Progress Review and Accountability', subtext: 'What progress will be reviewed every fortnight?' },
  ],
  reportingFrequency: { num: '01', key: 'reporting_frequency', label: 'Reporting Frequency', subtext: 'How often must progress be reported?' },
  jobDescription: { num: '06', key: 'job_descriptions', label: 'Job Description', subtext: 'Is the job description clear and updated?' },
  training: {
    num: '10',
    key: 'training',
    label: 'Training',
    subtext: 'When will training be completed?',
    fields: [
      { key: 'date', label: 'Training Date' },
      { key: 'trainer', label: 'Trainer' },
      { key: 'trainee', label: 'Trainee' },
      { key: 'remarks', label: 'Remarks' },
    ],
  },
  evaluation: {
    num: '11',
    key: 'evaluation',
    label: 'Evaluation and Implementation',
    subtext:
      'When will it be evaluated, and if successful, what will be the implementation date?',
    fields: [
      { key: 'evaluator', label: 'Evaluator' },
      { key: 'trainee', label: 'Trainee (who was evaluated)' },
      { key: 'date', label: 'Date' },
      { key: 'outcome', label: 'Outcome' },
    ],
  },
} as const;

export const ABOUT_ZAFFAR = {
  title: 'About Zaffar Khan',
  role: 'Business Acceleration Specialist',
  intro:
    'Zaffar Khan is a Business Acceleration Specialist, entrepreneur, global speaker, mentor and author of more than 50 books. He brings 40 years of practical business experience across multiple industries.\n\nZaffar’s expertise is helping businesses achieve 30 years of success in just 3 years.',
  sections: [
    {
      heading: 'From Humble Beginnings to Business Success',
      body: 'Zaffar began his journey working as a cleaner, taxi driver and labourer. Through discipline, consistency, persistence, strong systems, hard work and focused execution, he transformed challenges into opportunities and built highly successful businesses.',
    },
    {
      heading: 'Proven Business Achievements',
      body: 'Zaffar established Australia’s largest Australian Government accredited taxi training centre.\n\nIn New Zealand, he established a taxi company that became the second largest in the country within only 12 months.\n\nHe also built a home doctor service that became the second largest in Australia.\n\nHe later founded a disability services business that grew to 2,400 employees in less than four years. This included 1,200 dedicated staff providing support 24/7 to people with disabilities across 185 locations throughout Australia.',
    },
    {
      heading: 'An Extraordinary Life Story',
      body: 'A Bollywood production team is developing a movie inspired by Zaffar’s extraordinary life journey. The movie is expected to be released in cinemas by 30 November 2026.',
    },
    {
      heading: 'The Zaffarology Philosophy',
      body: 'Zaffar has experienced both great success and major setbacks. These experiences shaped his powerful belief that stagnation is worse than loss.\n\nThrough the Zaffarology 5 Pillars of Business Success, he shares practical systems, discipline and strategies to help individuals and businesses accelerate their growth.',
    },
    {
      heading: "Zaffar's Message is Simple:",
      body: 'Real success is not about never failing.\nReal success is never giving up.',
    },
  ],
  contact: {
    email: 'info@zaffarology.com',
    website: 'www.ZaffarKhan.com',
  },
};

export const CORE_TAKEAWAYS_COUNT = 5;
export const MAX_SOLUTIONS_PER_PROBLEM = 20;
export const DAILY_ACTIONS_MAX = 5;
export const DAILY_PROGRAM_DAYS = 90;

/** Pillar 2 - workbook step 02 text, shown with each problem's solutions list */
export const P2_SOLUTIONS = {
  heading: 'Possible Solution No. 1',
  headingFor: (n: number) => `Possible Solution No. ${n}`,
  subtext:
    'Before thinking of giving up, try at least 20 times and keep asking: What is the solution? How can I make it work?',
} as const;

/** Pillar 3 - workbook AM/PM section text (page 8) */
export const P3_CONTENT = {
  amLabel: 'AM PLANNING',
  amHeading: 'Plan Your Money Moves',
  amSubtext: 'Choose the 1 to 5 actions that can bring money into the business',
  pmLabel: 'PM ACHIEVEMENT',
  pmHeading: 'Achieved',
} as const;
