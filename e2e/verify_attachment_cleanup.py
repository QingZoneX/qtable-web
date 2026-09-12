from __future__ import annotations

import asyncio
import sys

from app.db.session import AsyncSessionLocal
from app.models.attachment import AttachmentObject
from app.services.attachment_storage import (
    cleanup_pending_attachments,
    reconcile_purged_record_attachments,
    stat_object,
)


async def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: verify_attachment_cleanup.py ATTACHMENT_ID OBJECT_KEY")
    attachment_id, object_key = sys.argv[1:]

    async with AsyncSessionLocal() as db:
        await reconcile_purged_record_attachments(db)
        for _ in range(3):
            cleaned, pending = await cleanup_pending_attachments(db)
            if pending == 0:
                break
            if cleaned == 0:
                await asyncio.sleep(1)
        registry = await db.get(AttachmentObject, attachment_id)
        if registry is not None:
            raise AssertionError(
                f"attachment registry row survived permanent purge: {attachment_id}"
            )

    try:
        await stat_object(object_key)
    except FileNotFoundError:
        print("[attachment-browser-e2e] registry and physical object purge verified")
        return
    raise AssertionError(f"attachment object survived permanent purge: {object_key}")


asyncio.run(main())
