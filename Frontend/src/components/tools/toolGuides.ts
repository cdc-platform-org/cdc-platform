// "How to use" guides for every digital tool, in Georgian and English.
// Other locales fall back to English. Keep each step short and concrete:
// a learner should be able to follow it without leaving the page.

export type ToolGuideKey = 'childrensBook' | 'exam' | 'englishTutor' | 'businessAi' | 'educatorHub' | 'mediaStudio';

export interface ToolGuide {
  title: string;
  intro: string;
  steps: { t: string; d: string }[];
  tips: string[];
  faq: { q: string; a: string }[];
}

type GuideSet = Record<ToolGuideKey, ToolGuide>;

const ka: GuideSet = {
  childrensBook: {
    title: 'როგორ შევქმნათ პერსონალური საბავშვო წიგნი',
    intro: 'რამდენიმე წუთში აღწერთ ბავშვს, AI კი წერს ზღაპარს, ხატავს ილუსტრაციებს და ამზადებს PDF-სა და გახმოვანებას.',
    steps: [
      { t: 'წიგნი', d: 'აირჩიეთ წიგნის სიგრძე, ენა და ჩაწერეთ სათაური ან თემა.' },
      { t: 'მთავარი გმირი', d: 'ჩაწერეთ ბავშვის სახელი, ასაკი, ხასიათი და საყვარელი რამ. ატვირთეთ ფოტო, რომ გმირი ბავშვს დაემსგავსოს.' },
      { t: 'დამატებით', d: 'სურვილისამებრ დაამატეთ და-ძმა, სხვა პერსონაჟები, მიძღვნა და შრიფტი. ეს ნაბიჯი შეგიძლიათ გამოტოვოთ.' },
      { t: 'სტილი და შეკვეთა', d: 'აირჩიეთ ილუსტრაციის სტილი, თუ გაქვთ, ჩაწერეთ პრომო კოდი და დააჭირეთ „წიგნის შექმნას“.' },
      { t: 'ტექსტის დამტკიცება და გადახდა', d: 'წაიკითხეთ ზღაპრის ტექსტი, საჭიროებისამებრ შეასწორეთ, მერე გადაიხადეთ. ილუსტრაციები მხოლოდ ამის შემდეგ იხატება.' },
      { t: 'მზა წიგნი', d: 'როცა წიგნი მზად იქნება, გახსენით მკითხველში, ჩამოტვირთეთ PDF ან მოუსმინეთ გახმოვანებას.' },
    ],
    tips: [
      'ფოტოზე ბავშვის სახე კარგად უნდა ჩანდეს: პირდაპირ კამერაში, კარგ განათებაზე, სათვალისა და ქუდის გარეშე.',
      'რაც უფრო კონკრეტულია ხასიათი და საყვარელი რამ (მაგ. „უყვარს დინოზავრები და ველოსიპედი“), მით უფრო პირადი გამოდის ზღაპარი.',
      'გენერაციას რამდენიმე წუთი სჭირდება. გვერდის დახურვა შეგიძლიათ, წიგნი „ჩემს წიგნებში“ დაგხვდებათ.',
    ],
    faq: [
      { q: 'სად შევიყვანო პრომო კოდი?', a: 'ბოლო ნაბიჯზე („სტილი და შეკვეთა“) და გადახდის ეკრანზე. ფასდაკლება შეჯამებაში მაშინვე ჩანს.' },
      { q: 'თუ რომელიმე ილუსტრაცია არ მომეწონა?', a: 'წიგნის გვერდზე შეგიძლიათ გვერდის თავიდან დახატვა მოითხოვოთ.' },
    ],
  },
  exam: {
    title: 'როგორ ჩავატაროთ AI გამოცდა ზედამხედველობით',
    intro: 'ატვირთავთ სასწავლო მასალას, AI ადგენს კითხვებს, მოსწავლეები კი ბმულით აბარებენ გამოცდას კამერის ზედამხედველობით.',
    steps: [
      { t: 'ახალი გამოცდა', d: 'დააჭირეთ „+ ახალი გამოცდა“, ჩაწერეთ სახელი და თემა.' },
      { t: 'მასალა', d: 'ატვირთეთ PDF ან ფოტოები, ჩასვით ტექსტი, ან მიუთითეთ YouTube ვიდეო. AI კითხვებს მხოლოდ ამ მასალიდან, მასალის ენაზე შეადგენს.' },
      { t: 'პარამეტრები', d: 'აირჩიეთ კითხვების რაოდენობა (1-50) და ხანგრძლივობა. სურვილისამებრ დაამატეთ ღია კითხვა, რომელსაც AI აფასებს.' },
      { t: 'კითხვების შემოწმება', d: '„კითხვების“ ჩანართში გადახედეთ და საჭიროებისამებრ შეასწორეთ კითხვები და სწორი პასუხები.' },
      { t: 'ბმულის გაზიარება', d: 'დააკოპირეთ გამოცდის ბმული და გაუგზავნეთ მოსწავლეებს. თითოეულ მოსწავლეს კითხვები და პასუხები სხვა რიგით ხვდება.' },
      { t: 'შედეგები', d: 'ნახეთ ქულები, დარღვევები და კლასის ანალიტიკა, ჩამოტვირთეთ PDF ანგარიში ან CSV.' },
    ],
    tips: [
      'მოსწავლეს სჭირდება კომპიუტერი ან ტელეფონი კამერით და მიკროფონით, Chrome ან Edge ბრაუზერში.',
      'ჩანართის გადართვა, ჩასმა (paste) და სრული ეკრანიდან გასვლა დარღვევად ითვლება. 3 დარღვევის შემდეგ გამოცდა მოინიშნება.',
      'თუ იგივე გამოცდა სხვა ჯგუფსაც აქვს, გამორთეთ სწორი პასუხების ჩვენება დასრულების შემდეგ.',
    ],
    faq: [
      { q: 'მოსწავლეს გვერდი გაეთიშა. რა ხდება?', a: 'იგივე ბმულს ხელახლა გახსნის და გამოცდა იქიდან გაგრძელდება, სადაც გაჩერდა.' },
      { q: 'ერთი სკოლის ქსელიდან ბევრი მოსწავლე შეძლებს?', a: 'კი, შეზღუდვა ყოველ მოსწავლეზეა და არა IP მისამართზე.' },
    ],
  },
  englishTutor: {
    title: 'როგორ ვისწავლოთ ინგლისური IMIAKO-სთან',
    intro: 'IMIAKO თქვენს დონეზე აწყობს გაკვეთილებს და ყველაფერს ქართულად გიხსნით.',
    steps: [
      { t: 'დონის არჩევა', d: 'თუ ახლა იწყებთ, აირჩიეთ A1 კურსი. თუ რაღაც უკვე იცით, აირჩიეთ თქვენი დონე (A1-C2).' },
      { t: 'გაკვეთილი', d: 'დააჭირეთ გაკვეთილს. დავალებები ცვლის ერთმანეთს: კითხვა, მოსმენა, წინადადების აწყობა, წერა და ლაპარაკი.' },
      { t: 'პასუხი', d: 'უპასუხეთ და დააჭირეთ „შემოწმებას“. შეცდომისას ნახავთ სწორ პასუხს და ახსნას. „ხელახლა ცდით“ იმავე დავალებას მაშინვე გაიმეორებთ.' },
      { t: 'წინადადების აწყობა', d: 'დააჭირეთ სიტყვებს სწორი რიგით. ჩასმულ სიტყვას კუთხეში × აქვს, „გასუფთავება“ კი მთელ ხაზს ასუფთავებს.' },
      { t: 'პროგრესი', d: 'ყოველი გაკვეთილის ბოლოს ხედავთ XP-ს, სიზუსტეს და ნავარჯიშებ უნარებს.' },
    ],
    tips: [
      'ლაპარაკის დავალებისთვის საჭიროა მიკროფონი და Chrome ან Edge. თუ ახლა ვერ ლაპარაკობთ, შეგიძლიათ გამოტოვოთ.',
      'ყოველდღე 10-15 წუთი უფრო ეფექტურია, ვიდრე კვირაში ერთხელ ერთი საათი.',
    ],
    faq: [
      { q: 'რამდენი გაკვეთილია უფასო?', a: 'ყოველდღე რამდენიმე უფასო გაკვეთილია. გამოწერით შეზღუდვა იხსნება. გადახდისას შეგიძლიათ პრომო კოდი შეიყვანოთ.' },
    ],
  },
  businessAi: {
    title: 'როგორ შევქმნათ ბიზნეს AI ჩატბოტი',
    intro: 'ჩატბოტი თქვენს საიტზე მომხმარებლებს 24/7 პასუხობს თქვენი ცოდნის ბაზიდან.',
    steps: [
      { t: 'აგენტის შექმნა', d: 'დააჭირეთ „ახალ აგენტს“, მიეცით სახელი, ფერი და მიუთითეთ, როგორ უნდა უპასუხოს (ტონი, ენა).' },
      { t: 'ცოდნის ბაზა', d: 'ატვირთეთ ფაილები (PDF, DOCX, MD, TXT) ან ჩასვით ტექსტი: ფასები, მომსახურება, ხშირი კითხვები.' },
      { t: 'შემოწმება', d: 'დაუსვით კითხვები ჩატბოტს და დარწმუნდით, რომ სწორად პასუხობს.' },
      { t: 'საიტზე ჩასმა', d: 'დააკოპირეთ ჩასასმელი კოდის ხაზი და ჩასვით საიტზე (WordPress, Shopify ან HTML). ინსტრუქცია ყველა პლატფორმისთვის გვერდზეა.' },
    ],
    tips: [
      'ცოდნის ბაზაში რაც უფრო ზუსტი და განახლებული ინფორმაციაა, მით უკეთ პასუხობს ჩატბოტი.',
      'ახალი ფასების ან მომსახურების დამატებისას ცოდნის ბაზაც განაახლეთ.',
    ],
    faq: [
      { q: 'რამდენ ხანს გრძელდება საცდელი პერიოდი?', a: 'საცდელი პერიოდის დასრულების თარიღი აგენტის ბარათზე ჩანს.' },
    ],
  },
  educatorHub: {
    title: 'როგორ გამოვიყენოთ მასწავლებლის ჰაბი',
    intro: 'AI ასისტენტი მასწავლებლის ყოველდღიური საქმისთვის: ტესტები, რუბრიკები, გასწორება, გეგმები და დოკუმენტები.',
    steps: [
      { t: 'საცდელი პერიოდი', d: 'დააჭირეთ „საცდელის დაწყებას“. 5 დღე ყველა ფუნქცია უფასოა.' },
      { t: 'ჩანართის არჩევა', d: 'ზემოთ აირჩიეთ, რა გჭირდებათ: ტესტები, რუბრიკები, გასწორება, დიფერენცირება, გეგმები, დოკუმენტაცია, მშობლის რეპორტი ან სერტიფიკატი.' },
      { t: 'მონაცემები', d: 'მიუთითეთ კლასი, საგანი და თემა. რაც უფრო ზუსტია, მით უკეთესია შედეგი.' },
      { t: 'შედეგი', d: 'დააჭირეთ გენერაციას, გადახედეთ შედეგს, საჭიროებისამებრ შეასწორეთ და ჩამოტვირთეთ ან დაბეჭდეთ.' },
    ],
    tips: [
      'ტესტის ბმული შეგიძლიათ მოსწავლეებს გაუზიაროთ, შედეგებს კი იქვე ნახავთ.',
      'მშობლის რეპორტი იწერება თბილი, გასაგები ენით, სპეციალური ტერმინების გარეშე.',
    ],
    faq: [
      { q: 'რა ხდება საცდელი პერიოდის შემდეგ?', a: 'წვდომის გასაგრძელებლად საჭიროა VIP გააქტიურება. ფასი გვერდზე ჩანს.' },
    ],
  },
  mediaStudio: {
    title: 'როგორ გამოვიყენოთ მედია სტუდია',
    intro: 'ტექსტს გადააქცევთ ბუნებრივ ხმად, ან ვიდეოდან ამოიღებთ ტრანსკრიპტს და კონსპექტს.',
    steps: [
      { t: 'ტექსტი → ხმა', d: 'ჩასვით ტექსტი, აირჩიეთ ენა და ხმა, დააჭირეთ გენერაციას და ჩამოტვირთეთ MP3.' },
      { t: 'ვიდეო → ტექსტი', d: 'ჩასვით YouTube ბმული ან ატვირთეთ ვიდეო ან აუდიო (300MB-მდე).' },
      { t: 'შედეგი', d: 'მიიღებთ სიტყვა-სიტყვით ტრანსკრიპტს და მოკლე კონსპექტს. დააკოპირეთ ან ჩამოტვირთეთ.' },
    ],
    tips: ['გრძელ ვიდეოს რამდენიმე წუთი სჭირდება. გვერდი ღია დატოვეთ, სანამ დამუშავება მიმდინარეობს.'],
    faq: [{ q: 'როგორ მივიღო წვდომა?', a: 'თუ გვერდი დახურულია, დააჭირეთ „წვდომის მოთხოვნას“ და გუნდი დაგიკავშირდებათ.' }],
  },
};

const en: GuideSet = {
  childrensBook: {
    title: 'How to create a personalised children’s book',
    intro: 'Describe the child in a few minutes. AI writes the story, draws the illustrations and prepares a PDF and narration.',
    steps: [
      { t: 'Book', d: 'Choose the length and language, and enter a title or theme.' },
      { t: 'Hero', d: 'Enter the child’s name, age, personality and favourite things. Upload a photo so the hero looks like the child.' },
      { t: 'Extras', d: 'Optionally add siblings, other characters, a dedication and a font. You can skip this step.' },
      { t: 'Style and order', d: 'Pick an illustration style, enter a promo code if you have one, and click “Create book”.' },
      { t: 'Approve the text and pay', d: 'Read the story text, edit it if needed, then pay. Illustrations are drawn only after that.' },
      { t: 'Finished book', d: 'When the book is ready, open it in the reader, download the PDF or listen to the narration.' },
    ],
    tips: [
      'The child’s face should be clearly visible in the photo: looking at the camera, good light, no glasses or hat.',
      'The more specific the personality and favourites (e.g. “loves dinosaurs and bikes”), the more personal the story.',
      'Generation takes a few minutes. You can close the page. The book will be waiting in “My books”.',
    ],
    faq: [
      { q: 'Where do I enter a promo code?', a: 'On the last step (“Style and order”) and on the payment screen. The discount shows in the summary right away.' },
      { q: 'What if I don’t like an illustration?', a: 'On the book page you can ask for that page to be redrawn.' },
    ],
  },
  exam: {
    title: 'How to run an AI-proctored exam',
    intro: 'Upload study material, AI writes the questions, and students take the exam from a link with camera proctoring.',
    steps: [
      { t: 'New exam', d: 'Click “+ New exam” and enter a name and topic.' },
      { t: 'Material', d: 'Upload a PDF or photos, paste text, or give a YouTube video. AI writes questions only from this material, in its language.' },
      { t: 'Settings', d: 'Choose the number of questions (1-50) and the duration. Optionally add an open question that AI grades.' },
      { t: 'Review questions', d: 'In the “Questions” tab, review and edit the questions and correct answers if needed.' },
      { t: 'Share the link', d: 'Copy the exam link and send it to students. Each student gets the questions and options in a different order.' },
      { t: 'Results', d: 'See scores, violations and class analytics, and download a PDF report or CSV.' },
    ],
    tips: [
      'Students need a computer or phone with a camera and microphone, in Chrome or Edge.',
      'Switching tabs, pasting and leaving full screen count as violations. After 3 the exam is flagged.',
      'If another group will take the same exam, turn off showing the correct answers at the end.',
    ],
    faq: [
      { q: 'A student’s page closed. What happens?', a: 'They open the same link again and the exam continues where it stopped.' },
      { q: 'Can many students on one school network take it?', a: 'Yes. Limits are per student, not per IP address.' },
    ],
  },
  englishTutor: {
    title: 'How to learn English with IMIAKO',
    intro: 'IMIAKO builds lessons at your level and explains everything in your language.',
    steps: [
      { t: 'Pick a level', d: 'If you are just starting, choose the A1 course. If you already know some English, choose your level (A1-C2).' },
      { t: 'Lesson', d: 'Open a lesson. Tasks alternate: reading, listening, building sentences, writing and speaking.' },
      { t: 'Answer', d: 'Answer and click “Check”. When you are wrong you see the right answer and why. “Try again” lets you redo the same task right away.' },
      { t: 'Build the sentence', d: 'Tap the words in the right order. Each placed word has an × in its corner, and “Clear” empties the whole row.' },
      { t: 'Progress', d: 'At the end of each lesson you see XP, accuracy and the skills you practised.' },
    ],
    tips: [
      'Speaking tasks need a microphone and Chrome or Edge. If you can’t speak right now, you can skip.',
      '10-15 minutes every day works better than one hour once a week.',
    ],
    faq: [
      { q: 'How many lessons are free?', a: 'A few lessons a day are free. A subscription removes the limit, and you can enter a promo code at checkout.' },
    ],
  },
  businessAi: {
    title: 'How to build a business AI chatbot',
    intro: 'The chatbot answers your customers on your website 24/7, from your own knowledge base.',
    steps: [
      { t: 'Create an agent', d: 'Click “New agent”, give it a name and color, and describe how it should answer (tone, language).' },
      { t: 'Knowledge base', d: 'Upload files (PDF, DOCX, MD, TXT) or paste text: prices, services, frequently asked questions.' },
      { t: 'Test it', d: 'Ask the chatbot questions and make sure it answers correctly.' },
      { t: 'Add it to your site', d: 'Copy the embed line and paste it into your site (WordPress, Shopify or HTML). Steps for each platform are on the page.' },
    ],
    tips: [
      'The more accurate and current your knowledge base, the better the chatbot answers.',
      'When you add new prices or services, update the knowledge base too.',
    ],
    faq: [{ q: 'How long is the trial?', a: 'The trial end date is shown on the agent card.' }],
  },
  educatorHub: {
    title: 'How to use the Educator hub',
    intro: 'An AI assistant for a teacher’s everyday work: tests, rubrics, grading, lesson plans and documents.',
    steps: [
      { t: 'Trial', d: 'Click “Start trial”. All features are free for 5 days.' },
      { t: 'Pick a tab', d: 'At the top, choose what you need: tests, rubrics, grading, differentiation, lesson plans, documents, parent reports or certificates.' },
      { t: 'Details', d: 'Enter the grade, subject and topic. The more precise, the better the result.' },
      { t: 'Result', d: 'Click generate, review the result, edit it if needed, then download or print it.' },
    ],
    tips: [
      'You can share a test link with students and see their results right there.',
      'Parent reports are written in warm, plain language without jargon.',
    ],
    faq: [{ q: 'What happens after the trial?', a: 'To keep access you need VIP activation. The price is shown on the page.' }],
  },
  mediaStudio: {
    title: 'How to use the Media studio',
    intro: 'Turn text into natural speech, or get a transcript and summary from any video.',
    steps: [
      { t: 'Text → speech', d: 'Paste text, choose a language and voice, generate and download the MP3.' },
      { t: 'Video → text', d: 'Paste a YouTube link or upload a video or audio file (up to 300MB).' },
      { t: 'Result', d: 'You get a word-for-word transcript and a short summary. Copy or download them.' },
    ],
    tips: ['Long videos take a few minutes. Keep the page open while it processes.'],
    faq: [{ q: 'How do I get access?', a: 'If the page is locked, click “Request access” and the team will contact you.' }],
  },
};

export function getToolGuide(key: ToolGuideKey, locale: string | undefined): ToolGuide {
  return (locale === 'ka' ? ka : en)[key];
}

export function guideUi(locale: string | undefined) {
  return locale === 'ka'
    ? { open: 'როგორ გამოვიყენო', steps: 'ნაბიჯები', tips: 'რჩევები', faq: 'ხშირი კითხვები', close: 'დახურვა' }
    : { open: 'How to use', steps: 'Steps', tips: 'Tips', faq: 'FAQ', close: 'Close' };
}
