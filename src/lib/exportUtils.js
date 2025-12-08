import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  convertInchesToTwip,
  ImageRun,
} from "docx";
import { saveAs } from "file-saver";
import { getLogoBase64, getLogoDimensions } from "./logoUtils";

// Currency symbol - use P for compatibility
const PESO_SYMBOL = "P";

/**
 * Export data to various file formats
 */
export async function exportData(
  data,
  columns,
  filename,
  format,
  options = {}
) {
  const { title = filename, subtitle = "" } = options;

  switch (format.toLowerCase()) {
    case "xlsx":
      exportToExcel(data, columns, filename, { title, subtitle });
      break;
    case "csv":
      exportToCSV(data, columns, filename);
      break;
    case "pdf":
      await exportToPDF(data, columns, filename, { title, subtitle });
      break;
    case "docx":
      await exportToWord(data, columns, filename, { title, subtitle });
      break;
    default:
      console.error("Unsupported format:", format);
  }
}

/**
 * Export Collection Summary with visual layout matching the UI
 */
export async function exportCollectionSummary(
  metricsData,
  filename,
  format,
  options = {}
) {
  const { title = filename, subtitle = "", semesterName = "" } = options;

  switch (format.toLowerCase()) {
    case "xlsx":
      exportCollectionSummaryExcel(metricsData, filename, {
        title,
        subtitle,
        semesterName,
      });
      break;
    case "csv":
      exportCollectionSummaryCSV(metricsData, filename);
      break;
    case "pdf":
      exportCollectionSummaryPDF(metricsData, filename, {
        title,
        subtitle,
        semesterName,
      });
      break;
    case "docx":
      await exportCollectionSummaryWord(metricsData, filename, {
        title,
        subtitle,
        semesterName,
      });
      break;
    default:
      console.error("Unsupported format:", format);
  }
}

/**
 * Collection Summary - Excel Export
 */
function exportCollectionSummaryExcel(metrics, filename, options) {
  const { title, subtitle, semesterName } = options;
  const wb = XLSX.utils.book_new();

  const wsData = [
    [title || "Collection Summary Report"],
    [subtitle],
    ["Semester: " + semesterName],
    [],
    ["OVERVIEW METRICS"],
    ["Metric", "Value"],
    ["Total Enrolled", metrics.totalEnrolled.toLocaleString()],
    ["Total Collected", formatCurrencySafe(metrics.totalCollected)],
    [
      "Expected Collection (Goal)",
      formatCurrencySafe(metrics.expectedCollection),
    ],
    ["Collection Rate", `${metrics.collectionRate.toFixed(1)}%`],
    [],
    ["PAYMENT STATUS BREAKDOWN"],
    ["Status", "Count", "Percentage"],
    [
      "Fully Paid",
      metrics.paidCount.toLocaleString(),
      `${
        metrics.totalEnrolled > 0
          ? ((metrics.paidCount / metrics.totalEnrolled) * 100).toFixed(1)
          : 0
      }%`,
    ],
    [
      "Partial Payment",
      metrics.partialCount.toLocaleString(),
      `${
        metrics.totalEnrolled > 0
          ? ((metrics.partialCount / metrics.totalEnrolled) * 100).toFixed(1)
          : 0
      }%`,
    ],
    [
      "Unpaid",
      metrics.unpaidCount.toLocaleString(),
      `${
        metrics.totalEnrolled > 0
          ? ((metrics.unpaidCount / metrics.totalEnrolled) * 100).toFixed(1)
          : 0
      }%`,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 15 }];

  XLSX.utils.book_append_sheet(wb, ws, "Collection Summary");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Collection Summary - CSV Export
 */
function exportCollectionSummaryCSV(metrics, filename) {
  const rows = [
    "Collection Summary Report",
    "",
    "OVERVIEW METRICS",
    "Metric,Value",
    `Total Enrolled,${metrics.totalEnrolled}`,
    `Total Collected,${formatCurrencySafe(metrics.totalCollected)}`,
    `Expected Collection (Goal),${formatCurrencySafe(
      metrics.expectedCollection
    )}`,
    `Collection Rate,${metrics.collectionRate.toFixed(1)}%`,
    "",
    "PAYMENT STATUS BREAKDOWN",
    "Status,Count,Percentage",
    `Fully Paid,${metrics.paidCount},${
      metrics.totalEnrolled > 0
        ? ((metrics.paidCount / metrics.totalEnrolled) * 100).toFixed(1)
        : 0
    }%`,
    `Partial Payment,${metrics.partialCount},${
      metrics.totalEnrolled > 0
        ? ((metrics.partialCount / metrics.totalEnrolled) * 100).toFixed(1)
        : 0
    }%`,
    `Unpaid,${metrics.unpaidCount},${
      metrics.totalEnrolled > 0
        ? ((metrics.unpaidCount / metrics.totalEnrolled) * 100).toFixed(1)
        : 0
    }%`,
  ];

  const csv = rows.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `${filename}.csv`);
}

/**
 * Collection Summary - PDF Export (Visual Layout)
 */
function exportCollectionSummaryPDF(metrics, filename, options) {
  const { title, subtitle, semesterName } = options;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageWidth, 35, "F");
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Collection Summary Report", 14, 15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(semesterName || "Current Semester", 14, 24);
  doc.setFontSize(9);
  doc.text(
    subtitle || `Generated on ${new Date().toLocaleDateString()}`,
    14,
    30
  );

  // Branding
  doc.setFontSize(9);
  doc.text("CCS Contribution Tracker", pageWidth - 14, 15, { align: "right" });

  let yPos = 45;

  // Overview Metrics - 4 colored cards
  const cardWidth = 65;
  const cardHeight = 30;
  const cardSpacing = 5;
  const startX = 14;

  // Card 1: Enrolled (Blue)
  drawMetricCard(doc, startX, yPos, cardWidth, cardHeight, {
    label: "Enrolled",
    value: metrics.totalEnrolled.toLocaleString(),
    bgColor: [239, 246, 255], // blue-50
    textColor: [37, 99, 235], // blue-600
  });

  // Card 2: Collected (Green)
  drawMetricCard(
    doc,
    startX + cardWidth + cardSpacing,
    yPos,
    cardWidth,
    cardHeight,
    {
      label: "Collected",
      value: formatCurrencySafe(metrics.totalCollected),
      bgColor: [240, 253, 244], // green-50
      textColor: [22, 163, 74], // green-600
    }
  );

  // Card 3: Goal (Purple)
  drawMetricCard(
    doc,
    startX + (cardWidth + cardSpacing) * 2,
    yPos,
    cardWidth,
    cardHeight,
    {
      label: "Goal",
      value: formatCurrencySafe(metrics.expectedCollection),
      bgColor: [250, 245, 255], // purple-50
      textColor: [147, 51, 234], // purple-600
    }
  );

  // Card 4: Rate (Amber)
  drawMetricCard(
    doc,
    startX + (cardWidth + cardSpacing) * 3,
    yPos,
    cardWidth,
    cardHeight,
    {
      label: "Collection Rate",
      value: `${metrics.collectionRate.toFixed(1)}%`,
      bgColor: [255, 251, 235], // amber-50
      textColor: [217, 119, 6], // amber-600
    }
  );

  yPos += cardHeight + 15;

  // Payment Status Distribution Title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Payment Status Distribution", 14, yPos);
  yPos += 10;

  // Status Cards (3 cards side by side)
  const statusCardWidth = 90;
  const statusCardHeight = 35;

  // Fully Paid (Green)
  drawStatusCard(doc, startX, yPos, statusCardWidth, statusCardHeight, {
    label: "Fully Paid",
    count: metrics.paidCount,
    percentage:
      metrics.totalEnrolled > 0
        ? ((metrics.paidCount / metrics.totalEnrolled) * 100).toFixed(1)
        : "0",
    bgColor: [240, 253, 244],
    textColor: [22, 163, 74],
    iconColor: [34, 197, 94],
  });

  // Partial Payment (Yellow)
  drawStatusCard(
    doc,
    startX + statusCardWidth + cardSpacing,
    yPos,
    statusCardWidth,
    statusCardHeight,
    {
      label: "Partial Payment",
      count: metrics.partialCount,
      percentage:
        metrics.totalEnrolled > 0
          ? ((metrics.partialCount / metrics.totalEnrolled) * 100).toFixed(1)
          : "0",
      bgColor: [254, 252, 232],
      textColor: [202, 138, 4],
      iconColor: [234, 179, 8],
    }
  );

  // Unpaid (Red)
  drawStatusCard(
    doc,
    startX + (statusCardWidth + cardSpacing) * 2,
    yPos,
    statusCardWidth,
    statusCardHeight,
    {
      label: "Unpaid",
      count: metrics.unpaidCount,
      percentage:
        metrics.totalEnrolled > 0
          ? ((metrics.unpaidCount / metrics.totalEnrolled) * 100).toFixed(1)
          : "0",
      bgColor: [254, 242, 242],
      textColor: [220, 38, 38],
      iconColor: [239, 68, 68],
    }
  );

  yPos += statusCardHeight + 15;

  // Pie Chart Legend
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const legendY = yPos + 5;

  // Paid legend
  doc.setFillColor(34, 197, 94);
  doc.rect(14, legendY, 8, 8, "F");
  doc.setTextColor(51, 65, 85);
  doc.text("Paid", 25, legendY + 6);

  // Partial legend
  doc.setFillColor(234, 179, 8);
  doc.rect(50, legendY, 8, 8, "F");
  doc.text("Partial", 61, legendY + 6);

  // Unpaid legend
  doc.setFillColor(239, 68, 68);
  doc.rect(95, legendY, 8, 8, "F");
  doc.text("Unpaid", 106, legendY + 6);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    14,
    pageHeight - 10
  );
  doc.text("CCS Contribution Tracker", pageWidth - 14, pageHeight - 10, {
    align: "right",
  });

  doc.save(`${filename}.pdf`);
}

// Helper to draw metric card
function drawMetricCard(doc, x, y, width, height, params) {
  const { label, value, bgColor, textColor } = params;

  // Background
  doc.setFillColor(...bgColor);
  doc.roundedRect(x, y, width, height, 3, 3, "F");

  // Label
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  doc.text(label, x + 5, y + 10);

  // Value
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + 5, y + 22);
}

// Helper to draw status card
function drawStatusCard(doc, x, y, width, height, params) {
  const { label, count, percentage, bgColor, textColor, iconColor } = params;

  // Background
  doc.setFillColor(...bgColor);
  doc.roundedRect(x, y, width, height, 3, 3, "F");

  // Icon circle
  doc.setFillColor(...iconColor);
  doc.circle(x + 12, y + height / 2, 6, "F");

  // Label
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  doc.text(label, x + 22, y + 12);

  // Count
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(count.toLocaleString(), x + 22, y + 26);

  // Percentage
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${percentage}%`, x + width - 10, y + height / 2 + 3, {
    align: "right",
  });
}

/**
 * Collection Summary - Word Export (Visual Layout)
 */
async function exportCollectionSummaryWord(metrics, filename, options) {
  const { title, subtitle, semesterName } = options;

  const children = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Collection Summary Report",
          bold: true,
          size: 48,
          color: "6366F1",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  // Semester name
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: semesterName || "Current Semester",
          size: 24,
          color: "64748B",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  // Subtitle
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: subtitle || `Generated on ${new Date().toLocaleDateString()}`,
          size: 20,
          color: "94A3B8",
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Overview Metrics Table
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Overview Metrics",
          bold: true,
          size: 28,
          color: "1E293B",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Metrics table (2x2 grid style)
  const metricsTable = new Table({
    rows: [
      new TableRow({
        children: [
          createMetricCell(
            "Enrolled",
            metrics.totalEnrolled.toLocaleString(),
            "DBEAFE",
            "2563EB"
          ),
          createMetricCell(
            "Collected",
            formatCurrencySafe(metrics.totalCollected),
            "DCFCE7",
            "16A34A"
          ),
        ],
      }),
      new TableRow({
        children: [
          createMetricCell(
            "Goal",
            formatCurrencySafe(metrics.expectedCollection),
            "F3E8FF",
            "9333EA"
          ),
          createMetricCell(
            "Collection Rate",
            `${metrics.collectionRate.toFixed(1)}%`,
            "FEF3C7",
            "D97706"
          ),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  children.push(metricsTable);

  // Spacing
  children.push(new Paragraph({ text: "", spacing: { after: 400 } }));

  // Payment Status Breakdown
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Payment Status Breakdown",
          bold: true,
          size: 28,
          color: "1E293B",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Status table
  const paidPct =
    metrics.totalEnrolled > 0
      ? ((metrics.paidCount / metrics.totalEnrolled) * 100).toFixed(1)
      : "0";
  const partialPct =
    metrics.totalEnrolled > 0
      ? ((metrics.partialCount / metrics.totalEnrolled) * 100).toFixed(1)
      : "0";
  const unpaidPct =
    metrics.totalEnrolled > 0
      ? ((metrics.unpaidCount / metrics.totalEnrolled) * 100).toFixed(1)
      : "0";

  const statusTable = new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Status", bold: true, color: "FFFFFF" }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              color: "6366F1",
              fill: "6366F1",
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Count", bold: true, color: "FFFFFF" }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              color: "6366F1",
              fill: "6366F1",
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Percentage",
                    bold: true,
                    color: "FFFFFF",
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              color: "6366F1",
              fill: "6366F1",
            },
          }),
        ],
      }),
      createStatusRow(
        "Fully Paid",
        metrics.paidCount,
        paidPct,
        "DCFCE7",
        "16A34A"
      ),
      createStatusRow(
        "Partial Payment",
        metrics.partialCount,
        partialPct,
        "FEF9C3",
        "CA8A04"
      ),
      createStatusRow(
        "Unpaid",
        metrics.unpaidCount,
        unpaidPct,
        "FEE2E2",
        "DC2626"
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  children.push(statusTable);

  // Footer
  children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })} | CCS Contribution Tracker`,
          color: "94A3B8",
          size: 18,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

// Helper to create metric cell for Word
function createMetricCell(label, value, bgColor, textColor) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: label, size: 18, color: textColor })],
        spacing: { after: 50 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: value, bold: true, size: 32, color: textColor }),
        ],
      }),
    ],
    shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
    margins: {
      top: convertInchesToTwip(0.15),
      bottom: convertInchesToTwip(0.15),
      left: convertInchesToTwip(0.15),
      right: convertInchesToTwip(0.15),
    },
  });
}

// Helper to create status row for Word
function createStatusRow(status, count, percentage, bgColor, textColor) {
  return new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: status, bold: true, color: textColor }),
            ],
          }),
        ],
        shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: count.toLocaleString(), color: textColor }),
            ],
          }),
        ],
        shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `${percentage}%`, color: textColor }),
            ],
          }),
        ],
        shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
      }),
    ],
  });
}

/**
 * Export to Excel (.xlsx) with professional styling
 */
function exportToExcel(data, columns, filename, options) {
  const { title, subtitle } = options;
  const headers = columns.map((c) => c.label);
  const rows = data.map((row) =>
    columns.map((c) => {
      const value = getNestedValue(row, c.key);
      return value ?? "";
    })
  );

  const wb = XLSX.utils.book_new();
  const wsData = [];
  if (title) wsData.push([title]);
  if (subtitle) wsData.push([subtitle]);
  if (title || subtitle) wsData.push([]);
  wsData.push(headers);
  rows.forEach((r) => wsData.push(r));

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.label.length + 5, 15) }));

  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export to CSV
 */
function exportToCSV(data, columns, filename) {
  const headers = columns.map((c) => c.label).join(",");
  const rows = data
    .map((row) =>
      columns
        .map((c) => {
          const value = getNestedValue(row, c.key);
          const escaped = String(value ?? "").replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(",")
    )
    .join("\n");

  const csv = headers + "\n" + rows;
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `${filename}.csv`);
}

/**
 * Export to PDF with premium styling and logo
 */
async function exportToPDF(data, columns, filename, options) {
  const { title, subtitle } = options;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageWidth, 40, "F");

  // Try to add logo
  try {
    const logoBase64 = await getLogoBase64();
    if (logoBase64) {
      const logoDims = getLogoDimensions();
      doc.addImage(
        logoBase64,
        "PNG",
        pageWidth - 14 - logoDims.width,
        5,
        logoDims.width,
        logoDims.height
      );
    }
  } catch (e) {
    console.warn("Could not add logo to PDF:", e);
  }

  if (title) {
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(title, 14, 18);
  }

  if (subtitle) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 200, 255);
    doc.text(subtitle, 14, 28);
  }

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("CCS Contribution Tracker", pageWidth - 14, 32, { align: "right" });

  doc.setTextColor(0, 0, 0);

  const headers = columns.map((c) => c.label);
  const rows = data.map((row) =>
    columns.map((c) => String(getNestedValue(row, c.key) ?? ""))
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 48,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    bodyStyles: { textColor: [51, 65, 85] },
    margin: { left: 14, right: 14 },
    didDrawPage: function (data) {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      doc.text(
        `Generated on ${new Date().toLocaleDateString()}`,
        14,
        pageHeight - 10
      );
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        pageWidth - 14,
        pageHeight - 10,
        { align: "right" }
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Export to Word (.docx) with premium styling
 */
async function exportToWord(data, columns, filename, options) {
  const { title, subtitle } = options;
  const children = [];

  if (title) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: title, bold: true, size: 48, color: "6366F1" }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        border: {
          bottom: {
            color: "6366F1",
            space: 10,
            style: BorderStyle.SINGLE,
            size: 12,
          },
        },
      })
    );
  }

  if (subtitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: subtitle,
            color: "64748B",
            size: 22,
            italics: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map(
      (c) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: c.label,
                  bold: true,
                  color: "FFFFFF",
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { type: ShadingType.SOLID, color: "6366F1", fill: "6366F1" },
          margins: {
            top: convertInchesToTwip(0.05),
            bottom: convertInchesToTwip(0.05),
            left: convertInchesToTwip(0.08),
            right: convertInchesToTwip(0.08),
          },
        })
    ),
  });

  const dataRows = data.map(
    (row, index) =>
      new TableRow({
        children: columns.map(
          (c, colIndex) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(getNestedValue(row, c.key) ?? ""),
                      size: 18,
                      bold: colIndex === 0,
                      color: "334155",
                    }),
                  ],
                }),
              ],
              shading:
                index % 2 === 1
                  ? { type: ShadingType.SOLID, color: "F8FAFC", fill: "F8FAFC" }
                  : {},
              margins: {
                top: convertInchesToTwip(0.04),
                bottom: convertInchesToTwip(0.04),
                left: convertInchesToTwip(0.08),
                right: convertInchesToTwip(0.08),
              },
            })
        ),
      })
  );

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
    },
  });

  children.push(table);

  children.push(new Paragraph({ text: "", spacing: { before: 400 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString()} | CCS Contribution Tracker`,
          color: "94A3B8",
          size: 18,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

/**
 * Get nested object value by dot notation path
 */
function getNestedValue(obj, path) {
  if (!path) return obj;
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

/**
 * Format currency safely (uses P instead of peso symbol for compatibility)
 */
function formatCurrencySafe(amount) {
  return `${PESO_SYMBOL}${parseFloat(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format currency for exports (exported function)
 */
export function formatExportCurrency(amount) {
  return formatCurrencySafe(amount);
}
