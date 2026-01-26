# Measure Mode Specification

## ADDED Requirements

### Requirement: Measure Distance
The system SHALL calculate and display the Euclidean distance between any two sequentially selected atoms.

#### Scenario: Measure distance between two atoms
- **WHEN** user clicks Atom A then Atom B
- **THEN** a distance line is drawn between A and B
- **AND** the distance is displayed in the info panel

### Requirement: Measure Bond Angle
The system SHALL calculate and display the bond angle defined by three sequentially selected atoms (A-B-C).

#### Scenario: Measure angle
- **WHEN** user clicks Atom A, then B, then C
- **THEN** an angle arc is visualized at vertex B
- **AND** the angle in degrees is displayed

### Requirement: Measure Dihedral Angle
The system SHALL calculate and display the dihedral (torsion) angle defined by four sequentially selected atoms (A-B-C-D).

#### Scenario: Measure dihedral
- **WHEN** user clicks Atom A, B, C, then D
- **THEN** the dihedral angle is calculated
- **AND** the value is displayed in the info panel

### Requirement: Sequential Selection Buffer
The mode SHALL maintain a rolling buffer of selected atoms to facilitate continuous measurement.

#### Scenario: Continuous measurement
- **WHEN** user clicks A, B, C, D, E
- **THEN** measurements created are: Distance(A-B), Angle(A-B-C), Dihedral(A-B-C-D), Distance(D-E)?
- *Refinement*: Actually, the design said "Drop A".
    - A,B -> Dist(A,B)
    - A,B,C -> Angle(A,B,C)
    - A,B,C,D -> Dihedral(A,B,C,D). Buffer becomes [B,C,D]
    - +E -> Dihedral(B,C,D,E). Buffer becomes [C,D,E]
- **THEN** this allows "walking" along a chain to measure successive dihedrals.

### Requirement: Unit Formatting
The system SHALL support changing units for distances (Angstrom, nm, pm) and angles (Degrees, Radians).

#### Scenario: Change Angle Units
- **WHEN** user selects "Radians" from context menu
- **THEN** all displayed angles update to Radians
