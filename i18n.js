// Localization: English and Arabic (RTL). Keys are English identifiers.
import { storage } from './storage.js';

const STRINGS = {
  en: {
    studioCredit: 'A game by AKANAZA Studio',
    play: 'Play', multiplayer: 'Multiplayer', otherWorlds: 'Other Worlds', settings: 'Settings',
    back: 'Back', createWorld: 'Create World', worldName: 'World name', multiplayerToggle: 'Multiplayer',
    on: 'ON', off: 'OFF', difficulty: 'Difficulty', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    islandType: 'Island type', volcanic: 'Volcanic Island', desert: 'Desert Island', forest: 'Forest Island',
    playBtn: 'Play', language: 'Language', controls: 'Controls', controlScheme: 'Control scheme',
    arrows: 'Arrow buttons', joystick: 'Virtual joystick', editLayout: 'Edit layout', controlSize: 'Control size',
    saveLayout: 'Save layout', resetLayout: 'Reset',
    dragHint: 'Edit layout, then drag each control to move it. Use the size slider to resize.',
    lanPrototype: 'PROTOTYPE: LAN discovery is simulated. Online multiplayer is not available yet.',
    noWorlds: 'No worlds yet.', noLanWorlds: 'No LAN worlds found.', players: 'players',
    savedWorlds: 'Saved worlds', load: 'Load', delete: 'Delete', confirmDelete: 'Delete this world?',
    profile: 'Profile', profileName: 'Player name', randomize: 'Random', save: 'Save', skin: 'Skin',
    equip: 'Equip', remove: 'Remove', equipped: 'Equipped',
    inventory: 'Bag', crafting: 'Craft', pause: 'Paused', resume: 'Resume', quitToMenu: 'Quit to menu',
    empty: 'Empty', health: 'Health', stamina: 'Stamina',
    noWeapon: 'No weapon', noArmor: 'No armor',
    msgGathered: 'Gathered', msgFull: 'Inventory full', msgCrafted: 'Crafted',
    msgNeedMats: 'Missing materials', msgDied: 'You collapsed. Respawning...',
    msgSaved: 'World saved', msgNotEnough: 'Not enough stamina',
    cannotStore: 'Storage unavailable on this device.',
    loading: 'Generating island...', graphics: 'Graphics quality', low: 'Low', medium: 'Medium', high: 'High',
    qualityHint: 'Lower settings run better on older phones.',
    skinHint: 'Craft armor and clothing to unlock it here.',
    gather: 'Gather', eat: 'Eat', close: 'Close', armorValue: 'Armor', bag: 'Bag', equipment: 'Equipment',
    head: 'Head', body: 'Body', legs: 'Legs', accessory: 'Accessory', weapon: 'Weapon',
    needs: 'Needs', craftBtn: 'Craft', saveGame: 'Save game',
    msgDefeated: 'Defeated', msgAte: 'Ate', msgNothingToEat: 'Nothing to eat', msgLava: 'Lava! Get out!',
    msgEquipped: 'Equipped', msgGathering: 'Gathering', msgUnlocked: 'New skin unlocked',
    msgNoSpace: 'No room in the bag', startHint: 'You have nothing. Gather wood, stone and fiber to begin.',
    done: 'Done', editorHint: 'Drag a control to move it. Drag its orange corner to resize.',
    skinLocked: 'Locked', webglError: 'This device could not start 3D graphics.',
    tapToSkip: 'Tap to continue', sizeLabel: 'Size', seedLabel: 'Seed',
    worldLoadError: 'Could not start the world.', mpNote: 'Multiplayer flag is saved; online play is not available yet.',
    editLayoutTitle: 'Edit controls'
  },
  ar: {
    studioCredit: 'لعبة من استوديو أكانازا',
    play: 'العب', multiplayer: 'اللعب الجماعي', otherWorlds: 'العوالم الأخرى', settings: 'الإعدادات',
    back: 'رجوع', createWorld: 'إنشاء عالم', worldName: 'اسم العالم', multiplayerToggle: 'اللعب الجماعي',
    on: 'تشغيل', off: 'إيقاف', difficulty: 'الصعوبة', easy: 'سهل', normal: 'عادي', hard: 'صعب',
    islandType: 'نوع الجزيرة', volcanic: 'جزيرة بركانية', desert: 'جزيرة صحراوية', forest: 'جزيرة غابات',
    playBtn: 'العب', language: 'اللغة', controls: 'أدوات التحكم', controlScheme: 'نوع التحكم',
    arrows: 'أزرار الأسهم', joystick: 'عصا تحكم افتراضية', editLayout: 'تعديل التخطيط', controlSize: 'حجم أدوات التحكم',
    saveLayout: 'حفظ التخطيط', resetLayout: 'إعادة ضبط',
    dragHint: 'اضغط تعديل التخطيط ثم اسحب كل أداة لتحريكها. استخدم شريط الحجم لتغيير حجمها.',
    lanPrototype: 'نموذج أولي: اكتشاف الشبكة المحلية محاكى. اللعب الجماعي عبر الإنترنت غير متاح بعد.',
    noWorlds: 'لا توجد عوالم بعد.', noLanWorlds: 'لم يتم العثور على عوالم على الشبكة المحلية.', players: 'لاعبين',
    savedWorlds: 'العوالم المحفوظة', load: 'تحميل', delete: 'حذف', confirmDelete: 'هل تريد حذف هذا العالم؟',
    profile: 'الملف الشخصي', profileName: 'اسم اللاعب', randomize: 'عشوائي', save: 'حفظ', skin: 'المظهر',
    equip: 'ارتداء', remove: 'إزالة', equipped: 'مرتدى',
    inventory: 'الحقيبة', crafting: 'صناعة', pause: 'متوقف', resume: 'متابعة', quitToMenu: 'الخروج إلى القائمة',
    empty: 'فارغ', health: 'الصحة', stamina: 'الطاقة',
    noWeapon: 'بلا سلاح', noArmor: 'بلا درع',
    msgGathered: 'تم جمع', msgFull: 'الحقيبة ممتلئة', msgCrafted: 'تمت الصناعة',
    msgNeedMats: 'مواد ناقصة', msgDied: 'لقد سقطت. جارٍ الإحياء...',
    msgSaved: 'تم حفظ العالم', msgNotEnough: 'الطاقة غير كافية',
    cannotStore: 'التخزين غير متاح على هذا الجهاز.',
    loading: 'جارٍ توليد الجزيرة...', graphics: 'جودة الرسوميات', low: 'منخفضة', medium: 'متوسطة', high: 'عالية',
    qualityHint: 'الإعدادات المنخفضة تعمل بشكل أفضل على الهواتف القديمة.',
    skinHint: 'اصنع الدروع والملابس لفتحها هنا.',
    gather: 'اجمع', eat: 'كل', close: 'إغلاق', armorValue: 'الدرع', bag: 'الحقيبة', equipment: 'العتاد',
    head: 'الرأس', body: 'الجسم', legs: 'الساقان', accessory: 'إكسسوار', weapon: 'السلاح',
    needs: 'يحتاج', craftBtn: 'اصنع', saveGame: 'حفظ اللعبة',
    msgDefeated: 'هُزم', msgAte: 'أكلت', msgNothingToEat: 'لا شيء للأكل', msgLava: 'حمم! ابتعد!',
    msgEquipped: 'تم التجهيز', msgGathering: 'جارٍ الجمع', msgUnlocked: 'تم فتح مظهر جديد',
    msgNoSpace: 'لا مكان في الحقيبة', startHint: 'لا تملك شيئاً. اجمع الخشب والحجر والألياف لتبدأ.',
    done: 'تم', editorHint: 'اسحب أداة لتحريكها. اسحب زاويتها البرتقالية لتغيير حجمها.',
    skinLocked: 'مقفل', webglError: 'تعذر تشغيل الرسوميات ثلاثية الأبعاد على هذا الجهاز.',
    tapToSkip: 'المس للمتابعة', sizeLabel: 'الحجم', seedLabel: 'البذرة',
    worldLoadError: 'تعذر بدء العالم.', mpNote: 'تم حفظ خيار اللعب الجماعي؛ اللعب عبر الإنترنت غير متاح بعد.',
    editLayoutTitle: 'تعديل أدوات التحكم'
  }
};

let current = storage.get('language', 'en');
if (!STRINGS[current]) current = 'en';

export function t(key) {
  return (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
}

export function getLanguage() { return current; }

export function setLanguage(lang) {
  if (!STRINGS[lang]) return;
  current = lang;
  storage.set('language', lang);
  applyDocumentLanguage();
  translateDom();
}

export function applyDocumentLanguage() {
  const html = document.documentElement;
  html.lang = current;
  html.dir = current === 'ar' ? 'rtl' : 'ltr';
}

// Fills every element with a data-i18n attribute.
export function translateDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}
