import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

export async function exportElementToPng(element, filename = 'export.png') {
  if (!element) return;
  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    filter: (node) => {
      if (node.classList?.contains('ask-conv-item-delete')) return false;
      if (node.classList?.contains('ask-toolbar-icon-btn')) return false;
      return true;
    },
  });
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export async function exportDomToPdf(element, title = 'Conversation') {
  if (!element) return;

  const PIXEL_RATIO = 2;
  const A4_W_MM = 210;
  const A4_H_MM = 297;
  const MARGIN_MM = 15;
  const CONTENT_W_MM = A4_W_MM - MARGIN_MM * 2;
  const CONTENT_H_MM = A4_H_MM - MARGIN_MM * 2;

  const captureW = Math.max(element.offsetWidth, element.scrollWidth);
  const captureH = Math.max(element.offsetHeight, element.scrollHeight);

  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: PIXEL_RATIO,
    width: captureW,
    height: captureH,
    style: { overflow: 'visible' },
    filter: (node) => {
      if (node.classList?.contains('ask-msg-delete-btn')) return false;
      if (node.classList?.contains('ask-streaming-cursor')) return false;
      if (node.classList?.contains('ask-toolbar-icon-btn')) return false;
      return true;
    },
  });

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const imgW = img.width;
  const imgH = img.height;

  const pdfImgW = CONTENT_W_MM;
  const scale = pdfImgW / imgW;
  const pageContentH_px = CONTENT_H_MM / scale;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 30);
  pdf.text(title, MARGIN_MM, MARGIN_MM + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(140, 140, 140);
  pdf.text(`Exported ${new Date().toLocaleString()}`, MARGIN_MM, MARGIN_MM + 11);
  pdf.setDrawColor(220, 220, 220);
  pdf.line(MARGIN_MM, MARGIN_MM + 14, A4_W_MM - MARGIN_MM, MARGIN_MM + 14);

  const headerOffset_mm = 18;
  const firstPageContentH_mm = CONTENT_H_MM - headerOffset_mm;
  const firstPageContentH_px = firstPageContentH_mm / scale;

  let srcY = 0;
  let pageNum = 0;

  while (srcY < imgH) {
    if (pageNum > 0) pdf.addPage();

    const sliceH_px = pageNum === 0
      ? Math.min(firstPageContentH_px, imgH - srcY)
      : Math.min(pageContentH_px, imgH - srcY);
    const roundedH = Math.ceil(sliceH_px);

    const canvas = document.createElement('canvas');
    canvas.width = imgW;
    canvas.height = roundedH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, srcY, imgW, roundedH, 0, 0, imgW, roundedH);

    const sliceData = canvas.toDataURL('image/png');
    const sliceH_mm = roundedH * scale;

    const yOffset = pageNum === 0 ? MARGIN_MM + headerOffset_mm : MARGIN_MM;
    pdf.addImage(sliceData, 'PNG', MARGIN_MM, yOffset, pdfImgW, sliceH_mm);

    srcY += roundedH;
    pageNum++;
  }

  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'conversation';
  pdf.save(`${safeName}.pdf`);
}

export function downloadCsv(data, columns, filename = 'data.csv') {
  const cols = columns || Object.keys(data[0] || {});
  const header = cols.join(',');
  const rows = data.map(row =>
    cols.map(c => {
      const v = row[c];
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','),
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
