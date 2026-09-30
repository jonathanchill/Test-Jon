export type ItemType =
  | 'flashcard'
  | 'gapfill'
  | 'choice'
  | 'transform'
  | 'errorspot'
  | 'translate'
  | 'dictation'
  | 'open';

export type Register = 'neutral' | 'informal' | 'slang' | 'vulgar';
export type Source = 'lesson' | 'sheet' | 'added';

export interface Item {
  id: string;
  unit: string;
  type: ItemType;
  /** The full, correct French. */
  fr: string;
  /** UK English translation. */
  en: string;
  /** gapfill: sentence with ___; transform/errorspot: source sentence; open: the prompt. */
  prompt_fr?: string;
  /** Accepted answers. */
  answers?: string[];
  /** choice items only. */
  choices?: string[];
  /** open items: model answer. */
  model?: string;
  note?: string;
  register: Register;
  source: Source;
  lesson_date: string | null;
  check: boolean;
  tts: boolean;
  tags?: string[];
}

export interface Unit {
  id: string;
  title: string;
  priority: 1 | 2 | 3;
  order: number;
  explanation: string;
  items: Item[];
}
