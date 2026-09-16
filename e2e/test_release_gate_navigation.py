from __future__ import annotations

import unittest

from release_gate_navigation import _surface_path_matches


class SurfacePathMatchesTest(unittest.TestCase):
    def test_table_landing_and_resolved_workbench_are_valid(self) -> None:
        self.assertTrue(_surface_path_matches("http://localhost/tables", "/tables"))
        self.assertTrue(
            _surface_path_matches(
                "http://localhost/workbench/dst-table/v1?source=tables", "/tables"
            )
        )
        self.assertFalse(
            _surface_path_matches("http://localhost/workbench/dsb-dashboard", "/tables")
        )

    def test_dashboard_landing_and_resolved_workbench_are_valid(self) -> None:
        self.assertTrue(
            _surface_path_matches("http://localhost/dashboards", "/dashboards")
        )
        self.assertTrue(
            _surface_path_matches(
                "http://localhost/workbench/dsb-dashboard", "/dashboards"
            )
        )
        self.assertFalse(
            _surface_path_matches("http://localhost/workbench/dst-table/v1", "/dashboards")
        )

    def test_other_surfaces_require_an_exact_path(self) -> None:
        self.assertTrue(_surface_path_matches("http://localhost/settings?tab=a", "/settings"))
        self.assertFalse(_surface_path_matches("http://localhost/settings/profile", "/settings"))


if __name__ == "__main__":
    unittest.main()
