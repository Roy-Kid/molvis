export interface Disposable {
  dispose: () => void;
}

export class CompositeDisposable implements Disposable {
  private readonly disposables: Disposable[] = [];

  public add(disposable: Disposable): void {
    this.disposables.push(disposable);
  }

  public dispose(): void {
    for (const disposable of this.disposables.splice(
      0,
      this.disposables.length,
    )) {
      disposable.dispose();
    }
  }
}
