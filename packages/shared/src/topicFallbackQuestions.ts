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
