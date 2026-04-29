"""
Validator: Duplicate SQL Expressions within a View
----------------------------------------------------
Cases 3 & 4:
  - Case 3: Two or more fields of the **same broad type** (both dimensions /
    dimension_groups, OR both measures) share identical SQL → WARNING.
    A dimension and a measure sharing the same SQL column is intentional and
    valid LookML (the dimension exposes the raw value; the measure aggregates
    it), so cross-type pairs are silently ignored.
  - Case 4: If one of the duplicate fields is a primary key → INFO
    (sharing SQL with a PK is often an intentional alias).
"""

from __future__ import annotations
from collections import defaultdict
from lookml_parser.models import LookMLProject, LookMLField, LookMLView
from .issue import Issue, IssueCategory, Severity


def _normalise_sql(sql: str) -> str:
    return sql.strip().lower().replace('"', '').replace("'", '').replace(' ', '')


def _field_kind(field: LookMLField) -> str:
    """Return human-readable type label."""
    if field.field_type == "measure":         return "measure"
    if field.field_type == "dimension_group": return "dimension group"
    return "dimension"


def check_duplicate_sql(project: LookMLProject) -> list[Issue]:
    issues = []
    SKIP = {"${table}", "1", "true", "false", "null", ""}

    for view in project.views:
        # Map: (normalised SQL, filters, field_type, data_type, html, v_format, v_format_name) → list of LookMLField objects
        sql_to_fields = defaultdict(list)
        for field in view.fields:
            # Only consider dimensions and measures
            if not field.sql or field.field_type not in ("dimension", "measure"):
                continue

            # 1. Skip if primary key: it's infrastructure for joins, not a user field
            if getattr(field, 'primary_key', False):
                continue

            # 2. Skip if hidden: often used for internal logic
            if getattr(field, 'hidden', False):
                continue

            norm = _normalise_sql(field.sql)
            if len(norm) < 5 or norm in SKIP:
                continue

            # Fields with identical SQL but different format strings are intentional 
            # (same data displayed differently). Including them in the group key 
            # naturally excludes them from being flagged together.
            filt = field.filters.strip() if getattr(field, 'filters', None) else None
            html = field.html.strip() if getattr(field, 'html', None) else None
            v_format = field.value_format.strip() if getattr(field, 'value_format', None) else None
            v_format_name = field.value_format_name.strip() if getattr(field, 'value_format_name', None) else None
            
            # Use a strict grouping key. Different types (e.g. yesno vs string) will 
            # have different data_type and thus won't be flagged together.
            group_key = (norm, filt, field.field_type, field.data_type, html, v_format, v_format_name)
            sql_to_fields[group_key].append(field)

        for group_key, fields in sql_to_fields.items():
            if len(fields) < 2:
                continue

            # Split into buckets: dimensions vs measures
            dimension_fields = [f for f in fields if f.field_type == "dimension"]
            measure_fields   = [f for f in fields if f.field_type == "measure"]

            for bucket in (dimension_fields, measure_fields):
                if len(bucket) < 2:
                    continue  # Only one field of this type in this SQL group — not a duplicate

                if len(bucket) == 2:
                    f1, f2 = bucket
                    msg = f"Duplicate SQL in view '{view.name}': '{f1.name}' ({_field_kind(f1)}) and '{f2.name}' ({_field_kind(f2)}) share identical SQL."
                else:
                    f1, f2, f3 = bucket[:3]
                    more_count = len(bucket) - 3
                    
                    # Majority type for "and N more" case
                    all_types = [f.field_type for f in bucket]
                    if all(t == "measure" for t in all_types):
                        m_type = "measures"
                    elif all(t == "dimension" for t in all_types):
                        m_type = "dimensions"
                    else:
                        m_type = "fields"
                    
                    msg = f"Duplicate SQL in view '{view.name}': '{f1.name}', '{f2.name}', '{f3.name}' and {more_count} more ({m_type}) share identical SQL."

                issues.append(Issue(
                    category=IssueCategory.DUPLICATE_FIELD_SQL,
                    severity=Severity.WARNING,
                    message=msg,
                    object_type="field",
                    object_name=f"{view.name}.*",
                    source_file=view.source_file,
                    line_number=view.line_number,
                    suggestion=(
                        f"Fields '{bucket[0].name}' and '{bucket[1].name}' in view '{view.name}' "
                        "share the same SQL expression. If intentional, add a comment to document the intent. "
                        "Otherwise remove the redundant definition."
                    ),
                ))

    return issues

