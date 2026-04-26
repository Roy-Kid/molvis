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
    OVERLAY = "overlay"
    PIPELINE = "pipeline"


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
    SET_TRAJECTORY = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "set_trajectory",
    )
    SET_FRAME_LABELS = FrontendCommand(
        FrontendCommandGroup.SCENE,
        "set_frame_labels",
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
    SET_BACKGROUND = FrontendCommand(
        FrontendCommandGroup.VIEW,
        "set_background",
    )
    COLOR_BY = FrontendCommand(
        FrontendCommandGroup.VIEW,
        "color_by",
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
    ADD_OVERLAY = FrontendCommand(
        FrontendCommandGroup.OVERLAY,
        "add",
    )
    REMOVE_OVERLAY = FrontendCommand(
        FrontendCommandGroup.OVERLAY,
        "remove",
    )
    UPDATE_OVERLAY = FrontendCommand(
        FrontendCommandGroup.OVERLAY,
        "update",
    )
    CLEAR_OVERLAYS = FrontendCommand(
        FrontendCommandGroup.OVERLAY,
        "clear",
    )
    MARK_ATOM = FrontendCommand(
        FrontendCommandGroup.OVERLAY,
        "mark_atom",
    )
    UNMARK_ATOM = FrontendCommand(
        FrontendCommandGroup.OVERLAY,
        "unmark_atom",
    )
    PIPELINE_LIST = FrontendCommand(FrontendCommandGroup.PIPELINE, "list")
    PIPELINE_AVAILABLE_MODIFIERS = FrontendCommand(
        FrontendCommandGroup.PIPELINE, "available_modifiers"
    )
    PIPELINE_ADD_MODIFIER = FrontendCommand(
        FrontendCommandGroup.PIPELINE, "add_modifier"
    )
    PIPELINE_REMOVE_MODIFIER = FrontendCommand(
        FrontendCommandGroup.PIPELINE, "remove_modifier"
    )
    PIPELINE_REORDER_MODIFIER = FrontendCommand(
        FrontendCommandGroup.PIPELINE, "reorder_modifier"
    )
    PIPELINE_SET_ENABLED = FrontendCommand(
        FrontendCommandGroup.PIPELINE, "set_enabled"
    )
    PIPELINE_SET_PARENT = FrontendCommand(
        FrontendCommandGroup.PIPELINE, "set_parent"
    )
    PIPELINE_CLEAR = FrontendCommand(FrontendCommandGroup.PIPELINE, "clear")
