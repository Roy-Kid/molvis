from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

__all__ = ["FrontendCommand", "FrontendCommandGroup", "FrontendCommands"]


class FrontendCommandGroup(str, Enum):
    SCENE = "scene"
    VIEW = "view"
    SELECTION = "selection"
    SNAPSHOT = "snapshot"
    SESSION = "session"


@dataclass(frozen=True)
class FrontendCommand:
    group: FrontendCommandGroup
    action: str
    legacy_aliases: tuple[str, ...] = ()

    @property
    def method(self) -> str:
        return f"{self.group.value}.{self.action}"


class FrontendCommands:
    NEW_FRAME = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "new_frame",
        ("new_frame",),
    )
    DRAW_FRAME = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "draw_frame",
        ("draw_frame",),
    )
    DRAW_BOX = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "draw_box",
        ("draw_box",),
    )
    CLEAR = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "clear",
        ("clear", "clear_scene"),
    )
    EXPORT_FRAME = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "export_frame",
        ("export_frame",),
    )
    GET_SELECTED = FrontendCommand(
        FrontendCommandGroup.SELECTION,
        "get",
        ("get_selected",),
    )
    SELECT_ATOMS = FrontendCommand(
        FrontendCommandGroup.SELECTION,
        "select_atoms",
        ("select_atoms",),
    )
    SNAPSHOT = FrontendCommand(
        FrontendCommandGroup.SNAPSHOT,
        "take",
        ("take_snapshot",),
    )
    SET_STYLE = FrontendCommand(
        FrontendCommandGroup.VIEW,
        "set_style",
        ("set_style",),
    )
    SET_THEME = FrontendCommand(
        FrontendCommandGroup.VIEW,
        "set_theme",
        ("set_theme",),
    )
    SET_VIEW_MODE = FrontendCommand(
        FrontendCommandGroup.VIEW,
        "set_mode",
        ("set_view_mode",),
    )
    SESSION_COUNT = FrontendCommand(
        FrontendCommandGroup.SESSION,
        "get_session_count",
        ("get_instance_count",),
    )
    LIST_SESSIONS = FrontendCommand(
        FrontendCommandGroup.SESSION,
        "list_sessions",
        ("list_instances",),
    )
    CLEAR_ALL_SESSIONS = FrontendCommand(
        FrontendCommandGroup.SESSION,
        "clear_all_sessions",
        ("clear_all_instances",),
    )
    CLEAR_ALL_CONTENT = FrontendCommand(
        FrontendCommandGroup.SESSION,
        "clear_all_content",
        ("clear_all_content",),
    )
