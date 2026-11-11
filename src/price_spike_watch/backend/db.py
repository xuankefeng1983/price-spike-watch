"""Thin SQL warehouse helper: parameterised statements via the Databricks SDK."""

from __future__ import annotations

import os
from typing import Any

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import (
    Disposition,
    Format,
    StatementParameterListItem,
    StatementState,
)

DEMO = "workshop_demo.energy_utilities"
EVENTS = "mellabs_006.default.price_spike_events"
WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "60eae4dc9633ec4a")


def query(ws: WorkspaceClient, sql: str, **params: Any) -> list[dict[str, Any]]:
    resp = ws.statement_execution.execute_statement(
        statement=sql,
        warehouse_id=WAREHOUSE_ID,
        wait_timeout="50s",
        disposition=Disposition.INLINE,
        format=Format.JSON_ARRAY,
        parameters=[
            StatementParameterListItem(
                name=k,
                value=None if v is None else str(v),
                type="INT" if isinstance(v, int) and not isinstance(v, bool) else None,
            )
            for k, v in params.items()
        ],
    )
    status = resp.status
    if status is None or status.state != StatementState.SUCCEEDED:
        msg = status.error.message if status and status.error else "unknown error"
        raise RuntimeError(f"SQL failed: {msg}")
    schema = resp.manifest.schema if resp.manifest else None
    cols = [c.name or "" for c in (schema.columns or [])] if schema else []
    rows = resp.result.data_array if resp.result else None
    return [dict(zip(cols, r)) for r in (rows or [])]
