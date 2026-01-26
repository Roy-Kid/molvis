# Measure Mode Enhancements

## Problem
The current `MeasureMode` only supports simple distance measurements between two atoms. Users need to measure bond angles and dihedral angles to fully analyze molecular geometry.

## Solution
Enhance `MeasureMode` to support:
1.  **Angles** (3 atoms)
2.  **Dihedrals** (4 atoms)

The interaction model will use a sequential selection pattern:
- Select A, B -> Display Distance A-B.
- Continue to C -> Display Angle A-B-C.
- Continue to D -> Display Dihedral A-B-C-D.
- Formatting and Units context menu options will apply to all relevant measurements.
