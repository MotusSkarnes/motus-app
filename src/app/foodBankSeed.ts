import { uid } from "./storage";
import type { FoodCategoryId, FoodItem } from "./foodBankTypes";

type SeedRow = {
  name: string;
  category: FoodCategoryId;
  origin: string;
  emoji: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  sodium?: number;
  portionLabel?: string;
  portionGrams?: number;
};

const SEED_ROWS: SeedRow[] = [
  { name: "Kyllingbryst", category: "proteinkilder", origin: "Kjøtt & fjærkre", emoji: "🍗", kcal: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, saturatedFat: 1, sodium: 74 },
  { name: "Kyllinglår uten skinn", category: "proteinkilder", origin: "Kjøtt & fjærkre", emoji: "🍗", kcal: 177, protein: 24, carbs: 0, fat: 9, fiber: 0, sugar: 0, saturatedFat: 2.5, sodium: 85 },
  { name: "Storfekjøtt mager", category: "proteinkilder", origin: "Kjøtt", emoji: "🥩", kcal: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, sugar: 0, saturatedFat: 6, sodium: 72 },
  { name: "Laks", category: "proteinkilder", origin: "Fisk & sjømat", emoji: "🐟", kcal: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0, saturatedFat: 3, sodium: 59 },
  { name: "Torsk", category: "proteinkilder", origin: "Fisk & sjømat", emoji: "🐟", kcal: 82, protein: 18, carbs: 0, fat: 0.7, fiber: 0, sugar: 0, saturatedFat: 0.1, sodium: 54 },
  { name: "Tunfisk i vann", category: "proteinkilder", origin: "Fisk & sjømat", emoji: "🐟", kcal: 116, protein: 26, carbs: 0, fat: 0.8, fiber: 0, sugar: 0, saturatedFat: 0.2, sodium: 320 },
  { name: "Egg", category: "proteinkilder", origin: "Egg", emoji: "🥚", kcal: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, sugar: 1.1, saturatedFat: 3.3, sodium: 124, portionLabel: "2 stk", portionGrams: 100 },
  { name: "Eggewite", category: "proteinkilder", origin: "Egg", emoji: "🥚", kcal: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, sugar: 0.7, saturatedFat: 0, sodium: 166 },
  { name: "Skyr naturell", category: "proteinkilder", origin: "Meieri", emoji: "🥣", kcal: 63, protein: 11, carbs: 4, fat: 0.2, fiber: 0, sugar: 4, saturatedFat: 0.1, sodium: 40, portionLabel: "1 beger", portionGrams: 130 },
  { name: "Cottage cheese", category: "proteinkilder", origin: "Meieri", emoji: "🧀", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0, sugar: 2.7, saturatedFat: 1.7, sodium: 364, portionLabel: "150 g", portionGrams: 150 },
  { name: "Tofu fast", category: "proteinkilder", origin: "Plantebasert", emoji: "🧈", kcal: 144, protein: 17, carbs: 3, fat: 8, fiber: 2, sugar: 0.7, saturatedFat: 1.2, sodium: 14 },
  { name: "Kalkunkjøtt", category: "proteinkilder", origin: "Kjøtt & fjærkre", emoji: "🦃", kcal: 135, protein: 30, carbs: 0, fat: 1, fiber: 0, sugar: 0, saturatedFat: 0.3, sodium: 68 },
  { name: "Skinke", category: "proteinkilder", origin: "Pålegg", emoji: "🥓", kcal: 120, protein: 20, carbs: 1, fat: 4, fiber: 0, sugar: 0.5, saturatedFat: 1.5, sodium: 900, portionLabel: "30 g", portionGrams: 30 },
  { name: "Leverpostei", category: "proteinkilder", origin: "Pålegg", emoji: "🍖", kcal: 270, protein: 12, carbs: 4, fat: 22, fiber: 0, sugar: 2, saturatedFat: 8, sodium: 650, portionLabel: "20 g", portionGrams: 20 },
  { name: "Reker", category: "proteinkilder", origin: "Fisk & sjømat", emoji: "🦐", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0, sugar: 0, saturatedFat: 0.1, sodium: 111 },
  { name: "Svin indrefilet", category: "proteinkilder", origin: "Kjøtt", emoji: "🥩", kcal: 143, protein: 26, carbs: 0, fat: 3.5, fiber: 0, sugar: 0, saturatedFat: 1.2, sodium: 62 },
  { name: "Proteinpulver whey", category: "proteinkilder", origin: "Kosttilskudd", emoji: "🥤", kcal: 400, protein: 80, carbs: 8, fat: 6, fiber: 0, sugar: 4, saturatedFat: 2, sodium: 200, portionLabel: "30 g", portionGrams: 30 },
  { name: "Karbonadedeig mager", category: "proteinkilder", origin: "Kjøtt", emoji: "🍔", kcal: 176, protein: 20, carbs: 0, fat: 10, fiber: 0, sugar: 0, saturatedFat: 4, sodium: 75 },

  { name: "Havregryn", category: "karbohydrater", origin: "Korn", emoji: "🌾", kcal: 379, protein: 13, carbs: 67, fat: 7, fiber: 10, sugar: 1, saturatedFat: 1.2, sodium: 2 },
  { name: "Basmatiris kokt", category: "karbohydrater", origin: "Korn", emoji: "🍚", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, saturatedFat: 0.1, sodium: 1 },
  { name: "Basmatiris tørr", category: "karbohydrater", origin: "Korn", emoji: "🍚", kcal: 350, protein: 7.5, carbs: 78, fat: 0.6, fiber: 1.3, sugar: 0.1, saturatedFat: 0.1, sodium: 1 },
  { name: "Fullkornspasta kokt", category: "karbohydrater", origin: "Korn", emoji: "🍝", kcal: 124, protein: 5, carbs: 26, fat: 0.5, fiber: 3.5, sugar: 0.6, saturatedFat: 0.1, sodium: 1 },
  { name: "Søtpotet", category: "karbohydrater", origin: "Rotfrukter", emoji: "🍠", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, sugar: 4.2, saturatedFat: 0, sodium: 55 },
  { name: "Potet kokt", category: "karbohydrater", origin: "Rotfrukter", emoji: "🥔", kcal: 87, protein: 2, carbs: 20, fat: 0.1, fiber: 1.8, sugar: 0.8, saturatedFat: 0, sodium: 5 },
  { name: "Quinoa kokt", category: "karbohydrater", origin: "Korn", emoji: "🥣", kcal: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, sugar: 0.9, saturatedFat: 0.2, sodium: 7 },
  { name: "Bulgur kokt", category: "karbohydrater", origin: "Korn", emoji: "🌾", kcal: 83, protein: 3.1, carbs: 19, fat: 0.2, fiber: 4.5, sugar: 0.4, saturatedFat: 0, sodium: 5 },
  { name: "Couscous kokt", category: "karbohydrater", origin: "Korn", emoji: "🥘", kcal: 112, protein: 3.8, carbs: 23, fat: 0.2, fiber: 1.4, sugar: 0.1, saturatedFat: 0, sodium: 5 },
  { name: "Rugbrød", category: "karbohydrater", origin: "Bakst", emoji: "🍞", kcal: 220, protein: 8, carbs: 42, fat: 2, fiber: 6, sugar: 3, saturatedFat: 0.4, sodium: 430, portionLabel: "1 skive", portionGrams: 40 },
  { name: "Grovt brød", category: "karbohydrater", origin: "Bakst", emoji: "🍞", kcal: 247, protein: 9, carbs: 43, fat: 3.5, fiber: 7, sugar: 4, saturatedFat: 0.6, sodium: 400, portionLabel: "1 skive", portionGrams: 45 },
  { name: "Banana", category: "karbohydrater", origin: "Frukt", emoji: "🍌", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, saturatedFat: 0.1, sodium: 1, portionLabel: "1 stk", portionGrams: 120 },
  { name: "Honning", category: "karbohydrater", origin: "Søtning", emoji: "🍯", kcal: 304, protein: 0.3, carbs: 82, fat: 0, fiber: 0.2, sugar: 82, saturatedFat: 0, sodium: 4, portionLabel: "1 ss", portionGrams: 21 },

  { name: "Olivenolje", category: "fettkilder", origin: "Olje", emoji: "🫒", kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, saturatedFat: 14, sodium: 2, portionLabel: "1 ss", portionGrams: 14 },
  { name: "Avokado", category: "fettkilder", origin: "Frukt", emoji: "🥑", kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, sugar: 0.7, saturatedFat: 2.1, sodium: 7, portionLabel: "1/2 stk", portionGrams: 100 },
  { name: "Mandler", category: "fettkilder", origin: "Nøtter", emoji: "🌰", kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12, sugar: 4.4, saturatedFat: 3.8, sodium: 1, portionLabel: "30 g", portionGrams: 30 },
  { name: "Valnøtter", category: "fettkilder", origin: "Nøtter", emoji: "🥜", kcal: 654, protein: 15, carbs: 14, fat: 65, fiber: 7, sugar: 2.6, saturatedFat: 6.1, sodium: 2, portionLabel: "30 g", portionGrams: 30 },
  { name: "Peanøttsmør", category: "fettkilder", origin: "Nøtter", emoji: "🥜", kcal: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, sugar: 9, saturatedFat: 10, sodium: 17, portionLabel: "1 ss", portionGrams: 16 },
  { name: "Smør", category: "fettkilder", origin: "Meieri", emoji: "🧈", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81, fiber: 0, sugar: 0.1, saturatedFat: 51, sodium: 11, portionLabel: "1 ts", portionGrams: 5 },
  { name: "Kokosolje", category: "fettkilder", origin: "Olje", emoji: "🥥", kcal: 862, protein: 0, carbs: 0, fat: 100, fiber: 0, sugar: 0, saturatedFat: 87, sodium: 0, portionLabel: "1 ss", portionGrams: 14 },
  { name: "Chiafrø", category: "fettkilder", origin: "Frø", emoji: "🌱", kcal: 486, protein: 17, carbs: 42, fat: 31, fiber: 34, sugar: 0, saturatedFat: 3.3, sodium: 16, portionLabel: "1 ss", portionGrams: 12 },

  { name: "Brokkoli", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥦", kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, sugar: 1.7, saturatedFat: 0.1, sodium: 33 },
  { name: "Spinat", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥬", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, sugar: 0.4, saturatedFat: 0.1, sodium: 79 },
  { name: "Tomat", category: "gronnsaker", origin: "Grønnsaker", emoji: "🍅", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, saturatedFat: 0, sodium: 5 },
  { name: "Agurk", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥒", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, sugar: 1.7, saturatedFat: 0, sodium: 2 },
  { name: "Paprika", category: "gronnsaker", origin: "Grønnsaker", emoji: "🫑", kcal: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1, sugar: 4.2, saturatedFat: 0.1, sodium: 4 },
  { name: "Gulrot", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥕", kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7, saturatedFat: 0, sodium: 69 },
  { name: "Squash", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥒", kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1, sugar: 2.5, saturatedFat: 0.1, sodium: 8 },
  { name: "Blomkål", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥦", kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2, sugar: 1.9, saturatedFat: 0.1, sodium: 30 },
  { name: "Asparges", category: "gronnsaker", origin: "Grønnsaker", emoji: "🌿", kcal: 20, protein: 2.2, carbs: 3.9, fat: 0.1, fiber: 2.1, sugar: 1.9, saturatedFat: 0, sodium: 2 },
  { name: "Rødbete", category: "gronnsaker", origin: "Grønnsaker", emoji: "🫜", kcal: 43, protein: 1.6, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 7, saturatedFat: 0, sodium: 78 },
  { name: "Salat mix", category: "gronnsaker", origin: "Grønnsaker", emoji: "🥗", kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2, fiber: 1.2, sugar: 0.8, saturatedFat: 0, sodium: 28 },
  { name: "Løk", category: "gronnsaker", origin: "Grønnsaker", emoji: "🧅", kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, sugar: 4.2, saturatedFat: 0, sodium: 4 },
  { name: "Hvitløk", category: "gronnsaker", origin: "Grønnsaker", emoji: "🧄", kcal: 149, protein: 6.4, carbs: 33, fat: 0.5, fiber: 2.1, sugar: 1, saturatedFat: 0.1, sodium: 17 },

  { name: "Eple", category: "frukt-baer", origin: "Frukt", emoji: "🍎", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sugar: 10, saturatedFat: 0, sodium: 1, portionLabel: "1 stk", portionGrams: 180 },
  { name: "Appelsin", category: "frukt-baer", origin: "Frukt", emoji: "🍊", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4, sugar: 9, saturatedFat: 0, sodium: 0, portionLabel: "1 stk", portionGrams: 130 },
  { name: "Blåbær", category: "frukt-baer", origin: "Bær", emoji: "🫐", kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, fiber: 2.4, sugar: 10, saturatedFat: 0, sodium: 1 },
  { name: "Jordbær", category: "frukt-baer", origin: "Bær", emoji: "🍓", kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2, sugar: 4.9, saturatedFat: 0, sodium: 1 },
  { name: "Bringebær", category: "frukt-baer", origin: "Bær", emoji: "🍇", kcal: 52, protein: 1.2, carbs: 12, fat: 0.7, fiber: 6.5, sugar: 4.4, saturatedFat: 0, sodium: 1 },
  { name: "Mango", category: "frukt-baer", origin: "Frukt", emoji: "🥭", kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6, sugar: 14, saturatedFat: 0.1, sodium: 1 },
  { name: "Druer", category: "frukt-baer", origin: "Frukt", emoji: "🍇", kcal: 69, protein: 0.7, carbs: 18, fat: 0.2, fiber: 0.9, sugar: 16, saturatedFat: 0.1, sodium: 2 },
  { name: "Ananas", category: "frukt-baer", origin: "Frukt", emoji: "🍍", kcal: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4, sugar: 10, saturatedFat: 0, sodium: 1 },
  { name: "Kiwi", category: "frukt-baer", origin: "Frukt", emoji: "🥝", kcal: 61, protein: 1.1, carbs: 15, fat: 0.5, fiber: 3, sugar: 9, saturatedFat: 0, sodium: 3 },
  { name: "Pære", category: "frukt-baer", origin: "Frukt", emoji: "🍐", kcal: 57, protein: 0.4, carbs: 15, fat: 0.1, fiber: 3.1, sugar: 10, saturatedFat: 0, sodium: 1 },

  { name: "Helmelk", category: "meieriprodukter", origin: "Meieri", emoji: "🥛", kcal: 64, protein: 3.4, carbs: 4.8, fat: 3.6, fiber: 0, sugar: 4.8, saturatedFat: 2.1, sodium: 44, portionLabel: "2 dl", portionGrams: 200 },
  { name: "Lettmelk", category: "meieriprodukter", origin: "Meieri", emoji: "🥛", kcal: 46, protein: 3.5, carbs: 4.9, fat: 1.5, fiber: 0, sugar: 4.9, saturatedFat: 0.9, sodium: 44, portionLabel: "2 dl", portionGrams: 200 },
  { name: "Skummet melk", category: "meieriprodukter", origin: "Meieri", emoji: "🥛", kcal: 35, protein: 3.4, carbs: 5, fat: 0.1, fiber: 0, sugar: 5, saturatedFat: 0.1, sodium: 44, portionLabel: "2 dl", portionGrams: 200 },
  { name: "Yoghurt naturell", category: "meieriprodukter", origin: "Meieri", emoji: "🥣", kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fiber: 0, sugar: 4.7, saturatedFat: 2.1, sodium: 46 },
  { name: "Gresk yoghurt", category: "meieriprodukter", origin: "Meieri", emoji: "🥣", kcal: 97, protein: 9, carbs: 3.6, fat: 5, fiber: 0, sugar: 3.2, saturatedFat: 3.2, sodium: 36 },
  { name: "Fløte 38%", category: "meieriprodukter", origin: "Meieri", emoji: "🥛", kcal: 345, protein: 2.1, carbs: 3, fat: 37, fiber: 0, sugar: 3, saturatedFat: 23, sodium: 40, portionLabel: "1 ss", portionGrams: 15 },
  { name: "Mozzarella", category: "meieriprodukter", origin: "Meieri", emoji: "🧀", kcal: 280, protein: 28, carbs: 3.1, fat: 17, fiber: 0, sugar: 1, saturatedFat: 11, sodium: 627, portionLabel: "50 g", portionGrams: 50 },
  { name: "Norvegia lett", category: "meieriprodukter", origin: "Meieri", emoji: "🧀", kcal: 280, protein: 27, carbs: 0, fat: 18, fiber: 0, sugar: 0, saturatedFat: 11, sodium: 600, portionLabel: "30 g", portionGrams: 30 },
  { name: "Fetaost", category: "meieriprodukter", origin: "Meieri", emoji: "🧀", kcal: 264, protein: 14, carbs: 4, fat: 21, fiber: 0, sugar: 4, saturatedFat: 15, sodium: 1116, portionLabel: "40 g", portionGrams: 40 },
  { name: "Rømme lett", category: "meieriprodukter", origin: "Meieri", emoji: "🥣", kcal: 160, protein: 3.2, carbs: 4.5, fat: 15, fiber: 0, sugar: 4.5, saturatedFat: 9, sodium: 40, portionLabel: "2 ss", portionGrams: 30 },

  { name: "Bønner kidney kokt", category: "karbohydrater", origin: "Belgfrukter", emoji: "🫘", kcal: 127, protein: 8.7, carbs: 23, fat: 0.5, fiber: 7.4, sugar: 0.3, saturatedFat: 0.1, sodium: 2 },
  { name: "Kikerter kokt", category: "karbohydrater", origin: "Belgfrukter", emoji: "🫘", kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6, sugar: 4.8, saturatedFat: 0.3, sodium: 7 },
  { name: "Linser kokt", category: "karbohydrater", origin: "Belgfrukter", emoji: "🥣", kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9, sugar: 1.8, saturatedFat: 0.1, sodium: 2 },
  { name: "Hummus", category: "fettkilder", origin: "Pålegg", emoji: "🧆", kcal: 166, protein: 8, carbs: 14, fat: 9.6, fiber: 6, sugar: 0.3, saturatedFat: 1.4, sodium: 379, portionLabel: "2 ss", portionGrams: 30 },
  { name: "Granola", category: "karbohydrater", origin: "Frokost", emoji: "🥣", kcal: 471, protein: 10, carbs: 64, fat: 20, fiber: 7, sugar: 20, saturatedFat: 3, sodium: 26, portionLabel: "50 g", portionGrams: 50 },
  { name: "Riskaker", category: "karbohydrater", origin: "Snacks", emoji: "🍘", kcal: 387, protein: 8, carbs: 81, fat: 2.8, fiber: 2.4, sugar: 0.5, saturatedFat: 0.6, sodium: 3, portionLabel: "2 stk", portionGrams: 18 },
  { name: "Müsli", category: "karbohydrater", origin: "Frokost", emoji: "🥣", kcal: 352, protein: 9, carbs: 66, fat: 6, fiber: 8, sugar: 20, saturatedFat: 1, sodium: 6, portionLabel: "50 g", portionGrams: 50 },
  { name: "Makrell i tomat", category: "proteinkilder", origin: "Fisk & sjømat", emoji: "🐟", kcal: 205, protein: 14, carbs: 0.5, fat: 16, fiber: 0, sugar: 0.3, saturatedFat: 3.5, sodium: 400, portionLabel: "1 boks", portionGrams: 170 },
  { name: "Kyllingwok grønnsaker", category: "gronnsaker", origin: "Ferdigblanding", emoji: "🥘", kcal: 65, protein: 3.5, carbs: 8, fat: 2, fiber: 2.5, sugar: 3, saturatedFat: 0.3, sodium: 320 },
  { name: "Proteinbar", category: "proteinkilder", origin: "Kosttilskudd", emoji: "🍫", kcal: 360, protein: 30, carbs: 35, fat: 12, fiber: 5, sugar: 18, saturatedFat: 5, sodium: 180, portionLabel: "1 stk", portionGrams: 60 },
  { name: "Sjokolade mørk 70%", category: "fettkilder", origin: "Snacks", emoji: "🍫", kcal: 598, protein: 7.8, carbs: 45, fat: 43, fiber: 11, sugar: 24, saturatedFat: 24, sodium: 20, portionLabel: "20 g", portionGrams: 20 },
  { name: "Iskaffe protein", category: "meieriprodukter", origin: "Drikke", emoji: "☕", kcal: 55, protein: 10, carbs: 3, fat: 0.5, fiber: 0, sugar: 2, saturatedFat: 0.2, sodium: 50, portionLabel: "330 ml", portionGrams: 330 },
];

export function buildDefaultFoodBankItems(createdBy = "Motus PT"): FoodItem[] {
  const baseDate = "2024-01-12T10:00:00.000Z";
  return SEED_ROWS.map((row, index) => ({
    id: uid(`food-seed-${index}`),
    name: row.name,
    portionLabel: row.portionLabel ?? "100 g",
    portionGrams: row.portionGrams ?? 100,
    category: row.category,
    origin: row.origin,
    source: "matvaretabell" as const,
    createdBy,
    createdAt: baseDate,
    imageEmoji: row.emoji,
    isCustom: false,
    nutritionPer100g: {
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      fiber: row.fiber ?? 0,
      sugar: row.sugar ?? 0,
      saturatedFat: row.saturatedFat ?? 0,
      sodium: row.sodium ?? 0,
    },
  }));
}
