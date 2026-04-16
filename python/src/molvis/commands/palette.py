from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from ..palettes import (
    PaletteDefinition,
    PaletteEntry,
    PaletteInfo,
    render_palette_preview,
    save_palette_preview_bytes,
)

if TYPE_CHECKING:
    from ..scene import Molvis

__all__ = ["PaletteCommandsMixin"]


class PaletteCommandsMixin:
    """Palette methods backed by JSON-RPC requests to the JS widget."""

    def list_palettes(
        self: "Molvis",
        timeout: float = 5.0,
    ) -> list[PaletteInfo]:
        result = self.send_cmd(
            "palette.list",
            {},
            wait_for_response=True,
            timeout=timeout,
        )
        return [PaletteInfo(r["name"], r["kind"], r["size"]) for r in result]

    def get_palette(
        self: "Molvis",
        name: str,
        timeout: float = 5.0,
    ) -> PaletteDefinition:
        result = self.send_cmd(
            "palette.get",
            {"name": name},
            wait_for_response=True,
            timeout=timeout,
        )
        entries = [
            PaletteEntry(e["label"], e["color"])
            for e in result["entries"]
        ]
        return PaletteDefinition(result["name"], result["kind"], result["size"], entries)

    def palette_entries(
        self: "Molvis",
        name: str,
        timeout: float = 5.0,
    ) -> list[tuple[str, str]]:
        palette = self.get_palette(name, timeout)
        return [(e.label, e.color) for e in palette.entries]

    def palette_colors(
        self: "Molvis",
        name: str,
        timeout: float = 5.0,
    ) -> list[str]:
        palette = self.get_palette(name, timeout)
        return [e.color for e in palette.entries]

    def palette_preview(
        self: "Molvis",
        name: str,
        *,
        columns: int | None = None,
        swatch_size: int = 24,
        gap: int = 4,
        padding: int = 12,
        background: str = "#111111",
        timeout: float = 5.0,
    ) -> bytes:
        palette = self.get_palette(name, timeout)
        return render_palette_preview(
            palette.entries,
            columns=columns,
            swatch_size=swatch_size,
            gap=gap,
            padding=padding,
            background=background,
        )

    def save_palette_preview(
        self: "Molvis",
        name: str,
        path: str | Path,
        *,
        columns: int | None = None,
        swatch_size: int = 24,
        gap: int = 4,
        padding: int = 12,
        background: str = "#111111",
        timeout: float = 5.0,
    ) -> Path:
        png = self.palette_preview(
            name,
            columns=columns,
            swatch_size=swatch_size,
            gap=gap,
            padding=padding,
            background=background,
            timeout=timeout,
        )
        return save_palette_preview_bytes(png, path)
