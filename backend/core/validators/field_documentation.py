"""
Validator: Field Documentation Quality
----------------------------------------
Flags fields that are missing label or description.
Hidden fields are excluded. Only dimensions, dimension_groups, and measures checked.
"""
from __future__ import annotations
from lookml_parser.models import LookMLProject
from .issue import Issue, IssueCategory, Severity


def check_field_documentation(project: LookMLProject) -> list[Issue]:
    issues = []
    ELIGIBLE = {"dimension", "dimension_group", "measure"}

    for view in project.views:
        missing_label  = []
        missing_desc   = []

        for field in view.fields:
            if field.hidden or field.field_type not in ELIGIBLE:
                continue
            
            missing_items = []
            if not field.label:
                missing_items.append("label")
            if not field.description:
                missing_items.append("description")
                
            if missing_items:
                issues.append(Issue(
                    category=IssueCategory.FIELD_QUALITY,
                    severity=Severity.INFO,
                    message=f"Field '{field.name}' in view '{view.name}' is missing {', '.join(missing_items)}",
                    object_type="field",
                    object_name=f"{view.name}.{field.name}",
                    source_file=view.source_file,
                    line_number=field.line_number,
                    suggestion=f"Add {', '.join(missing_items)} to improve Looker UI discoverability.",
                    fix_payload={
                        "line_number": field.line_number + 1,
                        "insert_text": "".join([
                            f"    label: \"{field.name.replace('_', ' ').title()}\"\n" if "label" in missing_items else "",
                            f"    description: \"{field.name.replace('_', ' ').title()} description\"\n" if "description" in missing_items else ""
                        ]).rstrip("\n"),
                        "replace_lines": 0
                    }
                ))

    return issues
