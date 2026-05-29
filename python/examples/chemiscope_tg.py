"""Chemiscope-style dataset explorer for polymer Tg data.

Loads ``LAMALAB_CURATED_Tg_structured.csv`` (all rows by default), converts
each PSMILES entry to a 3D structure with RDKit, and streams the set into
molvis as a trajectory plus a per-frame label table. The PCATool sidebar
then reduces the label columns to 2D; clicking a point navigates to the
matching frame (i.e. the corresponding polymer).

Capping strategy: each PSMILES wildcard ``[*]`` is first replaced with H
and embedded; if the H cap fails (parse, sanitize, or embed) the row
retries with a C cap (``-CH3``). This avoids aborting on wildcards that
carry a multi-order bond (``[*]=C``, ``[*]#C``), which fail RDKit
sanitization under an H cap. Rows are split into three groups —
``H`` (H succeeded), ``C`` (H failed, C succeeded), ``fail`` (both failed).
Each group is exported to its own CSV (``*_groups_H.csv``,
``*_groups_C.csv``, ``*_groups_fail.csv``); the C-cap file records
``h_error`` (why H had to fall back) and the fail-cap file records both
``h_error`` and ``c_error`` (the RDKit messages from each attempt). A
1×3 MW histogram is exported to ``*_groups_mw.png``.

Cap atoms are tagged on each Frame as ``is_cap`` (the cap atom plus any
``AddHs``-inserted hydrogens hanging off a C-cap) and ``is_cap_anchor``
(only the atom that replaced ``[*]``, one per cap site). End-group heavy
atoms (neighbors of the original ``[*]``) are tagged with an RDKit
atom-map-num *before* any mol edits and surface in the output Frame as an
``is_end_group`` bool column on the atoms block. Using map-nums means we
never have to reason about index shifts through ``RWMol`` /
``SanitizeMol`` / ``AddHs``. Frame 0's end-group atoms get a red ``*``
mark and cap anchors get a green ``+`` mark via ``scene.mark_atom`` —
composite overlays (halo + label) that follow their atom across
trajectory frames, so the synthetic cap atoms remain distinguishable from
the original monomer.

Architecture: Python only exposes a WebSocket; the frontend is whatever
MolVis tab you already have open (e.g. ``npm run dev:page`` at
``http://localhost:3000``). The script logs a single
``ws://…?token=…&session=…`` URL — paste it into the page's
Settings → Backend dialog and click Connect; Python then pushes the
trajectory and label table.

Run
---
1. In one terminal::

       npm run dev:page         # serves the page at http://localhost:3000

2. Open that tab in a browser.

3. In another terminal::

       python examples/chemiscope_tg.py [n_rows]

   ``n_rows`` is optional; omit it to process the whole CSV. The script
   logs one ``ws://…?token=…&session=…`` URL. Paste it into the browser
   tab's Settings → Backend dialog; Python then pushes the trajectory +
   labels. Ctrl+C to exit.
"""

from __future__ import annotations

import logging
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import matplotlib.pyplot as plt
import molpy as mp
import numpy as np
import pandas as pd
from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors

import molvis as mv

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("chemiscope_tg")

CSV_PATH: Final[Path] = Path(
    "/Users/roykid/work/molcrafts/LAMALAB_CURATED_Tg_structured.csv"
)
GROUPS_H_CSV_PATH: Final[Path] = CSV_PATH.parent / f"{CSV_PATH.stem}_groups_H.csv"
GROUPS_C_CSV_PATH: Final[Path] = CSV_PATH.parent / f"{CSV_PATH.stem}_groups_C.csv"
GROUPS_FAIL_CSV_PATH: Final[Path] = (
    CSV_PATH.parent / f"{CSV_PATH.stem}_groups_fail.csv"
)
GROUPS_FIG_PATH: Final[Path] = CSV_PATH.parent / f"{CSV_PATH.stem}_groups_mw.png"
PSMILES_COL: Final[str] = "PSMILES"
LABEL_COL: Final[str] = "labels.Exp_Tg(K)"
END_GROUP_COL: Final[str] = "is_end_group"
CAP_COL: Final[str] = "is_cap"
CAP_ANCHOR_COL: Final[str] = "is_cap_anchor"
EMBED_SEED: Final[int] = 42
EMBED_MAX_SEEDS: Final[int] = 30  # ETKDG retry budget per cap attempt
SESSION_NAME: Final[str] = "chemiscope-tg"

# Cap atomic numbers tried in order. H first (most common monomer endpoint),
# C as a fallback for rows that carry a multi-order bond on the wildcard.
_CAP_H: Final[int] = 1
_CAP_C: Final[int] = 6

_GROUP_ORDER: Final[tuple[str, ...]] = ("H", "C", "fail")

# Private atom-map-num markers used only inside cap_psmiles_to_mol /
# mol_to_frame. Any values not clashing with real PSMILES map numbers
# work; real PSMILES typically use 0.
_END_GROUP_MAP_NUM: Final[int] = 777
_CAP_MAP_NUM: Final[int] = 778


@dataclass(frozen=True)
class RowResult:
    """One row's outcome from the H→C cap retry."""

    row: int
    psmiles: str
    group: str  # "H", "C", or "fail"
    mol_weight: float | None
    h_error: str | None
    c_error: str | None
    frame: mp.Frame | None


def cap_psmiles_to_mol(psmiles: str, cap_atomic_num: int) -> Chem.Mol:
    """Parse a PSMILES and replace each ``[*]`` with ``cap_atomic_num``.

    Tags the heavy-atom neighbour of every original ``[*]`` with an
    atom-map-num so downstream code can identify the polymer end groups
    after Sanitize / AddHs (RDKit preserves map-nums through both, and
    new H atoms inserted by AddHs default to map-num 0). The replaced
    wildcard atom itself is tagged separately so the cap anchor can be
    distinguished from the original monomer end group.
    """
    mol = Chem.MolFromSmiles(psmiles)
    if mol is None:
        raise ValueError(f"RDKit could not parse: {psmiles!r}")

    # Tag end-group heavy atoms. RDKit preserves atom-map-nums through
    # atomic-number edits, Sanitize, and AddHs — new H's appended by
    # AddHs default to map-num 0, so they never false-positive.
    for atom in mol.GetAtoms():
        if atom.GetAtomicNum() != 0:
            continue
        for nbr in atom.GetNeighbors():
            if nbr.GetAtomicNum() != 0:
                nbr.SetAtomMapNum(_END_GROUP_MAP_NUM)

    rwmol = Chem.RWMol(mol)
    for atom in rwmol.GetAtoms():
        if atom.GetAtomicNum() == 0:
            atom.SetAtomicNum(cap_atomic_num)
            atom.SetAtomMapNum(_CAP_MAP_NUM)
            if cap_atomic_num == _CAP_H:
                # H is monovalent — block AddHs from layering more H onto
                # the cap itself.
                atom.SetNoImplicit(True)
                atom.SetNumExplicitHs(0)
    mol = rwmol.GetMol()
    Chem.SanitizeMol(mol)
    return mol


def mol_to_frame(mol: Chem.Mol, psmiles: str) -> mp.Frame:
    """Embed ``mol`` to 3D (ETKDGv3 + MMFF) and convert to a molpy Frame.

    Uses ETKDGv3 with ``useRandomCoords=True``: the default v1 with
    deterministic bound-matrix initialisation fails on >100-heavy-atom
    flexible polymers (long alkyls, PEG ethers, ladder polyimides,
    cyclophosphazenes). Tries up to ``EMBED_MAX_SEEDS`` seeds. If none
    converge, retries with stereochemistry stripped — fallback for
    multi-``/C=C/`` / multi-``/N=N/`` backbones where E/Z constraints
    conflict pairwise in the distance-bounds matrix (E/Z designation is
    lost on the retry path). Final fallback is plain ETKDG (v1), which
    skips the knowledge-based BFGS pass that asserts on small-ring
    geometries like ``[*]C1CCC([*])C1``.

    ``EmbedMolecule`` *raises* (RuntimeError) on internal RDKit
    assertion failures rather than returning ``-1`` — the per-seed
    try/except is what makes the retry budget actually iterate; without
    it the loop collapses to the first seed.
    """
    mol = Chem.AddHs(mol)

    def _try_embed(params: AllChem.EmbedParameters) -> bool:
        for offset in range(EMBED_MAX_SEEDS):
            params.randomSeed = EMBED_SEED + offset
            try:
                if AllChem.EmbedMolecule(mol, params) == 0:
                    return True
            except Exception:
                continue
        return False

    ps_v3 = AllChem.ETKDGv3()
    ps_v3.useRandomCoords = True
    ps_v3.useSmallRingTorsions = True  # better fused-ring convergence

    if not _try_embed(ps_v3):
        Chem.RemoveStereochemistry(mol)
        if not _try_embed(ps_v3):
            ps_v1 = AllChem.ETKDG()
            ps_v1.useRandomCoords = True
            if not _try_embed(ps_v1):
                raise RuntimeError(
                    f"Embedding failed after {3 * EMBED_MAX_SEEDS} attempts "
                    f"(v3, v3+nostereo, v1) for {psmiles!r}"
                )
            logger.warning(
                "Fell back to ETKDG (v1) to embed %s (knowledge-based "
                "BFGS pass asserted under v3)",
                psmiles,
            )
        else:
            logger.warning(
                "Stereochemistry stripped to embed %s (E/Z lost)", psmiles
            )

    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=400)
    except Exception:
        logger.warning("MMFF failed for %s; keeping unrelaxed coords", psmiles)

    conf = mol.GetConformer()
    n_atoms = mol.GetNumAtoms()
    elements = np.array([a.GetSymbol() for a in mol.GetAtoms()])
    is_end_group = np.array(
        [a.GetAtomMapNum() == _END_GROUP_MAP_NUM for a in mol.GetAtoms()],
        dtype=bool,
    )
    is_cap_anchor = np.array(
        [a.GetAtomMapNum() == _CAP_MAP_NUM for a in mol.GetAtoms()],
        dtype=bool,
    )
    is_cap = is_cap_anchor.copy()
    # Extend the cap mark to AddHs-inserted hydrogens hanging off a cap
    # atom (relevant for C-cap; H-cap is shielded by SetNoImplicit). New
    # Hs default to map-num 0 so they're trivially distinguishable from
    # the original cap atom we tagged ourselves.
    for atom in mol.GetAtoms():
        if atom.GetAtomMapNum() != _CAP_MAP_NUM:
            continue
        for nbr in atom.GetNeighbors():
            if nbr.GetAtomicNum() == 1 and nbr.GetAtomMapNum() == 0:
                is_cap[nbr.GetIdx()] = True
    xyz = np.zeros((n_atoms, 3), dtype=np.float64)
    for i in range(n_atoms):
        p = conf.GetAtomPosition(i)
        xyz[i] = (p.x, p.y, p.z)

    atomi = np.array([b.GetBeginAtomIdx() for b in mol.GetBonds()], dtype=np.uint32)
    atomj = np.array([b.GetEndAtomIdx() for b in mol.GetBonds()], dtype=np.uint32)

    return mp.Frame(
        blocks={
            "atoms": {
                "element": elements,
                "x": xyz[:, 0],
                "y": xyz[:, 1],
                "z": xyz[:, 2],
                END_GROUP_COL: is_end_group,
                CAP_COL: is_cap,
                CAP_ANCHOR_COL: is_cap_anchor,
            },
            "bonds": {"atomi": atomi, "atomj": atomj},
        }
    )


def try_build_row(row: int, psmiles: str) -> RowResult:
    """Try H cap first, then C cap. Record per-stage errors per cap.

    Molecular weight reflects the cap that produced the returned frame:
    H-capped MW for the ``H`` group, C-capped MW for the ``C`` group.
    Fail rows still get a MW if at least one cap parsed/sanitized — so
    the histogram's ``fail`` panel isn't empty when only embedding broke.
    """
    h_error: str | None = None
    c_error: str | None = None

    h_mol: Chem.Mol | None = None
    try:
        h_mol = cap_psmiles_to_mol(psmiles, _CAP_H)
    except Exception as exc:
        h_error = f"cap/sanitize: {exc}"

    if h_mol is not None:
        try:
            frame = mol_to_frame(h_mol, psmiles)
            return RowResult(
                row, psmiles, "H", Descriptors.MolWt(h_mol), None, None, frame
            )
        except Exception as exc:
            h_error = f"embed: {exc}"

    c_mol: Chem.Mol | None = None
    try:
        c_mol = cap_psmiles_to_mol(psmiles, _CAP_C)
    except Exception as exc:
        c_error = f"cap/sanitize: {exc}"

    if c_mol is not None:
        try:
            frame = mol_to_frame(c_mol, psmiles)
            return RowResult(
                row, psmiles, "C", Descriptors.MolWt(c_mol), h_error, None, frame
            )
        except Exception as exc:
            c_error = f"embed: {exc}"

    fail_mw: float | None = None
    if h_mol is not None:
        fail_mw = Descriptors.MolWt(h_mol)
    elif c_mol is not None:
        fail_mw = Descriptors.MolWt(c_mol)
    return RowResult(row, psmiles, "fail", fail_mw, h_error, c_error, None)


def collect_labels(df: pd.DataFrame) -> dict[str, np.ndarray]:
    """Pull every numeric column (Tg + featurizer outputs) into a label map.

    Columns with fewer than two finite values, or only a single unique
    value, are skipped — neither carries enough variance for the
    sidebar's PCA to do anything useful with.
    """
    labels: dict[str, np.ndarray] = {}
    for col in df.columns:
        if col == PSMILES_COL:
            continue
        series = pd.to_numeric(df[col], errors="coerce")
        if series.notna().sum() < 2:
            continue
        if series.nunique(dropna=True) < 2:
            continue
        labels[col] = series.to_numpy(dtype=np.float64)
    return labels


def build_frames(
    df: pd.DataFrame,
) -> tuple[list[mp.Frame], list[int], list[RowResult]]:
    """Run the H→C cap retry over the whole dataframe.

    Returns the surviving frames (in PSMILES row order), the original
    row indices for each surviving frame, and one RowResult per input row.
    """
    frames: list[mp.Frame] = []
    ok_row_ixs: list[int] = []
    results: list[RowResult] = []
    total = len(df)
    for i, psmiles in enumerate(df[PSMILES_COL]):
        logger.info("[%d/%d] %s", i + 1, total, psmiles)
        result = try_build_row(i, str(psmiles))
        results.append(result)
        if result.frame is not None:
            frames.append(result.frame)
            ok_row_ixs.append(i)
        else:
            logger.warning(
                "Row %d (%s) failed both caps: H=%s | C=%s",
                i,
                psmiles,
                result.h_error,
                result.c_error,
            )
    return frames, ok_row_ixs, results


def export_groups_csv(results: list[RowResult]) -> pd.DataFrame:
    """Split per-row results into H / C / fail CSVs and return the union frame.

    Each output file carries only the columns meaningful for its group —
    H rows have no errors to report; C rows surface ``h_error`` (the
    reason H had to fall back); fail rows surface both ``h_error`` and
    ``c_error``. The returned dataframe still contains every row so
    downstream consumers (e.g. the MW histogram) can iterate uniformly.
    """
    df_groups = pd.DataFrame(
        [
            {
                "row": r.row,
                "psmiles": r.psmiles,
                "group": r.group,
                "mol_weight": r.mol_weight,
                "h_error": r.h_error,
                "c_error": r.c_error,
            }
            for r in results
        ]
    )

    df_h = df_groups.loc[
        df_groups["group"] == "H", ["row", "psmiles", "mol_weight"]
    ]
    df_c = df_groups.loc[
        df_groups["group"] == "C", ["row", "psmiles", "mol_weight", "h_error"]
    ]
    df_fail = df_groups.loc[
        df_groups["group"] == "fail",
        ["row", "psmiles", "mol_weight", "h_error", "c_error"],
    ]

    df_h.to_csv(GROUPS_H_CSV_PATH, index=False)
    df_c.to_csv(GROUPS_C_CSV_PATH, index=False)
    df_fail.to_csv(GROUPS_FAIL_CSV_PATH, index=False)

    logger.info(
        "Exported group CSVs → %s (H=%d), %s (C=%d), %s (fail=%d)",
        GROUPS_H_CSV_PATH,
        len(df_h),
        GROUPS_C_CSV_PATH,
        len(df_c),
        GROUPS_FAIL_CSV_PATH,
        len(df_fail),
    )
    return df_groups


def export_groups_figure(df_groups: pd.DataFrame) -> None:
    """Render a 1×3 MW histogram (one axes per cap group)."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 4))
    for ax, group in zip(axes, _GROUP_ORDER):
        weights = df_groups.loc[df_groups["group"] == group, "mol_weight"].dropna()
        if len(weights):
            ax.hist(weights, bins=30, color="#4c72b0", edgecolor="white")
        ax.set_title(f"{group}-cap (n={len(weights)})")
        ax.set_xlabel("Molecular weight (g/mol)")
        ax.set_ylabel("Count")
    fig.tight_layout()
    fig.savefig(GROUPS_FIG_PATH, dpi=150)
    plt.close(fig)
    logger.info("Saved MW distribution → %s", GROUPS_FIG_PATH)


def main(n_rows: int | None = None) -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"CSV not found: {CSV_PATH}")

    df = pd.read_csv(CSV_PATH, nrows=n_rows)
    total = len(df)
    logger.info("Loaded %d rows, %d columns", total, len(df.columns))

    frames, ok_row_ixs, results = build_frames(df)
    df_groups = export_groups_csv(results)
    export_groups_figure(df_groups)

    if not frames:
        raise SystemExit(
            "No frames built — every PSMILES failed under both caps. "
            f"See {GROUPS_FAIL_CSV_PATH}."
        )

    df_ok = df.iloc[ok_row_ixs].reset_index(drop=True)
    labels = collect_labels(df_ok)
    logger.info(
        "Built %d frames and %d label columns (e.g. %s=%s)",
        len(frames),
        len(labels),
        LABEL_COL,
        labels.get(LABEL_COL),
    )

    # WS-only transport: the page is already open in the browser tab,
    # so we don't serve dist/ ourselves and we don't open a browser.
    transport = mv.WebSocketTransport(open_browser=False, serve_page=False)
    scene = mv.Molvis(name=SESSION_NAME, transport=transport)
    transport.start()

    connect_url = transport.connection_url(session=scene.name)
    logger.info("")
    logger.info("  >>> Paste this into Settings → Backend in the MolVis tab:")
    logger.info("      %s", connect_url)
    logger.info("")
    logger.info("Waiting for browser handshake…")
    transport.wait_for_connection()

    scene.set_trajectory(frames)
    scene.set_frame_labels(labels)

    # Mark end-group atoms (red ``*`` halo + label) and cap-anchor atoms
    # (green ``+`` halo + label) on frame 0. We read the indices straight
    # from the Frame's own `is_end_group` / `is_cap_anchor` columns — the
    # Frame is the single source of truth, so the marks can't drift out of
    # sync with what the frontend actually renders.
    frame0_atoms = frames[0]["atoms"]
    end_group_ids = np.flatnonzero(frame0_atoms[END_GROUP_COL]).tolist()
    for atom_id in end_group_ids:
        scene.mark_atom(
            int(atom_id),
            label="*",
            shape_color="#ff4d6d",
            shape_opacity=0.45,
            label_background="#ff4d6d",
            label_offset=(0.0, 0.8, 0.0),
        )
    cap_anchor_ids = np.flatnonzero(frame0_atoms[CAP_ANCHOR_COL]).tolist()
    for atom_id in cap_anchor_ids:
        scene.mark_atom(
            int(atom_id),
            label="+",
            shape_color="#1f9d55",
            shape_opacity=0.45,
            label_background="#1f9d55",
            label_offset=(0.0, 0.8, 0.0),
        )

    logger.info(
        "Sent %d frames, %d labels, marked %d end groups + %d caps on "
        "frame 0. Click Compute in the PCA sidebar. Ctrl+C to exit.",
        len(frames),
        len(labels),
        len(end_group_ids),
        len(cap_anchor_ids),
    )

    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        scene.close()


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(n)
