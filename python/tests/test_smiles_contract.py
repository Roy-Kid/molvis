"""SMILES atom classes survive the 0.18 conformer the viewer draws.

The dopamine sequence is the acceptance picture an agent builds in a cell.
These checks pin the row numbers that cell selects. They do not open a viewer.
"""

from __future__ import annotations

import math

import pytest

import molpy as mp

# (name, SMILES, (row, element, atom_class) for every non-zero class)
_CASES = [
    (
        "dopamine",
        "NCCc1ccc([OH:1])c([OH:2])c1",
        ((7, "O", 1.0), (9, "O", 2.0)),
    ),
    ("phenethylamine", "NCCc1ccccc1", ()),
    (
        "amphetamine",
        "[CH3:1][CH](N)Cc1ccccc1",
        ((0, "C", 1.0),),
    ),
    (
        "methamphetamine",
        "[CH3:1]N[CH](C)Cc1ccccc1",
        ((0, "C", 1.0),),
    ),
]


def test_molpy_minor_is_0_18() -> None:
    assert str(mp.version).startswith("0.18.")


@pytest.mark.parametrize(
    ("name", "smiles", "expected"),
    _CASES,
    ids=[case[0] for case in _CASES],
)
def test_atom_class_survives_conformer(
    name: str, smiles: str, expected: tuple[tuple[int, str, float], ...]
) -> None:
    del name
    embedded, _report = mp.conformer.Conformer(seed=1).generate(
        mp.io.read_smiles_str(smiles)
    )
    atoms = embedded.to_frame()["atoms"]
    elements = [str(element) for element in atoms["element"]]
    assert all(math.isfinite(float(value)) for value in atoms["x"])
    columns = list(atoms.keys())
    marked: list[tuple[int, str, float]] = []
    if "atom_class" in columns:
        classes = list(atoms["atom_class"])
        marked = [
            (index, elements[index], float(classes[index]))
            for index in range(len(elements))
            if classes[index]
        ]
    assert marked == list(expected)
