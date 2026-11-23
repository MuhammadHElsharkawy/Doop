import { Injectable, computed, inject } from '@angular/core';
import { PreferencesService } from '../preferences/preferences.service';

const en = {
  overview: 'Overview',
  tasks: 'Tasks',
  habits: 'Habits',
  focus: 'Focus',
  progress: 'Progress',
  overviewDescription: 'See what needs your attention today.',
  tasksDescription: 'Organize the work you want to finish.',
  habitsDescription: 'Build routines and track your consistency.',
  focusDescription: 'Make time for focused work.',
  progressDescription: 'Review how your time and routines have changed.',
  unavailable: 'Available in a later milestone.',
  navigation: 'Main navigation',
  skip: 'Skip to main content',
  expand: 'Expand sidebar',
  collapse: 'Collapse sidebar',
  settings: 'Settings',
  close: 'Close',
  appearance: 'Appearance',
  theme: 'Color theme',
  language: 'Language',
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  emerald: 'Emerald',
  slate: 'Slate',
  indigo: 'Indigo',
  teal: 'Teal',
  rose: 'Rose',
  amber: 'Amber',
  workspaceLoading: 'Opening local workspace storage…',
  workspaceBlocked:
    'Close other Doop tabs to finish opening workspace storage.',
  workspaceStorageError:
    'Doop couldn’t open workspace storage. Check that your browser allows site storage.',
  workspaceMigrationError:
    'Some stored records prevent the workspace upgrade. Your previous data is still intact.',
  workspaceInvalidRecord:
    'Doop couldn’t read a stored workspace record. The record is still in storage.',
  workspaceInvalidRecordWrite:
    'Doop couldn’t save your change because a stored record is unreadable. The record is still in storage.',
  workspaceReadError:
    'Doop couldn’t read workspace data. Try reading it again.',
  workspaceWriteError:
    'Doop couldn’t save your change. Try the same action again.',
  workspaceQuotaError:
    'Your change wasn’t saved because browser storage is full. Free space and try the same action again.',
  retryStorage: 'Retry storage',
  storageError:
    'Doop couldn’t save or load preferences. Changes may be lost when you refresh.',
};

const ar: typeof en = {
  overview: 'نظرة عامة',
  tasks: 'المهام',
  habits: 'العادات',
  focus: 'التركيز',
  progress: 'التقدم',
  overviewDescription: 'اطّلع على ما يحتاج إلى اهتمامك اليوم.',
  tasksDescription: 'نظّم الأعمال التي تريد إنجازها.',
  habitsDescription: 'كوّن عادات وتابع مدى انتظامك فيها.',
  focusDescription: 'خصّص وقتًا للعمل بتركيز.',
  progressDescription: 'راجع كيف تغيّر استخدامك للوقت ومدى انتظام عاداتك.',
  unavailable: 'ستتوفر هذه الصفحة في مرحلة لاحقة.',
  navigation: 'التنقل الرئيسي',
  skip: 'انتقل إلى المحتوى الرئيسي',
  expand: 'توسيع الشريط الجانبي',
  collapse: 'طي الشريط الجانبي',
  settings: 'الإعدادات',
  close: 'إغلاق',
  appearance: 'المظهر',
  theme: 'نظام الألوان',
  language: 'اللغة',
  light: 'فاتح',
  dark: 'داكن',
  system: 'حسب النظام',
  emerald: 'زمردي',
  slate: 'رمادي أردوازي',
  indigo: 'نيلي',
  teal: 'أخضر مزرق',
  rose: 'وردي',
  amber: 'كهرماني',
  workspaceLoading: 'جارٍ فتح مساحة التخزين المحلية…',
  workspaceBlocked: 'أغلق علامات تبويب Doop الأخرى لإكمال فتح مساحة التخزين.',
  workspaceStorageError:
    'تعذّر على Doop فتح بيانات مساحة العمل. تأكّد من أن متصفحك يسمح للموقع بتخزين البيانات.',
  workspaceMigrationError:
    'تمنع بعض السجلات ترقية مساحة العمل. ما زالت بياناتك السابقة محفوظة.',
  workspaceInvalidRecord:
    'تعذّر على Doop قراءة أحد سجلات مساحة العمل. ما زال السجل محفوظًا.',
  workspaceInvalidRecordWrite:
    'تعذّر على Doop حفظ التغيير لأن أحد السجلات المحفوظة غير قابل للقراءة. ما زال السجل محفوظًا.',
  workspaceReadError:
    'تعذّر على Doop قراءة بيانات مساحة العمل. حاول قراءتها مرة أخرى.',
  workspaceWriteError:
    'تعذّر على Doop حفظ التغيير. حاول تنفيذ الإجراء نفسه مرة أخرى.',
  workspaceQuotaError:
    'لم يُحفَظ التغيير لأن مساحة تخزين المتصفح ممتلئة. حرّر بعض المساحة ثم أعد تنفيذ الإجراء نفسه.',
  retryStorage: 'إعادة محاولة فتح التخزين',
  storageError:
    'تعذّر حفظ التفضيلات أو تحميلها. قد تفقد التغييرات عند تحديث الصفحة.',
};

const messages = { en, ar };

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  private readonly preferences = inject(PreferencesService);
  readonly text = computed(() => messages[this.preferences.current().language]);
}
