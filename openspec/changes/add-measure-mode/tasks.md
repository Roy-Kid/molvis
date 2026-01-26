# Measure Mode Implementation Tasks

- [x] Refactor `MeasureMode` state management
    - [x] Implement `SelectionBuffer` to track up to 4 atoms.
    - [x] Implement logic to trigger measurements based on buffer state.
- [x] Implement Angle Measurement
    - [x] Add `createAngleMeasurement(a, b, c)`
    - [x] Compute angle usage vector math.
    - [x] Visualize arc (or simple lines for MVP).
- [x] Implement Dihedral Measurement
    - [x] Add `createDihedralMeasurement(a, b, c, d)`
    - [x] Compute torsion angle.
    - [x] Update info panel display.
- [x] Update Context Menu
    - [x] Add Angle Units (Degrees/Radians).
- [x] Verify Interactions
    - [x] Test "walking" selection (A-B-C-D-E).
