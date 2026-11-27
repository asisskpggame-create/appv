import type { LocaleCode } from '../../design-system/tokens';

export interface AuthCopy {
  screenTitle: string;
  screenSubtitle: string;
  gatewayStatusLabel: string;
  gatewayNotConnected: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  forgotPasswordLink: string;
  submitSignIn: string;
  submitSigningIn: string;
  tabLink: string;
  tabPassword: string;
  tabsAriaLabel: string;
  linkLabel: string;
  linkPlaceholder: string;
  linkHint: string;
  validationLinkRequired: string;
  validationLinkInvalid: string;
  errorLinkTitle: string;
  errorLinkBody: string;
  validationUsernameRequired: string;
  validationUsernameMin: string;
  validationUsernameFormat: string;
  validationPasswordRequired: string;
  validationPasswordMin: string;
  errorCodeLabel: string;
  diagnosticIdLabel: string;
  errorInvalidCredentialsTitle: string;
  errorInvalidCredentialsBody: string;
  errorLockedTitle: string;
  errorLockedBody: string;
  errorSuspendedTitle: string;
  errorSuspendedBody: string;
  errorSessionExpiredTitle: string;
  errorSessionExpiredBody: string;
  errorNetworkTitle: string;
  errorNetworkBody: string;
  errorBackendTitle: string;
  errorBackendBody: string;
  recoveryTitle: string;
  recoveryDescription: string;
  recoveryUsernameLabel: string;
  recoverySubmit: string;
  recoverySubmitting: string;
  recoveryCancel: string;
  recoveryNotConnectedNote: string;
  stateInspectorLabel: string;
  stateLiveAttempt: string;
  stateInvalidPreview: string;
  stateSuspendedPreview: string;
  stateExpiredPreview: string;
  stateNetworkPreview: string;
  stateClear: string;
  securityNoteTitle: string;
  securityNoteBody: string;
  sessionActiveTitle: string;
  sessionLogout: string;
  sessionRevokeAll: string;
}

export const authTranslations: Record<LocaleCode, AuthCopy> = {
  'en-US': {
    screenTitle: 'Sign in to ASiS VPN',
    screenSubtitle:
      'Authenticate with your account credentials to synchronize subscriptions and device sessions.',
    gatewayStatusLabel: 'Gateway Integration',
    gatewayNotConnected: 'NOT CONNECTED (Awaiting Upstream Config)',
    usernameLabel: 'Username',
    usernamePlaceholder: 'Enter your account username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    showPasswordLabel: 'Show password',
    hidePasswordLabel: 'Hide password',
    forgotPasswordLink: 'Forgot password?',
    submitSignIn: 'Sign In',
    submitSigningIn: 'Signing in...',
    tabLink: 'Subscription link',
    tabPassword: 'Username & password',
    tabsAriaLabel: 'Sign-in method',
    linkLabel: 'Subscription link',
    linkPlaceholder: 'https://sub.example.com/sub/...',
    linkHint: 'Paste the subscription link you received from your provider.',
    validationLinkRequired: 'Subscription link is required.',
    validationLinkInvalid: 'Enter a full link starting with https://',
    errorLinkTitle: 'Subscription link not accepted',
    errorLinkBody: 'Check that you pasted the full link from your provider, then try again.',
    validationUsernameRequired: 'Username is required.',
    validationUsernameMin: 'Username must be at least 3 characters.',
    validationUsernameFormat:
      'Username may only contain letters, numbers, dots, underscores, or hyphens.',
    validationPasswordRequired: 'Password is required.',
    validationPasswordMin: 'Password must be at least 6 characters.',
    errorCodeLabel: 'Code',
    diagnosticIdLabel: 'Diagnostic ID',
    errorInvalidCredentialsTitle: 'Invalid credentials',
    errorInvalidCredentialsBody:
      'The username or password was rejected by the authentication service. Verify your input and try again.',
    errorLockedTitle: 'Account locked',
    errorLockedBody:
      'The password was wrong 3 times, so this account is locked. Contact support or your reseller and ask them to unlock it.',
    errorSuspendedTitle: 'Account suspended',
    errorSuspendedBody:
      'This account is currently suspended. Please contact your service provider or reseller support.',
    errorSessionExpiredTitle: 'Session expired',
    errorSessionExpiredBody:
      'Your session token expired or was revoked from another device. Please sign in again.',
    errorNetworkTitle: 'Network connection error',
    errorNetworkBody:
      'Unable to reach the ASiS Client API Gateway. Check your internet connection and retry.',
    errorBackendTitle: 'Authentication gateway not connected',
    errorBackendBody:
      'No live PasarGuard or Reseller authentication endpoint is configured yet. Configure your server adapters to enable sign-in.',
    recoveryTitle: 'Password recovery',
    recoveryDescription:
      'Password recovery is delegated to your existing reseller or account provider workflow. Enter your username to check recovery availability.',
    recoveryUsernameLabel: 'Account Username',
    recoverySubmit: 'Request Recovery',
    recoverySubmitting: 'Checking workflow...',
    recoveryCancel: 'Cancel',
    recoveryNotConnectedNote:
      'Password recovery endpoint is awaiting upstream Reseller Adapter configuration.',
    stateInspectorLabel: 'Auth UI State Preview',
    stateLiveAttempt: 'Live Submit',
    stateInvalidPreview: 'Invalid Credentials',
    stateSuspendedPreview: 'Suspended',
    stateExpiredPreview: 'Session Expired',
    stateNetworkPreview: 'Network Error',
    stateClear: 'Reset',
    securityNoteTitle: 'Token & Credential Protection',
    securityNoteBody:
      'Your password is never saved on the device. The web preview keeps the session only in memory; the installed app keeps the session on this device (app storage, not yet the system secure store) so you stay signed in.',
    sessionActiveTitle: 'Active Authenticated Session',
    sessionLogout: 'Sign Out',
    sessionRevokeAll: 'Revoke Device Session',
  },
  'fa-IR': {
    screenTitle: 'ورود به ASiS VPN',
    screenSubtitle:
      'برای همگام‌سازی اشتراک‌ها و مدیریت نشست دستگاه‌ها با نام کاربری و رمز عبور خود وارد شوید.',
    gatewayStatusLabel: 'وضعیت اتصال درگاه',
    gatewayNotConnected: 'متصل نیست (در انتظار تنظیمات سرور)',
    usernameLabel: 'نام کاربری',
    usernamePlaceholder: 'نام کاربری حساب خود را وارد کنید',
    passwordLabel: 'رمز عبور',
    passwordPlaceholder: 'رمز عبور خود را وارد کنید',
    showPasswordLabel: 'نمایش رمز عبور',
    hidePasswordLabel: 'مخفی کردن رمز عبور',
    forgotPasswordLink: 'فراموشی رمز عبور؟',
    submitSignIn: 'ورود به حساب',
    submitSigningIn: 'در حال احراز هویت...',
    tabLink: 'لینک اشتراک',
    tabPassword: 'نام کاربری و رمز',
    tabsAriaLabel: 'روش ورود',
    linkLabel: 'لینک اشتراک',
    linkPlaceholder: 'https://sub.example.com/sub/...',
    linkHint: 'لینک اشتراکی را که از فروشنده گرفته‌اید اینجا بچسبانید.',
    validationLinkRequired: 'وارد کردن لینک اشتراک الزامی است.',
    validationLinkInvalid: 'لینک کامل را با https:// وارد کنید.',
    errorLinkTitle: 'لینک اشتراک پذیرفته نشد',
    errorLinkBody: 'مطمئن شوید لینک کامل را از فروشنده کپی کرده‌اید و دوباره تلاش کنید.',
    validationUsernameRequired: 'وارد کردن نام کاربری الزامی است.',
    validationUsernameMin: 'نام کاربری باید حداقل ۳ کاراکتر باشد.',
    validationUsernameFormat:
      'نام کاربری فقط می‌تواند شامل حروف، اعداد، نقطه، زیرخط یا خط تیره باشد.',
    validationPasswordRequired: 'وارد کردن رمز عبور الزامی است.',
    validationPasswordMin: 'رمز عبور باید حداقل ۶ کاراکتر باشد.',
    errorCodeLabel: 'کد خطا',
    diagnosticIdLabel: 'شناسه تشخیصی',
    errorInvalidCredentialsTitle: 'نام کاربری یا رمز عبور نادرست است',
    errorInvalidCredentialsBody:
      'اطلاعات ورود توسط سرویس احراز هویت تایید نشد. ورودی خود را بررسی کرده و دوباره تلاش کنید.',
    errorLockedTitle: 'حساب قفل شد',
    errorLockedBody:
      'رمز عبور ۳ بار اشتباه وارد شد و حساب قفل شده است. برای بازکردن آن با پشتیبانی یا فروشنده‌ی خود تماس بگیرید.',
    errorSuspendedTitle: 'حساب کاربری مسدود شده است',
    errorSuspendedBody:
      'این حساب در حال حاضر غیرفعال یا معلق است. لطفاً با پشتیبانی ارائه‌دهنده سرویس خود تماس بگیرید.',
    errorSessionExpiredTitle: 'نشست کاربری منقضی شد',
    errorSessionExpiredBody:
      'توکن نشست شما منقضی شده یا از دستگاه دیگری لغو شده است. لطفاً دوباره وارد شوید.',
    errorNetworkTitle: 'خطا در اتصال شبکه',
    errorNetworkBody:
      'امکان برقراری ارتباط با درگاه API کلاینت ASiS وجود ندارد. اتصال اینترنت خود را بررسی کنید.',
    errorBackendTitle: 'درگاه احراز هویت متصل نیست',
    errorBackendBody:
      'هنوز سرویس زنده PasarGuard یا پنل نمایندگی پیکربندی نشده است. پس از تنظیم آداپتورهای سرور، ورود فعال می‌شود.',
    recoveryTitle: 'بازیابی رمز عبور',
    recoveryDescription:
      'بازیابی رمز عبور از طریق فرآیند موجود در سیستم نمایندگی یا ارائه‌دهنده حساب انجام می‌شود.',
    recoveryUsernameLabel: 'نام کاربری حساب',
    recoverySubmit: 'درخواست بازیابی',
    recoverySubmitting: 'در حال بررسی...',
    recoveryCancel: 'انصراف',
    recoveryNotConnectedNote:
      'مسیر بازیابی رمز عبور تا زمان پیکربندی آداپتور سیستم نمایندگی غیرفعال است.',
    stateInspectorLabel: 'پیش‌نمایش وضعیت‌های خطای ورود',
    stateLiveAttempt: 'ارسال واقعی فرم',
    stateInvalidPreview: 'اطلاعات نامعتبر',
    stateSuspendedPreview: 'حساب مسدود',
    stateExpiredPreview: 'انقضای نشست',
    stateNetworkPreview: 'خطای شبکه',
    stateClear: 'بازنشانی',
    securityNoteTitle: 'حفاظت از توکن و اطلاعات ورود',
    securityNoteBody:
      'رمز عبور شما هرگز روی دستگاه ذخیره نمی‌شود. در پیش‌نمایش وب نشست فقط در حافظه موقت می‌ماند؛ اپ نصب‌شده نشست را روی همین دستگاه (حافظه‌ی خود اپ، هنوز نه مخزن امن سیستم) نگه می‌دارد تا واردشده بمانید.',
    sessionActiveTitle: 'نشست فعال احراز هویت‌شده',
    sessionLogout: 'خروج امن',
    sessionRevokeAll: 'لغو نشست دستگاه',
  },
};
