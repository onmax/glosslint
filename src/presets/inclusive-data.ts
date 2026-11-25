// Inclusive wording, written for glosslint. Avoid words that also have an ordinary technical
// sense, such as `master` for a git branch, appear only inside a phrase that pins their meaning.
import type { Term } from "../types.ts";

export const terms: Term[] = [
  {
    term: "allowlist",
    description: "A list of entries that are let through.",
    avoid: [{ word: "whitelist", why: "It ties white to good and permitted." }],
    examples: {
      good: ["Add the address to the allowlist."],
      bad: ["Add the address to the whitelist."],
    },
  },
  {
    term: "allowlisted",
    description: "On the list of entries that are let through.",
    avoid: [{ word: "whitelisted", why: "It ties white to good and permitted." }],
    examples: { good: ["The domain is allowlisted."], bad: ["The domain is whitelisted."] },
  },
  {
    term: "denylist",
    description: "A list of entries that are refused.",
    nuance: "Blocklist works too.",
    avoid: [{ word: "blacklist", why: "It ties black to bad and forbidden." }],
    examples: {
      good: ["Requests from the denylist are dropped."],
      bad: ["Requests from the blacklist are dropped."],
    },
  },
  {
    term: "denylisted",
    description: "On the list of entries that are refused.",
    avoid: [{ word: "blacklisted", why: "It ties black to bad and forbidden." }],
    examples: { good: ["The sender is denylisted."], bad: ["The sender is blacklisted."] },
  },
  {
    term: "primary",
    description: "The node that accepts writes and that the others copy from.",
    nuance: "Leader works for consensus systems. A git branch called master is not flagged.",
    avoid: [
      { word: "master server", why: "It borrows the language of slavery." },
      { word: "master node", why: "It borrows the language of slavery." },
      { word: "master database", why: "It borrows the language of slavery." },
      { word: "master process", why: "It borrows the language of slavery." },
    ],
    examples: {
      good: ["Writes go to the primary database."],
      bad: ["Writes go to the master database."],
    },
  },
  {
    term: "replica",
    description: "A node that copies the primary and serves reads.",
    nuance: "Follower, secondary or, for buses, target also work.",
    avoid: [{ word: "slave", why: "It borrows the language of slavery." }],
    examples: {
      good: ["Reads are spread across three replicas."],
      bad: ["Reads are spread across three slaves."],
    },
  },
  {
    term: "placeholder",
    description: "A stand-in value used until the real one exists.",
    nuance: "Sample or example data also work.",
    avoid: [
      { word: "dummy value", why: "Dummy has long been a slur for people who cannot speak." },
      { word: "dummy data", why: "Dummy has long been a slur for people who cannot speak." },
      { word: "dummy text", why: "Dummy has long been a slur for people who cannot speak." },
    ],
    examples: {
      good: ["Fill the form with a placeholder value."],
      bad: ["Fill the form with a dummy value."],
    },
  },
  {
    term: "everyone",
    description: "Every person you are addressing.",
    nuance: "Folks, all and team also work.",
    avoid: [
      { word: "guys", why: "It addresses a mixed group as men." },
      { word: "ladies and gentlemen", why: "It leaves out people who are neither." },
    ],
    examples: { good: ["Thanks, everyone, for testing."], bad: ["Thanks, guys, for testing."] },
  },
  {
    term: "person-hours",
    description: "A unit of work: one person working for one hour.",
    avoid: [{ word: "man-hours", why: "It counts only men as the people doing the work." }],
    examples: {
      good: ["The migration took 40 person-hours."],
      bad: ["The migration took 40 man-hours."],
    },
  },
  {
    term: "person-days",
    description: "A unit of work: one person working for one day.",
    avoid: [{ word: "man-days", why: "It counts only men as the people doing the work." }],
    examples: {
      good: ["We estimate 12 person-days for the redesign."],
      bad: ["We estimate 12 man-days for the redesign."],
    },
  },
  {
    term: "coherence check",
    description: "A quick test that a result is plausible before deeper work.",
    nuance: "Quick check or smoke test also work.",
    avoid: [
      { word: "sanity check", why: "It treats mental illness as a byword for being wrong." },
      { word: "sanity test", why: "It treats mental illness as a byword for being wrong." },
    ],
    examples: {
      good: ["Run a coherence check on the totals."],
      bad: ["Run a sanity check on the totals."],
    },
  },
  {
    term: "legacy",
    description: "Kept under the old rules after the rules changed.",
    nuance: "Exempt also works.",
    avoid: [
      {
        word: "grandfathered",
        why: "Grandfather clauses were written to keep Black men from voting.",
      },
      {
        word: "grandfather clause",
        why: "Grandfather clauses were written to keep Black men from voting.",
      },
    ],
    examples: {
      good: ["Existing plans keep their legacy price."],
      bad: ["Existing plans are grandfathered at the old price."],
    },
  },
  {
    term: "workforce",
    description: "The people available to do the work.",
    nuance: "Staff or people also work.",
    avoid: [{ word: "manpower", why: "It counts only men as the people doing the work." }],
    examples: {
      good: ["We lack the workforce for a weekend release."],
      bad: ["We lack the manpower for a weekend release."],
    },
  },
  {
    term: "artificial",
    description: "Made by people rather than occurring in nature.",
    nuance: "Synthetic or human-made also work.",
    avoid: [{ word: "man-made", why: "It credits only men with making things." }],
    examples: {
      good: ["The lake is artificial."],
      bad: ["The lake is man-made."],
    },
  },
  {
    term: "chair",
    description: "The person who runs a meeting or a committee.",
    nuance: "Chairperson also works.",
    avoid: [{ word: "chairman", why: "It assumes the person is a man." }],
    examples: {
      good: ["The chair opens the meeting."],
      bad: ["The chairman opens the meeting."],
    },
  },
  {
    term: "salesperson",
    description: "A person who sells to customers.",
    avoid: [{ word: "salesman", why: "It assumes the person is a man." }],
    examples: {
      good: ["Ask a salesperson for a quote."],
      bad: ["Ask a salesman for a quote."],
    },
  },
  {
    term: "spokesperson",
    description: "A person who speaks for an organisation.",
    avoid: [{ word: "spokesman", why: "It assumes the person is a man." }],
    examples: {
      good: ["A spokesperson confirmed the outage."],
      bad: ["A spokesman confirmed the outage."],
    },
  },
  {
    term: "humanity",
    description: "All people, taken together.",
    nuance: "Humankind or people also work.",
    avoid: [{ word: "mankind", why: "It names all people after men." }],
    examples: {
      good: ["A small step for humanity."],
      bad: ["A small step for mankind."],
    },
  },
  {
    term: "staffed",
    description: "Having people on duty.",
    avoid: [{ word: "manned", why: "It assumes the people on duty are men." }],
    examples: {
      good: ["The help desk is staffed until six."],
      bad: ["The help desk is manned until six."],
    },
  },
  {
    term: "uncrewed",
    description: "Running with no people on board.",
    avoid: [{ word: "unmanned", why: "It assumes a crew would be men." }],
    examples: {
      good: ["An uncrewed drone maps the site."],
      bad: ["An unmanned drone maps the site."],
    },
  },
  {
    term: "intermediary",
    description: "A party that sits between two others in a deal or a request.",
    nuance: "Broker or go-between also work.",
    avoid: [{ word: "middleman", why: "It assumes the party is a man." }],
    examples: {
      good: ["The proxy acts as an intermediary."],
      bad: ["The proxy acts as a middleman."],
    },
  },
  {
    term: "first-year student",
    description: "A student in their first year.",
    avoid: [{ word: "freshman", why: "It assumes the student is a man." }],
    examples: {
      good: ["Every first-year student gets a mentor."],
      bad: ["Every freshman gets a mentor."],
    },
  },
  {
    term: "degraded",
    description: "Working, but worse than it should.",
    nuance: "Hobbled, slowed or broken may fit better.",
    avoid: [
      { word: "crippled", why: "It uses disability as a byword for broken." },
      { word: "crippling", why: "It uses disability as a byword for broken." },
    ],
    examples: {
      good: ["The cache miss left the page degraded."],
      bad: ["The cache miss left the page crippled."],
    },
  },
  {
    term: "accessible",
    description: "Usable by people with disabilities.",
    avoid: [{ word: "handicapped", why: "Disabled people widely reject it as dated." }],
    examples: {
      good: ["Use the accessible entrance on the left."],
      bad: ["Use the handicapped entrance on the left."],
    },
  },
  {
    term: "wheelchair user",
    description: "A person who uses a wheelchair.",
    avoid: [
      { word: "wheelchair-bound", why: "A wheelchair gives freedom, it does not bind." },
      { word: "confined to a wheelchair", why: "A wheelchair gives freedom, it does not confine." },
    ],
    examples: {
      good: ["The route works for a wheelchair user."],
      bad: ["The route works for someone confined to a wheelchair."],
    },
  },
  {
    term: "surprising",
    description: "Not what you expected.",
    nuance: "Say what you mean: wild, absurd, unexpected or huge.",
    avoid: [
      { word: "insane", why: "It uses mental illness as a byword for extreme or wrong." },
      { word: "crazy", why: "It uses mental illness as a byword for extreme or wrong." },
    ],
    examples: {
      good: ["The speedup is surprising."],
      bad: ["The speedup is insane."],
    },
  },
  {
    term: "ignore",
    description: "To leave something unattended on purpose.",
    nuance: "Overlook also works.",
    avoid: [{ word: "turn a blind eye", why: "It uses blindness as a byword for not caring." }],
    examples: {
      good: ["We cannot ignore flaky tests."],
      bad: ["We cannot turn a blind eye to flaky tests."],
    },
  },
  {
    term: "easy task",
    description: "Work that takes little effort.",
    nuance: "Breeze also works.",
    avoid: [
      { word: "cakewalk", why: "It comes from a dance enslaved people were made to perform." },
    ],
    examples: {
      good: ["The upgrade was an easy task."],
      bad: ["The upgrade was a cakewalk."],
    },
  },
  {
    term: "undocumented knowledge",
    description: "What a team knows that is written down nowhere.",
    nuance: "Write it down, then link the page.",
    avoid: [
      { word: "tribal knowledge", why: "It uses indigenous peoples as a byword for primitive." },
    ],
    examples: {
      good: ["The deploy steps are undocumented knowledge."],
      bad: ["The deploy steps are tribal knowledge."],
    },
  },
  {
    term: "meeting",
    description: "People getting together to discuss something.",
    nuance: "Huddle or sync also work.",
    avoid: [{ word: "powwow", why: "It borrows a Native American ceremony for a work chat." }],
    examples: {
      good: ["Let us have a quick meeting after lunch."],
      bad: ["Let us have a quick powwow after lunch."],
    },
  },
  {
    term: "expert",
    description: "A person with deep skill in a field.",
    nuance: "Name the skill: senior engineer, Rust specialist.",
    avoid: [
      { word: "rockstar developer", why: "It reads as a call for one kind of brash person." },
      { word: "rockstar engineer", why: "It reads as a call for one kind of brash person." },
    ],
    examples: {
      good: ["We are hiring a frontend expert."],
      bad: ["We are hiring a rockstar developer."],
    },
  },
  {
    term: "ethical hacker",
    description: "A person who breaks into systems with permission, to find flaws.",
    avoid: [{ word: "white hat hacker", why: "It ties white to good." }],
    examples: {
      good: ["An ethical hacker found the leak."],
      bad: ["A white hat hacker found the leak."],
    },
  },
  {
    term: "malicious hacker",
    description: "A person who breaks into systems without permission, to do harm.",
    nuance: "Attacker also works.",
    avoid: [{ word: "black hat hacker", why: "It ties black to bad." }],
    examples: {
      good: ["A malicious hacker stole the keys."],
      bad: ["A black hat hacker stole the keys."],
    },
  },
  {
    term: "freeze period",
    description: "A stretch of time when changes are not allowed.",
    avoid: [
      { word: "blackout period", why: "It ties black to forbidden." },
      { word: "blackout window", why: "It ties black to forbidden." },
    ],
    examples: {
      good: ["No deploys during the freeze period."],
      bad: ["No deploys during the blackout period."],
    },
  },
  {
    term: "deceptive pattern",
    description: "A design that tricks people into doing what they did not mean to.",
    avoid: [{ word: "dark pattern", why: "It ties dark to bad, and says less than deceptive." }],
    examples: {
      good: ["A hidden unsubscribe link is a deceptive pattern."],
      bad: ["A hidden unsubscribe link is a dark pattern."],
    },
  },
  {
    term: "they",
    description: "A person whose gender you do not know or that does not matter.",
    avoid: [{ word: "he or she", why: "It leaves out people who are neither." }],
    examples: {
      good: ["When a rider signs up, they get a code."],
      bad: ["When a rider signs up, he or she gets a code."],
    },
  },
  {
    term: "their",
    description: "Belonging to a person whose gender you do not know or that does not matter.",
    avoid: [{ word: "his or her", why: "It leaves out people who are neither." }],
    examples: {
      good: ["Each rider sets their own PIN."],
      bad: ["Each rider sets his or her own PIN."],
    },
  },
];
