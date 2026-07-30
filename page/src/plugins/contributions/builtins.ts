/**
 * Wire built-in modifier property panels into the contribution registry.
 * Called once at page boot so {@link ModifierProperties} no longer needs a
 * hard-coded instanceof chain for the common cases (matchers cover the rest).
 */

import {
  AffineTransformationModifier as CoreAffineTransformationModifier,
  AssignColorModifier as CoreAssignColorModifier,
  ColorByPropertyModifier as CoreColorByPropertyModifier,
  ComputeBondsModifier as CoreComputeBondsModifier,
  DataSourceModifier as CoreDataSourceModifier,
  DrawAtomModifier as CoreDrawAtomModifier,
  DrawBondModifier as CoreDrawBondModifier,
  DrawBoxModifier as CoreDrawBoxModifier,
  DrawIsosurfaceModifier as CoreDrawIsosurfaceModifier,
  DrawRibbonModifier as CoreDrawRibbonModifier,
  ExpandSelectionModifier as CoreExpandSelectionModifier,
  ExpressionSelectionModifier as CoreExpressionSelectionModifier,
  GaussianDensitySurfaceModifier as CoreGaussianDensitySurfaceModifier,
  HideSelectionModifier as CoreHideModifier,
  ReplicateModifier as CoreReplicateModifier,
  SelectModifier as CoreSelectModifier,
  SelectTypeModifier as CoreSelectTypeModifier,
  SliceModifier as CoreSliceModifier,
  SolidLiquidModifier as CoreSolidLiquidModifier,
  SteinhardtOrderModifier as CoreSteinhardtOrderModifier,
  TransparentSelectionModifier as CoreTransparentSelectionModifier,
  UnwrapTrajectoriesModifier as CoreUnwrapTrajectoriesModifier,
  VectorFieldModifier as CoreVectorFieldModifier,
  type Modifier,
} from "@molvis/stage";
import { AffineTransformationModifier } from "@/ui/modes/view/modifiers/AffineTransformationModifier";
import { AssignColorModifier } from "@/ui/modes/view/modifiers/AssignColorModifier";
import { ColorByPropertyModifier } from "@/ui/modes/view/modifiers/ColorByPropertyModifier";
import { ComputeBondsModifier } from "@/ui/modes/view/modifiers/ComputeBondsModifier";
import { DataSourceModifier } from "@/ui/modes/view/modifiers/DataSourceModifier";
import { DrawAtomModifier } from "@/ui/modes/view/modifiers/DrawAtomModifier";
import { DrawBondModifier } from "@/ui/modes/view/modifiers/DrawBondModifier";
import { DrawBoxModifier } from "@/ui/modes/view/modifiers/DrawBoxModifier";
import { DrawIsosurfaceModifier } from "@/ui/modes/view/modifiers/DrawIsosurfaceModifier";
import { DrawRibbonModifier } from "@/ui/modes/view/modifiers/DrawRibbonModifier";
import { ExpandSelectionModifier } from "@/ui/modes/view/modifiers/ExpandSelectionModifier";
import { ExpressionSelectionModifier } from "@/ui/modes/view/modifiers/ExpressionSelectionModifier";
import { GaussianDensitySurfaceModifier } from "@/ui/modes/view/modifiers/GaussianDensitySurfaceModifier";
import { HideSelectionModifier } from "@/ui/modes/view/modifiers/HideSelectionModifier";
import { ReplicateModifier } from "@/ui/modes/view/modifiers/ReplicateModifier";
import { SelectModifierProps } from "@/ui/modes/view/modifiers/SelectModifierProps";
import { SelectTypeModifier } from "@/ui/modes/view/modifiers/SelectTypeModifier";
import { SliceModifier } from "@/ui/modes/view/modifiers/SliceModifier";
import { SolidLiquidModifier } from "@/ui/modes/view/modifiers/SolidLiquidModifier";
import { SteinhardtOrderModifier } from "@/ui/modes/view/modifiers/SteinhardtOrderModifier";
import { TransparentSelectionModifier } from "@/ui/modes/view/modifiers/TransparentSelectionModifier";
import { UnwrapTrajectoriesModifier } from "@/ui/modes/view/modifiers/UnwrapTrajectoriesModifier";
import { VectorFieldModifier } from "@/ui/modes/view/modifiers/VectorFieldModifier";
import type { ModifierPanelComponent } from "../types";
import { registerModifierPanelMatcher } from "./modifier_panels";

let registered = false;

export function registerBuiltinModifierPanels(): void {
  if (registered) return;
  registered = true;

  // Built-in panels are typed against concrete modifier classes; the
  // registry only knows `Modifier`. Casts are safe because matchers use
  // `instanceof` before rendering.
  const asPanel = (c: unknown): ModifierPanelComponent =>
    c as ModifierPanelComponent;

  const specs: Array<{
    id: string;
    match: (m: Modifier) => boolean;
    component: ModifierPanelComponent;
    usesLeftConfig?: boolean;
  }> = [
    {
      id: "builtin:DataSource",
      match: (m) => m instanceof CoreDataSourceModifier,
      component: asPanel(DataSourceModifier),
    },
    {
      id: "builtin:Slice",
      match: (m) => m instanceof CoreSliceModifier,
      component: asPanel(SliceModifier),
    },
    {
      id: "builtin:ExpressionSelect",
      match: (m) => m instanceof CoreExpressionSelectionModifier,
      component: asPanel(ExpressionSelectionModifier),
    },
    {
      id: "builtin:SelectType",
      match: (m) => m instanceof CoreSelectTypeModifier,
      component: asPanel(SelectTypeModifier),
    },
    {
      id: "builtin:ExpandSelection",
      match: (m) => m instanceof CoreExpandSelectionModifier,
      component: asPanel(ExpandSelectionModifier),
    },
    {
      id: "builtin:HideSelection",
      match: (m) => m instanceof CoreHideModifier,
      component: asPanel(HideSelectionModifier),
    },
    {
      id: "builtin:AffineTransformation",
      match: (m) => m instanceof CoreAffineTransformationModifier,
      component: asPanel(AffineTransformationModifier),
    },
    {
      id: "builtin:Replicate",
      match: (m) => m instanceof CoreReplicateModifier,
      component: asPanel(ReplicateModifier),
    },
    {
      id: "builtin:UnwrapTrajectories",
      match: (m) => m instanceof CoreUnwrapTrajectoriesModifier,
      component: asPanel(UnwrapTrajectoriesModifier),
    },
    {
      id: "builtin:ColorByProperty",
      match: (m) => m instanceof CoreColorByPropertyModifier,
      component: asPanel(ColorByPropertyModifier),
    },
    {
      id: "builtin:ComputeBonds",
      match: (m) => m instanceof CoreComputeBondsModifier,
      component: asPanel(ComputeBondsModifier),
    },
    {
      id: "builtin:AssignColor",
      match: (m) => m instanceof CoreAssignColorModifier,
      component: asPanel(AssignColorModifier),
    },
    {
      id: "builtin:Transparent",
      match: (m) => m instanceof CoreTransparentSelectionModifier,
      component: asPanel(TransparentSelectionModifier),
    },
    {
      id: "builtin:Select",
      match: (m) => m instanceof CoreSelectModifier,
      component: asPanel(SelectModifierProps),
    },
    {
      id: "builtin:DrawAtom",
      match: (m) => m instanceof CoreDrawAtomModifier,
      component: asPanel(DrawAtomModifier),
    },
    {
      id: "builtin:DrawBond",
      match: (m) => m instanceof CoreDrawBondModifier,
      component: asPanel(DrawBondModifier),
    },
    {
      id: "builtin:DrawBox",
      match: (m) => m instanceof CoreDrawBoxModifier,
      component: asPanel(DrawBoxModifier),
    },
    {
      id: "builtin:DrawRibbon",
      match: (m) => m instanceof CoreDrawRibbonModifier,
      component: asPanel(DrawRibbonModifier),
    },
    {
      id: "builtin:DrawIsosurface",
      match: (m) => m instanceof CoreDrawIsosurfaceModifier,
      component: asPanel(DrawIsosurfaceModifier),
      usesLeftConfig: true,
    },
    {
      id: "builtin:VectorField",
      match: (m) => m instanceof CoreVectorFieldModifier,
      component: asPanel(VectorFieldModifier),
      usesLeftConfig: true,
    },
    {
      id: "builtin:GaussianDensitySurface",
      match: (m) => m instanceof CoreGaussianDensitySurfaceModifier,
      component: asPanel(GaussianDensitySurfaceModifier),
      usesLeftConfig: true,
    },
    {
      id: "builtin:SteinhardtOrder",
      match: (m) => m instanceof CoreSteinhardtOrderModifier,
      component: asPanel(SteinhardtOrderModifier),
      usesLeftConfig: true,
    },
    {
      id: "builtin:SolidLiquid",
      match: (m) => m instanceof CoreSolidLiquidModifier,
      component: asPanel(SolidLiquidModifier),
      usesLeftConfig: true,
    },
  ];

  for (const { id, match, component, usesLeftConfig } of specs) {
    registerModifierPanelMatcher({ id, match, component, usesLeftConfig });
  }
}
