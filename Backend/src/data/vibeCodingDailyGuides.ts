// Structured transcription of the supplied 15-page Vibe Coding Camp syllabus.
// Page numbers refer to that PDF. Prompts and code examples retain its wording;
// scheduling, publication, visibility and learner progress belong to the DB.
export type VibeCodingGuideSectionKind =
  | 'objectives' | 'topics' | 'tools' | 'concepts' | 'demo' | 'exercise'
  | 'outcome' | 'prompts' | 'code' | 'troubleshooting' | 'homework'
  | 'preview' | 'resources';

export interface VibeCodingGuideItem {
  id: string;
  title: string;
  body: string;
  language?: string;
  url?: string;
}

export interface VibeCodingGuideSection {
  id: string;
  kind: VibeCodingGuideSectionKind;
  title: string;
  items: VibeCodingGuideItem[];
}

export interface VibeCodingDailyGuide {
  dayNumber: number;
  title: string;
  summary: string;
  sourcePages: number[];
  sections: VibeCodingGuideSection[];
}

// Semantic identifiers remain stable when sections/items are reordered. They
// are scoped to the day so progress never collides across curriculum days.
function section(
  day: number,
  kind: VibeCodingGuideSectionKind,
  title: string,
  items: VibeCodingGuideItem[],
  key: string = kind,
): VibeCodingGuideSection {
  const id = `day-${day}-${key}`;
  return { id, kind, title, items: items.map((item) => ({ ...item, id: `${id}-${item.id}` })) };
}

export const vibeCodingDailyGuides: VibeCodingDailyGuide[] = [
  {
    dayNumber: 1,
    title: 'შესავალი Vibe Coding-ში და ციფრული ეკოსისტემის შექმნა',
    summary: 'გაეცნობით Vibe Coding-ს, Prompt Engineering-ის ოთხ ნაწილს და შექმნით Gmail, GitHub, Vercel და Supabase ანგარიშების ერთიან ეკოსისტემას.',
    sourcePages: [1, 2, 3],
    sections: [
      section(1, 'objectives', 'დღის მიზნები', [
        { id: 'idea-to-product', title: 'იდეიდან მუშა პროდუქტამდე', body: 'გაიგეთ, როგორ იქმნება მუშა პროდუქტი AI-ის დახმარებით და რა გელოდებათ ბანაკის 10 დღის განმავლობაში.' },
        { id: 'ecosystem', title: 'ციფრული ეკოსისტემის გამართვა', body: 'შექმენით პროფესიული განვითარების გარემო: Gmail → GitHub → Vercel და Supabase.' },
      ]),
      section(1, 'topics', 'დღეს განვიხილავთ', [
        { id: 'traditional-development', title: 'ტრადიციული დეველოპმენტი', body: 'ძველი გზა: სინტაქსის ზეპირად სწავლა, ათასობით სტრიქონი კოდის ხელით წერა და წლობით სწავლა.' },
        { id: 'vibe-coding', title: 'Vibe Coding', body: 'იდეის ფორმულირება, AI ასისტენტთან დიალოგი, სწრაფი პროტოტიპირება და შედეგის მყისიერი მიღება.' },
        { id: 'ai-partner', title: 'AI როგორც პარტნიორი', body: 'მთავარი წესი: AI არის თქვენი სუპერპარტნიორი და არა შემცვლელი! ფოკუსი პროდუქტის ლოგიკაზე, UX-სა და იდეაზეა, ტექნიკური რუტინა კი AI-ს გადაეცემა.' },
      ]),
      section(1, 'concepts', 'Prompt Engineering-ის ოქროს წესები', [
        { id: 'context', title: 'კონტექსტი — Context', body: 'ვინ ხარ, რას აკეთებ?' },
        { id: 'task', title: 'დავალება — Task', body: 'ზუსტად რა უნდა შეიქმნას?' },
        { id: 'constraints', title: 'შეზღუდვები — Constraints', body: 'რა ენები/ტექნოლოგიები გამოიყენოს?' },
        { id: 'format', title: 'ფორმატი — Format', body: 'კოდის სახით გამოიტანოს თუ ახსნით?' },
        { id: 'sso', title: 'Single Sign-On — SSO', body: 'ერთიან ეკოსისტემაში დეველოპერული ინსტრუმენტები უკავშირდება ერთმანეთს ავტორიზაციის სისტემით.' },
      ]),
      section(1, 'tools', 'ინსტრუმენტები და სერვისები', [
        { id: 'ai-assistant', title: 'Claude / ChatGPT', body: 'მენტორი AI ასისტენტში შეიყვანს პრომპტს და აჩვენებს აპლიკაციის გენერაციას.' },
        { id: 'gmail', title: 'Gmail', body: 'ცენტრალური იდენტობა და ეკოსისტემის ბაზისი.' },
        { id: 'github', title: 'GitHub', body: 'კოდის რეპოზიტორია და ვერსიების კონტროლი; რეგისტრაცია Gmail-ით.', url: 'https://github.com' },
        { id: 'vercel', title: 'Vercel', body: 'საიტებისა და აპლიკაციების ავტომატური ჰოსტინგი (CD); უერთდება GitHub-ს.', url: 'https://vercel.com' },
        { id: 'supabase', title: 'Supabase', body: 'ღრუბლოვანი მონაცემთა ბაზა (Backend-as-a-Service); უერთდება GitHub/Gmail-ს.', url: 'https://supabase.com' },
      ]),
      section(1, 'demo', 'მენტორის დემონსტრაცია', [
        { id: 'three-minute-app', title: 'აპლიკაცია 3 წუთში', body: 'მენტორი Claude / ChatGPT-ში შეიყვანს პრომპტს და ბრაუზერში აჩვენებს მუშა აპლიკაციას. სილაბუსის დემოს მიზანია შედეგის მიღება 180 წამში.' },
      ]),
      section(1, 'prompts', 'გამოსადეგი პრომპტი', [
        { id: 'calculator', title: 'ინტერაქტიული კალკულატორი', body: 'შემიქმენი ერთი HTML ფაილი, სადაც იქნება ინტერაქტიული კალკულატორი Tailwind CSS დიზაინით. ჰქონდეს Dark Mode-ის გადამრთველი და ღილაკების დაჭერის ხმოვანი ეფექტი.' },
      ]),
      section(1, 'exercise', 'პრაქტიკული დავალება #1', [
        { id: 'professional-gmail', title: 'პროფესიული Gmail', body: 'შექმენით ახალი, პროფესიული Gmail ანგარიში, მაგალითად: name.dev@gmail.com.' },
        { id: 'github-profile', title: 'GitHub პროფილი', body: 'დარეგისტრირდით GitHub.com-ზე და გამართეთ პროფილი.' },
        { id: 'vercel-account', title: 'Vercel ავტორიზაცია', body: 'გაიარეთ Vercel.com-ზე ავტორიზაცია GitHub-ის მეშვეობით.' },
        { id: 'supabase-account', title: 'Supabase ავტორიზაცია', body: 'გაიარეთ Supabase.com-ზე ავტორიზაცია GitHub-ის მეშვეობით.' },
      ]),
      section(1, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'ready-infrastructure', title: 'გამართული ციფრული ინფრასტრუქტურა', body: 'Gmail, GitHub, Vercel და Supabase ანგარიშები შექმნილია და დაკავშირებულია.' },
      ]),
    ],
  },
  {
    dayNumber: 2,
    title: 'სამუშაო გარემოს (IDE) გამართვა და გაფართოებები',
    summary: 'დააყენებთ VS Code-ს ან Cursor-ს, აუცილებელ გაფართოებებს და დააკავშირებთ პირველ GitHub რეპოზიტორიას Vercel-თან.',
    sourcePages: [3, 4, 5],
    sections: [
      section(2, 'objectives', 'დღის მიზანი', [
        { id: 'development-environment', title: 'სამუშაო გარემოს მოწყობა', body: 'გამართეთ IDE და ავტომატური გამოქვეყნების ჯაჭვი: კოდის რედაქტორი → GitHub → Vercel.' },
      ]),
      section(2, 'topics', 'სამუშაო გარემო და ავტომატიზაცია', [
        { id: 'ide', title: 'რა არის IDE?', body: 'IDE (Integrated Development Environment) დეველოპერის ციფრული სახელოსნოა.' },
        { id: 'editors', title: 'VS Code და Cursor', body: 'VS Code კოდის რედაქტორია. Cursor VS Code-ის ბაზაზე შექმნილი AI-native IDE-ა. სილაბუსში ჩაშენებული მოდელების მაგალითებად მითითებულია Claude 3.5 Sonnet და GPT-4o.' },
        { id: 'ci-cd', title: 'GitHub + Vercel — CI/CD', body: 'ცვლით კოდს VS Code / Cursor-ში, აკეთებთ git push-ს GitHub-ზე და Vercel ავტომატურად აახლებს ცოცხალ საიტს. სლაიდის მაგალითში განახლება 5 წამში აისახება.' },
      ]),
      section(2, 'tools', 'აუცილებელი გაფართოებები', [
        { id: 'ai-extension', title: 'GitHub Copilot / Cursor AI', body: 'კოდის ავტომატური შევსება და გენერაცია.' },
        { id: 'live-server', title: 'Live Server', body: 'კოდის ცვლილებების რეალურ დროში ნახვა ბრაუზერში.' },
        { id: 'tailwind-intellisense', title: 'Tailwind CSS IntelliSense', body: 'დიზაინის კლასების ავტომატური კარნახი.' },
        { id: 'gitlens', title: 'GitLens', body: 'კოდის ცვლილებების ისტორიის მონიტორინგი.' },
        { id: 'prettier', title: 'Prettier', body: 'კოდის ავტომატური გასუფთავება და დაფორმატება.' },
      ]),
      section(2, 'concepts', 'ვებ-დეველოპმენტის სამი საფუძველი', [
        { id: 'html', title: 'HTML — ჩონჩხი', body: 'სტრუქტურა, ტექსტი, ღილაკები და სურათები.' },
        { id: 'css', title: 'CSS / Tailwind — კანი და ტანსაცმელი', body: 'დიზაინი, ფერები, განლაგება და შრიფტები.' },
        { id: 'javascript', title: 'JavaScript — კუნთები და ნერვული სისტემა', body: 'ინტერაქციები, ლოგიკა და მონაცემების დამუშავება.' },
      ]),
      section(2, 'exercise', 'პრაქტიკული დავალება #2', [
        { id: 'install-ide', title: 'IDE-ის ინსტალაცია', body: 'ჩამოტვირთეთ და დააყენეთ Cursor / VS Code.' },
        { id: 'install-extensions', title: 'გაფართოებების დაყენება', body: 'დააყენეთ სილაბუსში ჩამოთვლილი ხუთი აუცილებელი გაფართოება.' },
        { id: 'first-repository', title: 'პირველი რეპოზიტორია', body: 'შექმენით პირველი რეპოზიტორია GitHub-ზე.' },
        { id: 'connect-vercel', title: 'Vercel-თან დაკავშირება', body: 'დააკავშირეთ პირველი GitHub რეპოზიტორია Vercel-თან.' },
      ]),
      section(2, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'connected-workspace', title: 'სამუშაო გარემო მზადაა', body: 'IDE და გაფართოებები დაყენებულია; პირველი რეპოზიტორია დაკავშირებულია Vercel-თან.' },
      ]),
    ],
  },
  {
    dayNumber: 3,
    title: 'მინი ვებ-აპლიკაცია — To-Do / Task Manager',
    summary: 'ააწყობთ Task Master-ს: დავალებების დამატება, წაშლა, შესრულებულად მონიშვნა და ფილტრაცია Supabase მონაცემთა ბაზით.',
    sourcePages: [5, 6],
    sections: [
      section(3, 'objectives', 'დღის მიზანი', [
        { id: 'task-master', title: 'პირველი სრული Web App', body: 'შექმენით Task Master — ინტერაქტიული დავალებების მენეჯერი დამატების, წაშლის, შესრულებულად მონიშვნისა და ფილტრაციის ფუნქციებით.' },
      ]),
      section(3, 'tools', 'ტექნოლოგიები', [
        { id: 'web-stack', title: 'HTML, Tailwind CSS და JavaScript', body: 'აპლიკაციის სტრუქტურა, ინტერფეისი და ლოგიკა.' },
        { id: 'supabase', title: 'Supabase Database და JS SDK', body: 'მონაცემების შენახვა და JavaScript-ით დაკავშირება. სილაბუსი Supabase-ს აღწერს როგორც Open-source Firebase ალტერნატივას.' },
        { id: 'development-deployment', title: 'VS Code, GitHub და Vercel', body: 'აპლიკაციის აწყობა, კოდის ატვირთვა და გამოქვეყნება.' },
      ]),
      section(3, 'topics', 'დღეს განვიხილავთ', [
        { id: 'relational-database', title: 'რელაციური მონაცემთა ბაზა', body: 'Supabase-ის ცხრილის სტრუქტურა და აპლიკაციის მონაცემების შენახვა.' },
        { id: 'step-by-step', title: 'Step-by-Step Prompting', body: 'ჯერ UI-ის გენერაცია, შემდეგ JavaScript ლოგიკისა და Supabase-თან კავშირის დამატება.' },
      ]),
      section(3, 'concepts', 'tasks ცხრილის სტრუქტურა', [
        { id: 'id', title: 'id', body: 'Primary Key, UUID.' },
        { id: 'title', title: 'title', body: 'Text — დავალების სახელი.' },
        { id: 'is-completed', title: 'is_completed', body: 'Boolean — true / false.' },
        { id: 'created-at', title: 'created_at', body: 'Timestamp.' },
      ]),
      section(3, 'prompts', 'აპლიკაციის გენერაციის პრომპტები', [
        { id: 'ui', title: 'Prompt #1 — UI', body: 'დამიწერე HTML და Tailwind CSS კოდი თანამედროვე Task Manager-ისთვის. გამოიყენე Glassmorphism დიზაინი, ჰქონდეს ინპუტი, დამატების ღილაკი და სია.' },
        { id: 'supabase-logic', title: 'Prompt #2 — JS Logic & Supabase', body: "ახლა დაამატე JavaScript, რომელიც მიუერთდება Supabase JS SDK-ს, წაიკითხავს 'tasks' ცხრილს და ახალ დავალებას ჩაწერს ბაზაში." },
      ]),
      section(3, 'code', 'სილაბუსის კოდის მაგალითი', [
        { id: 'supabase-connection', title: 'Supabase Connection', language: 'javascript', body: `import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseKey)

// დავალების დამატება
async function addTask(title) {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ title: title, is_completed: false }])
}` },
      ]),
      section(3, 'exercise', 'პრაქტიკული დავალება და დეპლოი', [
        { id: 'tasks-table', title: 'tasks ცხრილი', body: 'ააწყეთ Supabase-ში tasks ცხრილი მითითებული ველებით.' },
        { id: 'build-app', title: 'აპლიკაციის აწყობა', body: 'ააწყეთ აპლიკაცია VS Code-ში AI-ის დახმარებით.' },
        { id: 'publish', title: 'გამოქვეყნება', body: 'ატვირთეთ კოდი GitHub-ზე და გამოაქვეყნეთ Vercel-ზე.' },
      ]),
      section(3, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'deployed-task-manager', title: 'გამოქვეყნებული Task Manager', body: 'Task Manager დაკავშირებულია Supabase-თან და გამოქვეყნებულია Vercel-ზე.' },
      ]),
    ],
  },
  {
    dayNumber: 4,
    title: 'ბრაუზერის თამაშის შექმნა — 2D Game',
    summary: 'შექმნით HTML5 Canvas თამაშს, დაამატებთ მართვას, შეჯახების დეტექციას, ქულებს და გამოაქვეყნებთ Vercel-ზე.',
    sourcePages: [6, 7, 8],
    sections: [
      section(4, 'objectives', 'დღის მიზანი', [
        { id: 'browser-game', title: '2D თამაშის შექმნა', body: 'ააწყეთ ბრაუზერის თამაში Vibe Coding-ით, დახვეწეთ ვიზუალი და გამოაქვეყნეთ.' },
      ]),
      section(4, 'tools', 'ინსტრუმენტები და ტექნოლოგიები', [
        { id: 'canvas-javascript', title: 'HTML5 Canvas და JavaScript', body: 'ბრაუზერის ციფრული ტილო ობიექტების დასახატად და ასამოძრავებლად.' },
        { id: 'tailwind-audio', title: 'Tailwind და Web Audio API', body: 'სილაბუსის Snake Game პრომპტში გამოიყენება Retro Neon ვიზუალი და ხმოვანი ეფექტები.' },
        { id: 'browser-console', title: 'Browser Console', body: 'შეცდომების ნახვა F12-ით.' },
        { id: 'vercel', title: 'Vercel', body: 'თამაშის გამოქვეყნება.' },
      ]),
      section(4, 'concepts', 'თამაშის არქიტექტურა', [
        { id: 'game-loop', title: 'Game Loop', body: 'სილაბუსის სქემა: Update (პოზიციების განახლება) → Draw (ხელახლა დახატვა) → Clear (გასუფთავება) → 60 FPS.' },
        { id: 'player', title: 'Player / Snake', body: 'მოთამაშის ობიექტი კლავიატურით მართვით: Arrow keys / WASD.' },
        { id: 'target', title: 'Target / Food', body: 'შემთხვევით ადგილას გენერირებული ობიექტები.' },
        { id: 'collision', title: 'Collision Detection', body: 'შეჯახების დეტექცია, მაგალითად გველის შეჯახება კედელთან ან საკვებთან.' },
        { id: 'score', title: 'Score Tracker და High Score', body: 'ქულების დათვლა და High Score-ის შენახვა LocalStorage-ში.' },
      ]),
      section(4, 'topics', 'პროექტის მაგალითები', [
        { id: 'game-options', title: 'Snake Game / Space Shooter', body: 'თამაშის არქიტექტურის განხილვა Snake Game-ის ან Space Shooter-ის მაგალითზე.' },
      ]),
      section(4, 'prompts', 'გამოსადეგი პრომპტები', [
        { id: 'snake-game', title: 'Snake Game-ის გენერაცია', body: 'დამიწერე სრული HTML5 Canvas 2D Snake Game JavaScript-ზე. დაამატე Retro Neon visual style Tailwind-ით, ქულების დათვლა, Sound effects (Web Audio API) და Game Over ეკრანი Restart ღილაკით.' },
        { id: 'console-error', title: 'შეცდომის ახსნა', body: 'ეს შეცდომა ამოვარდა console-ში: [ErrorText]. რისი ბრალია და როგორ გავასწორო?' },
      ]),
      section(4, 'troubleshooting', 'როცა კოდი არ მუშაობს', [
        { id: 'open-console', title: 'გახსენით კონსოლი', body: 'გახსენით Browser Console ღილაკით F12.' },
        { id: 'copy-error', title: 'დააკოპირეთ შეცდომა', body: 'დააკოპირეთ წითელი Error შეტყობინება.' },
        { id: 'ask-ai', title: 'ჰკითხეთ AI-ს', body: 'გაუგზავნეთ AI-ს ზუსტი Error ტექსტი და სთხოვეთ მიზეზისა და გამოსწორების ახსნა.' },
      ]),
      section(4, 'exercise', 'ითამაშე და გამოაქვეყნე', [
        { id: 'build-polish', title: 'ლოგიკა და ვიზუალი', body: 'ააწყეთ თამაშის ლოგიკა და დახვეწეთ ვიზუალი.' },
        { id: 'publish-share', title: 'გამოქვეყნება და გაზიარება', body: 'ატვირთეთ თამაში Vercel-ზე და გააზიარეთ ბმული ჯგუფურ ჩატში.' },
      ]),
      section(4, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'playable-game', title: 'მუშა 2D თამაში', body: 'თამაში გამოქვეყნებულია და სხვა მონაწილეებს შეუძლიათ მისი თამაში და რეკორდების მოხსნა.' },
      ]),
    ],
  },
  {
    dayNumber: 5,
    title: 'პორტფოლიო / Landing Page და ინტეგრაციები',
    summary: 'ააწყობთ პერსონალურ Landing Page-ს, წარადგენთ უკვე შექმნილ პროექტებს და საკონტაქტო ფორმას Gmail-ს დაუკავშირებთ.',
    sourcePages: [8, 9],
    sections: [
      section(5, 'objectives', 'დღის მიზანი', [
        { id: 'personal-portfolio', title: 'პერსონალური პორტფოლიო', body: 'შექმენით საკუთარი პორტფოლიო AI-ით, დააკავშირეთ საკონტაქტო ფორმა Gmail-თან და გამოაქვეყნეთ Vercel-ზე.' },
      ]),
      section(5, 'topics', 'Landing Page-ის სტრუქტურა', [
        { id: 'hero', title: 'Hero Section', body: 'მთავარი სათაური, ქვესათაური და Call to Action (CTA) ღილაკი.' },
        { id: 'about', title: 'About Me / Services', body: 'ვინ ვართ და რას ვაკეთებთ.' },
        { id: 'projects', title: 'Portfolio / Projects', body: 'წინა დღეებში შექმნილი პროექტების ჩვენება: To-Do App და Snake Game.' },
        { id: 'contact', title: 'Contact Form', body: 'საკონტაქტო ფორმა.' },
      ]),
      section(5, 'tools', 'UI და ფორმის ინსტრუმენტები', [
        { id: 'v0', title: 'v0.dev', body: 'AI-ით UI-ის გენერაცია სურათის ან ტექსტური აღწერის მიხედვით.', url: 'https://v0.dev' },
        { id: 'lovable', title: 'Lovable.dev', body: 'AI-ით UI-ის გენერაცია სურათის ან ტექსტური აღწერის მიხედვით.', url: 'https://lovable.dev' },
        { id: 'forms', title: 'Web3Forms / Formspree', body: 'საიტის საკონტაქტო ფორმიდან წერილების Gmail-ზე მიღება HTML action ატრიბუტის გამოყენებით, რთული Back-end-ის გარეშე.' },
        { id: 'ecosystem', title: 'Gmail, Vercel, GitHub და Cursor', body: 'ფორმის შეტყობინებები, საიტის ჰოსტინგი, რეპოზიტორია და კოდის რედაქტორი ერთ ჯაჭვში.' },
      ]),
      section(5, 'concepts', 'UX/UI და სრული ეკოსისტემა', [
        { id: 'responsive', title: 'Responsive Design', body: 'საიტის მორგება მობილურებზე, პლანშეტებსა და მონიტორებზე: Tailwind sm:, md:, lg: კლასები.' },
        { id: 'ecosystem-chain', title: 'სრული ჯაჭვი', body: 'Gmail (ფორმის შეტყობინებები) ← Landing Page (Vercel) ← GitHub Repo ← Cursor IDE.' },
      ]),
      section(5, 'code', 'სილაბუსის კოდის მაგალითი', [
        { id: 'contact-form', title: 'Web3Forms საკონტაქტო ფორმა', language: 'html', body: `<form action="https://api.web3forms.com/submit" method="POST">
  <input type="hidden" name="access_key" value="YOUR_ACCESS_KEY">
  <input type="email" name="email" required placeholder="თქვენი Email">
  <textarea name="message" placeholder="შეტყობინება"></textarea>
  <button type="submit">გაგზავნა</button>
</form>` },
      ]),
      section(5, 'exercise', 'პრაქტიკული დავალება', [
        { id: 'build-portfolio', title: 'პორტფოლიოს აწყობა', body: 'ააწყეთ საკუთარი პორტფოლიო AI-ის დახმარებით.' },
        { id: 'gmail-form', title: 'Gmail ინტეგრაცია', body: 'დააკავშირეთ საკონტაქტო ფორმა Gmail-თან.' },
        { id: 'deploy', title: 'გამოქვეყნება', body: 'გამოაქვეყნეთ პორტფოლიო Vercel-ზე.' },
      ]),
      section(5, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'live-portfolio', title: 'პერსონალური Landing Page', body: 'პორტფოლიო გამოქვეყნებულია Vercel-ზე და საკონტაქტო ფორმის წერილები Gmail-ზე მოდის.' },
      ]),
    ],
  },
  {
    dayNumber: 6,
    title: 'გუნდების ფორმირება და 5 პროექტის სტარტი',
    summary: 'ჩამოყალიბდება ხუთი ოთხკაციანი გუნდი, განაწილდება როლები, შეირჩევა პროექტები და გაიწერება MVP.',
    sourcePages: [9, 10, 11],
    sections: [
      section(6, 'objectives', 'დღის მიზანი', [
        { id: 'team-project-start', title: 'გუნდური მუშაობის დაწყება', body: '20 მონაწილე ქმნის 5 გუნდს, თითოეულში 4 წევრით. გუნდი ირჩევს პროექტს და განსაზღვრავს MVP ფუნქციონალს.' },
      ]),
      section(6, 'topics', 'გუნდის როლები', [
        { id: 'product-owner', title: 'Product Owner / Team Lead', body: 'იდეის ხედვა და ამოცანების გადანაწილება.' },
        { id: 'frontend', title: 'Lead Vibe Coder — Front-end', body: 'UI/UX და ინტერფეისის აწყობა AI-ით.' },
        { id: 'backend', title: 'Back-end & DB Specialist', body: 'Supabase-ის, ბაზების და API-ების მართვა.' },
        { id: 'pitch', title: 'Pitch & Content Manager', body: 'ტექსტები, პრეზენტაცია და დემოს მომზადება.' },
      ], 'team-roles'),
      section(6, 'topics', 'ხუთი თემატური პროექტი — არჩევანი', [
        { id: 'commerce', title: 'E-Commerce / მარკეტი', body: 'ადგილობრივი პროდუქციის ონლაინ მაღაზია.' },
        { id: 'education', title: 'EdTech / განათლება', body: 'ინტერაქტიული საგანმანათლებლო პლატფორმა / ქვიზ-აპლიკაცია.' },
        { id: 'tourism', title: 'Smart Region / ტურიზმი', body: 'გურიის ტურისტული გზამკვლევი და ლოკაციების დაჯავშნა.' },
        { id: 'entertainment', title: 'Entertainment / Game Hub', body: 'მედია პლატფორმა ან მინი-თამაშების კოლექცია.' },
        { id: 'productivity', title: 'AI Productivity Tool', body: 'AI ასისტენტი კონკრეტული სფეროსთვის, მაგალითად რეცეპტების გენერატორი.' },
      ], 'project-directions'),
      section(6, 'tools', 'გუნდური მუშაობის ინსტრუმენტები', [
        { id: 'github-collaboration', title: 'Git & GitHub Collaboration', body: 'ერთი მთავარი რეპოზიტორია და გუნდის წევრების დამატება Collaborators-ის სახით.' },
      ]),
      section(6, 'concepts', 'Branching და Lean Canvas', [
        { id: 'branches', title: 'Branching — შტოები', body: 'main შტო და ინდივიდუალური feature-name შტოები.' },
        { id: 'problem', title: 'პრობლემა', body: 'რა არის პრობლემა?' },
        { id: 'customer', title: 'მომხმარებელი', body: 'ვინ არის მომხმარებელი?' },
        { id: 'mvp', title: 'MVP — Minimum Viable Product', body: 'რა არის ჩვენი MVP 3 დღეში შესასრულებლად?' },
      ]),
      section(6, 'exercise', 'დღის დავალება', [
        { id: 'form-team', title: 'გუნდის ჩამოყალიბება', body: 'ჩამოაყალიბეთ გუნდი და აირჩიეთ პროექტის თემა.' },
        { id: 'shared-repository', title: 'საერთო რეპოზიტორია', body: 'შექმენით GitHub რეპოზიტორია და დაამატეთ გუნდის წევრები.' },
        { id: 'define-mvp', title: 'MVP-ის გაწერა', body: 'გაწერეთ MVP ფუნქციონალი.' },
      ]),
      section(6, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'team-ready', title: 'პროექტი დაწყებულია', body: 'გუნდი ჩამოყალიბებულია, თემა არჩეულია, საერთო რეპოზიტორია შექმნილია და MVP გაწერილია.' },
      ]),
    ],
  },
  {
    dayNumber: 7,
    title: 'ინტენსიური დეველოპმენტი — Front-end + Back-end',
    summary: 'გუნდები აერთიანებენ ინტერფეისს, მონაცემთა ბაზასა და ავტორიზაციას პირველი მუშა პროტოტიპის მისაღებად.',
    sourcePages: [11, 12],
    sections: [
      section(7, 'objectives', 'დღის მიზანი', [
        { id: 'working-prototype', title: 'MVP-ის მშენებლობა', body: 'იმუშავეთ მხოლოდ კრიტიკულად აუცილებელ ფუნქციებზე და მიიღეთ პირველი მომუშავე პროტოტიპი (Working Prototype).' },
      ]),
      section(7, 'topics', 'ინტეგრაცია და ავტორიზაცია', [
        { id: 'frontend-backend', title: 'Front-end + Back-end', body: 'UI კომპონენტების შექმნა v0.dev / Cursor-ით და Supabase Tables-ის დაკავშირება UI-თან.' },
        { id: 'email-password', title: 'Email / Password', body: 'მომხმარებლის რეგისტრაცია Supabase Authentication-ით.' },
        { id: 'google-sign-in', title: 'Google Sign-In', body: 'Google Sign-In ინტეგრაცია მომხმარებლის ავტორიზაციისთვის.' },
        { id: 'complex-logic', title: 'Prompting Complex Logic', body: 'AI-სთვის რთული ლოგიკის აღწერა Supabase SQL query-სა და JavaScript ფუნქციის მაგალითზე.' },
      ]),
      section(7, 'tools', 'დღის ინსტრუმენტები', [
        { id: 'v0-cursor', title: 'v0.dev / Cursor', body: 'UI კომპონენტების აწყობა და AI Debugger Mode-ის გამოყენება Cursor-ში.' },
        { id: 'supabase', title: 'Supabase Tables და Auth', body: 'მონაცემთა ბაზები და მომხმარებელთა რეგისტრაცია.' },
        { id: 'browser-devtools', title: 'Console და Network Tab', body: 'ლოგების და API მოთხოვნების შემოწმება.' },
      ]),
      section(7, 'concepts', 'ფოკუსი MVP-ზე', [
        { id: 'no-feature-creep', title: 'No Feature Creep', body: 'ფოკუსი მხოლოდ კრიტიკულად აუცილებელ ფუნქციებზე.' },
      ]),
      section(7, 'code', 'სილაბუსის კოდის მაგალითი', [
        { id: 'supabase-auth', title: 'Supabase Auth — signUp', language: 'javascript', body: `const { user, error } = await supabase.auth.signUp({
  email: 'example@email.com',
  password: 'example-password',
})` },
      ]),
      section(7, 'prompts', 'რთული ლოგიკის პრომპტი', [
        { id: 'product-query', title: 'პროდუქტების გაფილტვრა და დალაგება', body: 'მჭირდება Supabase SQL query და JS ფუნქცია, რომელიც იპოვის ყველა პროდუქტს, რომლის ფასიც ნაკლებია 50 ლარზე და დაალაგებს რეიტინგის მიხედვით.' },
      ]),
      section(7, 'troubleshooting', 'Debugging Workshop', [
        { id: 'console-log', title: 'Console.log', body: 'გამოიყენეთ Console.log ეფექტურად შეცდომების სამართავად.' },
        { id: 'network', title: 'Network Tab', body: 'შეამოწმეთ Network Tab API მოთხოვნებისთვის.' },
        { id: 'ai-debugger', title: 'AI Debugger Mode', body: 'გამოიყენეთ Cursor-ის AI Debugger Mode.' },
      ]),
      section(7, 'exercise', 'პრაქტიკული მარათონი', [
        { id: 'database-logic', title: 'ბაზები და ლოგიკა', body: 'გუნდურად იმუშავეთ პროექტის ბაზებსა და ლოგიკაზე.' },
        { id: 'first-prototype', title: 'მუშა პროტოტიპი', body: 'მიიღეთ პირველი მომუშავე პროტოტიპი.' },
      ]),
      section(7, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'mvp-working', title: 'პირველი მომუშავე MVP', body: 'პროექტის ინტერფეისი, ბაზა და აუცილებელი ლოგიკა მუშაობს ერთ პროტოტიპში.' },
      ]),
    ],
  },
  {
    dayNumber: 8,
    title: 'UI/UX დახვეწა და ციფრული ეკოსისტემის სრული გამართვა',
    summary: 'დახვეწთ ვიზუალურ იერარქიას და მობილურ დიზაინს, შეამოწმებთ სრულ ეკოსისტემას და ჩაატარებთ გუნდებს შორის ჯვარედინ ტესტირებას.',
    sourcePages: [12, 13],
    sections: [
      section(8, 'objectives', 'დღის მიზანი', [
        { id: 'polish-test-freeze', title: 'დახვეწა, ტესტირება და Freeze', body: 'მოახდინეთ დიზაინის მობილური ოპტიმიზაცია, შეამოწმეთ პროექტი და შეაჩერეთ კოდის ცვლილებები საბოლოო Freeze-ით.' },
      ]),
      section(8, 'concepts', 'UI/UX პრინციპები', [
        { id: 'visual-hierarchy', title: 'Visual Hierarchy', body: 'მნიშვნელოვანი ელემენტები იყოს დიდი და მკვეთრი.' },
        { id: 'color-palette', title: 'Color Palette', body: 'მაქსიმუმ 3 ძირითადი ფერი: Primary, Secondary, Accent.' },
        { id: 'micro-interactions', title: 'Micro-interactions', body: 'Hover ეფექტები, Loading Spinner-ები და Success Message-ები.' },
      ]),
      section(8, 'topics', 'ეკოსისტემის სრული ჯაჭვის შემოწმება', [
        { id: 'open-vercel', title: '1. საიტზე შესვლა', body: 'მომხმარებელი შედის Vercel-ის ლინკზე.' },
        { id: 'supabase-auth', title: '2. რეგისტრაცია', body: 'მომხმარებელი რეგისტრირდება Supabase Auth-ით.' },
        { id: 'app-action', title: '3. მოქმედება და მონაცემები', body: 'სილაბუსის მაგალითი: მომხმარებელი ასრულებს მოქმედებას — ყიდულობს / ჩანს ბაზაში.' },
        { id: 'gmail-confirmation', title: '4. დასტურის წერილი', body: 'დასტურის წერილი მიდის Gmail-ზე.' },
        { id: 'automatic-update', title: '5. ავტომატური განახლება', body: 'კოდის ნებისმიერი განახლება GitHub-იდან ავტომატურად ისახება Vercel-ზე.' },
      ]),
      section(8, 'tools', 'ეკოსისტემის სერვისები', [
        { id: 'vercel', title: 'Vercel', body: 'გამოქვეყნებული აპლიკაციისა და ავტომატური განახლებების შემოწმება.' },
        { id: 'supabase', title: 'Supabase Auth და ბაზა', body: 'რეგისტრაციისა და მონაცემებში მოქმედების ასახვის შემოწმება.' },
        { id: 'gmail', title: 'Gmail', body: 'დასტურის წერილების მიღების შემოწმება.' },
        { id: 'github', title: 'GitHub', body: 'კოდის განახლებისა და Vercel-თან კავშირის შემოწმება.' },
      ]),
      section(8, 'troubleshooting', 'Cross-Testing და Bug Hunting', [
        { id: 'cross-testing', title: 'ჯვარედინი ტესტირება', body: 'გუნდი A ტესტავს გუნდი B-ს პროექტს.' },
        { id: 'bug-hunting', title: 'შეცდომების ძიება', body: 'იპოვეთ შეცდომები, არასწორი დიზაინი და გაფუჭებული ლინკები.' },
        { id: 'ai-fixes', title: 'უკუკავშირით გამოსწორება', body: 'უკუკავშირის საფუძველზე შეიტანეთ სწრაფი Fix-ები AI-ით.' },
      ]),
      section(8, 'exercise', 'პრაქტიკული სამუშაო', [
        { id: 'mobile-optimization', title: 'მობილური ოპტიმიზაცია', body: 'მოახდინეთ დიზაინის სრული ოპტიმიზაცია მობილური მოწყობილობებისთვის.' },
        { id: 'project-freeze', title: 'პროექტის საბოლოო Freeze', body: 'შეაჩერეთ კოდის ცვლილებები საბოლოო Freeze-ით.' },
      ]),
      section(8, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'tested-frozen-project', title: 'შემოწმებული პროექტი', body: 'პროექტის ეკოსისტემა შემოწმებულია, დიზაინი მობილურზე ოპტიმიზებულია და კოდი გაყინულია პრეზენტაციისთვის.' },
      ]),
    ],
  },
  {
    dayNumber: 9,
    title: 'Pitch Deck, Storytelling და Dry Run',
    summary: 'მოამზადებთ შვიდსლაიდიან Pitch Deck-ს, გაივლით 3–5-წუთიან რეპეტიციას და შეამოწმებთ დემოს ბმულებსა და სარეზერვო მასალას.',
    sourcePages: [13, 14],
    sections: [
      section(9, 'objectives', 'დღის მიზანი', [
        { id: 'presentation-ready', title: 'ფინალური პრეზენტაციის მომზადება', body: 'მოამზადეთ Pitch Deck, გაიარეთ გენერალური რეპეტიცია და მოემზადეთ Demo Day-ისთვის.' },
      ]),
      section(9, 'tools', 'პრეზენტაციის ინსტრუმენტები', [
        { id: 'gamma', title: 'Gamma.app', body: 'ტექსტური პრომპტიდან სლაიდების ავტომატური გენერაცია. სილაბუსის დემოს თემა: პრეზენტაციის შექმნა 10 წუთში.', url: 'https://gamma.app' },
        { id: 'canva', title: 'Canva', body: 'AI-Assisted Pitch Deck-ის მომზადების ალტერნატიული ინსტრუმენტი.' },
      ]),
      section(9, 'topics', 'Pitch Deck-ის შვიდი ოქროს სლაიდი', [
        { id: 'title-team', title: '1. სათაური და გუნდი', body: 'წარადგინეთ პროექტის სათაური და გუნდი.' },
        { id: 'problem', title: '2. პრობლემა', body: 'რა ტკივილია ბაზარზე?' },
        { id: 'solution', title: '3. გადაჭრა', body: 'ჩვენი პროდუქტი.' },
        { id: 'live-demo', title: '4. Live Demo', body: 'მუშა აპლიკაციის ჩვენება.' },
        { id: 'technology-stack', title: '5. ტექნოლოგიური სტეკი', body: 'Vibe Coding, Supabase, Vercel და Gmail.' },
        { id: 'future', title: '6. სამომავლო გეგმები / მონეტიზაცია', body: 'სამომავლო გეგმებისა და მონეტიზაციის წარმოდგენა.' },
        { id: 'call-to-action', title: '7. Call to Action / მადლობა', body: 'Call to Action და მადლობა.' },
      ]),
      section(9, 'concepts', 'Storytelling-ის ხელოვნება', [
        { id: 'value', title: 'ღირებულებაზე საუბარი', body: 'არ ისაუბროთ მხოლოდ კოდზე — ისაუბრეთ ღირებულებაზე!' },
        { id: 'story', title: 'რეალური ისტორია', body: 'დაიწყეთ რეალური ისტორიით ან სტატისტიკით.' },
        { id: 'delivery', title: 'წარდგენის ენერგია', body: 'იყავით ენერგიულები და დარწმუნებულები.' },
      ]),
      section(9, 'exercise', 'Dry Run — გენერალური რეპეტიცია', [
        { id: 'rehearse', title: '3–5-წუთიანი წარდგენა', body: 'თითოეულ გუნდს აქვს ზუსტად 3–5 წუთი პრეზენტაციისთვის.' },
        { id: 'feedback', title: 'უკუკავშირი', body: 'მიიღეთ ტრენერისა და თანაგუნდელების უკუკავშირი.' },
        { id: 'timing', title: 'ტაიმინგის გასწორება', body: 'გაასწორეთ პრეზენტაციის ტაიმინგი.' },
      ]),
      section(9, 'homework', 'მზადება Demo Day-ისთვის', [
        { id: 'verify-links', title: 'ყველა ბმულის შემოწმება', body: 'შეამოწმეთ Vercel App, GitHub Repo და Presentation Deck ბმულები.' },
        { id: 'backup', title: 'სარეზერვო გეგმა', body: 'მოამზადეთ Backup Video / Screenshots ინტერნეტის შეფერხების შემთხვევისთვის.' },
      ]),
      section(9, 'outcome', 'მოსალოდნელი შედეგი', [
        { id: 'rehearsed-pitch', title: 'მომზადებული Pitch და დემო', body: 'პრეზენტაცია მზადაა, რეპეტიცია გავლილია, ბმულები შემოწმებულია და სარეზერვო ვიდეო / სქრინშოტები მომზადებულია.' },
      ]),
    ],
  },
  {
    dayNumber: 10,
    title: 'Demo Day — ფინალური პრეზენტაციები და ჟიურის შეფასება',
    summary: 'ხუთი გუნდი წარადგენს პროექტებს, უპასუხებს ჟიურის კითხვებს და შეფასდება ხუთი კრიტერიუმით, ჯამში 100 ქულით.',
    sourcePages: [14, 15],
    sections: [
      section(10, 'objectives', 'დღის მიზანი', [
        { id: 'final-demo', title: 'ფინალური წარდგენა', body: 'წარადგინეთ გუნდური პროექტი და უპასუხეთ ჟიურის კითხვებს.' },
      ]),
      section(10, 'topics', 'Demo Day-ის დღის წესრიგი', [
        { id: 'welcome', title: '14:00–14:15 — მისალმება', body: 'მისალმება და ჟიურის წარდგენა.' },
        { id: 'presentations', title: '14:15–15:30 — გუნდების პრეზენტაციები', body: '5 გუნდის პრეზენტაცია: 5 წუთი პრეზენტაცია + 3 წუთი Q&A.' },
        { id: 'jury', title: '15:30–16:00 — ჟიურის თათბირი', body: 'ჟიური განიხილავს პროექტებს და შეფასებებს.' },
        { id: 'awards', title: '16:00–16:30 — დაჯილდოება', body: 'დაჯილდოება და სერტიფიკატების გადაცემა.' },
      ], 'agenda'),
      section(10, 'topics', 'ჟიურის შეფასების კრიტერიუმები — 100 ქულა', [
        { id: 'innovation', title: 'ინოვაციურობა & იდეა — 25 ქულა', body: 'პრობლემის აქტუალურობა და ორიგინალურობა.' },
        { id: 'functionality', title: 'MVP & ფუნქციონალი — 25 ქულა', body: 'რამდენად გამართულად მუშაობს რეალური აპლიკაცია.' },
        { id: 'ai-usage', title: 'Vibe Coding & AI-ის გამოყენება — 20 ქულა', body: 'AI ინსტრუმენტებისა და ეკოსისტემის ეფექტურობა.' },
        { id: 'design', title: 'UI/UX დიზაინი — 15 ქულა', body: 'ვიზუალური მხარე და მოხმარების სიმარტივე.' },
        { id: 'pitch', title: 'Pitch & პრეზენტაცია — 15 ქულა', body: 'გუნდის პრეზენტაციის ხარისხი და პასუხები კითხვებზე.' },
      ], 'scoring'),
      section(10, 'exercise', 'ფინალური პრეზენტაცია', [
        { id: 'present', title: 'გუნდის წარდგენა', body: 'წარადგინეთ პროექტი 5 წუთში.' },
        { id: 'questions', title: 'ჟიურის Q&A', body: 'უპასუხეთ ჟიურის კითხვებს 3 წუთის განმავლობაში.' },
      ]),
      section(10, 'outcome', 'ბანაკის დასრულება', [
        { id: 'awards-certificates', title: 'შეფასება, დაჯილდოება და სერტიფიკატები', body: 'ფინალურ წარდგენებს მოჰყვება ჟიურის შეფასება, დაჯილდოება და სერტიფიკატების გადაცემა.' },
        { id: 'next-journey', title: 'ტექნოლოგიური მოგზაურობის დასაწყისი', body: 'გახსოვდეთ, Vibe Coding Camp-ის დასრულება არის მხოლოდ თქვენი ტექნოლოგიური მოგზაურობის დასაწყისი!' },
      ]),
    ],
  },
];
