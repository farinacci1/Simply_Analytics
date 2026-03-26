import * as d3 from 'd3';

export function createGaugeChart(container, value, {
  width, height, minValue = 0, maxValue = 100,
  label = '', colorScheme = 'blues', colors, animate = true,
  formatValue: fmtFn, thresholds,
}) {
  const size = Math.min(width, height * 1.3);
  const radius = size * 0.42;
  const arcWidth = radius * 0.22;

  const startAngle = -Math.PI * 0.75;
  const endAngle = Math.PI * 0.75;
  const angleRange = endAngle - startAngle;

  const svg = d3.select(container)
    .selectAll('svg').data([null]).join('svg')
    .attr('width', width).attr('height', height);

  const cx = width / 2;
  const cy = height * 0.55;
  const g = svg.selectAll('g.gauge-root').data([null]).join('g')
    .attr('class', 'gauge-root')
    .attr('transform', `translate(${cx},${cy})`);

  const bgArc = d3.arc()
    .innerRadius(radius - arcWidth).outerRadius(radius)
    .startAngle(startAngle).endAngle(endAngle)
    .cornerRadius(arcWidth / 2);

  g.selectAll('path.gauge-bg').data([null]).join('path')
    .attr('class', 'gauge-bg').attr('d', bgArc()).attr('fill', '#2a2a3a');

  const clampedValue = Math.max(minValue, Math.min(maxValue, value));
  const ratio = (clampedValue - minValue) / (maxValue - minValue || 1);
  const targetAngle = startAngle + ratio * angleRange;

  const valueArc = d3.arc()
    .innerRadius(radius - arcWidth).outerRadius(radius)
    .startAngle(startAngle).cornerRadius(arcWidth / 2);

  const fillColor = (colors && colors.length > 0 && !thresholds)
    ? colors[Math.min(Math.floor(ratio * colors.length), colors.length - 1)]
    : getGaugeColor(ratio, colorScheme, thresholds);

  const valuePath = g.selectAll('path.gauge-value').data([null]).join('path')
    .attr('class', 'gauge-value').attr('fill', fillColor);

  if (animate) {
    valuePath.transition().duration(1200).ease(d3.easeCubicOut)
      .attrTween('d', function() {
        const interp = d3.interpolate(startAngle, targetAngle);
        return t => valueArc.endAngle(interp(t))();
      });
  } else {
    valuePath.attr('d', valueArc.endAngle(targetAngle)());
  }

  const needleLen = radius * 0.75;
  const needleG = g.selectAll('g.needle').data([null]).join('g').attr('class', 'needle');

  needleG.selectAll('circle.needle-hub').data([null]).join('circle')
    .attr('class', 'needle-hub').attr('r', arcWidth * 0.35).attr('fill', '#e0e0e0');

  const needlePath = needleG.selectAll('line.needle-line').data([null]).join('line')
    .attr('class', 'needle-line')
    .attr('x1', 0).attr('y1', 0)
    .attr('stroke', '#e0e0e0').attr('stroke-width', 2.5).attr('stroke-linecap', 'round');

  if (animate) {
    needlePath.transition().duration(1200).ease(d3.easeCubicOut)
      .attrTween('x2', () => {
        const interp = d3.interpolate(startAngle, targetAngle);
        return t => Math.sin(interp(t)) * needleLen;
      })
      .attrTween('y2', () => {
        const interp = d3.interpolate(startAngle, targetAngle);
        return t => -Math.cos(interp(t)) * needleLen;
      });
  } else {
    needlePath
      .attr('x2', Math.sin(targetAngle) * needleLen)
      .attr('y2', -Math.cos(targetAngle) * needleLen);
  }

  const fmt = fmtFn || d3.format(',.1f');
  g.selectAll('text.gauge-value-text').data([null]).join('text')
    .attr('class', 'gauge-value-text').attr('y', radius * 0.45)
    .attr('text-anchor', 'middle').attr('fill', '#e0e0e0')
    .attr('font-size', Math.max(14, radius * 0.25)).attr('font-weight', 600)
    .text(fmt(value));

  if (label) {
    g.selectAll('text.gauge-label').data([null]).join('text')
      .attr('class', 'gauge-label').attr('y', radius * 0.65)
      .attr('text-anchor', 'middle').attr('fill', '#888')
      .attr('font-size', Math.max(10, radius * 0.14)).text(label);
  }

  const tickFmt = d3.format(',.0f');
  g.selectAll('text.gauge-min').data([null]).join('text')
    .attr('class', 'gauge-min')
    .attr('x', Math.sin(startAngle) * (radius + 12))
    .attr('y', -Math.cos(startAngle) * (radius + 12))
    .attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', 10)
    .text(tickFmt(minValue));

  g.selectAll('text.gauge-max').data([null]).join('text')
    .attr('class', 'gauge-max')
    .attr('x', Math.sin(endAngle) * (radius + 12))
    .attr('y', -Math.cos(endAngle) * (radius + 12))
    .attr('text-anchor', 'middle').attr('fill', '#666').attr('font-size', 10)
    .text(tickFmt(maxValue));
}

function getGaugeColor(ratio, scheme, thresholds) {
  if (thresholds) {
    if (ratio <= (thresholds.low ?? 0.33)) return thresholds.lowColor || '#e74c3c';
    if (ratio <= (thresholds.mid ?? 0.66)) return thresholds.midColor || '#f39c12';
    return thresholds.highColor || '#2ecc71';
  }
  const schemes = {
    blues: ['#1e88e5', '#42a5f5', '#90caf9'],
    greens: ['#43a047', '#66bb6a', '#a5d6a7'],
    reds: ['#e53935', '#ef5350', '#ef9a9a'],
    oranges: ['#fb8c00', '#ffa726', '#ffcc80'],
    purples: ['#8e24aa', '#ab47bc', '#ce93d8'],
    viridis: ['#440154', '#21918c', '#fde725'],
  };
  const pal = schemes[scheme] || schemes.blues;
  if (ratio < 0.5) return d3.interpolateRgb(pal[0], pal[1])(ratio * 2);
  return d3.interpolateRgb(pal[1], pal[2])((ratio - 0.5) * 2);
}
