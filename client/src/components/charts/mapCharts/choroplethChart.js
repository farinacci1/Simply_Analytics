import * as d3 from 'd3';
import { getFeatureName } from './geoData';

export function createChoroplethChart(container, geojson, dataMap, {
  width, height, layerId, measureField, colorScheme = 'blues',
  animate = true, formatValue,
}) {
  if (!geojson || !geojson.features?.length) return;

  const isUS = layerId === 'us-states';
  const projection = isUS
    ? d3.geoAlbersUsa()
    : d3.geoNaturalEarth1();

  projection.fitWidth(width, geojson);
  const pathGen = d3.geoPath(projection);

  const bounds = pathGen.bounds(geojson);
  const naturalHeight = Math.ceil(bounds[1][1] - bounds[0][1]) + 20;
  const svgHeight = Math.max(naturalHeight, height);

  const yOffset = bounds[0][1] < 0 ? -bounds[0][1] + 10 : 10;

  d3.select(container).style('overflow-y', svgHeight > height ? 'auto' : 'hidden');

  const svg = d3.select(container)
    .selectAll('svg').data([null]).join('svg')
    .attr('width', width).attr('height', svgHeight);

  const g = svg.selectAll('g.map-root').data([null]).join('g')
    .attr('class', 'map-root')
    .attr('transform', `translate(0,${yOffset})`);

  const values = [...dataMap.values()].filter(v => v != null && !isNaN(v));
  const [minVal, maxVal] = values.length ? d3.extent(values) : [0, 1];

  const interpolator = getColorInterpolator(colorScheme);
  const color = (minVal !== maxVal)
    ? d3.scaleSequential(interpolator).domain([minVal, maxVal])
    : () => interpolator(0.5);

  const noDataColor = '#d0d0d8';

  const tooltip = d3.select(container).selectAll('.choropleth-tooltip').data([null]).join('div')
    .attr('class', 'choropleth-tooltip')
    .style('position', 'absolute').style('pointer-events', 'none').style('opacity', 0)
    .style('background', 'rgba(20,20,30,0.95)').style('color', '#e0e0e0')
    .style('padding', '6px 10px').style('border-radius', '6px')
    .style('font-size', '12px').style('box-shadow', '0 2px 8px rgba(0,0,0,0.4)')
    .style('z-index', '100');

  const fmt = formatValue || d3.format(',.1f');

  const regions = g.selectAll('path.region')
    .data(geojson.features, d => d.id || d.properties?.name)
    .join('path')
    .attr('class', 'region')
    .attr('d', pathGen)
    .attr('stroke', '#bbb')
    .attr('stroke-width', 0.5)
    .attr('fill', d => {
      const val = dataMap.get(String(d.id));
      return val != null ? color(val) : noDataColor;
    })
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
      const name = getFeatureName(layerId, String(d.id));
      const val = dataMap.get(String(d.id));
      tooltip.html(`<strong>${name}</strong>${val != null ? `<br/>${measureField}: ${fmt(val)}` : ''}`)
        .style('opacity', 1);
    })
    .on('mousemove', function(event) {
      const rect = container.getBoundingClientRect();
      tooltip.style('left', `${event.clientX - rect.left + 12}px`).style('top', `${event.clientY - rect.top - 10}px`);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('stroke', '#bbb').attr('stroke-width', 0.5);
      tooltip.style('opacity', 0);
    });

  if (animate) {
    regions.style('opacity', 0).transition().duration(600).style('opacity', 1);
  }

  // Zoom
  const zoom = d3.zoom().scaleExtent([0.5, 8]).on('zoom', (e) => {
    g.attr('transform', `translate(${e.transform.x},${e.transform.y + yOffset}) scale(${e.transform.k})`);
  });
  svg.call(zoom);

  // Legend
  const legendW = Math.min(200, width * 0.4);
  const legendH = 10;
  const legendG = svg.selectAll('g.legend').data([null]).join('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - legendW - 20},${svgHeight - 30})`);

  const defs = svg.selectAll('defs').data([null]).join('defs');
  const gradId = 'choropleth-grad';
  const grad = defs.selectAll(`#${gradId}`).data([null]).join('linearGradient')
    .attr('id', gradId);
  for (let i = 0; i <= 10; i++) {
    grad.selectAll(`stop.s${i}`).data([null]).join('stop')
      .attr('class', `s${i}`)
      .attr('offset', `${i * 10}%`)
      .attr('stop-color', color(minVal + (maxVal - minVal) * i / 10));
  }

  legendG.selectAll('rect.legend-bar').data([null]).join('rect')
    .attr('class', 'legend-bar')
    .attr('width', legendW).attr('height', legendH)
    .attr('rx', 3).attr('fill', `url(#${gradId})`);

  legendG.selectAll('text.legend-min').data([null]).join('text')
    .attr('class', 'legend-min').attr('y', legendH + 12)
    .attr('fill', '#888').attr('font-size', 9).text(fmt(minVal));

  legendG.selectAll('text.legend-max').data([null]).join('text')
    .attr('class', 'legend-max').attr('x', legendW).attr('y', legendH + 12)
    .attr('text-anchor', 'end').attr('fill', '#888').attr('font-size', 9).text(fmt(maxVal));
}

function getColorInterpolator(scheme) {
  const m = {
    blues: d3.interpolateBlues, greens: d3.interpolateGreens, reds: d3.interpolateReds,
    oranges: d3.interpolateOranges, purples: d3.interpolatePurples,
    viridis: d3.interpolateViridis, plasma: d3.interpolatePlasma,
    inferno: d3.interpolateInferno, turbo: d3.interpolateTurbo,
    ylgnbu: d3.interpolateYlGnBu, ylorbr: d3.interpolateYlOrBr,
  };
  return m[scheme] || m.blues;
}
