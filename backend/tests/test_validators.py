"""
test_validators.py — Tests for all 8 validator checks + scoring.

Validators covered:
  - check_broken_references
  - check_duplicates
  - check_duplicate_table_refs
  - check_duplicate_sql
  - check_join_integrity
  - check_primary_keys
  - check_field_documentation
  - check_orphans
  - compute_health_score
  - compute_category_scores
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "core"))

from validators.broken_references import check_broken_references
from validators.duplicates import check_duplicates
from validators.duplicate_tables import check_duplicate_table_refs
from validators.duplicate_sql import check_duplicate_sql
from validators.join_integrity import check_join_integrity
from validators.primary_keys import check_primary_keys
from validators.field_documentation import check_field_documentation
from validators.orphans import check_orphans
from validators.issue import Severity, IssueCategory
from validators import run_all_checks, compute_health_score, compute_category_scores


# ═══════════════════════════════════════════════════════════════════════════
# check_broken_references
# ═══════════════════════════════════════════════════════════════════════════

class TestBrokenReferences:

    def test_clean_project_no_issues(self, clean_project):
        issues = check_broken_references(clean_project)
        assert issues == []

    def test_empty_project_no_issues(self, empty_project):
        issues = check_broken_references(empty_project)
        assert issues == []

    def test_missing_base_view_flagged(self, broken_refs_project):
        issues = check_broken_references(broken_refs_project)
        cats = [i.category for i in issues]
        assert IssueCategory.BROKEN_REFERENCE in cats

    def test_missing_base_view_is_error(self, broken_refs_project):
        issues = check_broken_references(broken_refs_project)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert len(errors) >= 1

    def test_missing_join_view_flagged(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        j = make_join("ghost_join")  # resolved_view = "ghost_join", not in project
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders], explores=[e])
        issues = check_broken_references(p)
        assert any("ghost_join" in i.message for i in issues)

    def test_explore_with_from_alias_no_issue(self, explore_with_from_alias_project):
        issues = check_broken_references(explore_with_from_alias_project)
        assert issues == []

    def test_sql_on_unknown_view_ref_flagged(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        customers = make_view("customers", fields=[])
        j = make_join("customers", sql_on="${orders.id} = ${ghost_view.id}")
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders, customers], explores=[e])
        issues = check_broken_references(p)
        assert any("ghost_view" in i.message for i in issues)

    def test_sql_on_known_alias_no_issue(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        customers = make_view("customers", fields=[])
        j = make_join("customers", sql_on="${orders.id} = ${customers.id}")
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders, customers], explores=[e])
        issues = check_broken_references(p)
        assert issues == []

    def test_case_insensitive_view_lookup(self, make_view, make_explore, make_project):
        view = make_view("Orders")
        e = make_explore("Orders")  # base_view = "Orders"
        p = make_project(views=[view], explores=[e])
        issues = check_broken_references(p)
        assert issues == []


# ═══════════════════════════════════════════════════════════════════════════
# check_duplicates
# ═══════════════════════════════════════════════════════════════════════════

class TestDuplicates:

    def test_clean_project_no_issues(self, clean_project):
        issues = check_duplicates(clean_project)
        assert issues == []

    def test_empty_project_no_issues(self, empty_project):
        issues = check_duplicates(empty_project)
        assert issues == []

    def test_dup_views_same_folder_is_error(self, dup_views_same_folder_project):
        issues = check_duplicates(dup_views_same_folder_project)
        errors = [i for i in issues if i.severity == Severity.ERROR and i.object_type == "view"]
        assert len(errors) >= 1

    def test_dup_views_diff_folder_is_warning(self, dup_views_diff_folder_project):
        issues = check_duplicates(dup_views_diff_folder_project)
        warnings = [i for i in issues if i.severity == Severity.WARNING and i.object_type == "view"]
        assert len(warnings) >= 1

    def test_extends_view_fields_not_flagged(self, extends_project):
        issues = check_duplicates(extends_project)
        field_issues = [i for i in issues if i.object_type == "field"]
        assert field_issues == []

    def test_dup_explore_same_file_is_error(self, make_explore, make_project):
        e1 = make_explore("orders", source_file="/repo/a.model.lkml")
        e2 = make_explore("orders", source_file="/repo/b.model.lkml")
        p = make_project(explores=[e1, e2])
        issues = check_duplicates(p)
        dup = [i for i in issues if i.object_type == "explore"]
        assert len(dup) >= 1

    def test_dup_fields_same_type_is_error(self, make_field, make_view, make_project):
        f1 = make_field("status", field_type="dimension")
        f2 = make_field("status", field_type="dimension")
        v = make_view("orders", fields=[f1, f2])
        p = make_project(views=[v])
        issues = check_duplicates(p)
        errors = [i for i in issues if i.severity == Severity.ERROR and i.object_type == "field"]
        assert len(errors) >= 1

    def test_dim_and_dim_group_same_name_is_warning(self, make_field, make_view, make_project):
        f1 = make_field("created", field_type="dimension")
        f2 = make_field("created", field_type="dimension_group")
        v = make_view("orders", fields=[f1, f2])
        p = make_project(views=[v])
        issues = check_duplicates(p)
        warnings = [i for i in issues if i.severity == Severity.WARNING and i.object_type == "field"]
        assert len(warnings) >= 1


# ═══════════════════════════════════════════════════════════════════════════
# check_duplicate_table_refs
# ═══════════════════════════════════════════════════════════════════════════

class TestDuplicateTableRefs:

    def test_clean_project_no_issues(self, clean_project):
        assert check_duplicate_table_refs(clean_project) == []

    def test_empty_project_no_issues(self, empty_project):
        assert check_duplicate_table_refs(empty_project) == []

    def test_same_sql_table_flagged(self, dup_table_refs_project):
        issues = check_duplicate_table_refs(dup_table_refs_project)
        assert len(issues) >= 1
        assert all(i.category == IssueCategory.DUPLICATE_VIEW_SOURCE for i in issues)

    def test_case_insensitive_table_comparison(self, make_view, make_project):
        v1 = make_view("a", sql_table="Public.Orders")
        v2 = make_view("b", sql_table="public.orders")
        p = make_project(views=[v1, v2])
        issues = check_duplicate_table_refs(p)
        assert len(issues) >= 1

    def test_derived_tables_not_flagged(self, make_view, make_project):
        v1 = make_view("a", derived_sql="SELECT 1", sql_table=None)
        v2 = make_view("b", derived_sql="SELECT 1", sql_table=None)
        p = make_project(views=[v1, v2])
        issues = check_duplicate_table_refs(p)
        assert issues == []

    def test_unique_tables_no_issue(self, make_view, make_project):
        v1 = make_view("a", sql_table="public.table_a")
        v2 = make_view("b", sql_table="public.table_b")
        p = make_project(views=[v1, v2])
        assert check_duplicate_table_refs(p) == []


# ═══════════════════════════════════════════════════════════════════════════
# check_duplicate_sql
# ═══════════════════════════════════════════════════════════════════════════

class TestDuplicateSQL:

    def test_clean_project_no_issues(self, clean_project):
        assert check_duplicate_sql(clean_project) == []

    def test_empty_project_no_issues(self, empty_project):
        assert check_duplicate_sql(empty_project) == []

    def test_dup_sql_non_pk_is_warning(self, dup_sql_project):
        issues = check_duplicate_sql(dup_sql_project)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1

    def test_pk_sharing_sql_is_skipped(self, make_field, make_view, make_project):
        """Sharing SQL with a primary key is often intentional and should be skipped."""
        pk = make_field("id", primary_key=True, sql="${TABLE}.id")
        alias = make_field("id_alias", sql="${TABLE}.id")
        v = make_view("orders", fields=[pk, alias])
        p = make_project(views=[v])
        issues = check_duplicate_sql(p)
        assert issues == []

    def test_hidden_sharing_sql_is_skipped(self, make_field, make_view, make_project):
        """Hidden fields are often intermediate or internal and should be skipped."""
        f1 = make_field("f1", sql="${TABLE}.x", hidden=True)
        f2 = make_field("f2", sql="${TABLE}.x")
        v = make_view("v", fields=[f1, f2])
        p = make_project(views=[v])
        assert check_duplicate_sql(p) == []

    def test_short_sql_skipped(self, make_field, make_view, make_project):
        """SQL expressions < 5 chars or in skip-list must not be flagged."""
        f1 = make_field("a", sql="1")
        f2 = make_field("b", sql="1")
        v = make_view("orders", fields=[f1, f2])
        p = make_project(views=[v])
        assert check_duplicate_sql(p) == []

    def test_no_sql_fields_no_issue(self, make_field, make_view, make_project):
        f = make_field("count", field_type="measure", sql=None)
        v = make_view("orders", fields=[f])
        p = make_project(views=[v])
        assert check_duplicate_sql(p) == []

    # make_field not available as argument here — use conftest helper via fixture
    def test_unique_sql_no_issue(self, make_field, make_view, make_project):
        f1 = make_field("status", sql="${TABLE}.status")
        f2 = make_field("amount", sql="${TABLE}.amount")
        v = make_view("orders", fields=[f1, f2])
        p = make_project(views=[v])
        assert check_duplicate_sql(p) == []

    def test_dimension_and_measure_same_sql_not_flagged(self, make_field, make_view, make_project):
        """A dimension and a measure sharing the same SQL column is valid LookML — should not be flagged."""
        dim = make_field("item_cost",  field_type="dimension", sql="${TABLE}.item_cost")
        msr = make_field("item_costm", field_type="measure",   sql="${TABLE}.item_cost")
        v = make_view("np_margin_fact", fields=[dim, msr])
        p = make_project(views=[v])
        issues = check_duplicate_sql(p)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert warnings == [], f"Unexpected false-positive: {[i.message for i in warnings]}"

    def test_two_dimensions_same_sql_is_flagged(self, make_field, make_view, make_project):
        """Two dimensions sharing the same SQL expression IS a real duplicate and should warn."""
        f1 = make_field("item_cost",   field_type="dimension", sql="${TABLE}.item_cost")
        f2 = make_field("item_cost_v2", field_type="dimension", sql="${TABLE}.item_cost")
        v = make_view("np_margin_fact", fields=[f1, f2])
        p = make_project(views=[v])
        issues = check_duplicate_sql(p)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1

    def test_two_measures_same_sql_is_flagged(self, make_field, make_view, make_project):
        """Two measures sharing the same SQL expression IS a real duplicate and should warn."""
        m1 = make_field("total_cost",  field_type="measure", sql="${TABLE}.item_cost")
        m2 = make_field("total_cost2", field_type="measure", sql="${TABLE}.item_cost")
        v = make_view("np_margin_fact", fields=[m1, m2])
        p = make_project(views=[v])
        issues = check_duplicate_sql(p)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1

    def test_dup_sql_diff_filters_is_not_flagged(self, dup_sql_diff_filters_project):
        """Measures sharing SQL but having different filters are distinct."""
        issues = check_duplicate_sql(dup_sql_diff_filters_project)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert warnings == []



# ═══════════════════════════════════════════════════════════════════════════
# check_join_integrity
# ═══════════════════════════════════════════════════════════════════════════

class TestJoinIntegrity:

    def test_clean_project_no_issues(self, clean_project):
        assert check_join_integrity(clean_project) == []

    def test_empty_project_no_issues(self, empty_project):
        assert check_join_integrity(empty_project) == []

    def test_join_no_sql_on_is_error(self, join_no_sql_on_project):
        issues = check_join_integrity(join_no_sql_on_project)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert len(errors) >= 1

    def test_join_no_relationship_is_warning(self, join_no_relationship_project):
        issues = check_join_integrity(join_no_relationship_project)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1

    def test_cross_join_no_sql_on_no_error(self, cross_join_project):
        issues = check_join_integrity(cross_join_project)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []

    def test_sql_on_with_sql_where_is_warning(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        customers = make_view("customers", fields=[])
        j = make_join("customers", sql_on=None, sql_where="${orders.id} = ${customers.id}")
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders, customers], explores=[e])
        issues = check_join_integrity(p)
        warnings = [i for i in issues if i.severity == Severity.WARNING]
        assert len(warnings) >= 1

    def test_sql_on_valid_alias_no_issue(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        customers = make_view("customers", fields=[])
        j = make_join("customers", sql_on="${orders.id} = ${customers.id}", relationship="many_to_one")
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders, customers], explores=[e])
        issues = check_join_integrity(p)
        assert issues == []

    def test_sql_on_unknown_view_ref_is_error(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        customers = make_view("customers", fields=[])
        j = make_join("customers", sql_on="${orders.id} = ${ghost.id}", relationship="many_to_one")
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders, customers], explores=[e])
        issues = check_join_integrity(p)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert len(errors) >= 1

    def test_foreign_key_satisfies_condition(self, make_view, make_join, make_explore, make_project):
        orders = make_view("orders", fields=[])
        customers = make_view("customers", fields=[])
        j = make_join("customers", sql_on=None, foreign_key="customer_id", relationship="many_to_one")
        e = make_explore("orders", joins=[j])
        p = make_project(views=[orders, customers], explores=[e])
        issues = check_join_integrity(p)
        # foreign_key satisfies the "condition" requirement — no ERROR for missing sql_on
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []


# ═══════════════════════════════════════════════════════════════════════════
# check_primary_keys
# ═══════════════════════════════════════════════════════════════════════════

class TestPrimaryKeys:

    def test_clean_project_no_issues(self, clean_project):
        assert check_primary_keys(clean_project) == []

    def test_empty_project_no_issues(self, empty_project):
        assert check_primary_keys(empty_project) == []

    def test_missing_pk_is_warning(self, missing_pk_project):
        issues = check_primary_keys(missing_pk_project)
        assert len(issues) >= 1
        assert all(i.severity == Severity.WARNING for i in issues)
        assert all(i.category == IssueCategory.FIELD_QUALITY for i in issues)

    def test_view_with_pk_no_issue(self, make_view, make_field, make_project):
        v = make_view("orders", fields=[make_field("id", primary_key=True)])
        p = make_project(views=[v])
        assert check_primary_keys(p) == []

    def test_view_no_fields_is_flagged(self, make_view, make_project):
        v = make_view("empty_view", fields=[])
        p = make_project(views=[v])
        issues = check_primary_keys(p)
        assert len(issues) >= 1

    def test_multiple_views_only_missing_flagged(self, make_view, make_field, make_project):
        with_pk    = make_view("orders",   fields=[make_field("id", primary_key=True)])
        without_pk = make_view("sessions", fields=[make_field("session_id")])
        p = make_project(views=[with_pk, without_pk])
        issues = check_primary_keys(p)
        names = [i.object_name for i in issues]
        assert "sessions" in names
        assert "orders" not in names


# ═══════════════════════════════════════════════════════════════════════════
# check_field_documentation
# ═══════════════════════════════════════════════════════════════════════════

class TestFieldDocumentation:

    def test_clean_project_no_issues(self, clean_project):
        assert check_field_documentation(clean_project) == []

    def test_empty_project_no_issues(self, empty_project):
        assert check_field_documentation(empty_project) == []

    def test_undocumented_fields_flagged(self, undocumented_fields_project):
        issues = check_field_documentation(undocumented_fields_project)
        assert len(issues) >= 1
        assert all(i.severity == Severity.INFO for i in issues)

    def test_hidden_fields_excluded(self, make_field, make_view, make_project):
        hidden = make_field("secret", hidden=True)  # no label/description — but hidden
        visible = make_field("id", primary_key=True, label="ID", description="Primary key")
        v = make_view("orders", fields=[hidden, visible])
        p = make_project(views=[v])
        issues = check_field_documentation(p)
        assert issues == []

    def test_filter_and_parameter_excluded(self, make_field, make_view, make_project):
        f1 = make_field("f1", field_type="filter")
        f2 = make_field("p1", field_type="parameter")
        pk = make_field("id", primary_key=True, label="ID", description="ID")
        v = make_view("orders", fields=[pk, f1, f2])
        p = make_project(views=[v])
        issues = check_field_documentation(p)
        assert issues == []

    def test_one_issue_per_view_not_per_field(self, undocumented_fields_project):
        """Field docs produces one summary Issue per view, not one per field."""
        issues = check_field_documentation(undocumented_fields_project)
        assert len(issues) == 1


# ═══════════════════════════════════════════════════════════════════════════
# check_orphans
# ═══════════════════════════════════════════════════════════════════════════

class TestOrphans:

    def test_clean_project_no_orphan_issues(self, clean_project):
        issues = check_orphans(clean_project)
        orphan = [i for i in issues if "orphaned" in i.message]
        assert orphan == []

    def test_empty_project_no_issues(self, empty_project):
        assert check_orphans(empty_project) == []

    def test_unreferenced_view_is_info(self, orphan_view_project):
        issues = check_orphans(orphan_view_project)
        orphans = [i for i in issues if "orphaned" in i.message]
        assert len(orphans) >= 1
        assert all(i.severity == Severity.INFO for i in orphans)

    def test_referenced_view_not_flagged(self, orphan_view_project):
        issues = check_orphans(orphan_view_project)
        names = [i.object_name for i in issues if "orphaned" in i.message]
        assert "orders" not in names

    def test_extends_view_not_orphan(self, extends_project):
        issues = check_orphans(extends_project)
        orphans = [i for i in issues if "orphaned" in i.message and i.object_name == "base_view"]
        assert orphans == []

    def test_zombie_explore_flagged(self, make_explore, make_project):
        e = make_explore("ghost", from_view="non_existent")
        p = make_project(views=[], explores=[e])
        issues = check_orphans(p)
        zombie = [i for i in issues if "broken" in i.message.lower() or "does not exist" in i.message]
        assert len(zombie) >= 1


# ═══════════════════════════════════════════════════════════════════════════
# run_all_checks
# ═══════════════════════════════════════════════════════════════════════════

class TestRunAllChecks:

    def test_clean_project_minimal_issues(self, clean_project):
        issues = run_all_checks(clean_project)
        errors = [i for i in issues if i.severity == Severity.ERROR]
        assert errors == []

    def test_empty_project_no_issues(self, empty_project):
        issues = run_all_checks(empty_project)
        assert issues == []

    def test_broken_project_has_errors(self, broken_refs_project):
        issues = run_all_checks(broken_refs_project)
        assert any(i.severity == Severity.ERROR for i in issues)

    def test_returns_list_of_issue_objects(self, clean_project):
        from validators.issue import Issue
        issues = run_all_checks(clean_project)
        assert all(isinstance(i, Issue) for i in issues)


# ═══════════════════════════════════════════════════════════════════════════
# compute_health_score
# ═══════════════════════════════════════════════════════════════════════════

class TestHealthScore:

    def test_clean_project_scores_high(self, clean_project):
        issues = run_all_checks(clean_project)
        score = compute_health_score(issues, clean_project)
        assert score >= 85

    def test_empty_project_scores_100(self, empty_project):
        issues = run_all_checks(empty_project)
        score = compute_health_score(issues, empty_project)
        assert score == 100

    def test_score_bounded_0_to_100(self, broken_refs_project):
        issues = run_all_checks(broken_refs_project)
        score = compute_health_score(issues, broken_refs_project)
        assert 0 <= score <= 100

    def test_score_decreases_with_errors(self, clean_project, broken_refs_project):
        clean_issues   = run_all_checks(clean_project)
        broken_issues  = run_all_checks(broken_refs_project)
        clean_score    = compute_health_score(clean_issues, clean_project)
        broken_score   = compute_health_score(broken_issues, broken_refs_project)
        assert broken_score <= clean_score

    def test_breaking_errors_cap_score(self, make_view, make_explore, make_project):
        """5+ breaking errors must cap score at 70."""
        explores = [
            make_explore(f"ghost_{i}", from_view=f"missing_{i}")
            for i in range(6)
        ]
        p = make_project(views=[], explores=explores)
        issues = run_all_checks(p)
        score = compute_health_score(issues, p)
        assert score <= 70

    def test_fallback_mode_no_project(self):
        """compute_health_score without project arg uses fallback penalty."""
        from validators.issue import Issue, IssueCategory, Severity
        issues = [
            Issue(category=IssueCategory.BROKEN_REFERENCE, severity=Severity.ERROR,
                  message="x", object_type="explore", object_name="x")
        ]
        score = compute_health_score(issues)
        assert 0 <= score <= 100

    def test_returns_integer(self, clean_project):
        issues = run_all_checks(clean_project)
        score = compute_health_score(issues, clean_project)
        assert isinstance(score, int)


# ═══════════════════════════════════════════════════════════════════════════
# compute_category_scores
# ═══════════════════════════════════════════════════════════════════════════

class TestCategoryScores:

    def test_returns_all_four_categories(self, clean_project):
        issues = run_all_checks(clean_project)
        scores = compute_category_scores(issues, clean_project)
        assert "Broken Reference" in scores
        assert "Duplicate View Source" in scores
        assert "Duplicate Field SQL" in scores
        assert "Join Integrity" in scores
        assert "Field Quality" in scores

    def test_scores_bounded_0_to_100(self, broken_refs_project):
        issues = run_all_checks(broken_refs_project)
        scores = compute_category_scores(issues, broken_refs_project)
        for v in scores.values():
            assert 0 <= v <= 100

    def test_clean_project_high_scores(self, clean_project):
        issues = run_all_checks(clean_project)
        scores = compute_category_scores(issues, clean_project)
        assert scores["Broken Reference"] >= 90
        assert scores["Join Integrity"] >= 90


# ═══════════════════════════════════════════════════════════════════════════
# get_health_status — label boundaries must match frontend scoreMeta()
# ═══════════════════════════════════════════════════════════════════════════

class TestGetHealthStatus:
    """
    Thresholds: >=90 Healthy | >=80 Good | >=70 Needs Attention | else Critical
    These MUST stay in sync with frontend utils.js scoreMeta() boundaries.
    """

    def test_100_is_healthy(self):
        from validators import get_health_status
        assert get_health_status(100) == "Healthy"

    def test_90_is_healthy(self):
        from validators import get_health_status
        assert get_health_status(90) == "Healthy"

    def test_89_is_good(self):
        from validators import get_health_status
        assert get_health_status(89) == "Good"

    def test_80_is_good(self):
        from validators import get_health_status
        assert get_health_status(80) == "Good"

    def test_79_is_needs_attention(self):
        from validators import get_health_status
        assert get_health_status(79) == "Needs Attention"

    def test_70_is_needs_attention(self):
        from validators import get_health_status
        assert get_health_status(70) == "Needs Attention"

    def test_69_is_critical(self):
        from validators import get_health_status
        assert get_health_status(69) == "Critical"

    def test_0_is_critical(self):
        from validators import get_health_status
        assert get_health_status(0) == "Critical"

    def test_all_labels_are_valid_strings(self):
        from validators import get_health_status
        valid = {"Healthy", "Good", "Needs Attention", "Critical"}
        for score in range(0, 101, 5):
            assert get_health_status(score) in valid

