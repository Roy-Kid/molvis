import {
  type AnnotationCorner,
  type AnnotationLabel,
  annotationLabel,
  DEFAULT_BRACKET_LABEL,
  DEFAULT_TEXT_ANNOTATION,
  type SketchAnnotation,
  withAnnotationLabel,
} from "../annotations";
import type { SketchRenderTheme } from "../board/sketch_renderer";
import { BRACKET_CHOICES, ICONS } from "./icons";
import { cssColorToHex } from "./theme_bridge";

/** The placement defaults and an existing object use the same properties form. */
export function showAnnotationDialog(
  host: HTMLElement,
  item: SketchAnnotation,
  editPosition: boolean,
  theme: SketchRenderTheme,
  apply: (item: SketchAnnotation) => void,
  corner: AnnotationCorner,
): void {
  const dialog = document.createElement("dialog");
  dialog.className = "msk-figure-dialog";
  const title = editPosition ? "Edit figure object" : "Figure tool settings";
  dialog.setAttribute("aria-label", title);
  const form = document.createElement("form");
  const fields = document.createElement("div");
  fields.className = "msk-figure-fields";
  const error = document.createElement("p");
  error.setAttribute("role", "alert");
  error.hidden = true;

  function field(
    name: string,
    icon: string,
    control: HTMLInputElement | HTMLTextAreaElement,
    wide = false,
  ): void {
    const row = document.createElement("label");
    row.className = "msk-figure-field";
    row.classList.toggle("msk-figure-wide", wide);
    row.title = name;
    control.title = name;
    control.setAttribute("aria-label", name);
    row.append(ICONS[icon](), control);
    fields.append(row);
  }

  function number(
    name: string,
    icon: string,
    value: number,
    min?: number,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = String(Number(value.toFixed(4)));
    if (min !== undefined) input.min = String(min);
    input.required = true;
    field(name, icon, input);
    return input;
  }

  function color(name: string, icon: string, value: string): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "color";
    input.value = value;
    field(name, icon, input);
    return input;
  }

  function checkbox(
    name: string,
    icon: string,
    value: boolean,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    field(name, icon, input);
    input.parentElement?.classList.add("msk-figure-icon-choice");
    return input;
  }

  function choice<T extends string>(
    name: string,
    options: readonly { id: T; name: string; icon: string }[],
    value: T,
  ): () => T {
    const group = document.createElement("div");
    group.className = "msk-figure-choices";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", name);
    let selected = value;
    for (const option of options) {
      const label = document.createElement("label");
      label.className = "msk-figure-icon-choice";
      label.title = option.name;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.checked = option.id === value;
      input.title = option.name;
      input.setAttribute("aria-label", option.name);
      input.addEventListener("change", () => {
        selected = option.id;
      });
      label.append(ICONS[option.icon](), input);
      group.append(label);
    }
    fields.append(group);
    return () => selected;
  }

  const shape = item.kind === "text" ? undefined : item;
  const filledShape =
    item.kind === "rectangle" || item.kind === "ellipse" ? item : undefined;
  const currentLabel = {
    ...(item.kind === "bracket"
      ? DEFAULT_BRACKET_LABEL
      : DEFAULT_TEXT_ANNOTATION.label),
    text: "",
    ...annotationLabel(item, corner),
  };
  const textInput = document.createElement("textarea");
  textInput.rows = item.kind === "text" ? 3 : 1;
  textInput.value = currentLabel.text;
  textInput.required = item.kind === "text";
  if (editPosition || item.kind !== "text") {
    field(
      item.kind === "bracket"
        ? "Repeat label"
        : item.kind === "text"
          ? "Text"
          : "Label",
      item.kind === "bracket" ? "bracket" : "text",
      textInput,
      true,
    );
  }
  const textSize = number("Font size", "fontSize", currentLabel.size, 0.01);
  const textColor = color(
    "Text color",
    "textColor",
    currentLabel.color ?? cssColorToHex(theme.labelFill) ?? "#151515",
  );
  const family = choice(
    "Font",
    [
      { id: "sans-serif", name: "Sans serif", icon: "fontSans" },
      { id: "serif", name: "Serif", icon: "fontSerif" },
      { id: "monospace", name: "Monospace", icon: "fontMono" },
    ] as const,
    currentLabel.family ?? "sans-serif",
  );
  const alignment =
    item.kind === "bracket"
      ? undefined
      : choice(
          "Alignment",
          [
            { id: "left", name: "Align left", icon: "alignLeft" },
            { id: "center", name: "Align center", icon: "alignCenter" },
            { id: "right", name: "Align right", icon: "alignRight" },
          ] as const,
          currentLabel.align ?? "center",
        );
  const bold = checkbox("Bold", "textBold", currentLabel.bold ?? false);
  const italic = checkbox("Italic", "textItalic", currentLabel.italic ?? false);
  const x = editPosition
    ? number("X position", "positionX", item.x)
    : undefined;
  const y = editPosition
    ? number("Y position", "positionY", item.y)
    : undefined;
  const width = shape && number("Width", "width", shape.width, 0.01);
  const height = shape && number("Height", "height", shape.height, 0.01);
  const rotation =
    shape && number("Rotation (degrees)", "rotate", shape.rotation ?? 0);
  const stroke =
    shape &&
    color(
      "Stroke color",
      "strokeColor",
      shape.stroke ?? cssColorToHex(theme.bondStroke) ?? "#151515",
    );
  const strokeWidth =
    shape &&
    number("Stroke width", "strokeWidth", shape.strokeWidth ?? 0.06, 0);
  const fillToggle =
    filledShape &&
    checkbox("Fill shape", "fill", filledShape.fill !== undefined);
  const fill =
    filledShape &&
    color("Fill color", "fillColor", filledShape.fill ?? "#e6e6e6");
  if (fillToggle && fill) {
    fill.disabled = !fillToggle.checked;
    fillToggle.addEventListener("change", () => {
      fill.disabled = !fillToggle.checked;
    });
  }
  const radius =
    item.kind === "rectangle" &&
    number("Corner radius", "cornerRadius", item.radius ?? 0.25, 0);
  const variant =
    item.kind === "bracket" &&
    choice("Brackets", BRACKET_CHOICES, item.variant);

  const actions = document.createElement("footer");
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.title = "Cancel";
  cancel.setAttribute("aria-label", "Cancel");
  cancel.append(ICONS.close());
  cancel.addEventListener("click", () => dialog.close());
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.title = "Apply";
  submit.setAttribute("aria-label", "Apply");
  submit.append(ICONS.check());
  actions.append(cancel, submit);
  form.append(fields, error, actions);
  dialog.append(form);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const label: AnnotationLabel = {
      text: textInput.value,
      size: textSize.valueAsNumber,
      color: textColor.value,
      family: family(),
      align: alignment?.(),
      bold: bold.checked,
      italic: italic.checked,
    };
    const position = {
      x: x?.valueAsNumber ?? item.x,
      y: y?.valueAsNumber ?? item.y,
    };
    try {
      if (item.kind === "text") {
        apply({ ...item, ...position, label });
      } else if (width && height && rotation && stroke && strokeWidth) {
        const geometry = {
          ...position,
          width: width.valueAsNumber,
          height: height.valueAsNumber,
          rotation: rotation.valueAsNumber,
          stroke: stroke.value,
          strokeWidth: strokeWidth.valueAsNumber,
        };
        const fillColor = fillToggle?.checked ? fill?.value : undefined;
        if (item.kind === "bracket" && variant) {
          apply(
            withAnnotationLabel(
              {
                ...item,
                ...geometry,
                variant: variant(),
              },
              label,
              corner,
            ),
          );
        } else if (item.kind === "rectangle" && radius) {
          apply({
            ...item,
            ...geometry,
            label: label.text.trim() ? label : undefined,
            fill: fillColor,
            radius: radius.valueAsNumber,
          });
        } else if (item.kind === "ellipse") {
          apply({
            ...item,
            ...geometry,
            fill: fillColor,
            label: label.text.trim() ? label : undefined,
          });
        }
      }
      dialog.close();
    } catch (failure) {
      error.textContent =
        failure instanceof Error ? failure.message : String(failure);
      error.hidden = false;
    }
  });
  host.append(dialog);
  dialog.showModal();
  const firstInput = textInput.isConnected ? textInput : textSize;
  firstInput.focus();
  firstInput.select();
}
