export const RULES = [
  {
    id: 'missing_label',
    title: 'Missing Field Label',
    severity: 'warning',
    category: 'Field Quality',
    description: 'Dimension or measure has no label defined. Users see the raw field name in the UI instead of a human-readable label.',
    badExample: `dimension: customer_id {
  type: number
  sql: \${TABLE}.id ;;
}`,
    goodExample: `dimension: customer_id {
  type: number
  label: "Customer ID"
  sql: \${TABLE}.id ;;
}`,
  },
  {
    id: 'missing_description',
    title: 'Missing Field Description',
    severity: 'warning',
    category: 'Field Quality',
    description: 'Field has no description. Self-service users cannot understand what this field represents without tribal knowledge.',
    badExample: `measure: total_revenue {
  type: sum
  sql: \${TABLE}.revenue ;;
}`,
    goodExample: `measure: total_revenue {
  type: sum
  label: "Total Revenue"
  description: "Sum of all confirmed order revenue"
  sql: \${TABLE}.revenue ;;
}`,
  },
  {
    id: 'missing_primary_key',
    title: 'Missing Primary Key',
    severity: 'warning',
    category: 'Field Quality',
    description: 'View has no dimension with primary_key: yes. Looker cannot perform fanout detection without a declared primary key, which can silently inflate aggregated metrics.',
    badExample: `view: orders {
  dimension: id {
    type: number
    sql: \${TABLE}.id ;;
  }
}`,
    goodExample: `view: orders {
  dimension: id {
    type: number
    primary_key: yes
    sql: \${TABLE}.id ;;
  }
}`,
  },
  {
    id: 'broken_view_reference',
    title: 'Broken View Reference',
    severity: 'error',
    category: 'Broken Reference',
    description: 'An explore join references a view name that does not exist anywhere in the project. This causes the explore to fail to load entirely.',
    badExample: `explore: orders {
  join: missing_view {
    type: left_outer
    relationship: many_to_one
  }
}`,
    goodExample: `explore: orders {
  join: customers {
    type: left_outer
    relationship: many_to_one
    sql_on: \${orders.customer_id} = \${customers.id} ;;
  }
}`,
  },
  {
    id: 'duplicate_view_source',
    title: 'Duplicate View Source',
    severity: 'warning',
    category: 'Duplicate View Source',
    description: 'Two view files reference the same sql_table_name. This creates confusion about which view to use and can cause unexpected query results.',
    badExample: `# view_a.view.lkml
view: orders_v1 {
  sql_table_name: public.orders ;;
}

# view_b.view.lkml  ← SAME TABLE!
view: orders_v2 {
  sql_table_name: public.orders ;;
}`,
    goodExample: `# Single canonical view per table:
view: orders {
  sql_table_name: public.orders ;;
  # ... all fields
}`,
  },
  {
    id: 'duplicate_field_sql',
    title: 'Duplicate Field SQL',
    severity: 'warning',
    category: 'Duplicate Field SQL',
    description: 'Two dimensions or measures within the same view share identical SQL expressions. One is likely redundant and should be removed.',
    badExample: `view: orders {
  dimension: revenue {
    type: number
    sql: \${TABLE}.revenue ;;
  }
  dimension: revenue_copy {  # ← redundant
    type: number
    sql: \${TABLE}.revenue ;;
  }
}`,
    goodExample: `view: orders {
  dimension: revenue {
    type: number
    label: "Revenue"
    sql: \${TABLE}.revenue ;;
  }
  # Only one definition per SQL column
}`,
  },
  {
    id: 'join_missing_sql_on',
    title: 'Join Missing sql_on',
    severity: 'error',
    category: 'Join Integrity',
    description: 'A join in an explore has no sql_on or foreign_key defined. Without a join condition, Looker produces a Cartesian product which can return billions of rows.',
    badExample: `join: orders {
  type: left_outer
  relationship: many_to_one
  # missing sql_on — this is a cross join!
}`,
    goodExample: `join: orders {
  type: left_outer
  relationship: many_to_one
  sql_on: \${users.id} = \${orders.user_id} ;;
}`,
  },
  {
    id: 'orphan_view',
    title: 'Orphaned View',
    severity: 'info',
    category: 'Field Quality',
    description: 'View is defined but never joined into any explore. It adds unnecessary parse overhead on every project load and is invisible to end users.',
    badExample: `# never_used.view.lkml
view: never_used {
  sql_table_name: public.temp ;;
  # ... 40 fields nobody can access
}`,
    goodExample: `# Option 1: Delete it entirely.
# Option 2: Expose it through an explore:
explore: main {
  join: never_used {
    relationship: many_to_one
    sql_on: \${main.id} = \${never_used.id} ;;
  }
}`,
  },
  {
    id: 'fanout_risk',
    title: 'Potential Fanout Risk',
    severity: 'warning',
    category: 'Join Integrity',
    description: 'Join is missing a relationship declaration. Without it, Looker cannot warn about fan-out and aggregated metrics may be silently inflated.',
    badExample: `join: order_items {
  type: left_outer
  sql_on: \${orders.id} = \${order_items.order_id} ;;
  # missing relationship: — revenue will be 3x inflated
}`,
    goodExample: `join: order_items {
  type: left_outer
  relationship: one_to_many
  sql_on: \${orders.id} = \${order_items.order_id} ;;
}`,
  },
];
