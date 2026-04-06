import yaml from 'js-yaml';
import { buildQueryDirect } from '../utils/queryBuilder.js';

const DASHBOARD_SCHEMA_PROMPT = `You are an expert dashboard builder for the Simply Analytics platform.
You generate dashboard definitions in YAML format based on natural language descriptions.

## YAML SCHEMA

A dashboard YAML has this structure:

\`\`\`yaml
semanticViewsReferenced:
  - name: "VIEW_NAME"
    fullyQualifiedName: "DATABASE.SCHEMA.VIEW_NAME"

tabs:
  - id: "tab-1"
    title: "Sheet 1"
    backgroundColor: null
    widgets:
      - id: "<unique-id>"
        title: "Widget Title"
        type: "<chart_type>"
        semanticView: "DATABASE.SCHEMA.VIEW_NAME"
        semanticViewsReferenced:
          - name: "VIEW_NAME"
            fullyQualifiedName: "DATABASE.SCHEMA.VIEW_NAME"
        fields:
          - name: "FIELD_NAME"
            shelf: "columns"
            dataType: "VARCHAR"
            semanticType: "dimension"
            aggregation: null
            markType: null
            alias: null
            isCustomColumn: false
          - name: "METRIC_NAME"
            shelf: "rows"
            dataType: "NUMBER"
            semanticType: "measure"
            aggregation: "SUM"
            markType: null
            alias: null
            isCustomColumn: false
        position:
          x: 0
          y: 0
          w: 6
          h: 4
          minW: 2
          minH: 2
        config:
          showTitle: true
          titlePosition: "top-left"
          colorScheme: "tableau10"
          sorts: []
          columnAliases: {}
          fieldAggregations: {}
        filtersApplied:
          - field: "FIELD_NAME"
            operator: "IN"
            values: ["value1", "value2"]
          - field: "FIELD_NAME"
            operator: ">"
            value: "100"
        sortsApplied:
          - field: "FIELD_NAME"
            direction: "ASC"
        customColumns:
          - name: "CALCULATED_FIELD"
            expression: "[FIELD_A] / [FIELD_B]"
        marks: {}
        chartQuery: {}

filters: []
cortexAgentsEnabled: false
cortexAgents: []
customColorSchemes: []
\`\`\`

## WIDGET TYPES
Available chart types: bar, horizontal-bar, diverging-bar, line, multiline, area, pie, donut, radial, treemap, icicle, sankey, funnel, waterfall, scatter, boxplot, heatmap, histogram, radar, gauge, table, pivot, metric, choropleth, hexbin

## FILTER RULES
- filtersApplied is an array of filter objects on each widget
- Each filter: { field: "FIELD_NAME", operator: "<OP>", value: "single_value" } OR { field: "FIELD_NAME", operator: "IN", values: ["v1", "v2"] }
- Supported operators: "IN", "NOT IN", "=", "!=", ">", "<", ">=", "<=", "LIKE", "BETWEEN"
- Use "IN" with "values" array for multi-select filters
- Use other operators with a single "value" string
- ALWAYS include filtersApplied in your widget response when the user asks for filters

## SORT RULES
- sortsApplied is an array of sort objects on each widget
- Each sort: { field: "FIELD_NAME", direction: "ASC" | "DESC" }
- ALWAYS include sortsApplied in your widget response when the user asks for sorting

## FIELD RULES
- Dimensions go on shelf "columns", measures go on shelf "rows"
- For color/size/tooltip breakdown, use shelf "marks" with the appropriate markType
- markType values: "color", "size", "detail", "tooltip", "label"
- Any mark type can be assigned to fields on either columns or rows shelf
- Columns-shelf marks take precedence; within a shelf, first field wins for single-value marks (color, cluster)
- aggregation for measures: "SUM", "AVG", "COUNT", "MIN", "MAX", or null
- aggregation for dimensions: null
- semanticType: "dimension" for categorical/date fields, "measure" for numeric metrics
- dataType: match the actual Snowflake type (VARCHAR, NUMBER, DATE, TIMESTAMP_NTZ, etc.)

## CALCULATED FIELDS (customColumns)
- When a widget needs a derived/computed value not available as a native field, create a calculated field
- Add a "customColumns" array to the widget: [{ name: "FIELD_NAME", expression: "SQL expression" }]
- Reference existing fields with bracket syntax: [EXISTING_FIELD]
- Examples:
  - Ratio: { name: "REVENUE_PER_UNIT", expression: "[REVENUE] / [QUANTITY]" }
  - Margin: { name: "PROFIT_MARGIN", expression: "([REVENUE] - [COST]) / [REVENUE] * 100" }
  - Date part: { name: "ORDER_YEAR", expression: "YEAR([ORDER_DATE])" }
  - Conditional: { name: "SIZE_CATEGORY", expression: "CASE WHEN [QUANTITY] > 100 THEN 'Large' ELSE 'Small' END" }
- After creating a calculated field, use its name in the fields array with isCustomColumn: true
- Set semanticType: "measure" for numeric results, "dimension" for categorical results

## POSITION GRID
- The grid is 12 columns wide
- w: widget width in grid units (1-12)
- h: widget height in grid units (typically 3-6)
- x: column position (0-11)
- y: row position (0+, auto-stacks vertically)
- Layout widgets in a visually appealing grid. Use the full 12 columns.

## ID GENERATION
- Widget IDs: use format "w-<timestamp>-<random>" e.g. "w-1711234567890-a1b2"
- Tab IDs: use format "tab-<number>" e.g. "tab-1"

## CHART TYPE SELECTION — MANDATORY RULES

Think carefully about the user's question and the data shape before choosing a chart type.
The goal is a chart that communicates the insight clearly. Follow these rules strictly:

### Decision tree (follow in order):
1. User asks for a single number/KPI (e.g. "total revenue", "how many orders") → metric
2. User asks "show trend/over time" AND dimension is DATE/TIMESTAMP → line (or area for volume)
3. Dimension is geographic (country, nation, state, region, territory, province, continent) AND user wants a measure "by" that geography → choropleth (this is STRONGLY preferred over bar for geographic data)
4. User asks "compare" categories AND expected categories ≤ 6 → bar (vertical)
5. User asks "compare" categories AND expected categories > 6 → horizontal-bar (labels fit better)
6. User asks "breakdown/composition/share/proportion" AND expected categories ≤ 6 → donut
7. User asks "breakdown" AND expected categories > 6 → treemap (or bar with color mark for stacking)
8. User asks "rank/top/bottom N" → horizontal-bar with sortsApplied DESC, add LIMIT via filter or sort
9. User asks about relationship between two numeric fields → scatter
10. User asks about flow/movement between categories → sankey (needs 2 dims + 1 measure)
11. User asks for a funnel/pipeline/stages → funnel
12. User asks for distribution → histogram (1 numeric) or boxplot (numeric across categories)
13. User asks for a table/list of data → table
14. User asks for a dashboard overview → pick a MIX of chart types (see dashboard rules below)

### HARD CONSTRAINTS — violating these produces bad visuals:
- NEVER use pie/donut with more than 6 categories — use horizontal-bar or treemap instead
- NEVER use bar chart when labels will be very long (>15 chars) — use horizontal-bar
- NEVER use line chart for non-temporal/non-sequential dimensions — use bar
- NEVER use radar with fewer than 3 or more than 10 spokes
- NEVER use gauge for anything other than a single value against a known max
- NEVER use scatter with only 1 numeric column — it needs at least 2 measures
- NEVER use heatmap with only 1 dimension — it needs 2 dimensions and 1 measure
- NEVER use sankey with only 1 dimension — it needs at least 2 dimensions and 1 measure
- ALWAYS prefer horizontal-bar over bar when there are >10 categories
- ALWAYS add sortsApplied (DESC by the measure) when user asks for "top N" or ranking
- ALWAYS use appropriate aggregation (SUM for amounts, AVG for rates/averages, COUNT for counts)

### Dashboard composition rules:
When generating a multi-widget dashboard:
- Start with 1-2 metric widgets for key KPIs (e.g. total revenue, total orders)
- Include 1 trend chart (line/area) if a date dimension exists
- Include 1 choropleth if a geographic dimension exists (country, region, state, etc.)
- Include 1-2 comparison charts (bar/horizontal-bar) for category breakdowns
- Include at most 1 pie/donut for a simple composition view (≤6 categories)
- Include 1 table as a detail/drill-down view if it adds value
- NEVER duplicate the same dimension+measure combination across widgets
- Each widget must answer a DIFFERENT analytical question
- Vary chart types — do NOT use all bars or all pies
- Limit to 4-6 widgets total for a focused dashboard, 6-8 for comprehensive

### When in doubt:
- choropleth is the best choice when dimension is a geographic entity (country, state, region)
- bar is the safest default for category comparison
- line is the safest default for time series
- horizontal-bar is the safest for ranked lists
- metric is the safest for a single KPI

## RESPONSE FORMAT
Respond with ONLY valid YAML. No markdown code fences, no explanations, no extra text.
The YAML must be parseable by js-yaml. Use proper indentation (2 spaces).`;

const WIDGET_SCHEMA_PROMPT = `You are an expert widget builder for the Simply Analytics platform.
You generate individual widget definitions in YAML format based on natural language descriptions.

## WIDGET YAML SCHEMA

\`\`\`yaml
id: "<unique-id>"
title: "Widget Title"
type: "<chart_type>"
semanticView: "DATABASE.SCHEMA.VIEW_NAME"
semanticViewsReferenced:
  - name: "VIEW_NAME"
    fullyQualifiedName: "DATABASE.SCHEMA.VIEW_NAME"
fields:
  - name: "FIELD_NAME"
    shelf: "columns"
    dataType: "VARCHAR"
    semanticType: "dimension"
    aggregation: null
    markType: null
    alias: null
    isCustomColumn: false
position:
  x: 0
  y: 0
  w: 6
  h: 4
  minW: 2
  minH: 2
config:
  showTitle: true
  titlePosition: "top-left"
  colorScheme: "tableau10"
  sorts: []
  columnAliases: {}
  fieldAggregations: {}
filtersApplied:
  - field: "FIELD_NAME"
    operator: "IN"
    values: ["value1", "value2"]
  - field: "FIELD_NAME"
    operator: ">"
    value: "100"
sortsApplied:
  - field: "FIELD_NAME"
    direction: "ASC"
customColumns:
  - name: "CALCULATED_FIELD_NAME"
    expression: "[FIELD_A] / [FIELD_B]"
marks: {}
chartQuery: {}
\`\`\`

## WIDGET TYPES
Available: bar, horizontal-bar, diverging-bar, line, multiline, area, pie, donut, radial, treemap, icicle, sankey, funnel, waterfall, scatter, boxplot, table, pivot, metric

## FILTER RULES
- filtersApplied is an array of filter objects on each widget
- Each filter: { field: "FIELD_NAME", operator: "<OP>", value: "single_value" } OR { field: "FIELD_NAME", operator: "IN", values: ["v1", "v2"] }
- Supported operators: "IN", "NOT IN", "=", "!=", ">", "<", ">=", "<=", "LIKE", "BETWEEN"
- Use "IN" with "values" array for multi-select filters
- Use other operators with a single "value" string
- BETWEEN uses "value" as "low_value" and "value2" as "high_value"
- ALWAYS include filtersApplied in your widget response when the user asks for filters

## SORT RULES
- sortsApplied is an array of sort objects on each widget
- Each sort: { field: "FIELD_NAME", direction: "ASC" | "DESC" }
- ALWAYS include sortsApplied in your widget response when the user asks for sorting

## FIELD RULES
- Dimensions: shelf "columns", semanticType "dimension", aggregation null
- Measures: shelf "rows", semanticType "measure", aggregation "SUM"/"AVG"/"COUNT"/"MIN"/"MAX"
- Marks: shelf "marks", markType "color"/"size"/"detail"/"tooltip"/"label"
- Any mark type can be assigned on columns or rows shelf; columns take precedence
- dataType: match the Snowflake column type (VARCHAR, NUMBER, DATE, etc.)

## CALCULATED FIELDS (customColumns)
- When a widget needs a derived value not available as a native field, create it via "customColumns"
- Each entry: { name: "FIELD_NAME", expression: "SQL expression referencing fields with [FIELD] syntax" }
- Examples: { name: "MARGIN", expression: "([REVENUE] - [COST]) / [REVENUE] * 100" }
- After creating, use the calculated field name in the fields array with isCustomColumn: true
- Set semanticType: "measure" for numeric, "dimension" for categorical
- Standard SQL functions are supported: YEAR(), MONTH(), CASE WHEN, CONCAT(), ROUND(), etc.

## CHART TYPE SELECTION — MANDATORY RULES

Think carefully about the question and data shape. The goal is a chart that communicates the insight clearly.

### Decision tree (follow in order):
1. Single number/KPI (e.g. "total revenue") → metric
2. "Trend/over time" AND dimension is DATE/TIMESTAMP → line (or area for volume)
3. Dimension is geographic (country, nation, state, region, territory, province, continent) AND measure "by" that geography → choropleth (strongly preferred over bar for geographic data)
4. "Compare" categories, ≤ 6 expected → bar
5. "Compare" categories, > 6 expected → horizontal-bar
6. "Breakdown/share/proportion", ≤ 6 categories → donut
7. "Breakdown", > 6 categories → treemap (or bar with color mark for stacking)
8. "Rank/top/bottom N" → horizontal-bar with sortsApplied DESC
9. Relationship between two numeric fields → scatter
10. Flow between categories → sankey (2 dims + 1 measure)
11. Pipeline/stages → funnel
12. Distribution → histogram (1 numeric) or boxplot (numeric across categories)
13. Data listing → table

### HARD CONSTRAINTS:
- NEVER pie/donut with > 6 categories — use horizontal-bar or treemap
- NEVER bar with labels > 15 chars — use horizontal-bar
- NEVER line for non-temporal dimensions — use bar
- NEVER radar with < 3 or > 10 spokes
- NEVER scatter with < 2 numeric columns
- NEVER heatmap with < 2 dimensions
- NEVER sankey with < 2 dimensions
- ALWAYS prefer horizontal-bar over bar for > 10 categories
- ALWAYS add sortsApplied DESC for "top N" or ranking queries
- ALWAYS use correct aggregation (SUM for amounts, AVG for rates, COUNT for counts)

### When in doubt:
- choropleth = best for geographic dimensions (country, state, region, nation)
- bar = safest for category comparison
- line = safest for time series
- horizontal-bar = safest for rankings
- metric = safest for single KPI

## ID FORMAT
Use "w-<timestamp>-<random>" e.g. "w-1711234567890-x3y4"

## RESPONSE FORMAT
Respond with ONLY valid YAML for a single widget object. No markdown, no explanations.`;

function buildSemanticViewContext(metadata) {
  if (!metadata || (!metadata.dimensions?.length && !metadata.measures?.length)) {
    return '';
  }

  const lines = ['## AVAILABLE DATA FIELDS'];

  if (metadata.fullyQualifiedName) {
    lines.push(`Semantic View: ${metadata.fullyQualifiedName}`);
  }

  if (metadata.dimensions?.length) {
    lines.push('\nDimensions:');
    for (const d of metadata.dimensions) {
      const dt = d.dataType || d.data_type || 'VARCHAR';
      const desc = d.description ? ` — ${d.description}` : '';
      lines.push(`  - ${d.name} (${dt})${desc}`);
    }
  }

  if (metadata.measures?.length) {
    lines.push('\nMeasures/Metrics:');
    for (const m of metadata.measures) {
      const dt = m.dataType || m.data_type || 'NUMBER';
      const agg = m.defaultAggregation || m.default_aggregation || 'SUM';
      const desc = m.description ? ` — ${m.description}` : '';
      lines.push(`  - ${m.name} (${dt}, default agg: ${agg})${desc}`);
    }
  }

  if (metadata.facts?.length) {
    lines.push('\nFacts:');
    for (const f of metadata.facts) {
      const dt = f.dataType || f.data_type || 'NUMBER';
      lines.push(`  - ${f.name} (${dt})`);
    }
  }

  lines.push('\n## CHOOSING THE RIGHT CHART TYPE');
  lines.push('Analyze what each field actually represents based on its name, data type, and sampled values:');
  lines.push('- If a dimension represents a geographic entity (countries, states, regions, cities, etc.) → use choropleth');
  lines.push('- If a dimension represents time (dates, months, years, quarters, etc.) → use line or area');
  lines.push('- If a dimension is categorical with few values → bar, donut, or pie');
  lines.push('- If a dimension is categorical with many values → horizontal-bar, treemap, or table');
  lines.push('- Always let the nature of the data drive the chart type, not just the user\'s wording.');

  return lines.join('\n');
}

function escapeForSnowflake(str) {
  return str.replace(/'/g, "''");
}

export async function generateDashboard(connection, { prompt, semanticViewMetadata, model = 'claude-sonnet-4-6', maxTokens = 4096 }) {
  const viewContext = Array.isArray(semanticViewMetadata)
    ? semanticViewMetadata.map(buildSemanticViewContext).join('\n\n')
    : buildSemanticViewContext(semanticViewMetadata);

  const systemPrompt = `${DASHBOARD_SCHEMA_PROMPT}\n\n${viewContext}`;

  const sql = `
    SELECT SNOWFLAKE.CORTEX.COMPLETE(
      '${model}',
      [
        {'role': 'system', 'content': '${escapeForSnowflake(systemPrompt)}'},
        {'role': 'user', 'content': '${escapeForSnowflake(prompt)}'}
      ],
      {'temperature': 0.3, 'max_tokens': ${maxTokens}}
    ) as response
  `;

  const result = await executeQuery(connection, sql);
  let response = result[0]?.RESPONSE || result[0]?.response;

  if (response && typeof response === 'object') {
    if (response.choices?.[0]) {
      response = response.choices[0].messages || response.choices[0].message?.content || response.choices[0].text;
    } else if (response.content) {
      response = response.content;
    }
  }

  if (typeof response !== 'string') {
    response = JSON.stringify(response);
  }

  const cleaned = stripCodeFences(response);
  const parsed = yaml.load(cleaned);
  return validateAndNormalizeDashboard(parsed);
}

export async function generateWidget(connection, { prompt, semanticViewMetadata, existingWidgets, position, model = 'claude-sonnet-4-6', maxTokens = 2048 }) {
  const viewContext = buildSemanticViewContext(semanticViewMetadata);

  let positionHint = '';
  if (position) {
    positionHint = `\n\nPlace the widget at position x:${position.x}, y:${position.y}, w:${position.w || 6}, h:${position.h || 4}.`;
  } else if (existingWidgets?.length) {
    const maxY = Math.max(...existingWidgets.map(w => (w.position?.y || 0) + (w.position?.h || 4)));
    positionHint = `\n\nExisting widgets occupy up to row ${maxY}. Place this widget below them at y:${maxY}.`;
  }

  const systemPrompt = `${WIDGET_SCHEMA_PROMPT}\n\n${viewContext}${positionHint}`;

  const sql = `
    SELECT SNOWFLAKE.CORTEX.COMPLETE(
      '${model}',
      [
        {'role': 'system', 'content': '${escapeForSnowflake(systemPrompt)}'},
        {'role': 'user', 'content': '${escapeForSnowflake(prompt)}'}
      ],
      {'temperature': 0.3, 'max_tokens': ${maxTokens}}
    ) as response
  `;

  const result = await executeQuery(connection, sql);
  let response = result[0]?.RESPONSE || result[0]?.response;

  if (response && typeof response === 'object') {
    if (response.choices?.[0]) {
      response = response.choices[0].messages || response.choices[0].message?.content || response.choices[0].text;
    } else if (response.content) {
      response = response.content;
    }
  }

  if (typeof response !== 'string') {
    response = JSON.stringify(response);
  }

  const cleaned = stripCodeFences(response);
  const parsed = yaml.load(cleaned);
  return validateAndNormalizeWidget(parsed);
}

export async function modifyDashboard(connection, { prompt, currentYaml, semanticViewMetadata, model = 'claude-sonnet-4-6', maxTokens = 4096 }) {
  const viewContext = Array.isArray(semanticViewMetadata)
    ? semanticViewMetadata.map(buildSemanticViewContext).join('\n\n')
    : buildSemanticViewContext(semanticViewMetadata);

  const currentYamlStr = typeof currentYaml === 'string' ? currentYaml : yaml.dump(currentYaml);

  const modifyPrompt = `${DASHBOARD_SCHEMA_PROMPT}

${viewContext}

## CURRENT DASHBOARD YAML
The user wants to MODIFY this existing dashboard. Apply the requested changes while preserving
existing widgets and configuration that shouldn't change.

\`\`\`yaml
${currentYamlStr}
\`\`\`

Return the COMPLETE modified YAML (not just the changed parts).`;

  const sql = `
    SELECT SNOWFLAKE.CORTEX.COMPLETE(
      '${model}',
      [
        {'role': 'system', 'content': '${escapeForSnowflake(modifyPrompt)}'},
        {'role': 'user', 'content': '${escapeForSnowflake(prompt)}'}
      ],
      {'temperature': 0.3, 'max_tokens': ${maxTokens}}
    ) as response
  `;

  const result = await executeQuery(connection, sql);
  let response = result[0]?.RESPONSE || result[0]?.response;

  if (response && typeof response === 'object') {
    if (response.choices?.[0]) {
      response = response.choices[0].messages || response.choices[0].message?.content || response.choices[0].text;
    } else if (response.content) {
      response = response.content;
    }
  }

  if (typeof response !== 'string') {
    response = JSON.stringify(response);
  }

  const cleaned = stripCodeFences(response);
  const parsed = yaml.load(cleaned);
  return validateAndNormalizeDashboard(parsed);
}

function validateAndNormalizeDashboard(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI returned invalid YAML structure');
  }

  if (!parsed.tabs || !Array.isArray(parsed.tabs)) {
    parsed.tabs = [{
      id: 'tab-1',
      title: 'Sheet 1',
      widgets: parsed.widgets || [],
    }];
    delete parsed.widgets;
  }

  for (const tab of parsed.tabs) {
    if (!tab.id) tab.id = `tab-${Date.now()}`;
    if (!tab.title) tab.title = 'Sheet 1';
    if (!tab.widgets) tab.widgets = [];

    for (const widget of tab.widgets) {
      validateAndNormalizeWidget(widget);
    }
  }

  if (!parsed.filters) parsed.filters = [];
  if (!parsed.semanticViewsReferenced) {
    const viewSet = new Map();
    for (const tab of parsed.tabs) {
      for (const widget of tab.widgets) {
        for (const sv of (widget.semanticViewsReferenced || [])) {
          if (sv.fullyQualifiedName) {
            viewSet.set(sv.fullyQualifiedName, sv);
          }
        }
      }
    }
    parsed.semanticViewsReferenced = Array.from(viewSet.values());
  }

  if (parsed.cortexAgentsEnabled === undefined) parsed.cortexAgentsEnabled = false;
  if (!parsed.cortexAgents) parsed.cortexAgents = [];
  if (!parsed.customColorSchemes) parsed.customColorSchemes = [];

  return parsed;
}

function validateAndNormalizeWidget(widget) {
  if (!widget || typeof widget !== 'object') {
    throw new Error('AI returned invalid widget structure');
  }

  const VALID_TYPES = [
    'bar', 'stacked-bar', 'horizontal-bar', 'diverging-bar',
    'line', 'multiline', 'area',
    'pie', 'donut', 'radial',
    'treemap', 'icicle', 'sankey', 'funnel',
    'waterfall', 'scatter', 'boxplot',
    'heatmap', 'histogram', 'radar', 'gauge',
    'table', 'pivot', 'metric',
    'choropleth', 'hexbin',
  ];

  if (!widget.id) {
    widget.id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
  if (!widget.title) widget.title = 'Untitled Widget';
  if (!widget.type || !VALID_TYPES.includes(widget.type)) {
    widget.type = 'bar';
  }
  if (!Array.isArray(widget.fields)) widget.fields = [];
  if (!widget.position) {
    widget.position = { x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 };
  } else {
    widget.position.minW = widget.position.minW || 2;
    widget.position.minH = widget.position.minH || 2;
  }
  if (!widget.config) {
    widget.config = {
      showTitle: true,
      titlePosition: 'top-left',
      colorScheme: 'tableau10',
      sorts: [],
      columnAliases: {},
      fieldAggregations: {},
    };
  }
  if (!Array.isArray(widget.filtersApplied)) widget.filtersApplied = [];
  if (!Array.isArray(widget.sortsApplied)) widget.sortsApplied = [];
  if (!Array.isArray(widget.customColumns)) widget.customColumns = [];
  if (!widget.marks) widget.marks = {};
  if (!widget.chartQuery) widget.chartQuery = {};
  // Derive semanticViewsReferenced from the semanticView FQN when missing.
  // The AI often sets `semanticView` but omits `semanticViewsReferenced`.
  if (!widget.semanticViewsReferenced || widget.semanticViewsReferenced.length === 0) {
    if (widget.semanticView) {
      const fqn = widget.semanticView;
      const name = fqn.includes('.') ? fqn.split('.').pop() : fqn;
      widget.semanticViewsReferenced = [{ name, fullyQualifiedName: fqn }];
    } else {
      widget.semanticViewsReferenced = [];
    }
  }

  for (const field of widget.fields) {
    if (!field.shelf) field.shelf = 'columns';
    if (!field.semanticType) field.semanticType = 'dimension';
    if (!field.dataType) field.dataType = 'VARCHAR';
    if (field.isCustomColumn === undefined) field.isCustomColumn = false;
  }

  return widget;
}

function executeQuery(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      },
    });
  });
}

// ============================================================================
// AGENT TOOL DEFINITIONS & EXECUTION
// ============================================================================

const AGENT_TOOLS = [
  {
    name: 'sample_data',
    description: 'Get sample rows from a semantic view to understand what the data looks like before building a chart. Returns up to `limit` rows with the specified fields.',
    parameters: {
      semanticView: 'string — Fully qualified semantic view name (DATABASE.SCHEMA.VIEW)',
      dimensions: 'string[] — Dimension field names to include',
      measures: 'string[] — Measure field names to include (optional)',
      limit: 'number — Max rows to return (default 5)',
    },
  },
  {
    name: 'check_cardinality',
    description: 'Get the number of distinct values for a dimension field. Use this to decide whether a field is suitable for a pie chart (< 7), color encoding (< 20), or should be filtered/aggregated.',
    parameters: {
      semanticView: 'string — Fully qualified semantic view name',
      field: 'string — Dimension field name to check',
    },
  },
  {
    name: 'test_query',
    description: 'Run a test query to verify that a combination of dimensions and measures returns data. Returns the row count and first few rows so you can confirm the chart will render.',
    parameters: {
      semanticView: 'string — Fully qualified semantic view name',
      dimensions: 'string[] — Dimension fields',
      measures: 'string[] — Measure fields with aggregations, e.g. [{"name":"REVENUE","aggregation":"SUM"}]',
      limit: 'number — Max rows (default 5)',
    },
  },
];

function buildToolPromptSection() {
  const toolDescriptions = AGENT_TOOLS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n');
    return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
  }).join('\n\n');

  return `## TOOLS
You have access to tools that let you query actual data before building widgets.
Use tools when the user asks you to build charts — sampling the data first helps you pick the right chart type and field mappings.

Available tools:
${toolDescriptions}

## RESPONSE FORMAT (IMPORTANT)
You MUST respond with valid JSON. There are TWO response types:

### Type 1: Tool call (to query data before answering)
{
  "type": "tool_call",
  "tool": "<tool_name>",
  "args": { <tool parameters> },
  "thinking": "Brief explanation of why you're calling this tool"
}

### Type 2: Final answer (when you have enough information)
{
  "type": "answer",
  "message": "A short conversational explanation of what you did",
  "action": "none" | "add_widget" | "update_widget" | "remove_widget" | "replace_dashboard",
  "yaml": <the widget/dashboard object for the action, or null if action is "none">
}

RULES:
- You can make at most 4 tool calls per conversation turn. After that, give your best answer.
- MANDATORY: When building new charts, ALWAYS call sample_data first to inspect the actual data values and types before choosing a chart type. Do not guess the chart type from the field name alone.
- After sampling, if you see geographic values (country names, state names, regions), use choropleth. If you see dates/timestamps, use line/area. If you see high cardinality text, use horizontal-bar or table. Let the DATA drive the chart type, not assumptions.
- Use check_cardinality to verify whether a dimension has few enough distinct values for pie/donut (≤6) vs bar (≤15) vs table/treemap (>15).
- If a tool call fails, proceed with your best guess rather than retrying.
- For simple questions or modifications to existing widgets, skip tools and answer directly.
- When adding multiple widgets, use "add_widget" with an array of widget objects.
- Preserve widget IDs when updating. Only generate new IDs for new widgets.
- Be concise in your message. 1-2 sentences max.`;
}

async function executeAgentTool(connection, toolName, args) {
  const startTime = Date.now();
  try {
    switch (toolName) {
      case 'sample_data': {
        const { semanticView, dimensions = [], measures = [], limit = 5 } = args;
        if (!semanticView) return { error: 'semanticView is required' };
        if (dimensions.length === 0 && measures.length === 0) {
          return { error: 'At least one dimension or measure is required' };
        }
        const normalizedMeasures = measures.map(m =>
          typeof m === 'string' ? { name: m, aggregation: 'SUM' } : m
        );
        const sql = buildQueryDirect({
          semanticViewFQN: semanticView,
          dimensions,
          measures: normalizedMeasures,
          limit: Math.min(parseInt(limit) || 5, 20),
        });
        const rows = await executeQuery(connection, sql);
        return {
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          data: rows.slice(0, Math.min(parseInt(limit) || 5, 20)),
          executionTime: Date.now() - startTime,
        };
      }

      case 'check_cardinality': {
        const { semanticView, field } = args;
        if (!semanticView || !field) return { error: 'semanticView and field are required' };
        const sql = `SELECT COUNT(DISTINCT "${field}") AS DISTINCT_COUNT FROM SEMANTIC_VIEW(${semanticView} DIMENSIONS ${field}) WHERE "${field}" IS NOT NULL LIMIT 1`;
        const rows = await executeQuery(connection, sql);
        const count = rows[0]?.DISTINCT_COUNT ?? rows[0]?.distinct_count ?? 0;
        return {
          field,
          distinctCount: count,
          recommendation: count <= 6 ? 'Low cardinality — good for pie/donut'
            : count <= 15 ? 'Medium cardinality — good for bar charts, color encoding'
            : count <= 50 ? 'High cardinality — consider horizontal-bar, treemap, or filtering'
            : 'Very high cardinality — use table, filter, or aggregate',
          executionTime: Date.now() - startTime,
        };
      }

      case 'test_query': {
        const { semanticView, dimensions = [], measures = [], limit = 5 } = args;
        if (!semanticView) return { error: 'semanticView is required' };
        if (dimensions.length === 0 && measures.length === 0) {
          return { error: 'At least one dimension or measure is required' };
        }
        const normalizedMeasures = measures.map(m =>
          typeof m === 'string' ? { name: m, aggregation: 'SUM' } : m
        );
        const sql = buildQueryDirect({
          semanticViewFQN: semanticView,
          dimensions,
          measures: normalizedMeasures,
          limit: Math.min(parseInt(limit) || 5, 10),
        });
        const rows = await executeQuery(connection, sql);
        return {
          success: rows.length > 0,
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]) : [],
          sampleRows: rows.slice(0, 3),
          sql: sql.substring(0, 300),
          executionTime: Date.now() - startTime,
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    return {
      error: err.message || 'Tool execution failed',
      executionTime: Date.now() - startTime,
    };
  }
}

const MAX_AGENT_ITERATIONS = 4;

const CHAT_SYSTEM_PROMPT = `You are an AI assistant embedded in the Simply Analytics dashboard editor.
You help users build and modify dashboards through conversation. You have full context of the current dashboard state.

${DASHBOARD_SCHEMA_PROMPT.replace('## RESPONSE FORMAT\nRespond with ONLY valid YAML. No markdown code fences, no explanations, no extra text.\nThe YAML must be parseable by js-yaml. Use proper indentation (2 spaces).', '')}

${buildToolPromptSection()}

Actions for "action" field:
- "none": just answering a question, no changes
- "add_widget": yaml should be a single widget object OR an array of widget objects to add. PREFER this when the user asks to create/build/add widgets.
- "update_widget": yaml should be { widgetId: "<id>", widget: <updated widget object> }
- "remove_widget": yaml should be { widgetId: "<id>" }
- "replace_dashboard": full dashboard YAML replacement. ONLY use when the user explicitly asks to rebuild/replace the entire dashboard. NEVER use this just to add new widgets — use add_widget instead.

IMPORTANT:
- Always respond with valid JSON. The "yaml" field contains a JS object (not a YAML string).
- When the user asks about a focused widget, apply changes only to that widget.
- Preserve widget IDs when updating. Only generate new IDs for new widgets.
- When adding multiple widgets, use "add_widget" with an array of widget objects, NOT "replace_dashboard".
- Be concise in your message. 1-2 sentences max.`;

async function callCortex(connection, llmMessages, model, maxTokens) {
  const messagesStr = llmMessages.map(m =>
    `{'role': '${m.role}', 'content': '${escapeForSnowflake(m.content)}'}`
  ).join(', ');

  const sql = `
    SELECT SNOWFLAKE.CORTEX.COMPLETE(
      '${model}',
      [${messagesStr}],
      {'temperature': 0.3, 'max_tokens': ${maxTokens}}
    ) as response
  `;

  const result = await executeQuery(connection, sql);
  let response = result[0]?.RESPONSE || result[0]?.response;

  if (response && typeof response === 'object') {
    if (response.choices?.[0]) {
      response = response.choices[0].messages || response.choices[0].message?.content || response.choices[0].text;
    } else if (response.content) {
      response = response.content;
    }
  }

  if (typeof response !== 'string') {
    response = JSON.stringify(response);
  }

  return stripCodeFences(response);
}

function stripCodeFences(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/^\s*```(?:ya?ml|json|sql|text)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim();
}

export async function chatWithDashboard(connection, {
  messages,
  currentYaml,
  focusedWidgetId,
  semanticViewMetadata,
  model = 'claude-sonnet-4-6',
  maxTokens = 4096,
}) {
  const viewContext = Array.isArray(semanticViewMetadata)
    ? semanticViewMetadata.map(buildSemanticViewContext).join('\n\n')
    : buildSemanticViewContext(semanticViewMetadata);

  const currentYamlStr = currentYaml
    ? (typeof currentYaml === 'string' ? currentYaml : yaml.dump(currentYaml))
    : '(empty dashboard)';

  let focusContext = '';
  if (focusedWidgetId && currentYaml?.tabs) {
    for (const tab of currentYaml.tabs) {
      const w = (tab.widgets || []).find(w => w.id === focusedWidgetId);
      if (w) {
        focusContext = `\n\n## FOCUSED WIDGET\nThe user is focused on widget "${w.title}" (id: ${w.id}, type: ${w.type}). Apply changes to THIS widget unless they clearly ask for something else.\n\`\`\`yaml\n${yaml.dump(w)}\`\`\``;
        break;
      }
    }
  }

  const systemContent = `${CHAT_SYSTEM_PROMPT}\n\n${viewContext}\n\n## CURRENT DASHBOARD\n\`\`\`yaml\n${currentYamlStr}\n\`\`\`${focusContext}`;

  const llmMessages = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const toolSteps = [];
  let iteration = 0;

  while (iteration < MAX_AGENT_ITERATIONS) {
    iteration++;

    const rawResponse = await callCortex(connection, llmMessages, model, maxTokens);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { return { message: rawResponse, action: 'none', yaml: null, toolSteps }; }
      } else {
        return { message: rawResponse, action: 'none', yaml: null, toolSteps };
      }
    }

    if (parsed.type === 'tool_call' && parsed.tool) {
      const toolStep = {
        tool: parsed.tool,
        args: parsed.args || {},
        thinking: parsed.thinking || '',
      };

      const toolResult = await executeAgentTool(connection, parsed.tool, parsed.args || {});
      toolStep.result = toolResult;
      toolSteps.push(toolStep);

      const resultStr = JSON.stringify(toolResult, null, 2);
      const truncatedResult = resultStr.length > 3000
        ? resultStr.substring(0, 3000) + '\n... (truncated)'
        : resultStr;

      llmMessages.push({
        role: 'assistant',
        content: JSON.stringify({ type: 'tool_call', tool: parsed.tool, args: parsed.args, thinking: parsed.thinking }),
      });
      llmMessages.push({
        role: 'user',
        content: `Tool result for ${parsed.tool}:\n${truncatedResult}\n\nContinue. You have ${MAX_AGENT_ITERATIONS - iteration} tool calls remaining. Respond with ONLY valid JSON — no text before or after the JSON object.`,
      });

      continue;
    }

    const finalParsed = parsed.type === 'answer' ? parsed : parsed;

    if (finalParsed.action === 'replace_dashboard' && finalParsed.yaml) {
      finalParsed.yaml = validateAndNormalizeDashboard(finalParsed.yaml);
    } else if (finalParsed.action === 'add_widget' && finalParsed.yaml) {
      if (Array.isArray(finalParsed.yaml)) {
        finalParsed.yaml = finalParsed.yaml.map(w => validateAndNormalizeWidget(w));
      } else {
        finalParsed.yaml = validateAndNormalizeWidget(finalParsed.yaml);
      }
    } else if (finalParsed.action === 'update_widget' && finalParsed.yaml?.widget) {
      finalParsed.yaml.widget = validateAndNormalizeWidget(finalParsed.yaml.widget);
    }

    return {
      message: finalParsed.message || 'Done.',
      action: finalParsed.action || 'none',
      yaml: finalParsed.yaml || null,
      toolSteps,
    };
  }

  return {
    message: 'I ran out of tool calls. Please try rephrasing your request.',
    action: 'none',
    yaml: null,
    toolSteps,
  };
}

export async function conversationalAnswer(connection, {
  messages,
  semanticViewMetadata,
  model = 'claude-sonnet-4-6',
  maxTokens = 4096,
}) {
  const viewContext = Array.isArray(semanticViewMetadata)
    ? semanticViewMetadata.map(buildSemanticViewContext).join('\n\n')
    : buildSemanticViewContext(semanticViewMetadata);

  const toolDescriptions = AGENT_TOOLS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n');
    return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
  }).join('\n\n');

  const systemContent = `You are SimplyAsk, a friendly and knowledgeable data analytics assistant.
You answer questions about the user's data conversationally. You are NOT a dashboard editor.

${viewContext}

## TOOLS
You can query the data to answer questions accurately. Use tools when the user asks a factual question about their data.
For greetings, general conversation, or questions you can answer without data, respond directly — do NOT use tools.

Available tools:
${toolDescriptions}

## RESPONSE FORMAT
You MUST respond with valid JSON. There are TWO response types:

### Type 1: Tool call (to query data before answering)
{
  "type": "tool_call",
  "tool": "<tool_name>",
  "args": { <tool parameters> },
  "thinking": "Brief explanation of why you're calling this tool"
}

### Type 2: Final answer
{
  "type": "answer",
  "message": "Your conversational response in markdown. Be helpful, clear, and concise."
}

RULES:
- For greetings like "hi", "hello", "hey" — respond warmly WITHOUT using tools.
- For general chat or help requests — respond directly WITHOUT using tools.
- For data questions — use tools to query data first, then give a complete textual answer with the results.
- When presenting data results, format them nicely using markdown tables or bullet points.
- You can make at most ${MAX_AGENT_ITERATIONS} tool calls per turn.
- Always end with a Type 2 "answer" response after gathering data.
- Be conversational and natural. You are chatting with the user, not generating dashboards.`;

  const llmMessages = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const toolSteps = [];
  let iteration = 0;

  while (iteration < MAX_AGENT_ITERATIONS) {
    iteration++;

    const rawResponse = await callCortex(connection, llmMessages, model, maxTokens);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { return { message: rawResponse, toolSteps }; }
      } else {
        return { message: rawResponse, toolSteps };
      }
    }

    if (parsed.type === 'tool_call' && parsed.tool) {
      const toolStep = {
        tool: parsed.tool,
        args: parsed.args || {},
        thinking: parsed.thinking || '',
      };

      const toolResult = await executeAgentTool(connection, parsed.tool, parsed.args || {});
      toolStep.result = toolResult;
      toolSteps.push(toolStep);

      const resultStr = JSON.stringify(toolResult, null, 2);
      const truncatedResult = resultStr.length > 3000
        ? resultStr.substring(0, 3000) + '\n... (truncated)'
        : resultStr;

      llmMessages.push({
        role: 'assistant',
        content: JSON.stringify({ type: 'tool_call', tool: parsed.tool, args: parsed.args, thinking: parsed.thinking }),
      });
      llmMessages.push({
        role: 'user',
        content: `Tool result for ${parsed.tool}:\n${truncatedResult}\n\nNow respond with a Type 2 "answer" JSON containing your conversational response to the user. You have ${MAX_AGENT_ITERATIONS - iteration} tool calls remaining.`,
      });

      continue;
    }

    return {
      message: parsed.message || rawResponse,
      toolSteps,
    };
  }

  return {
    message: 'I ran out of tool calls. Please try rephrasing your request.',
    toolSteps,
  };
}

/**
 * Unified AskAI chat — combines data-querying tools with widget creation/modification.
 * Replaces the old 3-way intent classification + separate handler pattern.
 */
export async function askChat(connection, {
  messages,
  semanticViewMetadata,
  priorArtifacts = [],
  model = 'claude-sonnet-4-6',
  maxTokens = 4096,
  onToolStep,
}) {
  const viewContext = Array.isArray(semanticViewMetadata)
    ? semanticViewMetadata.map(buildSemanticViewContext).join('\n\n')
    : buildSemanticViewContext(semanticViewMetadata);

  const toolDescriptions = AGENT_TOOLS.map(t => {
    const params = Object.entries(t.parameters)
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n');
    return `- ${t.name}: ${t.description}\n  Parameters:\n${params}`;
  }).join('\n\n');

  let artifactContext = '';
  if (priorArtifacts.length > 0) {
    const widgetSummaries = priorArtifacts
      .filter(a => a.type === 'widget' && a.widget)
      .map(a => {
        const w = a.widget;
        const fieldsSummary = (w.fields || []).map(f =>
          `${f.name} (${f.shelf}, ${f.semanticType}${f.markType ? ', mark:' + f.markType : ''}${f.aggregation ? ', agg:' + f.aggregation : ''})`
        ).join(', ');
        return `- Widget "${w.title}" (id: ${w.id}, type: ${w.type})\n  semanticView: ${w.semanticView || w.semanticViewsReferenced?.[0]?.fullyQualifiedName || 'unknown'}\n  fields: [${fieldsSummary}]\n  filters: ${JSON.stringify(w.filtersApplied || [])}\n  sorts: ${JSON.stringify(w.sortsApplied || [])}`;
      }).join('\n');
    if (widgetSummaries) {
      artifactContext = `\n\n## EXISTING WIDGETS IN THIS CONVERSATION\nThe user has these widgets from prior messages. When they ask to modify a chart, update the relevant widget rather than creating a new one.\n${widgetSummaries}`;
    }
  }

  const systemContent = `You are AskAI, a friendly and knowledgeable data analytics assistant for the Simply Analytics platform.
You help users explore their data, answer questions, and build or modify visualizations through natural conversation.

${viewContext}

## TOOLS
You can query the data to answer questions accurately or to inspect data before building charts.
For greetings, general conversation, or questions you can answer without data, respond directly — do NOT use tools.
When building new charts, ALWAYS call sample_data first to understand the data before choosing a chart type.

Available tools:
${toolDescriptions}

## WIDGET SCHEMA
When creating or modifying widgets, use this field structure:

\`\`\`yaml
id: "<unique-id>"
title: "Widget Title"
type: "<chart_type>"
semanticView: "DATABASE.SCHEMA.VIEW_NAME"
semanticViewsReferenced:
  - name: "VIEW_NAME"
    fullyQualifiedName: "DATABASE.SCHEMA.VIEW_NAME"
fields:
  - name: "FIELD_NAME"
    shelf: "columns"
    dataType: "VARCHAR"
    semanticType: "dimension"
    aggregation: null
    markType: null
    alias: null
    isCustomColumn: false
filtersApplied: []
sortsApplied: []
customColumns: []
marks: {}
config:
  showTitle: true
  titlePosition: "top-left"
  colorScheme: "tableau10"
\`\`\`

Widget types: bar, horizontal-bar, diverging-bar, line, multiline, area, pie, donut, treemap, funnel, waterfall, scatter, boxplot, heatmap, histogram, radar, sankey, icicle, table, pivot, metric, choropleth, hexbin, gauge, radial
Note: For stacked bars, use type "bar" with a color mark field — stacking is handled automatically by the bar chart renderer.

Chart selection rules:
- Single KPI → metric
- Time series → line or area
- Geographic data → choropleth
- Category comparison ≤6 → bar, >6 → horizontal-bar
- Share/proportion ≤6 categories → donut, >6 → treemap
- Rankings → horizontal-bar with DESC sort
- Two numeric fields → scatter
- Data listing → table

Field rules:
- Dimensions: shelf "columns", semanticType "dimension", aggregation null
- Measures: shelf "rows", semanticType "measure", aggregation "SUM"/"AVG"/"COUNT"/"MIN"/"MAX"
- Color marks: markType "color" (can be on any shelf)

## CALCULATED FIELDS (customColumns)
When the user's request needs a derived value not available as a native field in the semantic view, create a calculated field.
- Add entries to the "customColumns" array: [{ name: "FIELD_NAME", expression: "SQL expression" }]
- Reference existing semantic view fields with bracket syntax: [EXISTING_FIELD]
- After creating a calculated field, reference it in the "fields" array with isCustomColumn: true
- Set semanticType: "measure" for numeric calculations, "dimension" for categorical/temporal derivations
- Standard SQL functions are supported: YEAR(), MONTH(), DAY(), QUARTER(), DATE_TRUNC(), CASE WHEN, CONCAT(), ROUND(), ABS(), COALESCE(), etc.

Examples:
- Extract year from date: { name: "ORDER_YEAR", expression: "YEAR([ORDER_DATE])" }
- Extract month: { name: "ORDER_MONTH", expression: "MONTH([ORDER_DATE])" }
- Profit margin: { name: "MARGIN", expression: "([REVENUE] - [COST]) / [REVENUE] * 100" }
- Category grouping: { name: "SIZE_GROUP", expression: "CASE WHEN [QUANTITY] > 100 THEN 'Large' ELSE 'Small' END" }

IMPORTANT: When the user asks for data "by year", "by month", "quarterly", etc. and the semantic view only has a DATE/TIMESTAMP field, you MUST create a customColumn to extract the time part and use it as a dimension.

## FILTER RULES
- filtersApplied is an array of filter objects: { field, operator, value } or { field, operator: "IN", values: [...] }
- Supported operators: "IN", "NOT IN", "=", "!=", ">", "<", ">=", "<=", "LIKE", "BETWEEN"
- BETWEEN uses "value" as low and "value2" as high

## SORT RULES
- sortsApplied is an array: [{ field: "FIELD_NAME", direction: "ASC" | "DESC" }]
- Always add DESC sort for "top N" or ranking queries
${artifactContext}

## RESPONSE FORMAT
You MUST respond with valid JSON. There are TWO response types:

### Type 1: Tool call (to query data before answering)
{
  "type": "tool_call",
  "tool": "<tool_name>",
  "args": { <tool parameters> },
  "thinking": "Brief explanation of why you're calling this tool"
}

### Type 2: Final answer
{
  "type": "answer",
  "message": "Your conversational response in markdown. Be helpful, clear, and concise.",
  "action": "none" | "add_widget" | "update_widget" | "add_dashboard",
  "yaml": <see action descriptions below>
}

Actions:
- "none": conversational answer only, yaml is null
- "add_widget": yaml is a single widget object OR an array of widget objects
- "update_widget": yaml is { widgetId: "<id>", widget: <updated widget> }. Preserve the widget id.
- "add_dashboard": yaml is { title: "Dashboard Title", tabs: [{ id: "tab-1", label: "Tab Label", widgets: [<widget>, ...] }] }. Use for multi-widget overview/report/KPI requests.

RULES:
- CRITICAL: Respond with ONLY valid JSON. No text before or after the JSON object. No markdown code fences.
- For greetings like "hi" — respond warmly with action "none". No tools needed.
- For data questions — use tools to query data, then answer with text. Use action "none".
- For single chart / "show me" / "visualize" requests — sample data first, then use action "add_widget".
- For "dashboard" / "overview" / "report" / "KPIs" / multiple charts — sample data first, then use action "add_dashboard" with multiple widgets organized in tabs.
- For "change the chart" / "make it a line chart" / modifications — use action "update_widget".
- When presenting data results as text, use markdown tables or bullet points.
- You can make at most ${MAX_AGENT_ITERATIONS} tool calls per turn.
- Be concise. 1-2 sentences for the message field.
- The "yaml" field contains a JS object, not a YAML string.`;

  const llmMessages = [
    { role: 'system', content: systemContent },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const toolSteps = [];
  let iteration = 0;

  while (iteration < MAX_AGENT_ITERATIONS) {
    iteration++;

    const rawResponse = await callCortex(connection, llmMessages, model, maxTokens);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      // The AI sometimes wraps JSON in conversational text — extract it
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          return { message: rawResponse, action: 'none', yaml: null, toolSteps };
        }
      } else {
        return { message: rawResponse, action: 'none', yaml: null, toolSteps };
      }
    }

    if (parsed.type === 'tool_call' && parsed.tool) {
      const toolStep = {
        tool: parsed.tool,
        args: parsed.args || {},
        thinking: parsed.thinking || '',
      };

      if (onToolStep) onToolStep(toolStep);

      const toolResult = await executeAgentTool(connection, parsed.tool, parsed.args || {});
      toolStep.result = toolResult;
      toolSteps.push(toolStep);

      const resultStr = JSON.stringify(toolResult, null, 2);
      const truncatedResult = resultStr.length > 3000
        ? resultStr.substring(0, 3000) + '\n... (truncated)'
        : resultStr;

      llmMessages.push({
        role: 'assistant',
        content: JSON.stringify({ type: 'tool_call', tool: parsed.tool, args: parsed.args, thinking: parsed.thinking }),
      });
      llmMessages.push({
        role: 'user',
        content: `Tool result for ${parsed.tool}:\n${truncatedResult}\n\nContinue. You have ${MAX_AGENT_ITERATIONS - iteration} tool calls remaining. Respond with ONLY valid JSON — no text before or after the JSON object.`,
      });

      continue;
    }

    if (parsed.action === 'add_widget' && parsed.yaml) {
      if (Array.isArray(parsed.yaml)) {
        parsed.yaml = parsed.yaml.map(w => validateAndNormalizeWidget(w));
      } else {
        parsed.yaml = validateAndNormalizeWidget(parsed.yaml);
      }
    } else if (parsed.action === 'update_widget' && parsed.yaml?.widget) {
      parsed.yaml.widget = validateAndNormalizeWidget(parsed.yaml.widget);
    } else if (parsed.action === 'add_dashboard' && parsed.yaml) {
      const dashboard = parsed.yaml;
      if (dashboard.tabs) {
        for (const tab of dashboard.tabs) {
          tab.widgets = (tab.widgets || []).map(w => validateAndNormalizeWidget(w));
        }
      } else if (Array.isArray(dashboard.widgets)) {
        dashboard.tabs = [{ id: 'tab-1', label: 'Overview', widgets: dashboard.widgets.map(w => validateAndNormalizeWidget(w)) }];
        delete dashboard.widgets;
      }
      if (!dashboard.title) dashboard.title = parsed.message || 'AI Dashboard';
    }

    return {
      message: parsed.message || 'Done.',
      action: parsed.action || 'none',
      yaml: parsed.yaml || null,
      toolSteps,
    };
  }

  return {
    message: 'I ran out of tool calls. Please try rephrasing your request.',
    action: 'none',
    yaml: null,
    toolSteps,
  };
}

export async function classifyIntent(connection, { message, hasHistory, model = 'claude-sonnet-4-6' }) {
  const systemPrompt = `You are an intent classifier for a data analytics chat assistant. Given the user's message, classify their intent into exactly ONE of these categories:

- "dashboard": User wants a multi-widget dashboard, overview, report, or KPI summary with multiple charts
- "widget": User wants a specific chart, graph, table, metric, or data visualization
- "data_answer": User is asking a factual question about their data that can be answered in text (e.g. "what was total revenue last quarter?") — no chart needed
- "chat": General conversation, greetings, help requests, clarification, or anything not related to data analysis

Respond with ONLY a JSON object: {"intent": "<category>", "reason": "<brief explanation>"}
Do NOT include any other text.`;

  const userContent = hasHistory
    ? `[Continuing a conversation] User says: "${message}"`
    : `[New conversation] User says: "${message}"`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const raw = await callCortex(connection, messages, model, 128);
  try {
    const parsed = JSON.parse(raw);
    const valid = ['dashboard', 'widget', 'data_answer', 'chat'];
    if (valid.includes(parsed.intent)) return parsed.intent;
  } catch { /* fallback */ }
  return 'chat';
}

export default {
  generateDashboard,
  generateWidget,
  modifyDashboard,
  chatWithDashboard,
  conversationalAnswer,
  askChat,
  classifyIntent,
};
