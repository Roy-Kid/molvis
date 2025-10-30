import type { HtmlGuiComponent } from "../types";
import { GUI_STYLES, applyStyles } from "../styles";
import { provideFluentDesignSystem, fluentTabs, fluentTab, fluentTabPanel } from "@fluentui/web-components";

export class TabIndicator implements HtmlGuiComponent {
  private _element: HTMLElement;
  private _tabs!: HTMLElement;
  private _activeSceneId = "scene-1";
  private _allSceneIds: string[] = [];
  private _onSceneChange?: (sceneId: string) => void;

  constructor(container: HTMLElement) {
    // Register Fluent UI components
    provideFluentDesignSystem().register(fluentTabs(), fluentTab(), fluentTabPanel());

    this._element = this._createElement();
    container.appendChild(this._element);
    this._updateTabs();
  }

  get element(): HTMLElement {
    return this._element;
  }

  public updateActiveScene(sceneId: string, allSceneIds: string[] = []): void {
    if (this._activeSceneId !== sceneId || this._allSceneIds.length !== allSceneIds.length) {
      this._activeSceneId = sceneId;
      this._allSceneIds = allSceneIds;
      this._updateTabs();
    }
  }

  private _allSceneIds: string[] = [];

  public show(): void {
    this._element.style.display = "block";
  }

  public hide(): void {
    this._element.style.display = "none";
  }

  public dispose(): void {
    if (this._element.parentNode) {
      this._element.parentNode.removeChild(this._element);
    }
  }

  public setOnSceneChange(callback: (sceneId: string) => void): void {
    this._onSceneChange = callback;
  }

  private _createElement(): HTMLElement {
    const element = document.createElement("div");
    element.className = "tab-indicator";
    applyStyles(element, GUI_STYLES.baseIndicator, GUI_STYLES.tabIndicator);

    this._tabs = document.createElement("fluent-tabs") as any;
    this._tabs.setAttribute("activeid", this._activeSceneId);
    this._tabs.addEventListener('change', (e: any) => {
      const newSceneId = e.detail.id;
      if (newSceneId && this._onSceneChange) {
        this._onSceneChange(newSceneId);
      }
    });
    element.appendChild(this._tabs);

    return element;
  }

  private _updateTabs(): void {
    const tabsHtml = this._allSceneIds.map(id => `<fluent-tab id="${id}">${id}</fluent-tab>`).join('');
    const panelsHtml = this._allSceneIds.map(id => `<fluent-tab-panel id="${id}-panel">${id} Scene</fluent-tab-panel>`).join('');
    this._tabs.innerHTML = tabsHtml + panelsHtml;
    (this._tabs as any).activeid = this._activeSceneId;
  }
}