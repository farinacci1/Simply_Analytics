import * as d3 from 'd3';
import { hexbin as d3Hexbin } from 'd3-hexbin';

export function createHexbinChart(container, points, {
  width, height, valueField, colorScheme = 'blues',
  animate = true, formatValue, hexRadius = 15,
}) {
  if (!points.length) return;

  const margin = { top: 10, right: 10, bottom: 10, left: 10 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  if (innerW <= 0 || innerH <= 0) return;

  const projection = d3.geoMercator().fitSize([innerW, innerH], {
    type: 'FeatureCollection',
    features: points.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })),
  });

  const projected = points.map(p => {
    const [x, y] = projection([p.lng, p.lat]) || [NaN, NaN];
    return { x, y, value: p.value };
  }).filter(p => !isNaN(p.x) && !isNaN(p.y));

  const hexbinGen = d3Hexbin()
    .x(d => d.x).y(d => d.y)
    .radius(hexRadius)
    .extent([[0, 0], [innerW, innerH]]);

  const bins = hexbinGen(projected);

  bins.forEach(bin => {
    bin.aggValue = valueField
      ? d3.sum(bin, d => d.value || 0)
      : bin.length;
  });

  const maxVal = d3.max(bins, d => d.aggValue) || 1;
  const interpolator = getColorInterpolator(colorScheme);
  const color = d3.scaleSequential(interpolator).domain([0, maxVal]);

  const svg = d3.select(container)
    .selectAll('svg').data([null]).join('svg')
    .attr('width', width).attr('height', height);

  const g = svg.selectAll('g.hexbin-root').data([null]).join('g')
    .attr('class', 'hexbin-root')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select(container).selectAll('.hexbin-tooltip').data([null]).join('div')
    .attr('class', 'hexbin-tooltip')
    .style('position', 'absolute').style('pointer-events', 'none').style('opacity', 0)
    .style('background', 'rgba(20,20,30,0.95)').style('color', '#e0e0e0')
    .style('padding', '6px 10px').style('border-radius', '6px')
    .style('font-size', '12px').style('box-shadow', '0 2px 8px rgba(0,0,0,0.4)')
    .style('z-index', '100');

  const fmt = formatValue || d3.format(',.1f');

  const hexes = g.selectAll('path.hex')
    .data(bins).join('path')
    .attr('class', 'hex')
    .attr('d', hexbinGen.hexagon())
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('fill', d => color(d.aggValue))
    .attr('stroke', '#1a1a24').attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .on('mouseenter', function(event, d) {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
      let html = `<strong>Points:</strong> ${d.length}`;
      if (valueField) html += `<br/><strong>${valueField}:</strong> ${fmt(d.aggValue)}`;
      tooltip.html(html).style('opacity', 1);
    })
    .on('mousemove', function(event) {
      const rect = container.getBoundingClientRect();
      tooltip.style('left', `${event.clientX - rect.left + 12}px`).style('top', `${event.clientY - rect.top - 10}px`);
    })
    .on('mouseleave', function() {
      d3.select(this).attr('stroke', '#1a1a24').attr('stroke-width', 0.5);
      tooltip.style('opacity', 0);
    });

  if (animate) {
    hexes.style('opacity', 0).transition().duration(600).style('opacity', 1);
  }

  // Zoom
  const zoom = d3.zoom().scaleExtent([0.5, 10]).on('zoom', (e) => {
    g.attr('transform', `translate(${e.transform.x + margin.left},${e.transform.y + margin.top}) scale(${e.transform.k})`);
  });
  svg.call(zoom);

  // Legend
  const legendW = Math.min(160, width * 0.35);
  const legendH = 8;
  const legendG = svg.selectAll('g.legend').data([null]).join('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - legendW - 16},${height - 24})`);

  const defs = svg.selectAll('defs').data([null]).join('defs');
  const gradId = 'hexbin-grad';
  const grad = defs.selectAll(`#${gradId}`).data([null]).join('linearGradient').attr('id', gradId);
  for (let i = 0; i <= 10; i++) {
    grad.selectAll(`stop.s${i}`).data([null]).join('stop')
      .attr('class', `s${i}`)
      .attr('offset', `${i * 10}%`)
      .attr('stop-color', color(maxVal * i / 10));
  }

  legendG.selectAll('rect.legend-bar').data([null]).join('rect')
    .attr('class', 'legend-bar')
    .attr('width', legendW).attr('height', legendH).attr('rx', 3)
    .attr('fill', `url(#${gradId})`);

  legendG.selectAll('text.legend-min').data([null]).join('text')
    .attr('class', 'legend-min').attr('y', legendH + 11)
    .attr('fill', '#888').attr('font-size', 9).text('0');

  legendG.selectAll('text.legend-max').data([null]).join('text')
    .attr('class', 'legend-max').attr('x', legendW).attr('y', legendH + 11)
    .attr('text-anchor', 'end').attr('fill', '#888').attr('font-size', 9)
    .text(fmt(maxVal));
}

function getColorInterpolator(scheme) {
  const m = {
    blues: d3.interpolateBlues, greens: d3.interpolateGreens, reds: d3.interpolateReds,
    oranges: d3.interpolateOranges, purples: d3.interpolatePurples,
    viridis: d3.interpolateViridis, plasma: d3.interpolatePlasma,
    inferno: d3.interpolateInferno, turbo: d3.interpolateTurbo,
  };
  return m[scheme] || m.blues;
}
