// A1 step-by-step course for Georgian speakers.
//
// Hand-written (not AI-generated) on purpose: at A1 every lesson has to
// introduce one small piece at a time ("I" → "I am" → "I am Giorgi") and
// then practise it through reading, writing, listening and speaking. A
// generated wall of text can't guarantee that order, and a curated path
// costs nothing per lesson.
//
// `{name}` is replaced with the learner's own name: Latin spelling in the
// English parts, their original spelling in the Georgian parts.

export type Skill = 'reading' | 'writing' | 'listening' | 'speaking';

export type Exercise =
  // Introduces a new word or phrase with a picture and audio.
  | { kind: 'teach'; en: string; ka: string; pic: string; note?: string }
  // Hear/see an English word, tap the matching picture.
  | { kind: 'pick_image'; en: string; options: { en: string; pic: string; ka: string }[] }
  // Read English, choose the Georgian meaning.
  | { kind: 'read_pick'; en: string; options: string[]; answer: string; pic?: string }
  // Build the English sentence from word tiles.
  | { kind: 'build'; ka: string; answer: string; alt?: string[]; extra: string[]; tip?: string }
  // Type the English. `dictate` shows the sentence to copy (first contact);
  // without it the learner translates from Georgian, with a hint button.
  | { kind: 'type'; ka: string; answer: string; alt?: string[]; dictate?: boolean; tip?: string; pic?: string }
  // Hear English, type what was said.
  | { kind: 'listen_type'; answer: string; alt?: string[]; ka: string; tip?: string }
  // Hear English, choose which sentence was said.
  | { kind: 'listen_pick'; en: string; options: string[] }
  // Read the sentence aloud (speech recognition).
  | { kind: 'speak'; en: string; ka: string }
  // Choose the missing word.
  | { kind: 'fill'; before: string; after: string; options: string[]; answer: string; ka: string; tip?: string };

export const EXERCISE_SKILLS: Record<Exercise['kind'], Skill[]> = {
  teach: ['reading', 'listening'],
  pick_image: ['reading', 'listening'],
  read_pick: ['reading'],
  build: ['writing'],
  type: ['writing'],
  listen_type: ['listening', 'writing'],
  listen_pick: ['listening'],
  speak: ['speaking'],
  fill: ['reading', 'writing'],
};

export interface CourseLesson {
  id: string;
  titleKa: string;
  titleEn: string;
  pic: string;
  exercises: Exercise[];
}

export interface CourseUnit {
  id: string;
  titleKa: string;
  titleEn: string;
  pic: string;
  lessons: CourseLesson[];
}

export const A1_COURSE: CourseUnit[] = [
  {
    id: 'u1',
    titleKa: 'გაცნობა',
    titleEn: 'Meeting people',
    pic: '👋',
    lessons: [
      {
        id: 'u1l1',
        titleKa: 'მე ვარ…',
        titleEn: 'I am…',
        pic: '🙋',
        exercises: [
          { kind: 'teach', en: 'I', ka: 'მე', pic: '🙋', note: '„I“ ყოველთვის დიდი ასოთი იწერება — წინადადების შუაშიც კი.' },
          { kind: 'teach', en: 'I am', ka: 'მე ვარ', pic: '🙋‍♂️', note: '„am“ ნიშნავს „ვარ“. „I“-ს შემდეგ ყოველთვის „am“ მოდის.' },
          { kind: 'read_pick', en: 'I am', options: ['მე ვარ', 'შენ ხარ', 'ის არის'], answer: 'მე ვარ' },
          { kind: 'teach', en: 'I am {name}', ka: 'მე ვარ {name}', pic: '😊', note: 'ასე ეცნობი ადამიანს: „I am“ + შენი სახელი.' },
          { kind: 'type', dictate: true, ka: 'მე ვარ {name}', answer: 'I am {name}', alt: ["I'm {name}"], tip: 'დაიწყე „I am“-ით, შემდეგ დაწერე შენი სახელი.' },
          { kind: 'build', ka: 'მე ვარ {name}', answer: 'I am {name}', alt: ["I'm {name}"], extra: ['is', 'you', 'are'], tip: '„I“-სთან ყოველთვის „am“ — არა „is“ ან „are“.' },
          { kind: 'listen_type', answer: 'I am {name}', alt: ["I'm {name}"], ka: 'მე ვარ {name}' },
          { kind: 'fill', before: 'I', after: '{name}.', options: ['am', 'is', 'are'], answer: 'am', ka: 'მე ვარ {name}.', tip: '„I“ + „am“. „is“ და „are“ სხვა სიტყვებთან მიდის.' },
          { kind: 'speak', en: 'I am {name}', ka: 'მე ვარ {name}' },
          { kind: 'type', ka: 'მე ვარ {name}', answer: 'I am {name}', alt: ["I'm {name}"], tip: 'სამი სიტყვა: I + am + შენი სახელი.' },
        ],
      },
      {
        id: 'u1l2',
        titleKa: 'გამარჯობა!',
        titleEn: 'Hello!',
        pic: '👋',
        exercises: [
          { kind: 'teach', en: 'Hello', ka: 'გამარჯობა', pic: '👋' },
          { kind: 'teach', en: 'My name is {name}', ka: 'მე მქვია {name}', pic: '📛', note: '„My name is“ = „ჩემი სახელია“. ეს იგივეა, რაც „I am {name}“.' },
          { kind: 'read_pick', en: 'My name is {name}', options: ['მე მქვია {name}', 'შენ გქვია {name}', 'მე ვარ კარგად'], answer: 'მე მქვია {name}' },
          { kind: 'build', ka: 'გამარჯობა, მე მქვია {name}', answer: 'Hello my name is {name}', extra: ['am', 'your', 'I'], tip: 'ჯერ „Hello“, შემდეგ „my name is“ და შენი სახელი.' },
          { kind: 'teach', en: 'Nice to meet you', ka: 'სასიამოვნოა შენი გაცნობა', pic: '🤝' },
          { kind: 'listen_pick', en: 'Nice to meet you', options: ['Nice to meet you', 'My name is', 'Hello'] },
          { kind: 'teach', en: 'Goodbye', ka: 'ნახვამდის', pic: '🙌' },
          { kind: 'pick_image', en: 'Hello', options: [
            { en: 'Hello', pic: '👋', ka: 'გამარჯობა' },
            { en: 'Goodbye', pic: '🙌', ka: 'ნახვამდის' },
            { en: 'Nice to meet you', pic: '🤝', ka: 'სასიამოვნოა' },
          ] },
          { kind: 'type', ka: 'მე მქვია {name}', answer: 'My name is {name}', tip: '„My name is“ + შენი სახელი.' },
          { kind: 'listen_type', answer: 'Nice to meet you', ka: 'სასიამოვნოა შენი გაცნობა' },
          { kind: 'speak', en: 'Hello, my name is {name}', ka: 'გამარჯობა, მე მქვია {name}' },
        ],
      },
      {
        id: 'u1l3',
        titleKa: 'როგორ ხარ?',
        titleEn: 'How are you?',
        pic: '🙂',
        exercises: [
          { kind: 'teach', en: 'How are you?', ka: 'როგორ ხარ?', pic: '🙂' },
          { kind: 'teach', en: 'I am fine', ka: 'კარგად ვარ', pic: '😊', note: 'ისევ „I am“! ახლა სახელის ნაცვლად — როგორ ხარ.' },
          { kind: 'teach', en: 'Thank you', ka: 'გმადლობ', pic: '🙏' },
          { kind: 'read_pick', en: 'Thank you', options: ['გმადლობ', 'ნახვამდის', 'გამარჯობა'], answer: 'გმადლობ' },
          { kind: 'teach', en: 'I am tired', ka: 'დაღლილი ვარ', pic: '😴' },
          { kind: 'teach', en: 'I am happy', ka: 'ბედნიერი ვარ', pic: '😄' },
          { kind: 'pick_image', en: 'tired', options: [
            { en: 'happy', pic: '😄', ka: 'ბედნიერი' },
            { en: 'tired', pic: '😴', ka: 'დაღლილი' },
            { en: 'fine', pic: '😊', ka: 'კარგად' },
          ] },
          { kind: 'fill', before: 'I', after: 'happy.', options: ['is', 'am', 'are'], answer: 'am', ka: 'ბედნიერი ვარ.' },
          { kind: 'build', ka: 'კარგად ვარ, გმადლობ', answer: 'I am fine thank you', alt: ["I'm fine thank you"], extra: ['is', 'you', 'are'] },
          { kind: 'listen_type', answer: 'How are you', ka: 'როგორ ხარ?' },
          { kind: 'type', ka: 'დაღლილი ვარ', answer: 'I am tired', alt: ["I'm tired"], pic: '😴' },
          { kind: 'speak', en: 'I am fine, thank you', ka: 'კარგად ვარ, გმადლობ' },
        ],
      },
    ],
  },
  {
    id: 'u2',
    titleKa: 'ოჯახი',
    titleEn: 'Family',
    pic: '👨‍👩‍👧',
    lessons: [
      {
        id: 'u2l1',
        titleKa: 'ჩემი ოჯახი',
        titleEn: 'My family',
        pic: '👩',
        exercises: [
          { kind: 'teach', en: 'mother', ka: 'დედა', pic: '👩' },
          { kind: 'teach', en: 'father', ka: 'მამა', pic: '👨' },
          { kind: 'pick_image', en: 'father', options: [
            { en: 'mother', pic: '👩', ka: 'დედა' },
            { en: 'father', pic: '👨', ka: 'მამა' },
          ] },
          { kind: 'teach', en: 'brother', ka: 'ძმა', pic: '👦' },
          { kind: 'teach', en: 'sister', ka: 'და', pic: '👧' },
          { kind: 'pick_image', en: 'sister', options: [
            { en: 'brother', pic: '👦', ka: 'ძმა' },
            { en: 'mother', pic: '👩', ka: 'დედა' },
            { en: 'sister', pic: '👧', ka: 'და' },
          ] },
          { kind: 'teach', en: 'This is my mother', ka: 'ეს არის დედაჩემი', pic: '👩', note: '„This is“ = „ეს არის“. „my“ = „ჩემი“.' },
          { kind: 'build', ka: 'ეს არის მამაჩემი', answer: 'This is my father', extra: ['am', 'mother', 'I'] },
          { kind: 'listen_pick', en: 'This is my brother', options: ['This is my brother', 'This is my sister', 'This is my mother'] },
          { kind: 'type', ka: 'ეს არის ჩემი და', answer: 'This is my sister', pic: '👧' },
          { kind: 'speak', en: 'This is my family', ka: 'ეს არის ჩემი ოჯახი' },
        ],
      },
      {
        id: 'u2l2',
        titleKa: 'ის არის…',
        titleEn: 'He is / She is',
        pic: '🧑‍🤝‍🧑',
        exercises: [
          { kind: 'teach', en: 'He is', ka: 'ის არის (კაცი)', pic: '👨', note: '„He“ — მამაკაცზე, „She“ — ქალზე. ორივესთან „is“.' },
          { kind: 'teach', en: 'She is', ka: 'ის არის (ქალი)', pic: '👩' },
          { kind: 'fill', before: 'She', after: 'my sister.', options: ['am', 'is', 'are'], answer: 'is', ka: 'ის ჩემი დაა.', tip: 'He / She + „is“.' },
          { kind: 'fill', before: 'I', after: '{name}.', options: ['am', 'is', 'are'], answer: 'am', ka: 'მე ვარ {name}.', tip: 'გაიხსენე: I + „am“.' },
          { kind: 'read_pick', en: 'He is my brother', options: ['ის ჩემი ძმაა', 'ის ჩემი დაა', 'მე ვარ ძმა'], answer: 'ის ჩემი ძმაა', pic: '👦' },
          { kind: 'build', ka: 'ის ჩემი დედაა', answer: 'She is my mother', alt: ["She's my mother"], extra: ['He', 'am', 'father'] },
          { kind: 'listen_type', answer: 'He is my father', alt: ["He's my father"], ka: 'ის მამაჩემია' },
          { kind: 'type', ka: 'ის ჩემი დაა', answer: 'She is my sister', alt: ["She's my sister"], tip: 'ქალზე ვსაუბრობთ — „She is“.' },
          { kind: 'speak', en: 'She is my mother', ka: 'ის დედაჩემია' },
        ],
      },
    ],
  },
  {
    id: 'u3',
    titleKa: 'საჭმელი და სასმელი',
    titleEn: 'Food & drinks',
    pic: '🍎',
    lessons: [
      {
        id: 'u3l1',
        titleKa: 'ვაშლი და პური',
        titleEn: 'Apple and bread',
        pic: '🍞',
        exercises: [
          { kind: 'teach', en: 'apple', ka: 'ვაშლი', pic: '🍎' },
          { kind: 'teach', en: 'bread', ka: 'პური', pic: '🍞' },
          { kind: 'teach', en: 'water', ka: 'წყალი', pic: '💧' },
          { kind: 'pick_image', en: 'bread', options: [
            { en: 'apple', pic: '🍎', ka: 'ვაშლი' },
            { en: 'bread', pic: '🍞', ka: 'პური' },
            { en: 'water', pic: '💧', ka: 'წყალი' },
          ] },
          { kind: 'teach', en: 'coffee', ka: 'ყავა', pic: '☕' },
          { kind: 'teach', en: 'milk', ka: 'რძე', pic: '🥛' },
          { kind: 'pick_image', en: 'milk', options: [
            { en: 'coffee', pic: '☕', ka: 'ყავა' },
            { en: 'milk', pic: '🥛', ka: 'რძე' },
            { en: 'apple', pic: '🍎', ka: 'ვაშლი' },
            { en: 'water', pic: '💧', ka: 'წყალი' },
          ] },
          { kind: 'teach', en: 'an apple', ka: 'ერთი ვაშლი', pic: '🍎', note: 'ხმოვნით დაწყებულ სიტყვასთან „an“ (an apple), სხვაგან „a“ (a coffee).' },
          { kind: 'fill', before: 'I want', after: 'apple.', options: ['a', 'an'], answer: 'an', ka: 'მინდა ვაშლი.', tip: '„apple“ ხმოვნით იწყება, ამიტომ „an“.' },
          { kind: 'listen_type', answer: 'water', ka: 'წყალი' },
          { kind: 'type', ka: 'ყავა', answer: 'coffee', pic: '☕' },
          { kind: 'speak', en: 'an apple', ka: 'ერთი ვაშლი' },
        ],
      },
      {
        id: 'u3l2',
        titleKa: 'მიყვარს / არ მიყვარს',
        titleEn: 'I like / I don’t like',
        pic: '☕',
        exercises: [
          { kind: 'teach', en: 'I like coffee', ka: 'მიყვარს ყავა', pic: '☕', note: '„I like“ = „მომწონს / მიყვარს“.' },
          { kind: 'teach', en: "I don't like milk", ka: 'არ მიყვარს რძე', pic: '🥛', note: 'უარყოფა: „I don’t like“ (= I do not like).' },
          { kind: 'read_pick', en: "I don't like coffee", options: ['არ მიყვარს ყავა', 'მიყვარს ყავა', 'მინდა ყავა'], answer: 'არ მიყვარს ყავა' },
          { kind: 'teach', en: 'I want water, please', ka: 'წყალი მინდა, თუ შეიძლება', pic: '💧', note: '„please“ = „თუ შეიძლება / გთხოვ“.' },
          { kind: 'build', ka: 'მიყვარს პური', answer: 'I like bread', extra: ['am', 'water', "don't"] },
          { kind: 'build', ka: 'არ მიყვარს ვაშლი', answer: "I don't like apples", alt: ['I do not like apples', "I don't like apple"], extra: ['am', 'is', 'milk'] },
          { kind: 'listen_pick', en: 'I want water, please', options: ['I want water, please', 'I like water', "I don't like water"] },
          { kind: 'listen_type', answer: 'I like coffee', ka: 'მიყვარს ყავა' },
          { kind: 'type', ka: 'ყავა მინდა, თუ შეიძლება', answer: 'I want coffee please', alt: ['I want a coffee please', 'Coffee please'], tip: '„I want“ + რა გინდა + „please“.' },
          { kind: 'speak', en: "I like apples, but I don't like milk", ka: 'მიყვარს ვაშლი, მაგრამ არ მიყვარს რძე' },
        ],
      },
    ],
  },
  {
    id: 'u4',
    titleKa: 'რიცხვები',
    titleEn: 'Numbers',
    pic: '🔢',
    lessons: [
      {
        id: 'u4l1',
        titleKa: '1-დან 5-მდე',
        titleEn: 'One to five',
        pic: '✋',
        exercises: [
          { kind: 'teach', en: 'one', ka: 'ერთი', pic: '1️⃣' },
          { kind: 'teach', en: 'two', ka: 'ორი', pic: '2️⃣' },
          { kind: 'teach', en: 'three', ka: 'სამი', pic: '3️⃣' },
          { kind: 'pick_image', en: 'two', options: [
            { en: 'one', pic: '1️⃣', ka: 'ერთი' },
            { en: 'two', pic: '2️⃣', ka: 'ორი' },
            { en: 'three', pic: '3️⃣', ka: 'სამი' },
          ] },
          { kind: 'teach', en: 'four', ka: 'ოთხი', pic: '4️⃣' },
          { kind: 'teach', en: 'five', ka: 'ხუთი', pic: '5️⃣' },
          { kind: 'pick_image', en: 'five', options: [
            { en: 'four', pic: '4️⃣', ka: 'ოთხი' },
            { en: 'three', pic: '3️⃣', ka: 'სამი' },
            { en: 'five', pic: '5️⃣', ka: 'ხუთი' },
          ] },
          { kind: 'listen_type', answer: 'three', ka: 'სამი' },
          { kind: 'type', ka: 'ოთხი', answer: 'four', pic: '4️⃣' },
          { kind: 'teach', en: 'two apples', ka: 'ორი ვაშლი', pic: '🍎🍎', note: 'ერთზე მეტი — სიტყვას ბოლოში „s“ ემატება: apple → apples.' },
          { kind: 'build', ka: 'სამი ვაშლი', answer: 'three apples', extra: ['apple', 'two', 'an'], tip: 'ერთზე მეტია — „apples“.' },
          { kind: 'speak', en: 'one, two, three, four, five', ka: 'ერთი, ორი, სამი, ოთხი, ხუთი' },
        ],
      },
      {
        id: 'u4l2',
        titleKa: '6-დან 10-მდე და ასაკი',
        titleEn: 'Six to ten, age',
        pic: '🎂',
        exercises: [
          { kind: 'teach', en: 'six', ka: 'ექვსი', pic: '6️⃣' },
          { kind: 'teach', en: 'seven', ka: 'შვიდი', pic: '7️⃣' },
          { kind: 'teach', en: 'eight', ka: 'რვა', pic: '8️⃣' },
          { kind: 'teach', en: 'nine', ka: 'ცხრა', pic: '9️⃣' },
          { kind: 'teach', en: 'ten', ka: 'ათი', pic: '🔟' },
          { kind: 'pick_image', en: 'eight', options: [
            { en: 'six', pic: '6️⃣', ka: 'ექვსი' },
            { en: 'eight', pic: '8️⃣', ka: 'რვა' },
            { en: 'nine', pic: '9️⃣', ka: 'ცხრა' },
          ] },
          { kind: 'listen_pick', en: 'seven', options: ['seven', 'six', 'ten'] },
          { kind: 'teach', en: 'I am ten years old', ka: 'ათი წლის ვარ', pic: '🎂', note: 'ასაკი: „I am“ + რიცხვი + „years old“. ისევ „I am“!' },
          { kind: 'build', ka: 'ცხრა წლის ვარ', answer: 'I am nine years old', alt: ["I'm nine years old"], extra: ['is', 'have', 'year'], tip: 'ქართულად „მაქვს“ არ ვამბობთ, ინგლისურშიც — „I am“, არა „I have“.' },
          { kind: 'listen_type', answer: 'I am ten years old', alt: ["I'm ten years old"], ka: 'ათი წლის ვარ' },
          { kind: 'type', ka: 'ექვსი', answer: 'six', pic: '6️⃣' },
          { kind: 'speak', en: 'I am ten years old', ka: 'ათი წლის ვარ' },
        ],
      },
    ],
  },
  {
    id: 'u5',
    titleKa: 'ფერები და ნივთები',
    titleEn: 'Colors & things',
    pic: '🎨',
    lessons: [
      {
        id: 'u5l1',
        titleKa: 'ფერები',
        titleEn: 'Colors',
        pic: '🎨',
        exercises: [
          { kind: 'teach', en: 'red', ka: 'წითელი', pic: '🔴' },
          { kind: 'teach', en: 'blue', ka: 'ლურჯი', pic: '🔵' },
          { kind: 'teach', en: 'green', ka: 'მწვანე', pic: '🟢' },
          { kind: 'pick_image', en: 'blue', options: [
            { en: 'red', pic: '🔴', ka: 'წითელი' },
            { en: 'green', pic: '🟢', ka: 'მწვანე' },
            { en: 'blue', pic: '🔵', ka: 'ლურჯი' },
          ] },
          { kind: 'teach', en: 'a red apple', ka: 'წითელი ვაშლი', pic: '🍎', note: 'ფერი სიტყვის წინ დგება: red apple — წითელი ვაშლი, ისევე როგორც ქართულში.' },
          { kind: 'teach', en: 'The car is blue', ka: 'მანქანა ლურჯია', pic: '🚙', note: '„The car is blue“ — „is“ ისევ საჭიროა, ქართულში „-ა“ ბოლოსართის ადგილას.' },
          { kind: 'build', ka: 'მანქანა წითელია', answer: 'The car is red', extra: ['am', 'blue', 'a'] },
          { kind: 'read_pick', en: 'a green apple', options: ['მწვანე ვაშლი', 'წითელი ვაშლი', 'მწვანე მანქანა'], answer: 'მწვანე ვაშლი', pic: '🍏' },
          { kind: 'listen_type', answer: 'The car is green', ka: 'მანქანა მწვანეა' },
          { kind: 'type', ka: 'ლურჯი მანქანა', answer: 'a blue car', alt: ['blue car', 'the blue car'], pic: '🚙' },
          { kind: 'speak', en: 'I like the red car', ka: 'მომწონს წითელი მანქანა' },
        ],
      },
      {
        id: 'u5l2',
        titleKa: 'გაიმეორე ყველაფერი',
        titleEn: 'Review',
        pic: '🏆',
        exercises: [
          { kind: 'read_pick', en: 'Hello! My name is Ana. I am ten years old. I like apples.', options: ['ანა ათი წლისაა და უყვარს ვაშლი', 'ანა ცხრა წლისაა და უყვარს ყავა', 'ანას არ უყვარს ვაშლი'], answer: 'ანა ათი წლისაა და უყვარს ვაშლი', pic: '👧' },
          { kind: 'fill', before: 'He', after: 'my father.', options: ['am', 'is', 'are'], answer: 'is', ka: 'ის მამაჩემია.' },
          { kind: 'build', ka: 'გამარჯობა, მე ვარ {name}', answer: 'Hello I am {name}', alt: ["Hello I'm {name}"], extra: ['is', 'my', 'you'] },
          { kind: 'listen_type', answer: 'Nice to meet you', ka: 'სასიამოვნოა შენი გაცნობა' },
          { kind: 'type', ka: 'ეს არის ჩემი ძმა', answer: 'This is my brother', pic: '👦' },
          { kind: 'listen_pick', en: 'I am happy', options: ['I am happy', 'I am tired', 'I am fine'] },
          { kind: 'type', ka: 'არ მიყვარს რძე', answer: "I don't like milk", alt: ['I do not like milk'], pic: '🥛' },
          { kind: 'speak', en: 'Hello! My name is {name}. Nice to meet you.', ka: 'გამარჯობა! მე მქვია {name}. სასიამოვნოა შენი გაცნობა.' },
        ],
      },
    ],
  },
];

export const ALL_LESSONS: CourseLesson[] = A1_COURSE.flatMap((u) => u.lessons);
