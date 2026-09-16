from __future__ import annotations

import unittest

from release_gate_query_config import _has_sort


class PersistedSortContractTest(unittest.TestCase):
    def test_database_sort_without_client_side_id_is_recognized(self) -> None:
        config = {
            "filters": [],
            "sorts": [{"fieldId": "release_title", "order": "desc"}],
        }

        self.assertTrue(
            _has_sort(config, field_id="release_title", order="desc")
        )

    def test_wrong_field_or_order_is_rejected(self) -> None:
        config = {
            "sorts": [{"fieldId": "release_title", "order": "asc"}],
        }

        self.assertFalse(
            _has_sort(config, field_id="release_title", order="desc")
        )
        self.assertFalse(
            _has_sort(config, field_id="release_status", order="asc")
        )


if __name__ == "__main__":
    unittest.main()
