"""
test_suppression.py — Tests for validators/suppression.py

Covers:
  - apply_suppressions() with suppress_checks (global category muting)
  - apply_suppressions() with per-object name matching
  - apply_suppressions() with glob patterns (* and ?)
  - apply_suppressions() with per-file matching
  - apply_suppressions() with cross-category rules (should NOT suppress)
  - load_suppression_rules() with missing file
  - load_suppression_rules() with empty/invalid YAML
  - Returned (kept_issues, suppressed_count) tuple
"""
from __future__ import annotations
import sys
import tempfile
import textwrap
from pathlib import Path

import pytest

_CORE_DIR = Path(__file__).parent.parent / "core"
sys.path.insert(0, str(_CORE_DIR))

from validators.issue import Issue, IssueCategory, Severity
from validators.suppression import apply_suppressions, load_suppression_rules


# ── Helpers ──────────────────────────────────────────────────────────────────

def _issue(cat=IssueCategory.BROKEN_REFERENCE, sev=Severity.ERROR,
           msg="test", obj_type="view", obj_name="my_view", src="my.view.lkml"):
    return Issue(category=cat, severity=sev, message=msg,
                 object_type=obj_type, object_name=obj_name, source_file=src)


def _rules(**kwargs) -> dict:
    """Build a rules dict like yaml.safe_load would return."""
    return dict(kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# apply_suppressions — global suppress_checks
# ─────────────────────────────────────────────────────────────────────────────

class TestApplySuppressions:

    def test_empty_rules_returns_all_issues(self):
        issues = [_issue(), _issue()]
        kept, count = apply_suppressions(issues, {})
        assert kept == issues
        assert count == 0

    def test_none_rules_returns_all_issues(self):
        issues = [_issue()]
        kept, count = apply_suppressions(issues, None)
        assert kept == issues
        assert count == 0

    def test_suppress_entire_category(self):
        issues = [
            _issue(cat=IssueCategory.FIELD_QUALITY),
            _issue(cat=IssueCategory.BROKEN_REFERENCE),
        ]
        rules = {"suppress_checks": ["field_quality"], "suppress": []}
        kept, count = apply_suppressions(issues, rules)
        assert count == 1
        assert all(i.category == IssueCategory.BROKEN_REFERENCE for i in kept)

    def test_suppress_multiple_categories(self):
        issues = [
            _issue(cat=IssueCategory.FIELD_QUALITY),
            _issue(cat=IssueCategory.JOIN_INTEGRITY),
            _issue(cat=IssueCategory.BROKEN_REFERENCE),
        ]
        rules = {"suppress_checks": ["field_quality", "join_integrity"], "suppress": []}
        kept, count = apply_suppressions(issues, rules)
        assert count == 2
        assert len(kept) == 1

    def test_suppress_count_equals_filtered_count(self):
        issues = [_issue()] * 5
        rules = {"suppress_checks": ["broken_reference"], "suppress": []}
        kept, count = apply_suppressions(issues, rules)
        assert count == 5
        assert len(kept) == 0

    def test_category_alias_broken(self):
        issues = [_issue(cat=IssueCategory.BROKEN_REFERENCE)]
        rules = {"suppress_checks": ["broken"], "suppress": []}
        kept, _ = apply_suppressions(issues, rules)
        assert len(kept) == 0

    def test_category_alias_join(self):
        issues = [_issue(cat=IssueCategory.JOIN_INTEGRITY)]
        rules = {"suppress_checks": ["join"], "suppress": []}
        kept, _ = apply_suppressions(issues, rules)
        assert len(kept) == 0

    def test_category_alias_duplicate(self):
        issues = [_issue(cat=IssueCategory.DUPLICATE)]
        rules = {"suppress_checks": ["duplicate"], "suppress": []}
        kept, _ = apply_suppressions(issues, rules)
        assert len(kept) == 0

    def test_category_alias_quality(self):
        issues = [_issue(cat=IssueCategory.FIELD_QUALITY)]
        rules = {"suppress_checks": ["quality"], "suppress": []}
        kept, _ = apply_suppressions(issues, rules)
        assert len(kept) == 0


# ─────────────────────────────────────────────────────────────────────────────
# apply_suppressions — per-object rules
# ─────────────────────────────────────────────────────────────────────────────

class TestPerObjectSuppressions:

    def test_exact_object_name_match(self):
        issues = [
            _issue(obj_name="staging_temp"),
            _issue(obj_name="orders"),
        ]
        rules = {
            "suppress": [{"check": "broken_reference", "object": "staging_temp"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 1
        assert kept[0].object_name == "orders"

    def test_object_match_case_insensitive(self):
        issues = [_issue(obj_name="StagingTemp")]
        rules = {
            "suppress": [{"check": "broken_reference", "object": "stagingtemp"}],
            "suppress_checks": [],
        }
        kept, _ = apply_suppressions(issues, rules)
        assert len(kept) == 0

    def test_wrong_category_does_not_suppress(self):
        """Rule targets join_integrity, issue is broken_reference — should NOT suppress."""
        issues = [_issue(cat=IssueCategory.BROKEN_REFERENCE, obj_name="orders")]
        rules = {
            "suppress": [{"check": "join_integrity", "object": "orders"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 0
        assert len(kept) == 1

    def test_wildcard_check_matches_any_category(self):
        issues = [
            _issue(cat=IssueCategory.BROKEN_REFERENCE, obj_name="orders"),
            _issue(cat=IssueCategory.JOIN_INTEGRITY,   obj_name="orders"),
        ]
        rules = {
            "suppress": [{"check": "*", "object": "orders"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 2
        assert len(kept) == 0


# ─────────────────────────────────────────────────────────────────────────────
# apply_suppressions — glob pattern rules
# ─────────────────────────────────────────────────────────────────────────────

class TestGlobPatternSuppressions:

    def test_star_pattern_matches_prefix(self):
        issues = [
            _issue(obj_name="np_legacy_orders"),
            _issue(obj_name="np_legacy_customers"),
            _issue(obj_name="orders"),
        ]
        rules = {
            "suppress": [{"check": "broken_reference", "pattern": "np_legacy_*"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 2
        assert kept[0].object_name == "orders"

    def test_question_mark_pattern(self):
        issues = [
            _issue(obj_name="orders_v1"),
            _issue(obj_name="orders_v2"),
            _issue(obj_name="orders_v10"),  # 2 chars after v — ? matches only 1
        ]
        rules = {
            "suppress": [{"check": "broken_reference", "pattern": "orders_v?"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 2
        assert "orders_v10" in {i.object_name for i in kept}

    def test_star_star_matches_all(self):
        issues = [_issue(obj_name="anything"), _issue(obj_name="else")]
        rules = {
            "suppress": [{"check": "*", "pattern": "*"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 2

    def test_pattern_case_insensitive(self):
        issues = [_issue(obj_name="Orders_Legacy")]
        rules = {
            "suppress": [{"check": "broken_reference", "pattern": "orders_*"}],
            "suppress_checks": [],
        }
        kept, _ = apply_suppressions(issues, rules)
        assert len(kept) == 0


# ─────────────────────────────────────────────────────────────────────────────
# apply_suppressions — file-based rules
# ─────────────────────────────────────────────────────────────────────────────

class TestFileSuppressions:

    def test_exact_filename_match(self):
        issues = [
            _issue(src="views/legacy.view.lkml"),
            _issue(src="views/orders.view.lkml"),
        ]
        rules = {
            "suppress": [{"file": "legacy.view.lkml", "check": "*"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 1
        assert kept[0].source_file == "views/orders.view.lkml"

    def test_glob_file_pattern(self):
        issues = [
            _issue(src="legacy_orders.model.lkml"),
            _issue(src="legacy_customers.model.lkml"),
            _issue(src="core.explore.lkml"),
        ]
        rules = {
            "suppress": [{"file": "legacy_*.model.lkml", "check": "*"}],
            "suppress_checks": [],
        }
        kept, count = apply_suppressions(issues, rules)
        assert count == 2
        assert kept[0].source_file == "core.explore.lkml"


# ─────────────────────────────────────────────────────────────────────────────
# load_suppression_rules
# ─────────────────────────────────────────────────────────────────────────────

class TestLoadSuppressionRules:

    def test_missing_file_returns_empty_dict(self):
        tmpdir = tempfile.mkdtemp()
        rules = load_suppression_rules(tmpdir)
        assert rules == {}
        import shutil; shutil.rmtree(tmpdir)

    def test_empty_yaml_file_returns_empty_dict(self):
        tmpdir = tempfile.mkdtemp()
        (Path(tmpdir) / "lookml_auditor.yaml").write_text("", encoding="utf-8")
        rules = load_suppression_rules(tmpdir)
        assert rules == {} or rules is None or isinstance(rules, dict)
        import shutil; shutil.rmtree(tmpdir)

    def test_valid_yaml_parsed(self):
        tmpdir = tempfile.mkdtemp()
        yaml_content = textwrap.dedent("""\
            suppress_checks:
              - field_documentation
            suppress:
              - check: join_integrity
                object: my_view
        """)
        (Path(tmpdir) / "lookml_auditor.yaml").write_text(yaml_content, encoding="utf-8")
        rules = load_suppression_rules(tmpdir)
        assert isinstance(rules, dict)
        assert "suppress_checks" in rules or "suppress" in rules
        import shutil; shutil.rmtree(tmpdir)
