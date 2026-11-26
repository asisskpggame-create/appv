import type { LocaleCode } from './tokens';

export interface TranslationDictionary {
  brandName: string;
  navOverview: string;
  navComponents: string;
  navArchitecture: string;
  navRoadmap: string;
  primaryCta: string;
  heroTitle: string;
  heroSubtitle: string;
  heroMeta: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;
  languageLabel: string;
  sectionFoundationTitle: string;
  sectionFoundationDesc: string;
  paletteTitle: string;
  typographyTitle: string;
  sectionComponentsTitle: string;
  sectionComponentsDesc: string;
  buttonsTitle: string;
  btnPrimary: string;
  btnSecondary: string;
  btnOutline: string;
  btnDanger: string;
  btnLoading: string;
  inputsTitle: string;
  inputUsernameLabel: string;
  inputUsernamePlaceholder: string;
  inputPasswordLabel: string;
  inputPasswordPlaceholder: string;
  inputUrlLabel: string;
  inputUrlPlaceholder: string;
  inputInvalidMsg: string;
  inputValidMsg: string;
  statesTitle: string;
  statePopulated: string;
  stateLoading: string;
  stateEmpty: string;
  stateError: string;
  emptyHeading: string;
  emptyBody: string;
  emptyAction: string;
  errorHeading: string;
  errorBody: string;
  errorAction: string;
  populatedTitle: string;
  populatedMeta: string;
  dialogTitle: string;
  dialogBody: string;
  dialogConfirm: string;
  dialogCancel: string;
  dialogConfirmedNote: string;
  sectionArchitectureTitle: string;
  sectionArchitectureDesc: string;
  platformWebTitle: string;
  platformWebBody: string;
  platformNativeTitle: string;
  platformNativeBody: string;
  integrationTitle: string;
  integrationBody: string;
  statusNotConnected: string;
  statusCompleted: string;
  statusPending: string;
  sectionRoadmapTitle: string;
  sectionRoadmapDesc: string;
  footerCopyright: string;
  footerMeta: string;
  sampleMetricLatency: string;
  sampleMetricUsage: string;
}

export const translations: Record<LocaleCode, TranslationDictionary> = {
  'en-US': {
    brandName: 'ASiS VPN',
    navOverview: 'Overview',
    navComponents: 'Design System',
    navArchitecture: 'Architecture',
    navRoadmap: 'Roadmap',
    primaryCta: 'Inspect Dialog',
    heroTitle: 'Phase 1: ASiS VPN Design System & Client Foundation',
    heroSubtitle:
      'Commercial multi-platform client architecture targeting Android, iOS, and Windows, engineered to integrate with existing PasarGuard and reseller infrastructure.',
    heroMeta: 'Phase 0 & Phase 1 Active · Bilingual LTR / RTL · Light & Dark Verified',
    themeLabel: 'Appearance',
    themeLight: 'Light',
    themeDark: 'Dark',
    languageLabel: 'Language',
    sectionFoundationTitle: 'Brand Palette & Typography',
    sectionFoundationDesc:
      'Core ASiS VPN color system, dual-theme contrast pairs, and tabular numeric discipline.',
    paletteTitle: 'Color Tokens',
    typographyTitle: 'Type Scale & Numerals',
    sectionComponentsTitle: 'Reusable UI Primitives',
    sectionComponentsDesc:
      'Interactive buttons, bilingual form fields with validation, state containers, and accessible modal dialogs.',
    buttonsTitle: 'Action Controls',
    btnPrimary: 'Connect Action',
    btnSecondary: 'Secondary Action',
    btnOutline: 'Outlined Action',
    btnDanger: 'Revoke Session',
    btnLoading: 'Synchronizing',
    inputsTitle: 'Form & Validation Controls',
    inputUsernameLabel: 'Account Username',
    inputUsernamePlaceholder: 'Enter username',
    inputPasswordLabel: 'Account Password',
    inputPasswordPlaceholder: 'Enter password',
    inputUrlLabel: 'Subscription URL Validation Sample',
    inputUrlPlaceholder: 'https://example.com/sub/...',
    inputInvalidMsg: 'Subscription URLs must use https:// and a valid hostname.',
    inputValidMsg: 'URL syntax passed client-side format check.',
    statesTitle: 'State Completeness',
    statePopulated: 'Populated',
    stateLoading: 'Loading',
    stateEmpty: 'Empty',
    stateError: 'Error',
    emptyHeading: 'No subscriptions synchronized',
    emptyBody: 'Sign in with your account or import a valid subscription link once Phase 4 is enabled.',
    emptyAction: 'Reset Preview State',
    errorHeading: 'Gateway integration not connected',
    errorBody: 'PasarGuard and Reseller adapters are awaiting upstream API schemas before live requests can run.',
    errorAction: 'Retry Check',
    populatedTitle: 'Design Token Verification Row',
    populatedMeta: 'Authoritative Source: None (Phase 1 UI Primitive) · Status: Ready',
    dialogTitle: 'Modal & Focus Trap Verification',
    dialogBody:
      'Dialogs support keyboard Escape dismissal, backdrop click, RTL/LTR logical spacing, and accessible contrast in both Light and Dark themes.',
    dialogConfirm: 'Confirm Check',
    dialogCancel: 'Close',
    dialogConfirmedNote: 'Dialog interaction verified.',
    sectionArchitectureTitle: 'Runtime & Integration Boundaries',
    sectionArchitectureDesc:
      'Clear separation between what runs inside this web workspace and what requires native OS toolchains or upstream credentials.',
    platformWebTitle: 'Web & Gateway Workspace (AI Studio)',
    platformWebBody:
      'Houses the bilingual design system, TypeScript protocol URI parsers, SSRF-safe subscription validator, and Express API gateway prototype.',
    platformNativeTitle: 'Native VPN Tunnels (Android / iOS / Windows)',
    platformNativeBody:
      'Real TUN interfaces via Android VpnService, iOS NEPacketTunnelProvider, and Windows Wintun + sing-box require native SDK compilation.',
    integrationTitle: 'PasarGuard & Reseller Adapters',
    integrationBody:
      'End-user client only. Gateway adapters will connect after sanitized API endpoints, auth flows, and sample payloads are provided.',
    statusNotConnected: 'NOT CONNECTED',
    statusCompleted: 'Completed',
    statusPending: 'Pending Approval',
    sectionRoadmapTitle: 'Phased Engineering Plan',
    sectionRoadmapDesc:
      'Incremental delivery sequence from Phase 0 through Phase 10. Phase 2 starts upon approval.',
    footerCopyright: 'ASiS VPN Client Architecture',
    footerMeta: 'Phase 0 & 1 Foundation · No simulated tunnels or fabricated balances',
    sampleMetricLatency: 'Tabular Latency Metric',
    sampleMetricUsage: 'Tabular Quota Metric',
  },
  'fa-IR': {
    brandName: 'ASiS VPN',
    navOverview: 'نمای کلی',
    navComponents: 'سیستم طراحی',
    navArchitecture: 'معماری',
    navRoadmap: 'نقشه راه',
    primaryCta: 'بررسی پنجره مودال',
    heroTitle: 'فاز ۱: سیستم طراحی و زیرساخت کلاینت ASiS VPN',
    heroSubtitle:
      'معماری کلاینت تجاری چندپلتفرمی برای اندروید، iOS و ویندوز، طراحی‌شده برای اتصال امن به پنل موجود PasarGuard و سیستم نمایندگی فعلی.',
    heroMeta: 'فاز ۰ و ۱ فعال · پشتیبانی کامل راست‌به‌چپ و چپ‌به‌راست · تم روشن و تاریک',
    themeLabel: 'ظاهر',
    themeLight: 'روشن',
    themeDark: 'تاریک',
    languageLabel: 'زبان',
    sectionFoundationTitle: 'پالت رنگ و تایپوگرافی برند',
    sectionFoundationDesc:
      'سیستم رنگ اختصاصی ASiS VPN، جفت‌های کنتراست تم روشن و تاریک و اعداد جدول‌بندی‌شده.',
    paletteTitle: 'توکن‌های رنگ',
    typographyTitle: 'مقیاس تایپوگرافی و ارقام',
    sectionComponentsTitle: 'اجزای رابط کاربری قابل استفاده مجدد',
    sectionComponentsDesc:
      'دکمه‌های تعاملی، فیلدهای فرم دوزبانه با اعتبارسنجی، وضعیت‌های استاندارد داده و دیالوگ‌های دسترس‌پذیر.',
    buttonsTitle: 'کنترل‌های عملیات',
    btnPrimary: 'عملیات اصلی اتصال',
    btnSecondary: 'عملیات ثانویه',
    btnOutline: 'دکمه حاشیه‌دار',
    btnDanger: 'لغو نشست',
    btnLoading: 'در حال همگام‌سازی',
    inputsTitle: 'فرم و اعتبارسنجی ورودی',
    inputUsernameLabel: 'نام کاربری حساب',
    inputUsernamePlaceholder: 'نام کاربری را وارد کنید',
    inputPasswordLabel: 'رمز عبور حساب',
    inputPasswordPlaceholder: 'رمز عبور را وارد کنید',
    inputUrlLabel: 'نمونه اعتبارسنجی لینک اشتراک',
    inputUrlPlaceholder: 'https://example.com/sub/...',
    inputInvalidMsg: 'آدرس اشتراک باید با https:// و دامنه معتبر آغاز شود.',
    inputValidMsg: 'ساختار آدرس در بررسی سمت کلاینت معتبر است.',
    statesTitle: 'کامل بودن وضعیت‌های نمایش',
    statePopulated: 'دارای داده',
    stateLoading: 'در حال بارگذاری',
    stateEmpty: 'خالی',
    stateError: 'خطا',
    emptyHeading: 'هیچ اشتراکی همگام‌سازی نشده است',
    emptyBody: 'پس از پیاده‌سازی فاز ۴ می‌توانید با حساب خود وارد شوید یا لینک اشتراک معتبر وارد کنید.',
    emptyAction: 'بازنشانی وضعیت پیش‌نمایش',
    errorHeading: 'درگاه یکپارچه‌سازی متصل نیست',
    errorBody: 'آداپتورهای PasarGuard و سیستم نمایندگی پیش از ارسال درخواست واقعی در انتظار دریافت مستندات API هستند.',
    errorAction: 'بررسی مجدد',
    populatedTitle: 'ردیف تایید توکن طراحی',
    populatedMeta: 'منبع رسمی: ناموجود (پیش‌نمایش فاز ۱) · وضعیت: آماده',
    dialogTitle: 'بررسی مودال و جهت راست‌به‌چپ',
    dialogBody:
      'دیالوگ‌ها از کلید Escape، کلیک پس‌زمینه، فاصله‌گذاری منطقی RTL/LTR و کنتراست استاندارد در هر دو تم روشن و تاریک پشتیبانی می‌کنند.',
    dialogConfirm: 'تایید بررسی',
    dialogCancel: 'بستن',
    dialogConfirmedNote: 'تعامل دیالوگ تایید شد.',
    sectionArchitectureTitle: 'مرزهای اجرا و یکپارچه‌سازی',
    sectionArchitectureDesc:
      'تفکیک شفاف میان بخش‌های قابل اجرا در محیط وب و ماژول‌هایی که نیازمند ابزارهای بومی سیستم‌عامل یا مستندات سرور هستند.',
    platformWebTitle: 'محیط وب و درگاه API (AI Studio)',
    platformWebBody:
      'شامل سیستم طراحی دوزبانه، پارسرهای پروتکل تایپ‌اسکریپت، اعتبارسنجی امن لینک اشتراک و نمونه درگاه Express.',
    platformNativeTitle: 'تونل‌های بومی VPN (اندروید / iOS / ویندوز)',
    platformNativeBody:
      'ساخت اینترفیس واقعی TUN از طریق Android VpnService، iOS NEPacketTunnelProvider و Windows Wintun + sing-box نیازمند کامپایلر بومی است.',
    integrationTitle: 'آداپتورهای PasarGuard و سیستم نمایندگی',
    integrationBody:
      'فقط کلاینت کاربر نهایی. اتصال واقعی پس از دریافت مستندات API، روش احراز هویت و نمونه پاسخ‌های غیرحساس انجام می‌شود.',
    statusNotConnected: 'متصل نیست',
    statusCompleted: 'تکمیل شده',
    statusPending: 'در انتظار تایید',
    sectionRoadmapTitle: 'برنامه اجرایی فازبندی‌شده',
    sectionRoadmapDesc:
      'توالی پیاده‌سازی گام‌به‌گام از فاز ۰ تا فاز ۱۰. فاز ۲ پس از تایید شما آغاز می‌شود.',
    footerCopyright: 'معماری کلاینت ASiS VPN',
    footerMeta: 'زیرساخت فاز ۰ و ۱ · بدون شبیه‌سازی جعلی تونل یا موجودی ساختگی',
    sampleMetricLatency: 'نمایش عدد تاخیر',
    sampleMetricUsage: 'نمایش عدد مصرف',
  },
};
