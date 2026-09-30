// The full curriculum, in order. Units without a content file yet still show
// on the map (greyed out) so the shape of the course is visible from day one.
export interface PlannedUnit {
  id: string;
  title: string;
  priority: 1 | 2 | 3;
  blurb: string;
}

export const CURRICULUM: PlannedUnit[] = [
  { id: 'subjunctive', title: 'The subjunctive', priority: 1, blurb: 'il faut que je sois, que j’aille, que je fasse' },
  { id: 'past', title: 'Talking about the past', priority: 1, blurb: 'passé composé vs imparfait, être vs avoir, devoir' },
  { id: 'future-conditional', title: 'Future, conditional and past conditional', priority: 2, blurb: 'je ferai, je vais faire, je voudrais, j’aurais su' },
  { id: 'mieux-meilleur', title: 'Meilleur / mieux, bon / bien, mauvais / mal, nul', priority: 1, blurb: 'adjective or adverb: the one-word test' },
  { id: 'gender-articles', title: 'Gender, agreement and articles', priority: 1, blurb: 'un problème, du, des, de after a negative' },
  { id: 'conjugation', title: 'Conjugation basics', priority: 1, blurb: 'tu fais, on vs nous, ne...pas, high-frequency verbs' },
  { id: 'pronouns-linking', title: 'Pronouns, prepositions and linking words', priority: 2, blurb: 'y, en, dont, personne, comme ça, en attendant' },
  { id: 'tricky-verbs', title: 'Tricky verbs and false friends', priority: 2, blurb: 'visiter vs aller voir, partir vs quitter, rendre, avoir l’air' },
  { id: 'vocab', title: 'Vocabulary by theme', priority: 3, blurb: 'home, people, feelings, work, studio, weather, numbers' },
  { id: 'phrases-slang', title: 'Phrases, idioms and slang', priority: 3, blurb: 'ça vaut le coup, aller de l’avant, c’est ouf' },
  { id: 'listening', title: 'Listening and pronunciation', priority: 1, blurb: 'word boundaries, liaison, silent consonants, the French R' },
];
