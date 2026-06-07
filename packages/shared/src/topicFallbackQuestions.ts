import type { QuestionInput } from "./types";
import { normalizeIntent, toTitleCase } from "./intentNormalization";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export function buildTopicFallbackQuestions(topicInput: string, questionCount: number): QuestionInput[] {
  const topic = normalizeTopic(topicInput);
  const lower = topic.toLowerCase();
  const pack =
    lower.includes("andaman")
      ? andamanQuestionPack(topic)
      : lower.includes("visa") || lower.includes("immigration")
      ? visaQuestionPack(topic)
      : lower.includes("spacetimedb")
          ? spacetimedbQuestionPack(topic)
          : lower.includes("space") || lower.includes("rocket") || lower.includes("nasa") || lower.includes("astronomy")
            ? spaceQuestionPack(topic)
          : lower.includes("database") || lower.includes("databases") || lower.includes("sql") || lower.includes("postgres")
            ? databaseQuestionPack(topic)
            : lower.includes("ai") || lower.includes("agent") || lower.includes("llm") || lower.includes("artificial intelligence")
              ? aiAgentsQuestionPack(topic)
              : lower.includes("startup") || lower.includes("founder") || lower.includes("venture")
                ? startupQuestionPack(topic)
                : lower.includes("formula 1") || lower.includes("f1") || lower.includes("grand prix")
                  ? formulaOneQuestionPack(topic)
                  : lower.includes("argentina") || lower.includes("buenos aires") || lower.includes("patagonia")
                    ? argentinaQuestionPack(topic)
                    : lower.includes("math") || lower.includes("logic") || lower.includes("probability")
                      ? mathQuestionPack(topic)
                      : lower.includes("history") || lower.includes("empire") || lower.includes("civilization")
                        ? historyQuestionPack(topic)
                        : lower.includes("fruit") || lower.includes("nutrition")
                          ? fruitQuestionPack(topic)
                          : generalKnowledgeQuestionPack();
  const questions: QuestionInput[] = [];
  for (let index = 0; index < questionCount; index += 1) {
    const source = pack[index % pack.length] ?? pack[0];
    if (!source) break;
    questions.push({
      ...source,
      questionText: source.questionText.replace(/\{topic\}/g, topic),
      explanation: source.explanation.replace(/\{topic\}/g, topic),
      topic: source.topic || topic
    });
  }
  return questions;
}

export function normalizeTopic(topicInput: string): string {
  const cleaned = topicInput.replace(/\s+/g, " ").trim();
  if (!cleaned) return "General Knowledge";
  const normalizedParts = cleaned
    .split(" + ")
    .map((part) => normalizeIntent(part).displayArenaName)
    .filter(Boolean)
    .slice(0, 3);
  return (normalizedParts.length ? normalizedParts : [toTitleCase(cleaned)]).join(" + ").slice(0, 80);
}

function visaQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In the {topic}, what is a visa generally used for?", ["Requesting entry", "Owning property", "Paying taxes", "Voting"], "A", "A visa is generally used to request permission to travel to a country for a stated purpose.", topic),
    q("Which document is a visa usually attached to or linked with?", ["Passport", "School ID", "Receipt", "Boarding pass"], "A", "Visas are usually placed in or electronically linked to a passport.", topic),
    q("What does a visa category usually describe?", ["Travel purpose", "Favorite city", "Phone model", "Hotel rating"], "A", "A visa category usually describes the purpose of travel, such as study, work, tourism, or exchange.", topic),
    q("Who commonly reviews visa applications outside the US?", ["Consular officer", "Airline pilot", "Hotel manager", "Bank teller"], "A", "Consular officers review many visa applications at embassies or consulates.", topic),
    q("What does overstaying usually mean?", ["Staying too long", "Booking early", "Flying direct", "Packing light"], "A", "Overstaying means remaining beyond the authorized period of stay.", topic),
    q("At a US port of entry, who makes the admission decision?", ["Border officer", "Taxi driver", "Tour guide", "Travel blogger"], "A", "A border officer makes the final admission decision at the port of entry.", topic),
    q("Why do forms ask for travel purpose?", ["Match the visa", "Pick an airline", "Choose a meal", "Rate a hotel"], "A", "Travel purpose helps match a person to the correct visa category and review path.", topic)
  ];
}

function fruitQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, which part usually protects seeds?", ["Fruit", "Root", "Stem", "Leaf"], "A", "A fruit develops around seeds and often helps protect or spread them.", topic),
    q("Which nutrient is citrus fruit famous for?", ["Vitamin C", "Iron", "Caffeine", "Salt"], "A", "Citrus fruits are widely known for vitamin C.", topic),
    q("What process helps fruit plants make sugars?", ["Photosynthesis", "Evaporation", "Rusting", "Freezing"], "A", "Plants use photosynthesis to make sugars from light, water, and carbon dioxide.", topic),
    q("Which fruit is botanically a berry?", ["Banana", "Carrot", "Potato", "Onion"], "A", "Botanically, bananas are classified as berries.", topic),
    q("Why do many fruits taste sweet?", ["Natural sugars", "Metal salts", "Chalk", "Air pressure"], "A", "Many ripe fruits contain natural sugars that create sweetness.", topic),
    q("What can fruit fiber support?", ["Digestion", "Jet engines", "Magnetism", "Screen brightness"], "A", "Dietary fiber from fruit can support normal digestion.", topic),
    q("Why do fruits ripen?", ["Seed dispersal", "Battery charging", "Rock melting", "Cloud forming"], "A", "Ripening makes many fruits more attractive for animals that help spread seeds.", topic)
  ];
}

function andamanQuestionPack(topic: string): QuestionInput[] {
  return [
    q("The {topic} are in which body of water?", ["Bay of Bengal", "Arabian Sea", "Red Sea", "Baltic Sea"], "A", "The Andaman Islands lie in the Bay of Bengal.", topic, ["andaman-location"]),
    q("Which Indian union territory includes the {topic}?", ["Andaman and Nicobar Islands", "Lakshadweep", "Delhi", "Puducherry"], "A", "The Andaman Islands are part of the Andaman and Nicobar Islands union territory.", topic, ["andaman-administration"]),
    q("What is the capital city of Andaman and Nicobar Islands?", ["Port Blair", "Kavaratti", "Panaji", "Kohima"], "A", "Port Blair is the capital of the Andaman and Nicobar Islands.", topic, ["andaman-capital"]),
    q("Which colonial prison is a major Port Blair landmark?", ["Cellular Jail", "Tihar Jail", "Aga Khan Palace", "Red Fort"], "A", "Cellular Jail in Port Blair is a major historic landmark.", topic, ["andaman-cellular-jail"]),
    q("Which island is also known as Swaraj Dweep?", ["Havelock Island", "Ross Island", "Neil Island", "Barren Island"], "A", "Havelock Island was renamed Swaraj Dweep.", topic, ["andaman-swaraj-dweep"]),
    q("What natural feature is Barren Island known for?", ["Active volcano", "Hot desert", "Salt glacier", "Coral atoll only"], "A", "Barren Island is known for India's only confirmed active volcano.", topic, ["andaman-barren-volcano"]),
    q("The Jarawa people are associated with which region?", ["Andaman Islands", "Sundarbans", "Thar Desert", "Nilgiri Hills"], "A", "The Jarawa are an Indigenous people of the Andaman Islands.", topic, ["andaman-jarawa"])
  ];
}

function spaceQuestionPack(topic: string): QuestionInput[] {
  return [
    q("Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"], "A", "Mars is commonly called the Red Planet because iron-rich dust gives it a reddish appearance.", topic, ["space-mars-red-planet"]),
    q("What force keeps planets in orbit around the Sun?", ["Gravity", "Friction", "Magnetism only", "Sound"], "A", "Gravity pulls planets toward the Sun while their motion carries them around it.", topic, ["space-gravity-orbits"]),
    q("Which agency operated the Apollo Moon missions?", ["NASA", "ESA", "ISRO", "JAXA"], "A", "NASA operated the Apollo program that landed astronauts on the Moon.", topic, ["space-nasa-apollo"]),
    q("What is a galaxy?", ["A huge star system", "A single planet", "A rocket engine", "A type of comet"], "A", "A galaxy is a massive system of stars, gas, dust, and dark matter bound by gravity.", topic, ["space-galaxy-definition"]),
    q("Which object orbits Earth and supports communication or observation?", ["Satellite", "Asteroid belt", "Volcano", "Coral reef"], "A", "Artificial satellites orbit Earth for communication, navigation, weather, science, and observation.", topic, ["space-satellites"]),
    q("What do rockets expel to move forward in spaceflight?", ["Exhaust", "Rain", "Sand", "Clouds"], "A", "Rockets move by expelling exhaust in one direction, creating thrust in the other.", topic, ["space-rocket-thrust"]),
    q("What is the Sun?", ["A star", "A planet", "A moon", "A spacecraft"], "A", "The Sun is the star at the center of the Solar System.", topic, ["space-sun-star"]),
    q("Which telescope is famous for deep-space images after launching in 1990?", ["Hubble", "Sputnik", "Voyager", "Artemis"], "A", "The Hubble Space Telescope launched in 1990 and produced many famous deep-space images.", topic, ["space-hubble"]),
    q("What is an exoplanet?", ["A planet outside our Solar System", "A moon crater", "A rocket stage", "A type of meteor"], "A", "An exoplanet is a planet that orbits a star outside our Solar System.", topic, ["space-exoplanet"]),
    q("Which craft have traveled into interstellar space?", ["Voyager probes", "Apollo landers", "Space shuttles", "GPS satellites"], "A", "NASA's Voyager probes have crossed into interstellar space after exploring the outer Solar System.", topic, ["space-voyager"])
  ];
}

function spacetimedbQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what is a reducer primarily responsible for?", ["Changing database state", "Compressing images", "Drawing CSS", "Hosting DNS"], "A", "Reducers are server-side functions that mutate SpacetimeDB tables transactionally.", topic, ["spacetimedb-reducers"]),
    q("Which feature lets clients react when subscribed data changes?", ["Subscriptions", "Static exports", "Cookies", "Image sprites"], "A", "SpacetimeDB clients subscribe to queries and receive updates as matching rows change.", topic, ["spacetimedb-subscriptions"]),
    q("Why should quiz scoring run in {topic} reducers instead of the browser?", ["The browser is untrusted", "CSS is slower", "Avatars need fonts", "QR codes need cameras"], "A", "Server-side reducers keep score, correctness, and ranking authoritative instead of trusting client code.", topic, ["spacetimedb-authoritative"]),
    q("Which race data should be stored as rows in {topic}?", ["Answers and scores", "Only button colors", "Only background images", "Only CSS shadows"], "A", "Answers, timing, scores, bracket state, final results, and share cards should be represented as database rows.", topic, ["spacetimedb-state-rows"]),
    q("What makes reducers useful for multiplayer game state?", ["Transactional commits", "Bigger fonts", "Offline images", "Manual refresh"], "A", "Reducer mutations commit atomically, so shared race state stays consistent for all subscribers.", topic, ["spacetimedb-transactions"]),
    q("In QuizRush, what should the projector render from {topic}?", ["Subscribed bracket rows", "Private correct answers", "Browser-local guesses", "Raw API keys"], "A", "The projector should render subscribed public rows such as bracket nodes, leaderboard rows, and live stats.", topic, ["spacetimedb-projector"]),
    q("What should a phone never receive before a quiz round resolves?", ["QuestionSecret rows", "QuestionPublic text", "Its own score", "Its avatar"], "A", "Correct answers live in hidden secret rows and should only be revealed after resolution.", topic, ["spacetimedb-question-secret"]),
    q("Why is a durable ShareCard slug stored in {topic}?", ["Links survive refresh", "Names become longer", "Buttons become purple", "Timers stop"], "A", "A share URL should point to a persisted ShareCard row, so it works in a new tab or after refresh.", topic, ["spacetimedb-sharecard"]),
    q("What does server-authoritative timing use as its official start point?", ["Round startsAtServerMs", "User nickname", "Screen width", "Avatar emoji"], "A", "Official response time is measured from the scheduled server start timestamp to server receipt.", topic, ["spacetimedb-timing"]),
    q("What is the best role for Vercel in a {topic}-backed realtime game?", ["Host the frontend", "Own live score state", "Store hidden answers", "Run browser subscriptions"], "A", "Vercel should host the web UI while SpacetimeDB owns realtime state and reducers.", topic, ["spacetimedb-vercel"])
  ];
}

function databaseQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what is a primary key used for?", ["Uniquely identifying rows", "Styling buttons", "Compressing images", "Playing sounds"], "A", "A primary key uniquely identifies a row in a table.", topic, ["database-primary-key"]),
    q("What does an index usually improve?", ["Lookup speed", "Image brightness", "Font size", "Audio volume"], "A", "Indexes help databases find rows more efficiently for common queries.", topic, ["database-index"]),
    q("What does ACID atomicity mean?", ["A transaction fully commits or rolls back", "Rows are always alphabetical", "Images load first", "Queries use emojis"], "A", "Atomicity means a transaction is applied completely or not applied at all.", topic, ["database-atomicity"]),
    q("Which query operation filters rows by conditions?", ["WHERE", "PAINT", "BEEP", "ZOOM"], "A", "A WHERE clause filters rows that match a condition.", topic, ["database-where"]),
    q("Why separate public question rows from secret answer rows?", ["To protect correct answers", "To remove indexes", "To slow subscriptions", "To hide avatars"], "A", "Separating public and secret data prevents clients from seeing correct answers too early.", topic, ["database-secret-split"]),
    q("What does a foreign key usually represent?", ["A relationship between rows", "A color palette", "A sound effect", "A QR code"], "A", "Foreign keys model relationships between records such as a participant and their answers.", topic, ["database-foreign-key"]),
    q("What is a database transaction?", ["A grouped unit of work", "A button animation", "A domain name", "A microphone event"], "A", "A transaction groups database changes so they commit consistently.", topic, ["database-transaction"]),
    q("Why store leaderboard rows instead of calculating only in the UI?", ["All clients share one truth", "Fonts render faster", "Images get smaller", "Sound becomes louder"], "A", "Database-backed leaderboard rows let every client subscribe to the same ranking state.", topic, ["database-leaderboard"]),
    q("Which structure helps many quiz answers point back to one player?", ["participantId", "borderRadius", "zIndex", "lineHeight"], "A", "A participantId connects answers, scores, final results, and share cards to one user.", topic, ["database-participant-id"]),
    q("What should happen to duplicate answer submissions?", ["Reject them", "Count both", "Double the score", "Hide the round"], "A", "A unique participant-round constraint should reject duplicate answers.", topic, ["database-duplicate-answer"])
  ];
}

function aiAgentsQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what does an agent usually combine?", ["Model reasoning plus tools", "Only CSS", "Only random numbers", "Only image filters"], "A", "An AI agent typically uses model reasoning with tools, memory, or workflow steps.", topic, ["ai-agents-tools"]),
    q("Why should a quiz agent cite source facts?", ["To reduce hallucinations", "To make fonts bigger", "To skip validation", "To hide answers"], "A", "Grounding generated questions in source facts reduces unsupported claims.", topic, ["ai-agents-grounding"]),
    q("What is a guardrail in an AI quiz pipeline?", ["A validation or safety rule", "A database password", "A color token", "A screen size"], "A", "Guardrails are checks that keep generated content safe, relevant, and schema-valid.", topic, ["ai-agents-guardrail"]),
    q("What does JSON schema validation prevent?", ["Malformed model output", "Fast tapping", "Avatar uploads", "QR scanning"], "A", "Schema validation rejects output that does not match the required question-pack structure.", topic, ["ai-agents-schema"]),
    q("Why use cache-first generation for {topic}?", ["Lower latency and cost", "More duplicate answers", "Larger images", "Less deterministic scoring"], "A", "Cache-first generation serves common topics quickly and reduces LLM calls.", topic, ["ai-agents-cache-first"]),
    q("What should happen if an LLM returns invalid quiz JSON?", ["Reject or fallback", "Publish anyway", "Give everyone points", "Show raw JSON"], "A", "Invalid model output should be rejected or replaced with a safe fallback pack.", topic, ["ai-agents-invalid-json"]),
    q("What is a tool call useful for in {topic}?", ["Fetching external facts", "Changing user scores directly", "Bypassing reducers", "Guessing identities"], "A", "Tools let agents retrieve facts, search pages, or call APIs before generating content.", topic, ["ai-agents-tool-call"]),
    q("Why keep scoring out of the AI agent?", ["Scores must be deterministic", "Agents cannot read text", "Browsers need secrets", "Topics need no facts"], "A", "Scoring should be deterministic and reducer-owned so all users trust the ranking.", topic, ["ai-agents-no-score"]),
    q("What does a fallback pack protect during a live demo?", ["Continuity under API failure", "Unlimited API spending", "Question secrecy", "CSS layout only"], "A", "Fallback packs keep the game playable when external AI or web APIs are slow or down.", topic, ["ai-agents-fallback"]),
    q("Which part should approve topic-specific MCQs before publishing?", ["Quality guard", "Leaderboard UI", "Confetti effect", "QR renderer"], "A", "A quality guard should reject generic, unsafe, or unsupported questions before they reach players.", topic, ["ai-agents-quality-guard"])
  ];
}

function startupQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what does product-market fit mean?", ["Strong market demand for a product", "A logo color match", "A legal filing only", "A random feature list"], "A", "Product-market fit means a product satisfies a real market need well enough to drive demand.", topic, ["startup-pmf"]),
    q("What is an MVP?", ["Minimum viable product", "Maximum viral pitch", "Monthly vendor plan", "Market value price"], "A", "An MVP is the simplest product version that can test core value with users.", topic, ["startup-mvp"]),
    q("Why do startups track retention?", ["To see if users return", "To pick fonts", "To buy domains", "To set avatars"], "A", "Retention shows whether users keep finding value after the first use.", topic, ["startup-retention"]),
    q("What does a runway measure?", ["Time before cash runs out", "Office floor length", "Server uptime only", "Number of competitors"], "A", "Runway estimates how long a company can operate before needing more cash.", topic, ["startup-runway"]),
    q("What is a pitch deck used for?", ["Explaining the business to investors", "Changing database rows", "Recording answer time", "Drawing bracket lines"], "A", "A pitch deck summarizes the problem, solution, market, traction, and ask.", topic, ["startup-pitch-deck"]),
    q("Why interview users before building too much?", ["Validate real pain points", "Increase button count", "Avoid all testing", "Replace analytics"], "A", "User interviews help test whether the problem and workflow are real.", topic, ["startup-user-interviews"]),
    q("What is a go-to-market strategy?", ["Plan to reach customers", "An app color system", "A database schema", "A speech transcript"], "A", "Go-to-market strategy explains how a product will find, sell to, and retain customers.", topic, ["startup-gtm"]),
    q("Which metric often matters for subscription products?", ["Monthly recurring revenue", "Screen brightness", "Keyboard height", "Icon radius"], "A", "Monthly recurring revenue tracks predictable subscription income.", topic, ["startup-mrr"]),
    q("What does churn mean?", ["Customers leaving", "New logo creation", "Server migration", "Question shuffling"], "A", "Churn measures users or revenue lost over a period.", topic, ["startup-churn"]),
    q("Why should a startup define its ICP?", ["Focus on ideal customers", "Avoid all sales", "Hide the product", "Disable analytics"], "A", "An ideal customer profile helps teams focus product, messaging, and sales effort.", topic, ["startup-icp"])
  ];
}

function formulaOneQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what is a Grand Prix?", ["A championship race event", "A tire brand only", "A pit-lane speed limit", "A steering wheel button"], "A", "A Grand Prix is an event in the Formula 1 championship calendar.", topic, ["f1-grand-prix"]),
    q("What does DRS help a Formula 1 car do?", ["Reduce drag on straights", "Add fuel mid-race", "Change drivers", "Start the safety car"], "A", "DRS opens a rear wing flap to reduce drag and aid overtaking in zones.", topic, ["f1-drs"]),
    q("What is a pit stop mainly used for in {topic}?", ["Changing tires", "Selling tickets", "Painting the car", "Replacing the driver every lap"], "A", "Pit stops are primarily used to change tires and sometimes repair damage.", topic, ["f1-pit-stop"]),
    q("What does pole position mean?", ["Starting first", "Finishing last", "Fastest pit stop", "Most penalties"], "A", "Pole position is the first starting spot, usually earned by the fastest qualifying lap.", topic, ["f1-pole"]),
    q("Which organization governs Formula 1 rules?", ["FIA", "NASA", "FIFA", "UNESCO"], "A", "The FIA is the governing body for international motorsport including Formula 1.", topic, ["f1-fia"]),
    q("What is a constructor in {topic}?", ["Team that builds/runs cars", "Track photographer", "Broadcast host", "Helmet painter"], "A", "A constructor is a team responsible for entering and building/running F1 cars.", topic, ["f1-constructor"]),
    q("Why do tire compounds matter in F1?", ["They affect grip and durability", "They set driver nationality", "They choose race city", "They control TV graphics"], "A", "Different tire compounds trade grip, degradation, and strategy options.", topic, ["f1-tire-compounds"]),
    q("What does a safety car do?", ["Controls pace after hazards", "Awards bonus points", "Refuels every car", "Ends qualifying"], "A", "A safety car slows and bunches the field when conditions are unsafe.", topic, ["f1-safety-car"]),
    q("What is qualifying used to determine?", ["Starting grid order", "Team budgets", "Race commentary", "Fan seating"], "A", "Qualifying sessions determine where drivers start the race.", topic, ["f1-qualifying"]),
    q("What does an undercut strategy try to gain?", ["Track position through an earlier stop", "More radio messages", "A slower tire change", "A later race start"], "A", "An undercut pits earlier to use fresh tires and gain time before rivals stop.", topic, ["f1-undercut"])
  ];
}

function argentinaQuestionPack(topic: string): QuestionInput[] {
  return [
    q("What is the capital of {topic}?", ["Buenos Aires", "Santiago", "Lima", "Montevideo"], "A", "Buenos Aires is the capital and largest city of Argentina.", topic, ["argentina-capital"]),
    q("{topic} is located mainly on which continent?", ["South America", "Europe", "Asia", "Africa"], "A", "Argentina is in southern South America.", topic, ["argentina-continent"]),
    q("Which mountain range runs along western Argentina?", ["Andes", "Alps", "Himalayas", "Rockies"], "A", "The Andes form much of Argentina's western border region.", topic, ["argentina-andes"]),
    q("What is Patagonia known for?", ["Southern landscapes and glaciers", "Tropical deserts only", "Ancient pyramids", "Coral reefs only"], "A", "Patagonia is known for dramatic southern landscapes, mountains, steppe, and glaciers.", topic, ["argentina-patagonia"]),
    q("Which dance is strongly associated with Argentina?", ["Tango", "Flamenco", "Ballet only", "Kabuki"], "A", "Tango developed around the Rio de la Plata region and is strongly associated with Argentina.", topic, ["argentina-tango"]),
    q("What is the Pampas region famous for?", ["Grasslands and agriculture", "Polar ice caps", "Volcanic islands", "Tundra forests"], "A", "The Pampas are fertile grasslands important for agriculture and ranching.", topic, ["argentina-pampas"]),
    q("Which language is most widely spoken in Argentina?", ["Spanish", "Portuguese", "French", "German"], "A", "Spanish is the official and most widely spoken language in Argentina.", topic, ["argentina-language"]),
    q("What is Aconcagua?", ["The highest mountain in the Americas", "A coastal city", "A river delta", "A rainforest"], "A", "Aconcagua in the Andes is the highest mountain in the Americas.", topic, ["argentina-aconcagua"]),
    q("Which sport is especially popular in Argentina?", ["Football", "Cricket", "Sumo", "Ice hockey only"], "A", "Football is deeply popular in Argentina and central to its sports culture.", topic, ["argentina-football"]),
    q("Which ocean borders Argentina to the east?", ["Atlantic Ocean", "Pacific Ocean", "Indian Ocean", "Arctic Ocean"], "A", "Argentina's eastern coast borders the South Atlantic Ocean.", topic, ["argentina-atlantic"])
  ];
}

function mathQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what is a prime number?", ["A number with exactly two positive factors", "Any even number", "A decimal only", "A negative fraction"], "A", "A prime number has exactly two positive factors: 1 and itself.", topic, ["math-prime"]),
    q("What does probability measure?", ["How likely an event is", "How loud a sound is", "How bright a color is", "How long a word is"], "A", "Probability measures the likelihood of an event, usually from 0 to 1.", topic, ["math-probability"]),
    q("What is the value of 3 squared?", ["9", "6", "12", "27"], "A", "Three squared means 3 multiplied by 3, which equals 9.", topic, ["math-square"]),
    q("What does a variable usually represent?", ["An unknown or changing value", "A fixed font", "A picture file", "A sound clip"], "A", "A variable is a symbol used to represent an unknown or changing value.", topic, ["math-variable"]),
    q("In logic, what does AND require?", ["Both statements true", "Either statement true", "No statement true", "Only the first false"], "A", "A logical AND is true only when both component statements are true.", topic, ["math-logic-and"]),
    q("What is the median of an ordered data set?", ["Middle value", "Largest value", "Smallest value", "Sum of all values"], "A", "The median is the middle value after the data is ordered.", topic, ["math-median"]),
    q("What does a percentage describe?", ["A part per hundred", "A part per thousand only", "A square root", "A prime factor"], "A", "Percent means per hundred.", topic, ["math-percent"]),
    q("What is an equation?", ["A statement that two expressions are equal", "A random list", "A color code", "A database index"], "A", "An equation states that two mathematical expressions have the same value.", topic, ["math-equation"]),
    q("What is 1/2 written as a decimal?", ["0.5", "0.2", "1.5", "2.0"], "A", "One half equals 0.5 as a decimal.", topic, ["math-half"]),
    q("What does a graph often show?", ["Relationships between quantities", "Only spelling rules", "Only sound waves", "Only avatar colors"], "A", "Graphs visualize relationships, patterns, or changes in quantities.", topic, ["math-graph"])
  ];
}

function historyQuestionPack(topic: string): QuestionInput[] {
  return [
    q("In {topic}, what is a primary source?", ["Evidence from the time studied", "A modern movie only", "A random guess", "A math formula"], "A", "A primary source comes from the period or event being studied.", topic, ["history-primary-source"]),
    q("What is chronology?", ["Ordering events by time", "Drawing maps only", "Counting votes only", "Naming planets"], "A", "Chronology is the arrangement of events in time order.", topic, ["history-chronology"]),
    q("Why do historians compare sources?", ["To check reliability and perspective", "To change font size", "To remove dates", "To avoid evidence"], "A", "Comparing sources helps evaluate reliability, bias, and context.", topic, ["history-source-comparison"]),
    q("What does BCE mean?", ["Before Common Era", "Basic Calendar Entry", "British Colonial Empire", "Before City Events"], "A", "BCE means Before Common Era.", topic, ["history-bce"]),
    q("Which factor often shapes civilizations?", ["Access to water and trade", "Only keyboard layout", "Only screen color", "Only avatar choice"], "A", "Water, geography, trade, and resources strongly influence civilizations.", topic, ["history-geography"]),
    q("What is an empire?", ["A large political unit ruling diverse territories", "A single village only", "A weather system", "A math symbol"], "A", "An empire controls multiple peoples or territories under one political authority.", topic, ["history-empire"]),
    q("What is archaeology?", ["Study of past societies through material remains", "Study of browser errors", "Study of app icons", "Study of live scores"], "A", "Archaeology examines artifacts, structures, and remains to understand past societies.", topic, ["history-archaeology"]),
    q("Why are timelines useful?", ["They show sequence and cause", "They hide all dates", "They randomize events", "They score quizzes"], "A", "Timelines help show order, duration, and possible cause-and-effect relationships.", topic, ["history-timeline"]),
    q("What is cultural diffusion?", ["Spread of ideas between societies", "A database backup", "A race timer", "A sound effect"], "A", "Cultural diffusion is the spread of ideas, practices, or technologies between groups.", topic, ["history-diffusion"]),
    q("What does historical context help explain?", ["Why events happened as they did", "Which color to use", "How to mute audio", "How to draw QR codes"], "A", "Historical context helps explain decisions, causes, and meanings within their time.", topic, ["history-context"])
  ];
}

function generalKnowledgeQuestionPack(): QuestionInput[] {
  const topic = "General Knowledge";
  return [
    q("Which planet is known as the Red Planet?", ["Mars", "Venus", "Jupiter", "Mercury"], "A", "Mars is commonly called the Red Planet because of its reddish appearance.", topic, ["general-mars"]),
    q("What gas do plants absorb during photosynthesis?", ["Carbon dioxide", "Oxygen", "Helium", "Nitrogen"], "A", "Plants absorb carbon dioxide during photosynthesis.", topic, ["general-photosynthesis"]),
    q("Which ocean is the largest on Earth?", ["Pacific Ocean", "Indian Ocean", "Atlantic Ocean", "Arctic Ocean"], "A", "The Pacific Ocean is Earth's largest ocean.", topic, ["general-pacific"]),
    q("Who wrote the play Romeo and Juliet?", ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], "A", "Romeo and Juliet is a play by William Shakespeare.", topic, ["general-shakespeare"]),
    q("What is the boiling point of water at sea level?", ["100°C", "50°C", "0°C", "200°C"], "A", "At standard sea-level pressure, water boils at 100°C.", topic, ["general-boiling"]),
    q("Which organ pumps blood through the human body?", ["Heart", "Liver", "Lung", "Kidney"], "A", "The heart pumps blood through the circulatory system.", topic, ["general-heart"]),
    q("Which continent is the Sahara Desert in?", ["Africa", "Asia", "Europe", "Australia"], "A", "The Sahara Desert is in Africa.", topic, ["general-sahara"])
  ];
}

function q(
  questionText: string,
  options: [string, string, string, string],
  correctOption: (typeof OPTION_KEYS)[number],
  explanation: string,
  topic: string,
  factIds: string[] = [factIdFor(topic, questionText)]
): QuestionInput {
  return {
    questionText,
    options: {
      A: options[0],
      B: options[1],
      C: options[2],
      D: options[3]
    },
    correctOption,
    explanation,
    topic,
    factIds
  };
}

function factIdFor(topic: string, questionText: string): string {
  return `${topic}-${questionText}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}
