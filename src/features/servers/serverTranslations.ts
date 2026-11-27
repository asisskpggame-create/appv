import type { LocaleCode } from '../../design-system/tokens';
import type { SmartSelectionOutcome } from './types';

export interface ServerTranslations {
  title: string;
  subtitle: string;
  testPingBtn: string;
  probingBtn: string;
  pingSingleLabel: string;
  refreshBtn: string;
  addCustomBtn: string;
  customModalTitle: string;
  customModalDesc: string;
  customNameLabel: string;
  customNamePlaceholder: string;
  customCountryLabel: string;
  customCountryAuto: string;
  customConfigLabel: string;
  customConfigPlaceholder: string;
  customSaveBtn: string;
  customCancelBtn: string;
  customErrorInvalid: string;
  customGroupLabel: string;
  removeCustomLabel: string;
  smartSectionTitle: string;
  smartPolicyLabel: string;
  policyAutomatic: string;
  policyLowestLatency: string;
  policySpecificCountry: string;
  policySpecificServer: string;
  policyFavoriteServer: string;
  runSmartSelect: string;
  smartDiagnosticTitle: string;
  searchPlaceholder: string;
  filterAllCountries: string;
  filterAllProtocols: string;
  filterFavoritesOnly: string;
  sortLabel: string;
  sortDefault: string;
  sortLatency: string;
  sortName: string;
  recentServersTitle: string;
  colServer: string;
  colCountry: string;
  colProtocol: string;
  colLatency: string;
  colAction: string;
  selectBtn: string;
  selectedBtn: string;
  unavailableLabel: string;
  unsupportedLabel: string;
  emptyTitle: string;
  emptyBody: string;
  emptyAction: string;
  icmpVsTunnelTitle: string;
  icmpVsTunnelBody: string;
  reasonMessages: Record<SmartSelectionOutcome['reasonCode'], string>;
}

export const serverTranslations: Record<LocaleCode, ServerTranslations> = {
  'en-US': {
    title: 'Server Locations & Smart Selection',
    subtitle:
      'Browse locations from active subscriptions or add your own custom server endpoints with automatic country flags.',
    testPingBtn: 'Test Ping',
    probingBtn: 'Testing Ping...',
    pingSingleLabel: 'Ping server',
    refreshBtn: 'Refresh List',
    addCustomBtn: 'Add Location',
    customModalTitle: 'Add Custom Location',
    customModalDesc:
      'Paste a server configuration link (VLESS, VMess, Trojan, Shadowsocks, Hysteria2, TUIC, or WireGuard) and assign a custom name and country flag.',
    customNameLabel: 'Location Name (Optional)',
    customNamePlaceholder: 'e.g. Frankfurt Private or Germany Fast',
    customCountryLabel: 'Country & Flag',
    customCountryAuto: 'Auto-detect from name or link',
    customConfigLabel: 'Server Config / URI',
    customConfigPlaceholder: 'vless://uuid@server.example.com:443?security=reality#DE-Frankfurt',
    customSaveBtn: 'Save Location',
    customCancelBtn: 'Cancel',
    customErrorInvalid: 'Enter at least one valid server configuration URI or WireGuard/sing-box block.',
    customGroupLabel: 'Custom',
    removeCustomLabel: 'Remove custom location',
    smartSectionTitle: 'Smart Connection Policy',
    smartPolicyLabel: 'Selection Mode',
    policyAutomatic: 'Automatic',
    policyLowestLatency: 'Lowest Latency',
    policySpecificCountry: 'Specific Country',
    policySpecificServer: 'Specific Server',
    policyFavoriteServer: 'Favorite Server',
    runSmartSelect: 'Evaluate Smart Selection',
    smartDiagnosticTitle: 'Smart Selection Diagnostics',
    searchPlaceholder: 'Search server name, country, or group...',
    filterAllCountries: 'All Countries',
    filterAllProtocols: 'All Protocols',
    filterFavoritesOnly: 'Favorites Only',
    sortLabel: 'Sort',
    sortDefault: 'Default Order',
    sortLatency: 'Latency (Measured)',
    sortName: 'Name (A–Z)',
    recentServersTitle: 'Recently Selected',
    colServer: 'Server / Group',
    colCountry: 'Country',
    colProtocol: 'Protocol',
    colLatency: 'Measured Ping',
    colAction: 'Select',
    selectBtn: 'Select',
    selectedBtn: 'Selected',
    unavailableLabel: 'Unavailable',
    unsupportedLabel: 'UNSUPPORTED',
    emptyTitle: 'No servers available in catalog',
    emptyBody:
      'Click "Add Location" to add your own server config, or import a subscription in Subscriptions.',
    emptyAction: 'Go to Subscriptions',
    icmpVsTunnelTitle: 'Honest Latency & Availability Notice',
    icmpVsTunnelBody:
      'In the Android app, "Test Ping" measures the TCP handshake time from this phone to each server, even while connected. In a browser it falls back to the ASiS gateway. For tunnel servers this is the entry hop only; it is not the end-to-end tunnel latency.',
    reasonMessages: {
      SELECTED_BY_MEASURED_LATENCY: 'Selected lowest measured latency compatible server.',
      SELECTED_COMPATIBLE_NO_LATENCY:
        'Latency measurements are unavailable in browser preview; selected first compatible server.',
      SELECTED_COUNTRY_MATCH: 'Selected compatible server matching target country.',
      SELECTED_FAVORITE_MATCH: 'Selected compatible favorite server.',
      SELECTED_SPECIFIC_SERVER: 'Selected requested specific server.',
      NO_SERVERS_AVAILABLE: 'No servers are currently loaded in the catalog.',
      NO_COMPATIBLE_SERVERS: 'All servers were excluded due to unsupported protocols or unavailability.',
      NO_LATENCY_MEASUREMENTS:
        'Lowest-latency policy requires real probe measurements; none are available yet.',
      NO_MATCHING_COUNTRY: 'No compatible server matched the selected country filter.',
      NO_FAVORITE_SERVERS: 'No compatible servers are starred as favorites.',
    },
  },
  'fa-IR': {
    title: 'فهرست لوکیشن‌ها و انتخاب هوشمند',
    subtitle:
      'مشاهده سرورهای اشتراک‌های فعال یا افزودن مستقیم لوکیشن‌ها و کانفیگ‌های شخصی همراه با پرچم کشورها.',
    testPingBtn: 'تست پینگ',
    probingBtn: 'در حال تست پینگ...',
    pingSingleLabel: 'تست پینگ سرور',
    refreshBtn: 'بروزرسانی فهرست',
    addCustomBtn: 'افزودن لوکیشن',
    customModalTitle: 'افزودن لوکیشن و سرور شخصی',
    customModalDesc:
      'لینک کانفیگ (VLESS، VMess، Trojan، Shadowsocks، Hysteria2، TUIC یا WireGuard) را وارد کنید و نام و پرچم کشور دلخواه را انتخاب نمایید.',
    customNameLabel: 'نام دلخواه لوکیشن (اختیاری)',
    customNamePlaceholder: 'مثلاً آلمان اختصاصی یا Germany Fast',
    customCountryLabel: 'کشور و پرچم',
    customCountryAuto: 'تشخیص خودکار از نام یا لینک',
    customConfigLabel: 'لینک یا پیکربندی سرور',
    customConfigPlaceholder: 'vless://uuid@server.example.com:443?security=reality#DE-Frankfurt',
    customSaveBtn: 'ذخیره لوکیشن',
    customCancelBtn: 'انصراف',
    customErrorInvalid: 'حداقل یک لینک کانفیگ معتبر یا پیکربندی WireGuard / sing-box وارد کنید.',
    customGroupLabel: 'شخصی',
    removeCustomLabel: 'حذف لوکیشن شخصی',
    smartSectionTitle: 'سیاست انتخاب هوشمند اتصال',
    smartPolicyLabel: 'حالت انتخاب',
    policyAutomatic: 'خودکار',
    policyLowestLatency: 'کمترین تاخیر',
    policySpecificCountry: 'کشور مشخص',
    policySpecificServer: 'سرور مشخص',
    policyFavoriteServer: 'سرور برگزیده',
    runSmartSelect: 'اجرای انتخاب هوشمند',
    smartDiagnosticTitle: 'نتیجه تحلیل انتخاب هوشمند',
    searchPlaceholder: 'جستجوی نام سرور، کشور یا گروه...',
    filterAllCountries: 'همه کشورها',
    filterAllProtocols: 'همه پروتکل‌ها',
    filterFavoritesOnly: 'فقط برگزیده‌ها',
    sortLabel: 'مرتب‌سازی',
    sortDefault: 'ترتیب پیش‌فرض',
    sortLatency: 'تاخیر (اندازه‌گیری‌شده)',
    sortName: 'نام سرور',
    recentServersTitle: 'انتخاب‌های اخیر',
    colServer: 'سرور / گروه',
    colCountry: 'کشور',
    colProtocol: 'پروتکل',
    colLatency: 'تاخیر اندازه‌گیری‌شده',
    colAction: 'انتخاب',
    selectBtn: 'انتخاب',
    selectedBtn: 'انتخاب‌شده',
    unavailableLabel: 'ناموجود',
    unsupportedLabel: 'پشتیبانی‌نشده',
    emptyTitle: 'هیچ سروری در فهرست موجود نیست',
    emptyBody:
      'روی دکمه «افزودن لوکیشن» کلیک کنید تا سرورهای خود را اضافه کنید یا در بخش اشتراک‌ها یک اشتراک وارد نمایید.',
    emptyAction: 'رفتن به بخش اشتراک‌ها',
    icmpVsTunnelTitle: 'شفافیت سنجش پینگ و دسترس‌پذیری',
    icmpVsTunnelBody:
      'در اپ اندروید، «تست پینگ» زمان اتصال TCP را از خود گوشی تا هر سرور می‌سنجد، حتی وقتی وصل هستید. در مرورگر از درگاه ASiS سنجیده می‌شود. برای سرورهای تانلی این عدد فقط تا سرور ورودی است و تأخیر کل تانل نیست.',
    reasonMessages: {
      SELECTED_BY_MEASURED_LATENCY: 'سازگارترین سرور با کمترین تاخیر اندازه‌گیری‌شده انتخاب شد.',
      SELECTED_COMPATIBLE_NO_LATENCY:
        'سنجش تاخیر در مرورگر در دسترس نیست؛ اولین سرور سازگار انتخاب شد.',
      SELECTED_COUNTRY_MATCH: 'سرور سازگار مطابق با کشور انتخابی برگزیده شد.',
      SELECTED_FAVORITE_MATCH: 'سرور سازگار از فهرست برگزیده‌ها انتخاب شد.',
      SELECTED_SPECIFIC_SERVER: 'سرور مشخص‌شده با موفقیت انتخاب شد.',
      NO_SERVERS_AVAILABLE: 'هیچ سروری در فهرست فعلی وجود ندارد.',
      NO_COMPATIBLE_SERVERS: 'تمام سرورها به دلیل پروتکل پشتیبانی‌نشده یا عدم دسترس‌پذیری حذف شدند.',
      NO_LATENCY_MEASUREMENTS:
        'انتخاب بر اساس کمترین تاخیر نیازمند سنجش واقعی است و هنوز داده‌ای ثبت نشده است.',
      NO_MATCHING_COUNTRY: 'سرور سازگاری برای کشور انتخاب‌شده یافت نشد.',
      NO_FAVORITE_SERVERS: 'هیچ سرور سازگاری به‌عنوان برگزیده علامت‌گذاری نشده است.',
    },
  },
};
