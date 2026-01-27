## ADDED Requirements
### Requirement: Serialize Frame via WASM Writer
The core library SHALL serialize a Frame to formatted text using the wasm writer and return the text along with the format identifier.

#### Scenario: Serialize to PDB
- **GIVEN** a Frame and format "pdb"
- **WHEN** serialization is requested
- **THEN** the wasm writer is invoked and the returned text is labeled with format "pdb"

### Requirement: No Delivery Side Effects
Frame serialization in the core library MUST NOT trigger downloads, filesystem writes, or host-specific delivery mechanisms.

#### Scenario: Serialize without host side effects
- **WHEN** serialization is requested
- **THEN** no download, filesystem write, or external event is triggered by the core library
