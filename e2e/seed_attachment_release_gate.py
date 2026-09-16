import asyncio
import json
import os

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.smart_table import (
    TableField,
    TableRecord,
    TableRowPermissionPolicy,
    TableView,
    WorkspaceItem,
)
from app.models.user import User
from app.models.workspace_member import Workspace, WorkspaceMember, WorkspaceRole

WORKSPACE_ID = "ws-attachment-browser-e2e"
TABLE_ID = "tbl-attachment-browser-e2e"
RECORD_ID = "record-attachment-browser-e2e"
VIEW_ID = "view-attachment-browser-e2e"
ALICE_ID = 927101
BOB_ID = 927102
MANAGER_ID = 927103
ALICE_EMAIL = "attachment-e2e-alice@example.com"
BOB_EMAIL = "attachment-e2e-bob@example.com"
MANAGER_EMAIL = "attachment-e2e-manager@example.com"


async def main():
    password = os.environ["QTABLE_E2E_PASSWORD"]
    async with AsyncSessionLocal() as db:
        existing = await db.get(Workspace, WORKSPACE_ID)
        if existing is not None:
            raise RuntimeError("attachment browser E2E seed already exists")

        users = [
            User(
                id=ALICE_ID,
                email=ALICE_EMAIL,
                name="Attachment E2E Alice",
                password_hash=hash_password(password),
            ),
            User(
                id=BOB_ID,
                email=BOB_EMAIL,
                name="Attachment E2E Bob",
                password_hash=hash_password(password),
            ),
            User(
                id=MANAGER_ID,
                email=MANAGER_EMAIL,
                name="Attachment E2E Manager",
                password_hash=hash_password(password),
            ),
        ]
        db.add_all(users)
        db.add(Workspace(id=WORKSPACE_ID, name="Attachment Browser E2E"))
        await db.flush()
        db.add_all(
            [
                WorkspaceMember(
                    user_id=ALICE_ID,
                    workspace_id=WORKSPACE_ID,
                    role=WorkspaceRole.editor,
                ),
                WorkspaceMember(
                    user_id=BOB_ID,
                    workspace_id=WORKSPACE_ID,
                    role=WorkspaceRole.editor,
                ),
                WorkspaceMember(
                    user_id=MANAGER_ID,
                    workspace_id=WORKSPACE_ID,
                    role=WorkspaceRole.owner,
                ),
                WorkspaceItem(
                    id=TABLE_ID,
                    workspace_id=WORKSPACE_ID,
                    type="table",
                    name="Attachment Browser Release Gate",
                    parent_id=None,
                    order_index=0,
                    default_view_id=VIEW_ID,
                ),
                TableField(
                    id="title",
                    table_id=TABLE_ID,
                    name="Title",
                    type="text",
                    order_index=0,
                ),
                TableField(
                    id="owner",
                    table_id=TABLE_ID,
                    name="Owner",
                    type="member",
                    property={"multiple": True},
                    order_index=1,
                ),
                TableField(
                    id="files",
                    table_id=TABLE_ID,
                    name="Files",
                    type="attachment",
                    order_index=2,
                ),
                TableView(
                    id=VIEW_ID,
                    table_id=TABLE_ID,
                    name="Grid",
                    type="grid",
                    config={},
                ),
                TableRowPermissionPolicy(
                    table_id=TABLE_ID,
                    mode="member_field",
                    member_field_id="owner",
                ),
                TableRecord(
                    id=RECORD_ID,
                    table_id=TABLE_ID,
                    data={
                        "title": "Browser attachment row",
                        "owner": [str(ALICE_ID)],
                        "files": [],
                    },
                    order_index=0,
                    created_by_user_id=ALICE_ID,
                    version=1,
                ),
            ]
        )
        await db.commit()
        print(
            json.dumps(
                {
                    "workspaceId": WORKSPACE_ID,
                    "tableId": TABLE_ID,
                    "recordId": RECORD_ID,
                    "aliceId": ALICE_ID,
                    "bobId": BOB_ID,
                    "managerId": MANAGER_ID,
                }
            )
        )


asyncio.run(main())
