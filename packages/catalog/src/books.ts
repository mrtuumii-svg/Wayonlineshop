/**
 * Үнэгүй номын сан — 40 ном. Бүгд зохиогч/хэвлэлийнхээ зөвшөөрлөөр интернэтэд ҮНЭГҮЙ
 * уншигддаг (албан ёсны сайт, Creative Commons, эсвэл Project Gutenberg-ийн нийтийн өмч).
 * Манай сайт номыг хуулж хадгалахгүй — "Унших" товч албан ёсны үнэгүй хувилбар руу нь хөтөлнө.
 *
 * coverUrl: Open Library (ISBN) эсвэл Project Gutenberg-ийн жинхэнэ нүүр. Нүүргүй номд
 * сайт гарчиг, зохиогчоор нь загварчилсан нүүр зурна. Линк бүрийг 2026-10-30-нд шалгасан.
 */

export interface BookSeed {
  id: string
  slug: string
  title: string
  author: string
  /** Монголоор, 1–2 өгүүлбэр */
  description: string
  /** Хичээлийн ангилалтай ижил: Програмчлал, Дизайн, Маркетинг, Англи хэл */
  category: string
  /** Номын хэл */
  language: string
  year?: number
  coverUrl?: string
  /** Албан ёсны үнэгүй хувилбар */
  readUrl: string
  /** Холбогдох хичээл (seed-ийн хичээлийн id) */
  courseId?: string
}

const openLibrary = (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
const gutenbergCover = (n: number) => `https://www.gutenberg.org/cache/epub/${n}/pg${n}.cover.medium.jpg`
const gutenberg = (n: number) => `https://www.gutenberg.org/ebooks/${n}`

const EN = 'Англи'

export const books: BookSeed[] = [
  // ── Програмчлал: JavaScript, TypeScript, веб ─────────────────────────────
  {
    id: 'b1', slug: 'eloquent-javascript', title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', year: 2018,
    description: 'JavaScript-ийг анхнаас нь, жишээ дасгалтайгаар заадаг алдартай ном. Програмчлалын сэтгэлгээг хамт төлөвшүүлнэ.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781593279509'), readUrl: 'https://eloquentjavascript.net/', courseId: 'c10',
  },
  {
    id: 'b2', slug: 'you-dont-know-js-yet', title: "You Don't Know JS Yet", author: 'Kyle Simpson',
    description: 'JavaScript хэлний гүн гүнзгий механизм — scope, closure, объект, async — цуврал ном.',
    category: 'Програмчлал', language: EN, readUrl: 'https://github.com/getify/You-Dont-Know-JS', courseId: 'c10',
  },
  {
    id: 'b3', slug: 'exploring-js', title: 'JavaScript for Impatient Programmers', author: 'Axel Rauschmayer',
    description: 'Орчин үеийн JavaScript-ийг товч, тодорхой тайлбарласан ном. Аль хэдийн өөр хэл мэддэг хүнд тохиромжтой.',
    category: 'Програмчлал', language: EN, readUrl: 'https://exploringjs.com/', courseId: 'c10',
  },
  {
    id: 'b4', slug: 'typescript-deep-dive', title: 'TypeScript Deep Dive', author: 'Basarat Ali Syed',
    description: 'TypeScript-ийн төрлийн систем, тохиргоо, практик загваруудыг дэлгэрэнгүй тайлбарлана.',
    category: 'Програмчлал', language: EN, readUrl: 'https://basarat.gitbook.io/typescript', courseId: 'c3',
  },
  {
    id: 'b5', slug: 'typescript-handbook', title: 'The TypeScript Handbook', author: 'Microsoft',
    description: 'TypeScript-ийг бүтээгчдийн албан ёсны гарын авлага — хамгийн найдвартай эх сурвалж.',
    category: 'Програмчлал', language: EN, readUrl: 'https://www.typescriptlang.org/docs/handbook/intro.html', courseId: 'c3',
  },
  {
    id: 'b6', slug: 'full-stack-open', title: 'Full Stack Open', author: 'University of Helsinki',
    description: 'React, Node.js, MongoDB, GraphQL, TypeScript-ээр бүрэн вэб апп бүтээх их сургуулийн нээлттэй сургалт.',
    category: 'Програмчлал', language: EN, readUrl: 'https://fullstackopen.com/en/', courseId: 'c1',
  },
  {
    id: 'b7', slug: 'node-best-practices', title: 'Node.js Best Practices', author: 'Yoni Goldberg',
    description: 'Node.js төслийн бүтэц, алдааны удирдлага, аюулгүй байдал, тестийн 100 гаруй шилдэг туршлага.',
    category: 'Програмчлал', language: EN, readUrl: 'https://github.com/goldbergyoni/nodebestpractices', courseId: 'c4',
  },
  {
    id: 'b8', slug: 'pro-git', title: 'Pro Git', author: 'Scott Chacon, Ben Straub', year: 2014,
    description: 'Git-ийн албан ёсны ном: commit, branch, merge-ээс эхлээд дотоод бүтэц хүртэл.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781484200773'), readUrl: 'https://git-scm.com/book/en/v2', courseId: 'c12',
  },
  {
    id: 'b25', slug: 'high-performance-browser-networking', title: 'High Performance Browser Networking', author: 'Ilya Grigorik', year: 2013,
    description: 'HTTP, TCP, TLS, WebSocket — вэб сайтыг хурдан болгохын тулд сүлжээ хэрхэн ажилладгийг ойлгоно.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781449344764'), readUrl: 'https://hpbn.co/', courseId: 'c4',
  },
  {
    id: 'b24', slug: 'software-engineering-at-google', title: 'Software Engineering at Google', author: 'Titus Winters, Tom Manshreck, Hyrum Wright', year: 2020,
    description: 'Google-ийн инженерүүд том системийг хэрхэн тест, код review, хэрэгслээр удирддаг тухай.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781492082798'), readUrl: 'https://abseil.io/resources/swe-book', courseId: 'c4',
  },

  // ── Програмчлал: Python, өгөгдөл, AI ───────────────────────────────────
  {
    id: 'b9', slug: 'think-python', title: 'Think Python', author: 'Allen B. Downey', year: 2015,
    description: 'Python-оор програмчлалд анх суралцагчдад зориулсан, компьютерийн шинжлэх ухааны сэтгэлгээ заадаг ном.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781491939369'), readUrl: 'https://greenteapress.com/wp/think-python-2e/', courseId: 'c9',
  },
  {
    id: 'b10', slug: 'automate-the-boring-stuff', title: 'Automate the Boring Stuff with Python', author: 'Al Sweigart', year: 2019,
    description: 'Файл, Excel, PDF, имэйлтэй ажиллах уйтгартай ажлуудаа Python-оор автоматжуулж сурна.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781593279929'), readUrl: 'https://automatetheboringstuff.com/', courseId: 'c9',
  },
  {
    id: 'b11', slug: 'a-byte-of-python', title: 'A Byte of Python', author: 'Swaroop C H',
    description: 'Python-ийг хамгийн энгийн хэлээр, богино бүлгүүдээр заадаг дэлхий даяар уншигддаг ном.',
    category: 'Програмчлал', language: EN, readUrl: 'https://python.swaroopch.com/', courseId: 'c9',
  },
  {
    id: 'b12', slug: 'python-for-data-analysis', title: 'Python for Data Analysis', author: 'Wes McKinney', year: 2022,
    description: 'pandas-ийг бүтээгчийн бичсэн ном: өгөгдөл цэвэрлэх, нэгтгэх, шинжлэх бүх арга.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781098104030'), readUrl: 'https://wesmckinney.com/book/', courseId: 'c13',
  },
  {
    id: 'b13', slug: 'python-data-science-handbook', title: 'Python Data Science Handbook', author: 'Jake VanderPlas', year: 2016,
    description: 'NumPy, pandas, Matplotlib, Scikit-Learn — өгөгдлийн шинжлэх ухааны гол хэрэгслүүд нэг дор.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781491912058'), readUrl: 'https://jakevdp.github.io/PythonDataScienceHandbook/', courseId: 'c13',
  },
  {
    id: 'b14', slug: 'think-stats', title: 'Think Stats', author: 'Allen B. Downey', year: 2014,
    description: 'Статистикийг томъёогоор биш, Python код ба бодит өгөгдлөөр ойлгомжтой заана.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781491907337'), readUrl: 'https://greenteapress.com/wp/think-stats-2e/', courseId: 'c13',
  },
  {
    id: 'b15', slug: 'introduction-to-statistical-learning', title: 'An Introduction to Statistical Learning', author: 'Gareth James, Daniela Witten, Trevor Hastie, Robert Tibshirani, Jonathan Taylor', year: 2023,
    description: 'Машин сургалтын үндсэн аргуудыг Python дээрх жишээтэйгээр тайлбарласан сонгодог сурах бичиг.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9783031387463'), readUrl: 'https://www.statlearning.com/', courseId: 'c14',
  },
  {
    id: 'b16', slug: 'dive-into-deep-learning', title: 'Dive into Deep Learning', author: 'Aston Zhang, Zachary C. Lipton, Mu Li, Alexander J. Smola', year: 2023,
    description: 'Гүн сургалтыг код ажиллуулж, математиктай нь хамт алхам алхмаар заадаг интерактив ном.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781009389433'), readUrl: 'https://d2l.ai/', courseId: 'c14',
  },
  {
    id: 'b17', slug: 'deep-learning', title: 'Deep Learning', author: 'Ian Goodfellow, Yoshua Bengio, Aaron Courville', year: 2016,
    description: 'Гүн сургалтын онолын үндэс — салбарын хамгийн их иш татагддаг ном.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9780262035613'), readUrl: 'https://www.deeplearningbook.org/', courseId: 'c14',
  },
  {
    id: 'b18', slug: 'mathematics-for-machine-learning', title: 'Mathematics for Machine Learning', author: 'Marc Peter Deisenroth, A. Aldo Faisal, Cheng Soon Ong', year: 2020,
    description: 'Шугаман алгебр, магадлал, оновчлол — машин сургалтад хэрэгтэй математикийг нэг дор.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781108455145'), readUrl: 'https://mml-book.github.io/', courseId: 'c14',
  },

  // ── Програмчлал: систем, DB, DevOps ─────────────────────────────────────
  {
    id: 'b19', slug: 'the-linux-command-line', title: 'The Linux Command Line', author: 'William Shotts', year: 2019,
    description: 'Терминал, файл систем, shell script — Linux-ийн командын мөрийг бүрэн эзэмшинэ.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781593279523'), readUrl: 'https://linuxcommand.org/tlcl.php', courseId: 'c15',
  },
  {
    id: 'b20', slug: 'operating-systems-three-easy-pieces', title: 'Operating Systems: Three Easy Pieces', author: 'Remzi H. Arpaci-Dusseau, Andrea C. Arpaci-Dusseau', year: 2018,
    description: 'Үйлдлийн систем процесс, санах ой, файлыг хэрхэн удирддагийг ойлгомжтой тайлбарлана.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781985086593'), readUrl: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', courseId: 'c15',
  },
  {
    id: 'b21', slug: 'sql-performance-explained', title: 'SQL Performance Explained', author: 'Markus Winand', year: 2012,
    description: 'SQL индекс хэрхэн ажилладгийг ойлгож, удаан query-г хурдан болгож сурна ("Use The Index, Luke").',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9783950307825'), readUrl: 'https://use-the-index-luke.com/', courseId: 'c11',
  },
  {
    id: 'b22', slug: 'docker-curriculum', title: 'Docker for Beginners', author: 'Prakhar Srivastav',
    description: 'Container гэж юу вэ, image бүтээх, апп байршуулах — Docker-ийн анхан шатны бүрэн гарын авлага.',
    category: 'Програмчлал', language: EN, readUrl: 'https://docker-curriculum.com/', courseId: 'c16',
  },
  {
    id: 'b23', slug: 'site-reliability-engineering', title: 'Site Reliability Engineering', author: 'Betsy Beyer, Chris Jones, Jennifer Petoff, Niall Richard Murphy', year: 2016,
    description: 'Google том системээ хэрхэн тасралтгүй, найдвартай ажиллуулдаг тухай SRE-ийн үндсэн ном.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781491929124'), readUrl: 'https://sre.google/sre-book/table-of-contents/', courseId: 'c16',
  },

  // ── Програмчлал: компьютерийн шинжлэх ухаан ─────────────────────────────
  {
    id: 'b26', slug: 'algorithms-erickson', title: 'Algorithms', author: 'Jeff Erickson', year: 2019,
    description: 'Рекурс, динамик програмчлал, граф — алгоритмын их сургуулийн түвшний үнэгүй сурах бичиг.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781792644832'), readUrl: 'https://jeffe.cs.illinois.edu/teaching/algorithms/',
  },
  {
    id: 'b27', slug: 'sicp', title: 'Structure and Interpretation of Computer Programs', author: 'Harold Abelson, Gerald Jay Sussman', year: 1996,
    description: 'MIT-ийн домогт сурах бичиг: програмчлал гэдэг юу болохыг үндсээр нь ойлгуулна.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9780262510875'), readUrl: 'https://sarabander.github.io/sicp/',
  },
  {
    id: 'b28', slug: 'the-rust-programming-language', title: 'The Rust Programming Language', author: 'Steve Klabnik, Carol Nichols', year: 2019,
    description: 'Rust хэлний албан ёсны ном — санах ойн аюулгүй, хурдан систем програмчлал.',
    category: 'Програмчлал', language: EN, coverUrl: openLibrary('9781718500440'), readUrl: 'https://doc.rust-lang.org/book/',
  },

  // ── Дизайн ───────────────────────────────────────────────────────────────
  {
    id: 'b30', slug: 'resilient-web-design', title: 'Resilient Web Design', author: 'Jeremy Keith',
    description: 'Ямар ч төхөөрөмж, хурдан ч удаан интернэтэд ажилладаг вэб бүтээх зарчмууд.',
    category: 'Дизайн', language: EN, readUrl: 'https://resilientwebdesign.com/', courseId: 'c2',
  },
  {
    id: 'b34', slug: 'svg-pocket-guide', title: 'Pocket Guide to Writing SVG', author: 'Joni Trythall',
    description: 'Вэбийн вектор график (SVG)-ийг гараар бичиж, дүрс, өнгө, хөдөлгөөн хийж сурна.',
    category: 'Дизайн', language: EN, readUrl: 'https://svgpocketguide.com/', courseId: 'c2',
  },
  {
    id: 'b33', slug: 'laws-of-ux', title: 'Laws of UX', author: 'Jon Yablonski',
    description: 'Хэрэглэгчийн сэтгэл зүйд суурилсан UX дизайны 30 гаруй хууль, жишээтэйгээ.',
    category: 'Дизайн', language: EN, readUrl: 'https://lawsofux.com/', courseId: 'c5',
  },
  {
    id: 'b32', slug: 'the-shape-of-design', title: 'The Shape of Design', author: 'Frank Chimero',
    description: 'Дизайн гэж юу вэ, яагаад хийдэг вэ — бүтээлч ажлын тухай гүн бодомжтой ном.',
    category: 'Дизайн', language: EN, readUrl: 'https://shapeofdesignbook.com/', courseId: 'c17',
  },
  {
    id: 'b31', slug: 'practical-typography', title: 'Practical Typography', author: 'Matthew Butterick',
    description: 'Үсгийн хэв, мөр хоорондын зай, хуудасны зохиомж — текстийг мэргэжлийн түвшинд харагдуулах дүрмүүд.',
    category: 'Дизайн', language: EN, readUrl: 'https://practicaltypography.com/', courseId: 'c18',
  },

  // ── Маркетинг ────────────────────────────────────────────────────────────
  {
    id: 'b35', slug: 'principles-of-marketing', title: 'Principles of Marketing', author: 'OpenStax',
    description: 'Маркетингийн үндэс: зах зээл, хэрэглэгч, брэнд, үнэ, сурталчилгаа — их сургуулийн нээлттэй сурах бичиг.',
    category: 'Маркетинг', language: EN, readUrl: 'https://openstax.org/details/books/principles-marketing', courseId: 'c6',
  },
  {
    id: 'b37', slug: 'introduction-to-business', title: 'Introduction to Business', author: 'OpenStax',
    description: 'Бизнес хэрхэн ажилладаг, маркетинг, санхүү, менежментийн ерөнхий ойлголт.',
    category: 'Маркетинг', language: EN, readUrl: 'https://openstax.org/details/books/introduction-business', courseId: 'c7',
  },
  {
    id: 'b36', slug: 'entrepreneurship', title: 'Entrepreneurship', author: 'OpenStax',
    description: 'Санаагаа бизнес болгох, хэрэглэгч олох, өсгөх — эхлэн бизнес эрхлэгчдийн сурах бичиг.',
    category: 'Маркетинг', language: EN, readUrl: 'https://openstax.org/details/books/entrepreneurship', courseId: 'c19',
  },

  // ── Англи хэл (Project Gutenberg — нийтийн өмч) ───────────────────────────
  {
    id: 'b38', slug: 'the-elements-of-style', title: 'The Elements of Style', author: 'William Strunk Jr.', year: 1920,
    description: 'Англиар тодорхой, товч бичих дүрмүүдийн сонгодог гарын авлага. IELTS бичгийн хэсэгт тустай.',
    category: 'Англи хэл', language: EN, coverUrl: gutenbergCover(37134), readUrl: gutenberg(37134), courseId: 'c20',
  },
  {
    id: 'b41', slug: 'sherlock-holmes', title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', year: 1892,
    description: 'Шерлок Холмсын 12 мөрдөгч өгүүллэг — үг хэллэг баялаг, сонирхолтой унших дасгал.',
    category: 'Англи хэл', language: EN, coverUrl: gutenbergCover(1661), readUrl: gutenberg(1661), courseId: 'c20',
  },
  {
    id: 'b39', slug: 'pride-and-prejudice', title: 'Pride and Prejudice', author: 'Jane Austen', year: 1813,
    description: 'Англи уран зохиолын хамгийн их уншигддаг роман — сонгодог англи хэлтэй танилцах сайн эхлэл.',
    category: 'Англи хэл', language: EN, coverUrl: gutenbergCover(1342), readUrl: gutenberg(1342), courseId: 'c8',
  },
  {
    id: 'b40', slug: 'alice-in-wonderland', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll', year: 1865,
    description: 'Энгийн өгүүлбэр, хөгжилтэй үйл явдалтай — англиар уншиж эхлэгчдэд хамгийн тохиромжтой ном.',
    category: 'Англи хэл', language: EN, coverUrl: gutenbergCover(11), readUrl: gutenberg(11), courseId: 'c8',
  },
]
