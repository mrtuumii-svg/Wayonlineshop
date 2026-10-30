import type {
  AdminOrder,
  AdminUser,
  CourseInput,
  CourseUpdate,
  AuthResult,
  ChatConversation,
  ChatReply,
  ChatRequest,
  Course,
  CourseFilter,
  CourseSummary,
  MyCourse,
  Order,
  Paginated,
  PaymentIntent,
  Progress,
  Role,
  SalesReport,
  User,
} from './types'

export type { AuthResult }

/**
 * Админы API. Зөвхөн role=admin хэрэглэгчид backend зөвшөөрнө (бусдад 403).
 * Сайт цэсийг нуудаг нь зөвхөн тав тух — жинхэнэ хамгаалалт нь backend.
 */
export interface AdminApi {
  getSalesReport(): Promise<SalesReport>
  getUsers(): Promise<AdminUser[]>
  setUserRole(id: string, role: Role): Promise<AdminUser>
  getOrders(status?: Order['status']): Promise<AdminOrder[]>
  getInstructors(): Promise<{ id: string; name: string }[]>
  createCourse(input: CourseInput): Promise<{ id: string; slug: string }>
  updateCourse(id: string, input: CourseUpdate): Promise<{ id: string; slug: string }>
  deleteCourse(id: string): Promise<void>
}

/** Backend-тэй харилцах цорын ганц гэрээ. UI зөвхөн үүгээр дамжина. */
export interface ApiClient {
  getCourses(filter?: CourseFilter): Promise<Paginated<CourseSummary>>
  /** Сагсны id-ууд. Бүх каталогийг татахгүйн тулд. */
  getCoursesByIds(ids: string[]): Promise<CourseSummary[]>
  getCourse(slug: string): Promise<Course>
  getCategories(): Promise<string[]>
  register(input: { name: string; email: string; password: string }): Promise<AuthResult>
  login(input: { email: string; password: string }): Promise<AuthResult>
  getMe(): Promise<User>
  /** Захиалга `pending`-ээр үүсгэж QR буцаана. Төлбөр хийгдээгүй. */
  checkout(courseIds: string[]): Promise<PaymentIntent>
  /** Төлбөрийн статусыг хянах. Зөвхөн өөрийн захиалга. */
  getOrder(orderId: string): Promise<Order>
  /**
   * Зөвхөн QPay sandbox-д: туршилтын QR-ийг жинхэнэ банк уншихгүй тул төлсөнд тооцно.
   * Production болон mock-д байхгүй (undefined).
   */
  simulatePayment?(orderId: string): Promise<void>
  getMyCourses(): Promise<MyCourse[]>
  getProgress(courseId: string): Promise<Progress>
  markLessonComplete(courseId: string, lessonId: string): Promise<Progress>
  /** AI туслахтай ярих. Зөвхөн шинэ мессежээ илгээнэ — түүхийг сервер сангаас уншина. */
  chat(input: ChatRequest): Promise<ChatReply>
  /** Refresh-ийн дараа яриаг сэргээх. Байхгүй бол NOT_FOUND. */
  getConversation(id: string): Promise<ChatConversation>
  /** Админы хэсэг. Mock горимд байхгүй (undefined) */
  admin?: AdminApi
}
