import type { AppSettings } from '../domain/app-settings';

export type AppearanceSnapshot = {
  settings: AppSettings;
  error: string | null;
};

type SaveSettings = (settings: AppSettings) => Promise<void>;

/**
 * 串行保存快速发生的外观修改，并只允许最新失败回滚当前界面。
 * React Provider 只负责订阅，不重复实现竞态处理。
 */
export class AppearanceSettingsController {
  private snapshot: AppearanceSnapshot;
  private persisted: AppSettings;
  private revision = 0;
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(initial: AppSettings, private readonly save: SaveSettings) {
    this.persisted = initial;
    this.snapshot = { settings: initial, error: null };
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** 在用户尚未修改设置时接收 SQLite 的启动值，避免异步加载覆盖新选择。 */
  replaceFromStorage(settings: AppSettings) {
    if (this.revision !== 0) return;
    this.persisted = settings;
    this.setSnapshot({ settings, error: null });
  }

  async update(change: Partial<AppSettings>) {
    const next = { ...this.snapshot.settings, ...change };
    const revision = ++this.revision;
    this.setSnapshot({ settings: next, error: null });

    const operation = this.queue.then(async () => {
      try {
        await this.save(next);
        this.persisted = next;
        if (revision === this.revision && this.snapshot.error) {
          this.setSnapshot({ settings: this.snapshot.settings, error: null });
        }
      } catch {
        if (revision === this.revision) {
          this.setSnapshot({ settings: this.persisted, error: '设置保存失败，请重试' });
        }
      }
    });
    this.queue = operation;
    await operation;
  }

  clearError() {
    if (this.snapshot.error) this.setSnapshot({ settings: this.snapshot.settings, error: null });
  }

  private setSnapshot(snapshot: AppearanceSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
}
