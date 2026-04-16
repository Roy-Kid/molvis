from __future__ import annotations

from pathlib import Path

from molvis.palettes import (
    PaletteDefinition,
    PaletteEntry,
    PaletteInfo,
    render_palette_preview,
    save_palette_preview_bytes,
)


def test_palette_dataclasses():
    """Test that palette dataclasses can be constructed."""
    entry = PaletteEntry(label="H", color="#FFFFFF")
    assert entry.label == "H"
    assert entry.color == "#FFFFFF"

    info = PaletteInfo(name="cpk", kind="element", size=118)
    assert info.name == "cpk"
    assert info.kind == "element"
    assert info.size == 118

    definition = PaletteDefinition(
        name="cpk",
        kind="element",
        size=118,
        entries=[entry],
    )
    assert definition.name == "cpk"
    assert len(definition.entries) == 1


def test_render_palette_preview_basic():
    """Test that palette preview rendering works."""
    entries = [
        PaletteEntry(label="1", color="#FF0000"),
        PaletteEntry(label="2", color="#00FF00"),
        PaletteEntry(label="3", color="#0000FF"),
    ]
    png = render_palette_preview(entries, columns=2, swatch_size=12)
    assert png.startswith(b"\x89PNG\r\n\x1a\n")


def test_save_palette_preview_bytes(tmp_path: Path):
    """Test that palette preview can be saved to disk."""
    entries = [
        PaletteEntry(label="1", color="#FF0000"),
        PaletteEntry(label="2", color="#00FF00"),
    ]
    png = render_palette_preview(entries, columns=1, swatch_size=10)
    output = save_palette_preview_bytes(png, tmp_path / "test.png")
    assert output.exists()
    assert output.read_bytes() == png
