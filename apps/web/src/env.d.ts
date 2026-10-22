/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (анхдагч) эсвэл 'http' */
  readonly VITE_API_MODE?: string
  /** http горимд backend-ийн хаяг. Хоосон бол dev proxy-ийн `/api` */
  readonly VITE_API_URL?: string
  readonly VITE_MOCK_DELAY?: string
  /** 'qpay' (анхдагч) эсвэл 'mock' */
  readonly VITE_PAYMENT_MODE?: string
  /** server/qpay.ts plugin тохируулна: 'true' бол QPay sandbox */
  readonly VITE_QPAY_SANDBOX?: string
}
