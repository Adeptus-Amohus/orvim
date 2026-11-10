export const reviewSections = [
  {
    id: "inbox",
    title: "Inbox",
    prompt: "What needs a home?",
    hint: "Look through your captures. What needs action, a decision, or simply letting go?",
  },
  {
    id: "mind",
    title: "Mind",
    prompt: "What has been taking up space?",
    hint: "Notice what's been on your mind. What helped you feel clear or grounded?",
  },
  {
    id: "body",
    title: "Body",
    prompt: "What has your body been telling you?",
    hint: "Think about rest, movement, energy, and what you might need more of.",
  },
  {
    id: "work",
    title: "Work",
    prompt: "What moved forward?",
    hint: "What mattered in your work this week? What would you like to approach differently?",
  },
  {
    id: "money",
    title: "Money",
    prompt: "Is there anything to give attention to?",
    hint: "A payment, a decision, a question, or a small step toward feeling more settled.",
  },
  {
    id: "relationships",
    title: "Relationships",
    prompt: "Who has been on your mind?",
    hint: "Notice the people you connected with, and anyone you'd like to make space for.",
  },
  {
    id: "projects",
    title: "Projects",
    prompt: "Which projects still matter?",
    hint: "What needs a next action? What could be paused, finished, or put down?",
  },
  {
    id: "open_loops",
    title: "Open Loops",
    prompt: "What is still asking for your attention?",
    hint: "Promises, loose ends, decisions, things you've been meaning to do. Get them out of your head.",
  },
  {
    id: "wins",
    title: "Wins",
    prompt: "What are you glad happened?",
    hint: "Look beyond completed tasks. What felt meaningful, brave, kind, or simply good?",
  },
  {
    id: "next_week",
    title: "Next Week",
    prompt: "What would you like to make room for?",
    hint: "Choose up to three focuses. These are directions for your attention, not a test to pass.",
  },
] as const;
export type ReviewSection = (typeof reviewSections)[number]["id"];
