# Measure Mode Design

## Interaction Model: Sequential Selection
Instead of separate sub-modes for Distance, Angle, and Dihedral, we will use a unified sequential selection model.

### State Machine
- **State 0 (Idle)**: No active selection chain.
- **State 1 (1 Atom)**: Start of chain. Highlight Atom A.
- **State 2 (2 Atoms)**: Line A-B. Show Distance.
    - If user clicks background: Reset to Idle.
    - If user clicks Atom C: Transition to State 3.
- **State 3 (3 Atoms)**: Arc A-B-C. Show Angle.
    - Previous Distance A-B remains visible? NO, usually we transition the "active measurement".
    - *Decision*: Each step creates a *persistent* measurement object.
        - Click A, then B: Creates Distance Measurement (A-B).
        - Click C: Creates Angle Measurement (A-B-C).
        - Click D: Creates Dihedral Measurement (A-B-C-D).
        - Click E: Starts new chain? Or acts as Dihedral B-C-D-E?
        - *Refinement*: PyMOL style is click-click-click.
            - A, B -> Dist
            - B, C -> Dist (if just distances).
            - For Angles: usually specific mode.
        - *Proposed Logic*: 
            - Use the existing "Click A, Click B" for Distance.
            - If "Angle Mode" is enabled? 
            - **Better**: Keep it simple. Let's stick to the user request "Measure mode".
            - Let's support meaningful defaults.
            - If I click A, B, C, D in sequence, I likely want the geometry defined by them.
            - A-B: Dist.
            - B-C: Dist.
            - A-B-C: Angle.
            - B-C-D: Angle.
            - A-B-C-D: Dihedral.
            - *Revised State Machine*:
                - Maintain a *buffer* of last N selected atoms (up to 4).
                - On generic click Atom X:
                    - Push X to buffer.
                    - If Buffer = [A, B]: Create Distance(A,B).
                    - If Buffer = [A, B, C]: Create Angle(A,B,C).
                    - If Buffer = [A, B, C, D]: Create Dihedral(A,B,C,D). Drop A (Buffer becomes [B,C,D]).

### Visualization
- **Distance**: Line + Label (Midpoint).
- **Angle**: Dashed lines to vertex + Arc + Label.
- **Dihedral**: Visual plane indicators or just Dashed lines + Label.

### Persistence
- Measurements are persistent objects managed by `MeasureMode`.
- Can be cleared via Context Menu ("Clear All").

### UI Overlay
- Existing `updateInfoPanel` text overlay is sufficient for MVP.
- Future: 3D Labels (billboards).
