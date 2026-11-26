import type { LocaleCode } from '../../design-system/tokens';

export interface SubscriptionCopy {
  title: string;
  subtitle: string;
  tabAccount: string;
  tabImported: string;
  accountNotConnectedTitle: string;
  accountNotConnectedBody: string;
  accountSyncBtn: string;
  importTitle: string;
  importSubtitle: string;
  methodUrl: string;
  methodClipboard: string;
  methodQr: string;
  methodFile: string;
  labelName: string;
  placeholderName: string;
  labelUrl: string;
  placeholderUrl: string;
  labelPayload: string;
  placeholderPayload: string;
  btnImportUrl: string;
  btnPasteClipboard: string;
  btnScanQrImage: string;
  btnSelectFile: string;
  btnRefresh: string;
  btnDelete: string;
  btnSelectActive: string;
  activeSelectedLabel: string;
  qrNoteSupported: string;
  qrNoteUnsupported: string;
  errUrlEmpty: string;
  errUrlMalformed: string;
  errUrlInsecure: string;
  errUrlBlocked: string;
  errDuplicate: string;
  errClipboardDenied: string;
  errFileTooLarge: string;
  errUnparsedPayload: string;
  errQrNoCode: string;
  detailTotalTraffic: string;
  detailUsedTraffic: string;
  detailRemainingTraffic: string;
  detailStartDate: string;
  detailExpirationDate: string;
  detailStatus: string;
  detailType: string;
  detailAllowedDevices: string;
  detailLocations: string;
  detailLastSync: string;
  detailRenewal: string;
  detailNodesCount: string;
  unavailable: string;
  emptyImportedTitle: string;
  emptyImportedBody: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  deleteConfirmBtn: string;
  cancelBtn: string;
  expirationAlertTitle: string;
  expirationAlertBody: string;
  privacyNotice: string;
}

export const subscriptionTranslations: Record<LocaleCode, SubscriptionCopy> = {
  'en-US': {
    title: 'Subscriptions',
    subtitle:
      'Synchronize account plans from PasarGuard/Reseller or import configuration links, files, and QR codes securely.',
    tabAccount: 'Account Subscriptions',
    tabImported: 'Manual Imports',
    accountNotConnectedTitle: 'Account synchronization unavailable',
    accountNotConnectedBody:
      'Sign in and connect the PasarGuard and Reseller adapters in Phase 3 to synchronize account subscriptions and authoritative quotas.',
    accountSyncBtn: 'Check Gateway Sync',
    importTitle: 'Add Manual Subscription',
    importSubtitle:
      'Supports HTTPS subscription URLs, clipboard paste, QR code image decode, and .txt / .json / .conf configuration files.',
    methodUrl: 'URL',
    methodClipboard: 'Clipboard',
    methodQr: 'QR Code',
    methodFile: 'Config File',
    labelName: 'Subscription Name',
    placeholderName: 'e.g. Primary Profile',
    labelUrl: 'Subscription URL (HTTPS)',
    placeholderUrl: 'https://sub.example.com/profile/...',
    labelPayload: 'Configuration Content or URI List (Optional)',
    placeholderPayload: 'Paste vless://, vmess://, trojan://, ss://, sing-box JSON, or WireGuard config...',
    btnImportUrl: 'Validate & Import',
    btnPasteClipboard: 'Read from Clipboard',
    btnScanQrImage: 'Decode QR Image',
    btnSelectFile: 'Choose Config File',
    btnRefresh: 'Refresh',
    btnDelete: 'Delete',
    btnSelectActive: 'Use Subscription',
    activeSelectedLabel: 'Selected',
    qrNoteSupported: 'Browser BarcodeDetector is available for QR image decoding.',
    qrNoteUnsupported:
      'This browser does not support native BarcodeDetector QR decoding. Use URL, Clipboard, or Config File import, or run on native Android/iOS.',
    errUrlEmpty: 'Enter a subscription URL or configuration payload.',
    errUrlMalformed: 'The provided subscription URL is malformed.',
    errUrlInsecure: 'Only secure https:// subscription URLs are permitted.',
    errUrlBlocked: 'Private, loopback, or invalid hostnames are blocked.',
    errDuplicate: 'Duplicate detected: this subscription URL or configuration is already imported.',
    errClipboardDenied: 'Clipboard access was denied by the browser. Paste manually into the field.',
    errFileTooLarge: 'Configuration file exceeds the 512 KB safety limit.',
    errUnparsedPayload: 'No valid VPN configuration URIs or supported JSON/WireGuard blocks were found.',
    errQrNoCode: 'No readable QR code was detected in the selected image.',
    detailTotalTraffic: 'Total Traffic',
    detailUsedTraffic: 'Used Traffic',
    detailRemainingTraffic: 'Remaining Traffic',
    detailStartDate: 'Start Date',
    detailExpirationDate: 'Expiration Date',
    detailStatus: 'Status',
    detailType: 'Type',
    detailAllowedDevices: 'Allowed Devices',
    detailLocations: 'Parsed Nodes / Locations',
    detailLastSync: 'Last Synced',
    detailRenewal: 'Renewal Info',
    detailNodesCount: 'Parsed Endpoints',
    unavailable: 'Unavailable',
    emptyImportedTitle: 'No manually imported subscriptions',
    emptyImportedBody:
      'Import an HTTPS subscription URL, paste configurations from clipboard, or upload a supported .txt / .json / .conf file.',
    deleteConfirmTitle: 'Delete Imported Subscription',
    deleteConfirmBody:
      'Remove this manually imported subscription and its parsed local endpoints from the workspace?',
    deleteConfirmBtn: 'Delete Subscription',
    cancelBtn: 'Cancel',
    expirationAlertTitle: 'Subscription Expiration Notice',
    expirationAlertBody: 'This subscription is expired or nearing expiration.',
    privacyNotice:
      'Raw subscription URLs are hashed (SHA-256) for duplicate detection and are never written to logs or analytics.',
  },
  'fa-IR': {
    title: 'اشتراک‌ها',
    subtitle:
      'همگام‌سازی اشتراک‌های حساب کاربری یا افزودن دستی لینک اشتراک، کلیپ‌بورد، کد QR و فایل پیکربندی.',
    tabAccount: 'اشتراک‌های حساب',
    tabImported: 'افزودن دستی',
    accountNotConnectedTitle: 'همگام‌سازی اشتراک حساب در دسترس نیست',
    accountNotConnectedBody:
      'برای دریافت اشتراک‌های حساب و ترافیک رسمی، پس از اتصال آداپتورهای PasarGuard و سیستم نمایندگی وارد حساب شوید.',
    accountSyncBtn: 'بررسی همگام‌سازی درگاه',
    importTitle: 'افزودن اشتراک دستی',
    importSubtitle:
      'پشتیبانی از لینک اشتراک HTTPS، خواندن از کلیپ‌بورد، تصویر کد QR و فایل‌های پیکربندی .txt / .json / .conf.',
    methodUrl: 'لینک اشتراک',
    methodClipboard: 'کلیپ‌بورد',
    methodQr: 'کد QR',
    methodFile: 'فایل کانفیگ',
    labelName: 'نام اشتراک',
    placeholderName: 'مثال: پروفایل اصلی',
    labelUrl: 'آدرس اشتراک (HTTPS)',
    placeholderUrl: 'https://sub.example.com/profile/...',
    labelPayload: 'محتوای کانفیگ یا فهرست لینک‌ها (اختیاری)',
    placeholderPayload: 'لینک‌های vless://، vmess://، trojan://، ss:// یا فایل JSON / WireGuard را وارد کنید...',
    btnImportUrl: 'اعتبارسنجی و افزودن',
    btnPasteClipboard: 'خواندن از کلیپ‌بورد',
    btnScanQrImage: 'خواندن تصویر QR',
    btnSelectFile: 'انتخاب فایل پیکربندی',
    btnRefresh: 'بروزرسانی',
    btnDelete: 'حذف',
    btnSelectActive: 'انتخاب اشتراک',
    activeSelectedLabel: 'انتخاب‌شده',
    qrNoteSupported: 'قابلیت BarcodeDetector مرورگر برای خواندن تصویر QR فعال است.',
    qrNoteUnsupported:
      'مرورگر فعلی از رمزگشایی بومی QR پشتیبانی نمی‌کند. از ورود لینک، کلیپ‌بورد یا فایل استفاده کنید (در اپلیکیشن بومی موبایل فعال است).',
    errUrlEmpty: 'لطفاً آدرس اشتراک یا متن پیکربندی را وارد کنید.',
    errUrlMalformed: 'ساختار آدرس اشتراک معتبر نیست.',
    errUrlInsecure: 'فقط لینک‌های امن https:// مجاز هستند.',
    errUrlBlocked: 'آدرس‌های محلی، شبکه داخلی یا نامعتبر مسدود هستند.',
    errDuplicate: 'اشتراک تکراری: این لینک یا پیکربندی قبلاً اضافه شده است.',
    errClipboardDenied: 'دسترسی به کلیپ‌بورد توسط مرورگر رد شد. لطفاً متن را به‌صورت دستی جای‌گذاری کنید.',
    errFileTooLarge: 'حجم فایل از سقف ایمن ۵۱۲ کیلوبایت بیشتر است.',
    errUnparsedPayload: 'هیچ لینک VPN معتبر یا ساختار پشتیبانی‌شده JSON/WireGuard یافت نشد.',
    errQrNoCode: 'کد QR قابل خواندن در تصویر انتخاب‌شده یافت نشد.',
    detailTotalTraffic: 'حجم کل',
    detailUsedTraffic: 'حجم مصرف‌شده',
    detailRemainingTraffic: 'حجم باقیمانده',
    detailStartDate: 'تاریخ شروع',
    detailExpirationDate: 'تاریخ انقضا',
    detailStatus: 'وضعیت',
    detailType: 'نوع اشتراک',
    detailAllowedDevices: 'دستگاه‌های مجاز',
    detailLocations: 'سرورها / نودهای استخراج‌شده',
    detailLastSync: 'آخرین همگام‌سازی',
    detailRenewal: 'اطلاعات تمدید',
    detailNodesCount: 'تعداد نودها',
    unavailable: 'نامشخص (از سرور دریافت نشده)',
    emptyImportedTitle: 'هیچ اشتراک دستی ثبت نشده است',
    emptyImportedBody:
      'یک لینک اشتراک HTTPS وارد کنید، از کلیپ‌بورد بخوانید یا یک فایل .txt / .json / .conf بارگذاری کنید.',
    deleteConfirmTitle: 'حذف اشتراک دستی',
    deleteConfirmBody:
      'آیا از حذف این اشتراک و نودهای استخراج‌شده آن از محیط کلاینت اطمینان دارید؟',
    deleteConfirmBtn: 'حذف اشتراک',
    cancelBtn: 'انصراف',
    expirationAlertTitle: 'هشدار وضعیت اشتراک',
    expirationAlertBody: 'این اشتراک منقضی شده یا در آستانه انقضا است.',
    privacyNotice:
      'آدرس‌های اشتراک برای تشخیص تکرار به‌صورت هش SHA-256 ذخیره می‌شوند و در گزارش‌ها ثبت نمی‌گردند.',
  },
};
