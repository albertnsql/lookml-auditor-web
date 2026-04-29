"""
test_suppression.py — Tests for suppression rules (lookml_auditor.yaml).

Covers:
  - load_suppression_rules: missing file, valid file, empty file, malformed file
  - apply_suppressions: global suppress_checks, pattern match, object exact match,
    file match, wildcard check, multi-rule, zero suppressions, empty issues list
"""
from __future__ import annotations
import sys
import tempfile
import shutil
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))

from validators.suppression import load_suppression_rules, apply_suppressions
from validators.issue import Issue, IssueCategory, Severity


# ─── Helpers ────────────────────────────────────────────────────────────────

def _make_issue(
    category: IssueCategory = IssueCategory.JOIN_INTEGRITY,
    severity: Severity = Severity.ERROR,
    object_name: str = "my_explore",
    object_type: str = "explore",
    source_file: str = "model.explore.lkml",
    message: str = "test issue",
) -> Issue:
    return Issue(
        category=category,
        severity=severity,
        message=message,
        object_type=object_type,
        object_name=object_name,
        source_file=source_file,
    )


# ═══════════════════════════════════════════════════════════════════════════
# load_suppression_rules
# ═══════════════════════════════════════════════════════════════════════════

class TestLoadSuppressionRules:

    def test_missing_file_returns_empty(self):
        tmpdir = tempfile.mkdtemp()
        try:
            rules = load_suppression_rules(tmpdir)
            assert rules == {}
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_valid_yaml_loaded(self):
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "lookml_auditor.yaml").write_text(
                "suppress_checks:\n  - join_integrity\n", encoding="utf-8"
            )
            rules = load_suppression_rules(tmpdir)
            assert isinstance(rules, dict)
            assert "suppress_checks" in rules
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_empty_yaml_file_returns_empty(self):
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "lookml_auditor.yaml").write_text("", encoding="utf-8")
            rules = load_suppression_rules(tmpdir)
            assert rules == {}
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_malformed_yaml_returns_empty(self):
        tmpdir = tempfile.mkdtemp()
        try:
            (Path(tmpdir) / "lookml_auditor.yaml").write_text(
                ":::: totally invalid yaml [[[\n", encoding="utf-8"
            )
            rules = load_suppression_rules(tmpdir)
            # Must not raise, must return empty or dict
            assert isinstance(rules, dict)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_full_config_loaded(self, suppression_project_dir):
        rules = load_suppression_rules(suppression_project_dir)
        assert isinstance(rules, dict)
        assert "suppress" in rules or "suppress_checks" in rules


# ═══════════════════════════════════════════════════════════════════════════
# apply_suppressions
# ═══════════════════════════════════════════════════════════════════════════

class TestApplySuppressions:

    def test_no_rules_returns_all_issues(self):
        issues = [_make_issue(), _make_issue()]
        kept, suppressed = apply_suppressions(issues, {})
        assert len(kept) == 2
        assert suppressed == 0

    def test_empty_issues_list_returns_zero(self):
        kept, suppressed = apply_suppressions([], {"suppress_checks": ["join_integrity"]})
        assert kept == []
        assert suppressed == 0

    def test_empty_rules_dict_returns_all(self):
        issues = [_make_issue(), _make_issue()]
        kept, suppressed = apply_suppressions(issues, {})
        assert len(kept) == 2
        assert suppressed == 0

    def test_none_rules_returns_all(self):
        issues = [_make_issue()]
        kept, suppressed = apply_suppressions(issues, None)
        assert len(kept) == 1

    def test_global_suppress_check_removes_category(self):
        join_issue = _make_issue(category=IssueCategory.JOIN_INTEGRITY)
        ref_issue  = _make_issue(category=IssueCategory.BROKEN_REFERENCE)
        rules = {"suppress_checks": ["join_integrity"]}
        kept, suppressed = apply_suppressions([join_issue, ref_issue], rules)
        assert suppressed == 1
        assert all(i.category != IssueCategory.JOIN_INTEGRITY for i in kept)

    def test_global_suppress_field_documentation_alias(self):
        issue = _make_issue(category=IssueCategory.FIELD_QUALITY)
        rules = {"suppress_checks": ["field_documentation"]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 1
        assert kept == []

    def test_pattern_wildcard_match(self):
        issue = _make_issue(object_name="legacy_explore", category=IssueCategory.JOIN_INTEGRITY)
        rules = {"suppress": [{"check": "join_integrity", "pattern": "legacy_*"}]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 1
        assert kept == []

    def test_pattern_no_match_kept(self):
        issue = _make_issue(object_name="modern_explore", category=IssueCategory.JOIN_INTEGRITY)
        rules = {"suppress": [{"check": "join_integrity", "pattern": "legacy_*"}]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 0
        assert len(kept) == 1

    def test_exact_object_match(self):
        issue = _make_issue(object_name="orders")
        rules = {"suppress": [{"check": "duplicate", "object": "orders"}]}
        issue2 = _make_issue(category=IssueCategory.DUPLICATE_VIEW_SOURCE, object_name="orders")
        kept, suppressed = apply_suppressions([issue2], rules)
        assert suppressed == 1

    def test_exact_object_case_insensitive(self):
        issue = _make_issue(category=IssueCategory.DUPLICATE_VIEW_SOURCE, object_name="Orders")
        rules = {"suppress": [{"check": "duplicate", "object": "orders"}]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 1

    def test_file_match_suppresses(self):
        issue = _make_issue(source_file="/repo/legacy.model.lkml")
        rules = {"suppress": [{"file": "legacy.model.lkml", "check": "*"}]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 1

    def test_file_glob_match(self):
        issue = _make_issue(source_file="/repo/legacy_orders.model.lkml")
        rules = {"suppress": [{"file": "legacy_*.model.lkml", "check": "*"}]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 1

    def test_wrong_category_not_suppressed(self):
        issue = _make_issue(category=IssueCategory.BROKEN_REFERENCE)
        rules = {"suppress": [{"check": "join_integrity", "pattern": "*"}]}
        kept, suppressed = apply_suppressions([issue], rules)
        assert suppressed == 0
        assert len(kept) == 1

    def test_suppressed_count_accurate(self):
        issues = [
            _make_issue(category=IssueCategory.JOIN_INTEGRITY),
            _make_issue(category=IssueCategory.JOIN_INTEGRITY),
            _make_issue(category=IssueCategory.BROKEN_REFERENCE),
        ]
        rules = {"suppress_checks": ["join_integrity"]}
        kept, suppressed = apply_suppressions(issues, rules)
        assert suppressed == 2
        assert len(kept) == 1

    def test_wildcard_check_star_matches_all_categories(self):
        issues = [
            _make_issue(category=IssueCategory.JOIN_INTEGRITY),
            _make_issue(category=IssueCategory.BROKEN_REFERENCE),
            _make_issue(category=IssueCategory.DUPLICATE_VIEW_SOURCE),
        ]
        rules = {"suppress": [{"check": "*", "pattern": "my_explore"}]}
        kept, suppressed = apply_suppressions(issues, rules)
        assert suppressed == 3
        assert kept == []

    def test_multiple_rules_combined(self):
        join_issue = _make_issue(category=IssueCategory.JOIN_INTEGRITY, object_name="legacy_x")
        ref_issue  = _make_issue(category=IssueCategory.BROKEN_REFERENCE, object_name="ghost")
        dup_issue  = _make_issue(category=IssueCategory.DUPLICATE_VIEW_SOURCE, object_name="other")
        rules = {
            "suppress": [
                {"check": "join_integrity", "pattern": "legacy_*"},
                {"check": "broken_reference", "object": "ghost"},
            ]
        }
        kept, suppressed = apply_suppressions([join_issue, ref_issue, dup_issue], rules)
        assert suppressed == 2
        assert len(kept) == 1
        assert kept[0].object_name == "other"

    def test_end_to_end_with_disk_project(self, suppression_project_dir):
        """Integration: load rules from disk and suppress real validator output."""
        from lookml_parser.parser import parse_project
        from validators import run_all_checks

        project = parse_project(suppression_project_dir)
        issues_raw = run_all_checks(project)
        rules = load_suppression_rules(suppression_project_dir)
        kept, suppressed = apply_suppressions(issues_raw, rules, suppression_project_dir)
        # suppressed count must be non-negative
        assert suppressed >= 0
        # field_quality suppressed globally by suppress_checks
        field_quality_kept = [
            i for i in kept if i.category == IssueCategory.FIELD_QUALITY
        ]
        assert field_quality_kept == []
