// Terms & Conditions (ka + en). Section numbers are referenced inside the
// text ("see Section 5"), so renumber those references when adding or
// removing a section. Rules here mirror the backend (see legal/index.ts).
import { LegalSection } from '@/src/components/layout/LegalSections';
import { merchantInfo, entityLineKa, entityLineEn } from './shared';

const ka: LegalSection[] = [
  {
    heading: '1. პირობების მიღება',
    paragraphs: [
      `პლატფორმის (cdc.org.ge) გამოყენებით თქვენ ეთანხმებით წინამდებარე წესებსა და პირობებს, კონფიდენციალურობის პოლიტიკას (/privacy) და დაბრუნების პოლიტიკას (/refund-policy). პლატფორმის ოპერატორია ${entityLineKa}.`,
    ],
  },
  {
    heading: '2. სერვისის აღწერა',
    paragraphs: [
      'CDC პლატფორმა აერთიანებს: ონლაინ კურსებსა და ლაივ ტრენინგებს (სერტიფიკატებით), გამოცდებსა და უნარების ტესტებს, AI ხელსაწყოებს (AI ასისტენტი IAKO, ინგლისურის AI მასწავლებელი IMIAKO, AI აგენტები, მედია სტუდია), პერსონალიზებულ საბავშვო წიგნებს, ციფრულ მაღაზიას (მათ შორის რედაქტირებადი შაბლონები და დიზაინის რედაქტორი), სასაჩუქრე ბარათებს, ფრილანს ბირჟას (ესქროუ ანგარიშსწორებით), ვაკანსიების დაფას, მენტორობის სესიებს და ფორუმს.',
      'ფრილანს გარიგებებში, მენტორობასა და ვაკანსიებში CDC ცენტრი მოქმედებს როგორც შუამავალი პლატფორმა (ფრილანს გარიგებებში ასევე ესქროუ აგენტი). ის უზრუნველყოფს უსაფრთხო ტრანზაქციას, მაგრამ არ არის მხარე დამკვეთსა და შემსრულებელს, მენტორსა და სტუდენტს ან დამსაქმებელსა და კანდიდატს შორის ხელშეკრულებაში.',
    ],
  },
  {
    heading: '3. ანგარიშის რეგისტრაცია და ასაკი',
    paragraphs: [
      'სერვისების გამოსაყენებლად საჭიროა ანგარიშის შექმნა და ელ-ფოსტის დადასტურება. თქვენ პასუხისმგებელი ხართ ანგარიშის მონაცემების უსაფრთხოებაზე და ანგარიშიდან შესრულებულ ყველა ქმედებაზე.',
      'ანგარიშის შექმნა და გადახდა შეუძლია 18 წლის ან უფროსი ასაკის პირს. არასრულწლოვანს პლატფორმის გამოყენება შეუძლია მხოლოდ მშობლის ან კანონიერი წარმომადგენლის თანხმობითა და ზედამხედველობით. საბავშვო წიგნებს ქმნის მშობელი ან კანონიერი წარმომადგენელი (იხ. მე-9 პუნქტი).',
    ],
  },
  {
    heading: '4. ანგარიშის ვერიფიკაცია: რატომ და რას გაძლევთ',
    paragraphs: [
      'ვერიფიკაცია ნებაყოფლობითია, მაგრამ ის ადასტურებს, რომ ანგარიშის უკან რეალური ადამიანი ან კომპანიაა. ეს იცავს ყველა მომხმარებელს ყალბი პროფილებისა და თაღლითობისგან. ვერიფიკაციის სახეები:',
      '🪪 „ფიზიკური პირი“: პირადობის მოწმობის ან პასპორტის ატვირთვა და პირადი ნომერი, ადმინისტრაციის დამტკიცებით. ერთი პირადი ნომრით შესაძლებელია მხოლოდ ერთი ანგარიშის ვერიფიკაცია.',
      '🏢 „ბიზნესი“: საჯარო რეესტრის ამონაწერი (ან უცხოური ეკვივალენტი) და საიდენტიფიკაციო კოდი, ადმინისტრაციის დამტკიცებით.',
      '⚡ „ვერიფიცირებული ფრილანსერი“ / 🎓 „ვერიფიცირებული სტუდენტი“: AI-ზედამხედველობით ჩაბარებული უნარების ტესტი ან CDC-ის კურსის დასრულება.',
      'ვერიფიკაციის სარგებელი: (ა) ნაკლები საკომისიო, 20% ნაცვლად 25%-ისა (იხ. მე-5 პუნქტი); (ბ) გამომუშავებული თანხის გატანა საბანკო ანგარიშზე (ვერიფიკაციის გარეშე გატანა შეუძლებელია); (გ) შეკვეთებისა და ვაკანსიების გამოქვეყნება, პროდუქტის გაყიდვაში განთავსება და ფორუმზე ულიმიტო პოსტები; (დ) „ვერიფიცირებული“ ნიშანი პროფილსა და წინადადებებზე, რაც კლიენტებისა და მყიდველების ნდობას ზრდის; (ე) ბიზნესისთვის B2B ინვოისები.',
      'ვერიფიკაციის დოკუმენტები ინახება დახურულ საცავში, მათ ხედავს მხოლოდ ადმინისტრაცია შემოწმების მიზნით და ისინი არ ქვეყნდება. ყალბი დოკუმენტის წარდგენა იწვევს ანგარიშის დაბლოკვას.',
    ],
  },
  {
    heading: '5. დაუდასტურებელი ანგარიშის დამატებითი საკომისიო (+5%)',
    paragraphs: [
      'ვერიფიცირებულ ანგარიშზე მოქმედებს საბაზისო საკომისიო, 20% (იხ. მე-10 და მე-14 პუნქტები). დაუდასტურებელ ანგარიშს ემატება +5%, ანუ ჯამში 25%, როგორც ციფრულ მაღაზიაში, ისე ფრილანს ბირჟის ესქროუ ტრანზაქციებში.',
      'განაკვეთი განისაზღვრება ავტომატურად გაყიდვის/გარიგების დაფიქსირების მომენტში და ფიქსირდება ტრანზაქციაზე. ვერიფიკაციის დამტკიცების შემდეგ ახალი განაკვეთი მომდევნო ტრანზაქციებზე მაშინვე მოქმედებს; უკვე დაფიქსირებული ტრანზაქცია არ იცვლება.',
    ],
  },
  {
    heading: '6. კურსები და ლაივ ტრენინგები',
    paragraphs: [
      'გადახდის დადასტურების შემდეგ კურსზე წვდომა ავტომატურად და დაუყოვნებლივ იხსნება. ლაივ ტრენინგზე ადგილი ჯავშნით შეზღუდულია და ჩარიცხვა დასტურდება მხოლოდ გადახდის დადასტურების შემდეგ.',
      'კურსის მასალა განკუთვნილია პირადი, არაკომერციული გამოყენებისთვის. აკრძალულია ვიდეოს ჩაწერა, გავრცელება ან ანგარიშის სხვისთვის გაზიარება.',
    ],
  },
  {
    heading: '7. გამოცდები, უნარების ტესტები და AI ზედამხედველობა',
    paragraphs: [
      'ზოგიერთი გამოცდა და უნარების ტესტი მიმდინარეობს AI ზედამხედველობით. თქვენი თანხმობით ბრაუზერი იყენებს კამერასა და მიკროფონს და ამოწმებს: ჩანს თუ არა სახე, ხომ არ არის კადრში სხვა პირი, ხომ არ ისმის ფონური ხმა, ტოვებთ თუ არა გამოცდის ფანჯარას ან აკოპირებთ ტექსტს. ვიდეო და აუდიო მუშავდება თქვენს მოწყობილობაზე; ჩვენ ვინახავთ მხოლოდ დარღვევის ტიპსა და დროს.',
      'გამოცდის კითხვები შეიძლება შექმნილი იყოს AI-ის დახმარებით. დარღვევების შემთხვევაში გამოცდა შეიძლება გაუქმდეს, ხოლო თაღლითობით მიღებული სერტიფიკატი ან ვერიფიკაცია გაუქმდეს.',
    ],
  },
  {
    heading: '8. AI ხელსაწყოები და AI-ით შექმნილი კონტენტი',
    paragraphs: [
      'AI ხელსაწყოების პასუხები ავტომატურად იქმნება და შეიძლება შეიცავდეს შეცდომებს. ისინი არ წარმოადგენს იურიდიულ, სამედიცინო, ფინანსურ ან სხვა პროფესიულ რჩევას; მნიშვნელოვანი გადაწყვეტილების წინ გადაამოწმეთ.',
      'თქვენ პასუხისმგებელი ხართ იმაზე, რასაც შეიყვანთ და ატვირთავთ. აკრძალულია უკანონო, შეურაცხმყოფელი, სხვისი უფლებების დამრღვევი კონტენტის შექმნა და სხვა ადამიანის პერსონალური მონაცემების ან ფოტოს ატვირთვა მისი თანხმობის გარეშე.',
      'ფასიანი AI სერვისები (მაგ. IMIAKO PRO ყოველთვიური გამოწერა) იძენს წვდომას მითითებული პერიოდით. გამოწერის გაუქმება შესაძლებელია ნებისმიერ დროს; უკვე გადახდილი პერიოდი ბოლომდე მოქმედებს. AI ხელსაწყოებს შეიძლება ჰქონდეს გამოყენების ლიმიტები.',
    ],
  },
  {
    heading: '9. პერსონალიზებული საბავშვო წიგნები',
    paragraphs: [
      'საბავშვო წიგნს ქმნის მშობელი ან კანონიერი წარმომადგენელი. ბავშვის ფოტოს, სახელისა და სხვა დეტალების ატვირთვით ადასტურებთ, რომ ამის უფლება გაქვთ. ფოტო და დეტალები გამოიყენება მხოლოდ ამ წიგნის ილუსტრაციების, ტექსტისა და გახმოვანების შესაქმნელად და ამისთვის გადაეცემა AI სერვისის პროვაიდერებს.',
      'ბავშვის ფოტოს წაშლა შეგიძლიათ ნებისმიერ დროს წიგნის გვერდიდან. გაზიარების ბმულით წიგნის ნახვა შეუძლია ნებისმიერს, ვისაც ბმული აქვს; გააზიარეთ მხოლოდ სანდო ადამიანებთან.',
      'წიგნი ციფრული პროდუქტია და იქმნება შეკვეთისთანავე. AI ილუსტრაციები შეიძლება ზუსტად არ ჰგავდეს ფოტოს; ტექნიკური ხარვეზის შემთხვევაში წიგნს თავიდან შევქმნით ან თანხას დაგიბრუნებთ (იხ. დაბრუნების პოლიტიკა).',
    ],
  },
  {
    heading: '10. ციფრული მაღაზია: შემოსავლის განაწილება',
    paragraphs: [
      'ციფრულ მაღაზიაში გაყიდვისას პლატფორმის ჯამური საკომისიო არის 20% ვერიფიცირებული ავტორისთვის ან 25% დაუდასტურებელი ანგარიშისთვის (იხ. მე-5 პუნქტი). იგი მოიცავს 10%-ს საბანკო საგადახდო სისტემის ტრანზაქციის ხარჯად და 10%-ს (ან 15%-ს) CDC ცენტრის პლატფორმულ მომსახურებად.',
      'ავტორის სუფთა შემოსავალი გადახდისთანავე ისახება მის შიდა ბალანსზე. საბანკო ანგარიშზე გატანა საჭიროებს ანგარიშის ვერიფიკაციას (იხ. მე-4 პუნქტი) და მუშავდება მოთხოვნიდან 1 სამუშაო დღეში.',
    ],
  },
  {
    heading: '11. ციფრული მაღაზია: ლიცენზია და AI-ით შექმნილი პროდუქტები',
    paragraphs: [
      'პროდუქტზე საავტორო უფლება რჩება ავტორთან. შესყიდვა გაძლევთ გამოყენების ლიცენზიას, რომლის ტიპი (პირადი ან კომერციული) მითითებულია პროდუქტის გვერდზე. აკრძალულია პროდუქტის ხელახლა გაყიდვა, ცალკე პროდუქტად გავრცელება ან საკუთარ ნამუშევრად წარდგენა, თუ ლიცენზია ამას პირდაპირ არ უშვებს.',
      'CDC-ის ზოგიერთი პროდუქტი (მაგ. ბეჭდვადი დიზაინები, შაბლონები, პლანერები) იქმნება AI-ის დახმარებით და გამოქვეყნებამდე მოწმდება ჩვენი გუნდის მიერ. ასეთ პროდუქტებზე მოქმედებს მათ გვერდზე მითითებული ლიცენზია.',
    ],
  },
  {
    heading: '12. დიზაინის რედაქტორი',
    paragraphs: [
      'რედაქტირებადი შაბლონის ყიდვის შემდეგ შეგიძლიათ შეცვალოთ ის საიტის დიზაინის რედაქტორში. თქვენი დიზაინები ინახება თქვენს ანგარიშში. მზა დიზაინზე მოქმედებს თავდაპირველი პროდუქტის ლიცენზია.',
      'რედაქტორში ატვირთული ფოტოები და ლოგოები უნდა იყოს თქვენი ან გქონდეთ მათი გამოყენების უფლება. ისინი გამოიყენება მხოლოდ თქვენი დიზაინისთვის.',
    ],
  },
  {
    heading: '13. სასაჩუქრე ბარათები',
    paragraphs: [
      'სასაჩუქრე ბარათი იყიდება 5-დან 1000 ლარამდე ღირებულებით და მოქმედებს შეძენიდან 365 დღე. ბარათის კოდი გამოიყენება საიტზე ნებისმიერი შესყიდვისას პრომო კოდის ველში; ნაწილობრივი გამოყენებისას დარჩენილი ბალანსი რჩება ვადის ბოლომდე.',
      'ბარათი არ იცვლება ნაღდ ფულზე და გადახდილი თანხა არ ბრუნდება, გარდა კანონით გათვალისწინებული შემთხვევებისა ან თუ ბარათი ტექნიკური ხარვეზით ვერ მიიღეთ. კოდი ინახეთ საიდუმლოდ: მისი გამოყენება შეუძლია ნებისმიერს, ვინც მას იცნობს.',
    ],
  },
  {
    heading: '14. ფრილანს ბირჟა და ესქროუ',
    paragraphs: [
      'გარიგების თანხა ინახება ესქროუში, სანამ დამკვეთი არ დაადასტურებს სამუშაოს (ან ეტაპს). საკომისიო არის 20% ვერიფიცირებული ფრილანსერისთვის და 25% დაუდასტურებელისთვის (იხ. მე-5 პუნქტი). ესქროუ თავისუფლდება: (ა) დამკვეთის დადასტურებით; (ბ) შეთანხმებული ვადის გასვლის შემდეგ, თუ დამკვეთი არ უპასუხებს; ან (გ) დავის განხილვის შედეგად (იხ. 21-ე პუნქტი).',
      'გადახდის პროვაიდერები მოქმედებენ PSD2 სტანდარტების შესაბამისად, რაც საეჭვო ან მაღალი რისკის ოპერაციისას (უცნობი მოწყობილობა ან IP, უჩვეულოდ დიდი თანხა) შეიძლება მოითხოვდეს დამატებით ავთენტიფიკაციას (SCA).',
    ],
  },
  {
    heading: '15. ვაკანსიების დაფა',
    paragraphs: [
      'ვაკანსიის გამოქვეყნება საჭიროებს ანგარიშის ვერიფიკაციას. დამსაქმებელი პასუხისმგებელია ვაკანსიის სიზუსტესა და კანონიერებაზე. აკრძალულია კანდიდატისგან თანხის მოთხოვნა, დისკრიმინაციული ან შეცდომაში შემყვანი განცხადება.',
      'კანდიდატის განაცხადი (CV და სხვა მონაცემები) ეგზავნება მხოლოდ შესაბამის დამსაქმებელს. CDC იტოვებს უფლებას წაშალოს წესების დამრღვევი ვაკანსია.',
    ],
  },
  {
    heading: '16. მენტორობის სესიები',
    paragraphs: [
      'უფასო გაუქმება შესაძლებელია სესიამდე მინიმუმ 12 საათით ადრე; თანხა ბრუნდება საბანკო ხარჯის გამოკლებით (იხ. მე-17 პუნქტი).',
      'სესიამდე 12 საათზე ნაკლებით ადრე გაუქმებისას თანხის 50% რჩება მენტორის დაჯავშნილი დროის კომპენსაციად, 50% ბრუნდება. თუ მენტორი არ გამოცხადდა, სტუდენტს უბრუნდება 100%.',
    ],
  },
  {
    heading: '17. გადახდები, ვალუტა და ინვოისები',
    paragraphs: [
      'ფასები მითითებულია ლარში (₾). ქართული ბარათით გადახდა მუშავდება საქართველოს ბანკის (BOG) უსაფრთხო გვერდზე, ლარში. უცხოეთში გაცემული Visa/Mastercard ბარათით შეგიძლიათ გადაიხადოთ იმავე გზით, ლარში, ხოლო ვალუტას თქვენი ბანკი გადაიყვანს.',
      'სადაც ეს შესაძლებლობა ჩართულია, საერთაშორისო ბარათით გადახდა ასევე შესაძლებელია Stripe-ის უსაფრთხო გვერდზე, აშშ დოლარში (USD). თანხა დოლარში გამოითვლება checkout-ზე ნაჩვენები კურსით. ბარათის მონაცემებს ჩვენ არ ვინახავთ: მათ ამუშავებს BOG ან Stripe.',
      'თქვენი ბანკის მიერ დაკისრებულ კონვერტაციის ან საერთაშორისო ოპერაციის საკომისიოზე CDC პასუხს არ აგებს. ყოველ დასრულებულ შესყიდვაზე, ესქროუ ტრანზაქციასა და მენტორობის ჯავშანზე ავტომატურად იქმნება PDF ინვოისი.',
    ],
  },
  {
    heading: '18. თანხის დაბრუნება',
    paragraphs: [
      'ციფრული პროდუქტები და სერვისები მიეწოდება მყისიერად, ამიტომ დაბრუნების უფლება შეზღუდულია. დეტალური წესები (კურსი 24 საათში, ჩამოტვირთული პროდუქტი, სასაჩუქრე ბარათი, საბავშვო წიგნი, AI გამოწერა, ტექნიკური ხარვეზი) იხილეთ დაბრუნების პოლიტიკაში (/refund-policy).',
      'ნებაყოფლობითი მოთხოვნით დაბრუნებისას იქვითება თავდაპირველი გადახდის საბანკო ხარჯი (დაახლოებით 1.5%–2%). თანხა ბრუნდება იმავე ბარათზე, რომლითაც გადაიხადეთ.',
    ],
  },
  {
    heading: '19. მომხმარებლის ქცევა',
    paragraphs: [
      'აკრძალულია: სხვისი ანგარიშის გამოყენება ან რამდენიმე ანგარიშით ვერიფიკაციის გვერდის ავლა; პლატფორმის გვერდის ავლით გადახდა; თაღლითობა და ყალბი დოკუმენტები; საავტორო უფლებების დარღვევა; სპამი; AI ხელსაწყოების ბოროტად გამოყენება ან სისტემის ავტომატური გადატვირთვა. დარღვევისას ანგარიში შეიძლება შეიზღუდოს ან დაიბლოკოს.',
    ],
  },
  {
    heading: '20. პლატფორმის ინტელექტუალური საკუთრება',
    paragraphs: [
      'CDC-ის მიერ შექმნილი კურსები, ვიდეოები, დიზაინი და სერტიფიკატის შაბლონები CDC-ის საკუთრებაა. სერტიფიკატის მფლობელს შეუძლია გამოიყენოს იგი პირად პორტფოლიოში. მესამე მხარის პროდუქტებისთვის იხ. მე-11 პუნქტი.',
    ],
  },
  {
    heading: '21. დავების გადაწყვეტა',
    paragraphs: [
      'ესქროუ გარიგებაზე დავის შემთხვევაში მხარეები წარადგენენ მტკიცებულებებს პლატფორმის დავების პროცედურაში. CDC იღებს გადაწყვეტილებას ესქროუში არსებული თანხის განაწილებაზე, რაც არ ზღუდავს მხარეთა უფლებას მიმართონ სასამართლოს.',
      'თანხის გატანის მოთხოვნები გადის რისკის შეფასებას; მაღალი რისკის მოთხოვნას ადმინისტრაცია ხელით განიხილავს.',
    ],
  },
  {
    heading: '22. პასუხისმგებლობის შეზღუდვა',
    paragraphs: [
      'პლატფორმა მოწოდებულია „როგორც არის“. CDC არ აგებს პასუხს მომხმარებლებს შორის გარიგებების შედეგებზე, დამსაქმებლის ქმედებებზე ან AI ხელსაწყოს პასუხის საფუძველზე მიღებულ გადაწყვეტილებებზე, გარდა კანონით გათვალისწინებული შემთხვევებისა.',
    ],
  },
  {
    heading: '23. პირობების ცვლილება',
    paragraphs: [
      'პირობები შეიძლება განახლდეს სერვისის ცვლილებასთან ერთად. ბოლო განახლების თარიღი მითითებულია გვერდის თავში. არსებითი ცვლილების შესახებ შეგატყობინებთ საიტზე ან ელ-ფოსტით; ცვლილების შემდეგ პლატფორმის გამოყენება ნიშნავს ახალ პირობებზე თანხმობას.',
    ],
  },
  {
    heading: '24. მარეგულირებელი კანონმდებლობა',
    paragraphs: ['პირობები რეგულირდება საქართველოს კანონმდებლობით. დავები განიხილება საქართველოს კომპეტენტურ სასამართლოებში.'],
  },
  {
    heading: '25. კონტაქტი',
    paragraphs: [`${entityLineKa} · ${merchantInfo.email} · ${merchantInfo.phone}`],
  },
];

const en: LegalSection[] = [
  {
    heading: '1. Acceptance of Terms',
    paragraphs: [
      `By using the platform (cdc.org.ge) you agree to these Terms & Conditions, the Privacy Policy (/privacy) and the Refund Policy (/refund-policy). The platform is operated by ${entityLineEn}.`,
    ],
  },
  {
    heading: '2. Description of Service',
    paragraphs: [
      "The CDC Platform combines: online courses and live trainings (with certificates), exams and skill tests, AI tools (the IAKO AI assistant, the IMIAKO AI English tutor, AI agents, Media Studio), personalized children's books, a Digital Store (including editable templates and a design editor), gift cards, a freelance marketplace (with escrow), a job board, mentorship sessions, and a community forum.",
      'For freelance deals, mentorship and vacancies, CDC Center acts as an intermediary platform (and, for freelance deals, as an escrow agent). It secures the transaction but is not a party to the agreement between client and freelancer, mentor and student, or employer and candidate.',
    ],
  },
  {
    heading: '3. Account Registration and Age',
    paragraphs: [
      'Using the services requires an account and a verified email. You are responsible for keeping your credentials safe and for all activity on your account.',
      "You must be 18 or older to create an account and make payments. Minors may use the platform only with the consent and supervision of a parent or legal guardian. Children's books are created by a parent or legal guardian (see Section 9).",
    ],
  },
  {
    heading: '4. Account Verification: Why and What You Get',
    paragraphs: [
      'Verification is optional, but it confirms that a real person or company is behind an account. This protects every user from fake profiles and fraud. Verification types:',
      '🪪 "Individual": upload an ID card or passport and your personal ID number, approved by an administrator. One personal ID number can verify only one account.',
      '🏢 "Business": a Public Registry extract (or a foreign equivalent) and the company ID code, approved by an administrator.',
      '⚡ "Verified Freelancer" / 🎓 "Verified Student": passing an AI-proctored skill test or completing a CDC course.',
      'Benefits of verification: (a) lower fees, 20% commission instead of 25% (see Section 5); (b) withdrawing your earnings to your bank account (payouts are not possible without verification); (c) posting gigs and vacancies, listing products for sale, and unlimited forum posting; (d) a "Verified" badge on your profile and proposals, which builds trust with clients and buyers; (e) B2B invoices for businesses.',
      'Verification documents are kept in private storage, are seen only by administrators for the check, and are never published. Submitting a forged document leads to the account being blocked.',
    ],
  },
  {
    heading: '5. Unverified Account Surcharge (+5%)',
    paragraphs: [
      'Verified accounts pay the base commission of 20% (see Sections 10 and 14). Unverified accounts pay an extra +5%, i.e. 25% in total, both in the Digital Store and in freelance escrow transactions.',
      'The rate is set automatically when a sale or deal is recorded and is locked onto that transaction. Once verification is approved, the lower rate applies immediately to later transactions; already-recorded transactions do not change.',
    ],
  },
  {
    heading: '6. Courses and Live Trainings',
    paragraphs: [
      'Course access opens automatically and immediately after payment is confirmed. Live trainings have limited seats, and enrollment is confirmed only after payment is confirmed.',
      'Course content is for personal, non-commercial use. Recording or redistributing videos, or sharing your account, is prohibited.',
    ],
  },
  {
    heading: '7. Exams, Skill Tests and AI Proctoring',
    paragraphs: [
      'Some exams and skill tests are AI-proctored. With your permission, your browser uses your camera and microphone to check whether your face is visible, whether another person is in frame, whether there is background voice, and whether you leave the exam window or copy text. Video and audio are processed on your device; we store only the type and time of each flagged event.',
      'Exam questions may be generated with the help of AI. Violations can void an exam, and a certificate or verification obtained by cheating can be revoked.',
    ],
  },
  {
    heading: '8. AI Tools and AI-Generated Content',
    paragraphs: [
      'AI tool outputs are generated automatically and may contain mistakes. They are not legal, medical, financial or other professional advice; double-check before making important decisions.',
      "You are responsible for what you enter and upload. Creating unlawful, abusive or rights-infringing content is prohibited, as is uploading another person's personal data or photo without their consent.",
      'Paid AI services (e.g. the IMIAKO PRO monthly subscription) give access for the stated period. You can cancel at any time; the period already paid for remains active until it ends. AI tools may have usage limits.',
    ],
  },
  {
    heading: "9. Personalized Children's Books",
    paragraphs: [
      "Children's books are created by a parent or legal guardian. By uploading a child's photo, name or other details, you confirm you have the right to do so. These are used only to create that book's illustrations, text and narration, and are sent to AI service providers for that purpose.",
      "You can delete the child's photo at any time from the book page. Anyone who has a book's share link can view it, so share it only with people you trust.",
      'A book is a digital product created as soon as it is ordered. AI illustrations may not look exactly like the photo; if a technical fault occurs, we will regenerate the book or refund you (see the Refund Policy).',
    ],
  },
  {
    heading: '10. Digital Store: Revenue Split',
    paragraphs: [
      "The total platform fee on a Digital Store sale is 20% for a verified creator or 25% for an unverified account (see Section 5): 10% covers the bank payment-system transaction cost and 10% (or 15%) is CDC Center's platform service fee.",
      "The creator's net earnings are credited to their internal balance as soon as payment completes. Withdrawing to a bank account requires a verified account (see Section 4) and is processed within 1 business day of the request.",
    ],
  },
  {
    heading: '11. Digital Store: Licenses and AI-Created Products',
    paragraphs: [
      "Copyright in a product stays with its creator. A purchase gives you a license to use it, whose type (personal or commercial) is shown on the product page. Reselling, redistributing it as a standalone product, or presenting it as your own work is prohibited unless the license explicitly allows it.",
      "Some CDC products (e.g. printable designs, templates, planners) are created with the help of AI and reviewed by our team before publishing. The license shown on each such product's page applies.",
    ],
  },
  {
    heading: '12. Design Editor',
    paragraphs: [
      "After buying an editable template you can customize it in the site's design editor. Your designs are saved in your account. The original product's license applies to the finished design.",
      'Photos and logos you upload to the editor must be yours or you must have the right to use them. They are used only for your design.',
    ],
  },
  {
    heading: '13. Gift Cards',
    paragraphs: [
      'Gift cards are sold for 5 to 1,000 GEL and are valid for 365 days from purchase. The code can be used in the promo-code field of any checkout on the site; if only part is used, the remaining balance stays available until the card expires.',
      'Gift cards cannot be exchanged for cash and are non-refundable, except where the law requires it or the card was not received because of a technical fault. Keep the code secret: anyone who knows it can use it.',
    ],
  },
  {
    heading: '14. Freelance Marketplace and Escrow',
    paragraphs: [
      'Deal funds are held in escrow until the client approves the work (or a milestone). The commission is 20% for a verified freelancer and 25% for an unverified one (see Section 5). Escrow is released: (a) on the client\'s approval; (b) automatically if the client does not respond after the agreed deadline; or (c) as a result of dispute resolution (see Section 21).',
      'Payment providers follow PSD2 standards, which may require Strong Customer Authentication (SCA) for unusual or high-risk activity (an unfamiliar device or IP, an unusually large amount).',
    ],
  },
  {
    heading: '15. Job Board',
    paragraphs: [
      'Posting a vacancy requires a verified account. Employers are responsible for the accuracy and lawfulness of their vacancies. Charging candidates any fee, and discriminatory or misleading listings, are prohibited.',
      "A candidate's application (CV and other details) is sent only to the employer concerned. CDC may remove any vacancy that breaks these rules.",
    ],
  },
  {
    heading: '16. Mentorship Sessions',
    paragraphs: [
      'Free cancellation is available up to 12 hours before the session; the amount is refunded minus the bank cost (see Section 17).',
      "If cancelled less than 12 hours before, 50% is kept as compensation for the mentor's reserved time and 50% is refunded. If the mentor does not show up, the student receives a 100% refund.",
    ],
  },
  {
    heading: '17. Payments, Currency and Invoices',
    paragraphs: [
      'Prices are shown in Georgian lari (₾). Payment with a Georgian card is processed on the secure Bank of Georgia (BOG) page, in GEL. Visa/Mastercard cards issued abroad can pay the same way, in GEL, and your bank converts the currency.',
      'Where enabled, international cards can also pay on the secure Stripe checkout page in US dollars (USD). The USD amount is calculated at the rate shown at checkout. We never store card details: they are processed by BOG or Stripe.',
      'CDC is not responsible for currency-conversion or foreign-transaction fees charged by your bank. A PDF invoice is generated automatically for every completed purchase, escrow transaction and mentorship booking.',
    ],
  },
  {
    heading: '18. Refunds',
    paragraphs: [
      "Digital products and services are delivered instantly, so the right of withdrawal is limited. See the Refund Policy (/refund-policy) for the detailed rules (courses within 24 hours, downloaded products, gift cards, children's books, AI subscriptions, technical faults).",
      'For a voluntary refund request, the bank cost of the original payment (about 1.5%–2%) is deducted. Funds are returned to the card you paid with.',
    ],
  },
  {
    heading: '19. User Conduct',
    paragraphs: [
      "Prohibited: using another person's account or multiple accounts to get around verification; paying outside the platform to avoid fees; fraud and forged documents; copyright infringement; spam; abusing AI tools or automatically overloading the system. Violations can lead to the account being restricted or blocked.",
    ],
  },
  {
    heading: '20. Platform Intellectual Property',
    paragraphs: [
      'Courses, videos, design and certificate templates created by CDC are the property of CDC. Certificate holders may use their certificate in a personal portfolio. For third-party products, see Section 11.',
    ],
  },
  {
    heading: '21. Dispute Resolution',
    paragraphs: [
      "In a dispute over an escrow deal, both parties submit evidence through the platform's dispute process. CDC decides how the escrowed funds are allocated; this does not limit either party's right to go to court.",
      'Withdrawal requests go through a risk check; high-risk requests are reviewed manually by an administrator.',
    ],
  },
  {
    heading: '22. Limitation of Liability',
    paragraphs: [
      "The platform is provided \"as is\". CDC is not liable for the outcome of deals between users, for employers' actions, or for decisions made based on an AI tool's output, except as required by law.",
    ],
  },
  {
    heading: '23. Changes to These Terms',
    paragraphs: [
      'These terms may be updated as the service changes. The last-updated date is shown at the top of this page. We will notify you of material changes on the site or by email; continuing to use the platform after a change means you accept the new terms.',
    ],
  },
  {
    heading: '24. Governing Law',
    paragraphs: ['These terms are governed by the laws of Georgia. Disputes are subject to the competent courts of Georgia.'],
  },
  {
    heading: '25. Contact',
    paragraphs: [`${entityLineEn} · ${merchantInfo.email} · ${merchantInfo.phone}`],
  },
];

export const termsAndConditions = { ka, en };
