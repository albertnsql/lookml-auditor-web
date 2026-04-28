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

            # 2. Skip if hidden: often used for intermediate calculations or internal logic
            if getattr(field, 'hidden', False):
                continue

            # 3. Skip if it belongs to a dimension_group: timeframe fields share base SQL by design
            # (Note: already handled by only allowing "dimension" and "measure" above)

            norm = _normalise_sql(field.sql)
            if len(norm) < 5 or norm in SKIP:
                continue

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

                bucket_names = [f.name for f in bucket]
                field_details = []
                for f in bucket:
                    detail = f"'{f.name}' ({_field_kind(f)})"
                    vf = getattr(f, 'value_format', None) or ""
                    if vf:
                        detail += f" [format: {vf}]"
                    field_details.append(detail)
                
                detail_str = ", ".join(field_details)

                issues.append(Issue(
                    category=IssueCategory.DUPLICATE,
                    severity=Severity.WARNING,
                    message=(
                        f"Duplicate SQL in view '{view.name}': {detail_str} share identical SQL."
                    ),
                    object_type="field",
                    object_name=f"{view.name}.*",
                    source_file=view.source_file,
                    line_number=view.line_number,
                    suggestion=(
                        f"Fields {', '.join(repr(n) for n in bucket_names)} in view '{view.name}' "
                        "share the same SQL expression. If intentional (e.g. different value formats), "
                        "add a comment to document the intent. Otherwise remove the redundant definition."
                    ),
                ))

    return issues

