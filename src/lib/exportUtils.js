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

// Import header image for PDF exports
import headerImage from "../assets/docs/Header.png";

// Currency symbol - use P for compatibility
const PESO_SYMBOL = "P";

// Cache for header image base64
let headerImageBase64 = null;

/**
 * Convert image URL to base64 string
 */
async function imageToBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return null;
  }
}

/**
 * Get header image as base64 for PDF exports
 */
async function getHeaderImageBase64() {
  if (!headerImageBase64) {
    headerImageBase64 = await imageToBase64(headerImage);
  }
  return headerImageBase64;
}

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
 * Export Collection Summary with UI snapshots and grouped bar charts
 * For PDF and Word exports with header/footer on each page
 */
export async function exportVisualCollectionSummary(
  elementRef,
  metricsData,
  majorMetrics,
  filename,
  format,
  options = {}
) {
  const { semesterName = "" } = options;
  const oldTitle = document.title;
  document.title = "Generating Report...";

  try {
    // Dynamically import html2canvas
    const html2canvas = (await import("html2canvas")).default;

    // Capture the collection summary div as high-res image
    let summaryImageData = null;
    if (elementRef?.current) {
      try {
        // Clone the element to avoid modifying the original
        const clone = elementRef.current.cloneNode(true);
        clone.style.position = "absolute";
        clone.style.left = "-9999px";
        clone.style.top = "0";
        clone.style.width = elementRef.current.offsetWidth + "px";
        document.body.appendChild(clone);

        // Convert oklch colors to rgb fallbacks in the clone
        convertOklchToRgb(clone);

        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
        });
        summaryImageData = canvas.toDataURL("image/png");

        // Clean up clone
        document.body.removeChild(clone);
      } catch (captureError) {
        console.warn("Could not capture UI snapshot:", captureError.message);
        // Continue without the snapshot
      }
    }

    if (format === "pdf") {
      await exportVisualCollectionSummaryPDF(
        summaryImageData,
        metricsData,
        majorMetrics,
        filename,
        semesterName
      );
    } else if (format === "docx") {
      await exportVisualCollectionSummaryWord(
        summaryImageData,
        metricsData,
        majorMetrics,
        filename,
        semesterName
      );
    }
  } catch (error) {
    console.error("Error generating visual export:", error);
  } finally {
    document.title = oldTitle;
  }
}

/**
 * Convert oklch colors to rgb fallbacks in an element tree
 * html2canvas doesn't support oklch color function from Tailwind CSS v4
 */
function convertOklchToRgb(element) {
  const allElements = element.querySelectorAll("*");
  const elementsToProcess = [element, ...allElements];

  // Common oklch to hex mappings for Tailwind colors
  const oklchFallbacks = {
    // Blues
    "oklch(0.623 0.214 259.815)": "#3b82f6", // blue-500
    "oklch(0.546 0.245 262.881)": "#2563eb", // blue-600
    "oklch(0.488 0.243 264.376)": "#1d4ed8", // blue-700
    "oklch(0.970 0.014 254.604)": "#eff6ff", // blue-50
    "oklch(0.932 0.032 255.585)": "#dbeafe", // blue-100
    // Greens
    "oklch(0.723 0.191 142.542)": "#22c55e", // green-500
    "oklch(0.627 0.194 149.214)": "#16a34a", // green-600
    "oklch(0.527 0.154 150.069)": "#15803d", // green-700
    "oklch(0.982 0.018 155.826)": "#f0fdf4", // green-50
    // Yellows/Ambers
    "oklch(0.795 0.184 86.047)": "#eab308", // yellow-500
    "oklch(0.666 0.179 58.318)": "#d97706", // amber-600
    "oklch(0.993 0.017 95.178)": "#fefce8", // yellow-50
    // Reds
    "oklch(0.628 0.258 29.234)": "#ef4444", // red-500
    "oklch(0.577 0.245 27.325)": "#dc2626", // red-600
    "oklch(0.971 0.013 17.38)": "#fef2f2", // red-50
    // Purples
    "oklch(0.627 0.265 303.9)": "#a855f7", // purple-500
    "oklch(0.558 0.288 302.321)": "#9333ea", // purple-600
    "oklch(0.981 0.011 315.586)": "#faf5ff", // purple-50
    // Indigos
    "oklch(0.585 0.233 277.117)": "#6366f1", // indigo-500
    // Slates
    "oklch(0.446 0.043 257.281)": "#475569", // slate-600
    "oklch(0.554 0.046 257.417)": "#64748b", // slate-500
    "oklch(0.279 0.041 260.031)": "#1e293b", // slate-800
    "oklch(0.985 0.002 247.839)": "#f8fafc", // slate-50
    "oklch(0.968 0.007 247.896)": "#f1f5f9", // slate-100
  };

  elementsToProcess.forEach((el) => {
    if (!(el instanceof HTMLElement)) return;

    const computedStyle = window.getComputedStyle(el);
    const stylesToCheck = [
      "color",
      "backgroundColor",
      "borderColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ];

    stylesToCheck.forEach((prop) => {
      const value = computedStyle[prop];
      if (value && value.includes("oklch")) {
        // Try to find a fallback, or use a neutral color
        let fallback = oklchFallbacks[value];
        if (!fallback) {
          // Default fallbacks based on property
          if (prop === "backgroundColor") {
            fallback = "#ffffff";
          } else if (prop === "color") {
            fallback = "#1e293b";
          } else {
            fallback = "#e2e8f0";
          }
        }
        el.style[prop] = fallback;
      }
    });
  });
}

/**
 * Visual Collection Summary - PDF Export with snapshots and bar charts
 */
async function exportVisualCollectionSummaryPDF(
  summaryImageData,
  metrics,
  majorMetrics,
  filename,
  semesterName
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Load header image as base64
  const headerImageData = await getHeaderImageBase64();

  // Helper to add header only
  const addHeader = () => {
    if (headerImageData) {
      try {
        doc.addImage(headerImageData, "PNG", (pageWidth - 184) / 2, 5, 184, 28);
      } catch (e) {
        console.warn("Could not add header image:", e);
      }
    }
  };

  // ============================================
  // PAGE 1: Overall Summary (grouped by Major)
  // ============================================
  addHeader();

  let yPos = 40;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Collection Summary Report", pageWidth / 2, yPos, {
    align: "center",
  });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(semesterName || "Current Semester", pageWidth / 2, yPos, {
    align: "center",
  });
  yPos += 6;

  // Add captured UI snapshot if available
  if (summaryImageData) {
    const imgWidth = 180;
    const imgHeight = 80;
    doc.addImage(
      summaryImageData,
      "PNG",
      (pageWidth - imgWidth) / 2,
      yPos,
      imgWidth,
      imgHeight
    );
    yPos += imgHeight + 10;
  }

  // Overall Grouped Bar Chart (grouped by Major)
  yPos = drawImprovedBarChart(
    doc,
    majorMetrics.overallByMajor,
    yPos,
    pageWidth,
    "Overall Summary by Major",
    "major"
  );

  // Overall metrics summary
  yPos = drawMetricsSummary(
    doc,
    metrics,
    majorMetrics.contributionAmount,
    yPos,
    pageWidth
  );

  // Add status cards to fill unused space on first page
  yPos = drawStatusCards(doc, metrics, yPos, pageWidth);

  // ============================================
  // PER-MAJOR PAGES
  // ============================================
  majorMetrics.majors.forEach((major) => {
    doc.addPage();
    addHeader();

    let yPosMajor = 40;

    // Major Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(`Major: ${major}`, pageWidth / 2, yPosMajor, { align: "center" });
    yPosMajor += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(semesterName || "Current Semester", pageWidth / 2, yPosMajor, {
      align: "center",
    });
    yPosMajor += 12;

    // Major bar chart (by year level)
    const majorData = majorMetrics.perMajor[major];
    yPosMajor = drawImprovedBarChart(
      doc,
      majorData.yearLevelData,
      yPosMajor,
      pageWidth,
      `${major} - Year Level Breakdown`,
      "yearLevel"
    );

    // Major metrics summary
    yPosMajor = drawMetricsSummary(
      doc,
      {
        totalEnrolled: majorData.totalEnrolled,
        totalCollected: majorData.totalCollected,
        expectedCollection: majorData.expectedCollection,
        collectionRate: majorData.collectionRate,
        paidCount: majorData.paidCount,
        partialCount: majorData.partialCount,
        unpaidCount: majorData.unpaidCount,
      },
      majorMetrics.contributionAmount,
      yPosMajor,
      pageWidth
    );

    // Add status cards to fill space
    yPosMajor = drawStatusCards(doc, majorData, yPosMajor, pageWidth);
  });

  // Add footer with page numbers to all pages
  const pageCount = doc.internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Generated: ${generatedDate}  |  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  doc.save(`${filename}.pdf`);
}

/**
 * Draw an improved grouped bar chart on PDF with grid lines and value labels
 */
function drawImprovedBarChart(doc, data, startY, pageWidth, title, groupBy) {
  const chartWidth = 170;
  const chartHeight = 90;
  const chartX = (pageWidth - chartWidth) / 2;
  const margin = { left: 25, right: 10, top: 5, bottom: 20 };
  let yPos = startY;

  // Chart title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(title, pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  const chartAreaWidth = chartWidth - margin.left - margin.right;
  const chartAreaHeight = chartHeight - margin.top - margin.bottom;
  const chartAreaX = chartX + margin.left;
  const chartAreaY = yPos + margin.top;

  // Chart area background with border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(chartX, yPos, chartWidth, chartHeight, 4, 4, "FD");

  // Calculate max value for scale
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.paid || 0, d.partial || 0, d.unpaid || 0)),
    1
  );
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;

  // Draw horizontal grid lines and Y-axis labels
  const gridLines = 5;
  doc.setDrawColor(241, 245, 249);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  for (let i = 0; i <= gridLines; i++) {
    const y = chartAreaY + chartAreaHeight - (i / gridLines) * chartAreaHeight;
    const value = Math.round((i / gridLines) * niceMax);

    // Grid line
    doc.setLineWidth(0.2);
    doc.line(chartAreaX, y, chartAreaX + chartAreaWidth, y);

    // Y-axis label
    doc.text(value.toString(), chartAreaX - 3, y + 1, { align: "right" });
  }

  // Bar dimensions
  const numGroups = data.length;
  const groupWidth = chartAreaWidth / numGroups;
  const barWidth = Math.min(12, (groupWidth - 10) / 3);
  const barGap = 2;
  const barTotalWidth = barWidth * 3 + barGap * 2;

  // Draw vertical separator lines between groups
  doc.setDrawColor(226, 232, 240);
  for (let i = 1; i < numGroups; i++) {
    const x = chartAreaX + i * groupWidth;
    doc.setLineWidth(0.3);
    doc.line(x, chartAreaY, x, chartAreaY + chartAreaHeight);
  }

  // Draw bars for each group
  const barBaseY = chartAreaY + chartAreaHeight;
  data.forEach((item, index) => {
    const groupCenterX = chartAreaX + index * groupWidth + groupWidth / 2;
    const groupStartX = groupCenterX - barTotalWidth / 2;

    const values = [
      { value: item.paid || 0, color: [34, 197, 94] }, // Green
      { value: item.partial || 0, color: [234, 179, 8] }, // Yellow
      { value: item.unpaid || 0, color: [239, 68, 68] }, // Red
    ];

    values.forEach((bar, barIndex) => {
      const barHeight = (bar.value / niceMax) * chartAreaHeight;
      const barX = groupStartX + barIndex * (barWidth + barGap);

      if (barHeight > 0) {
        // Draw bar with slight rounded top
        doc.setFillColor(...bar.color);
        doc.roundedRect(
          barX,
          barBaseY - barHeight,
          barWidth,
          barHeight,
          1,
          1,
          "F"
        );

        // Value label on top of bar
        if (bar.value > 0) {
          doc.setFontSize(6);
          doc.setTextColor(51, 65, 85);
          doc.text(
            bar.value.toString(),
            barX + barWidth / 2,
            barBaseY - barHeight - 2,
            { align: "center" }
          );
        }
      }
    });

    // X-axis label
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const label = groupBy === "major" ? item.major : `Year ${item.yearLevel}`;
    doc.text(label, groupCenterX, barBaseY + 8, { align: "center" });
  });

  // Legend
  const legendY = yPos + chartHeight + 5;
  const legendStartX = chartX + chartWidth / 2 - 60;

  const legends = [
    { label: "Paid", color: [34, 197, 94] },
    { label: "Partial", color: [234, 179, 8] },
    { label: "Unpaid", color: [239, 68, 68] },
  ];

  legends.forEach((legend, i) => {
    const x = legendStartX + i * 45;
    doc.setFillColor(...legend.color);
    doc.roundedRect(x, legendY, 6, 4, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(legend.label, x + 9, legendY + 3);
  });

  return legendY + 12;
}

/**
 * Draw a metrics summary box below the chart
 */
function drawMetricsSummary(
  doc,
  metrics,
  contributionAmount,
  startY,
  pageWidth
) {
  const boxWidth = 180;
  const boxX = (pageWidth - boxWidth) / 2;
  let yPos = startY + 5;

  // Box background
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(boxX, yPos, boxWidth, 35, 3, 3, "FD");

  yPos += 8;
  const col1X = boxX + 10;
  const col2X = boxX + 65;
  const col3X = boxX + 125;

  // Format currency helper
  const formatPeso = (val) =>
    `P${(val || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Row 1
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  doc.text("Contribution/Student:", col1X, yPos);
  doc.text("Total Enrolled:", col2X, yPos);
  doc.text("Collection Rate:", col3X, yPos);

  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);

  doc.text(formatPeso(contributionAmount), col1X, yPos);
  doc.text(`${metrics.totalEnrolled || 0} students`, col2X, yPos);
  doc.text(`${(metrics.collectionRate || 0).toFixed(1)}%`, col3X, yPos);

  yPos += 8;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  doc.text("Expected Collection:", col1X, yPos);
  doc.text("Total Collected:", col2X, yPos);
  doc.text("Outstanding:", col3X, yPos);

  yPos += 5;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);

  doc.text(formatPeso(metrics.expectedCollection), col1X, yPos);
  doc.setTextColor(34, 197, 94);
  doc.text(formatPeso(metrics.totalCollected), col2X, yPos);
  doc.setTextColor(239, 68, 68);
  const outstanding =
    (metrics.expectedCollection || 0) - (metrics.totalCollected || 0);
  doc.text(formatPeso(outstanding), col3X, yPos);

  return startY + 45;
}

/**
 * Draw status cards to fill unused space on page
 */
function drawStatusCards(doc, metrics, startY, pageWidth) {
  let yPos = startY + 10;

  // Title
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Payment Status Breakdown", pageWidth / 2, yPos, {
    align: "center",
  });
  yPos += 10;

  const cardWidth = 55;
  const cardHeight = 35;
  const cardGap = 8;
  const totalWidth = cardWidth * 3 + cardGap * 2;
  const startX = (pageWidth - totalWidth) / 2;

  const cards = [
    {
      label: "Fully Paid",
      value: metrics.paidCount || 0,
      bgColor: [240, 253, 244],
      borderColor: [34, 197, 94],
      textColor: [22, 163, 74],
    },
    {
      label: "Partial Payment",
      value: metrics.partialCount || 0,
      bgColor: [254, 252, 232],
      borderColor: [234, 179, 8],
      textColor: [161, 98, 7],
    },
    {
      label: "Unpaid",
      value: metrics.unpaidCount || 0,
      bgColor: [254, 242, 242],
      borderColor: [239, 68, 68],
      textColor: [185, 28, 28],
    },
  ];

  cards.forEach((card, idx) => {
    const x = startX + idx * (cardWidth + cardGap);

    // Card background
    doc.setFillColor(...card.bgColor);
    doc.setDrawColor(...card.borderColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, yPos, cardWidth, cardHeight, 3, 3, "FD");

    // Label
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...card.textColor);
    doc.text(card.label, x + cardWidth / 2, yPos + 10, { align: "center" });

    // Value
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(card.value.toString(), x + cardWidth / 2, yPos + 25, {
      align: "center",
    });
  });

  return yPos + cardHeight + 10;
}

/**
 * Draw a metric card on PDF
 */
function drawPDFMetricCard(
  doc,
  x,
  y,
  width,
  height,
  label,
  value,
  bgColor,
  textColor
) {
  doc.setFillColor(...bgColor);
  doc.roundedRect(x, y, width, height, 2, 2, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  doc.text(label, x + width / 2, y + 8, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(value, x + width / 2, y + 18, { align: "center" });
}

/**
 * Generate a bar chart image using Canvas for Word export
 */
function generateBarChartImage(data, title, groupBy) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const width = 700;
  const height = 400;
  const margin = { left: 60, right: 30, top: 60, bottom: 60 };

  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText(title, width / 2, 35);

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Calculate max value
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.paid || 0, d.partial || 0, d.unpaid || 0)),
    1
  );
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;

  // Draw grid lines and Y-axis labels
  ctx.strokeStyle = "#F1F5F9";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#94A3B8";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";

  for (let i = 0; i <= 5; i++) {
    const y = margin.top + chartHeight - (i / 5) * chartHeight;
    const value = Math.round((i / 5) * niceMax);

    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(width - margin.right, y);
    ctx.stroke();

    ctx.fillText(value.toString(), margin.left - 10, y + 4);
  }

  // Bar dimensions
  const numGroups = data.length;
  const groupWidth = chartWidth / numGroups;
  const barWidth = Math.min(35, (groupWidth - 20) / 3);
  const barGap = 4;

  const colors = {
    paid: "#22C55E",
    partial: "#EAB308",
    unpaid: "#EF4444",
  };

  // Draw bars
  data.forEach((item, index) => {
    const groupCenterX = margin.left + index * groupWidth + groupWidth / 2;
    const barTotalWidth = barWidth * 3 + barGap * 2;
    const groupStartX = groupCenterX - barTotalWidth / 2;

    const values = [
      { key: "paid", value: item.paid || 0, color: colors.paid },
      { key: "partial", value: item.partial || 0, color: colors.partial },
      { key: "unpaid", value: item.unpaid || 0, color: colors.unpaid },
    ];

    values.forEach((bar, barIndex) => {
      const barHeight = (bar.value / niceMax) * chartHeight;
      const barX = groupStartX + barIndex * (barWidth + barGap);
      const barY = margin.top + chartHeight - barHeight;

      // Draw bar
      ctx.fillStyle = bar.color;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barWidth, barHeight, 3);
      ctx.fill();

      // Value label
      if (bar.value > 0) {
        ctx.fillStyle = "#334155";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(bar.value.toString(), barX + barWidth / 2, barY - 5);
      }
    });

    // X-axis label
    ctx.fillStyle = "#475569";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    const label =
      groupBy === "major" ? item.major || "" : `Year ${item.yearLevel}`;
    ctx.fillText(label, groupCenterX, height - margin.bottom + 20);

    // Vertical separator
    if (index > 0) {
      ctx.strokeStyle = "#E2E8F0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left + index * groupWidth, margin.top);
      ctx.lineTo(margin.left + index * groupWidth, margin.top + chartHeight);
      ctx.stroke();
    }
  });

  // Legend
  const legendY = height - 20;
  const legendItems = [
    { label: "Paid", color: colors.paid },
    { label: "Partial", color: colors.partial },
    { label: "Unpaid", color: colors.unpaid },
  ];

  const legendWidth = 180;
  const legendStartX = (width - legendWidth) / 2;

  legendItems.forEach((item, i) => {
    const x = legendStartX + i * 60;

    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(x, legendY - 4, 12, 8, 2);
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.font = "11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(item.label, x + 16, legendY + 2);
  });

  return canvas.toDataURL("image/png");
}

/**
 * Visual Collection Summary - Word Export
 */
async function exportVisualCollectionSummaryWord(
  summaryImageData,
  metrics,
  majorMetrics,
  filename,
  semesterName
) {
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
      spacing: { after: 200 },
    })
  );

  // Add captured image if available
  if (summaryImageData) {
    try {
      // Convert base64 to buffer
      const base64Data = summaryImageData.split(",")[1];
      const imageBuffer = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );

      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: {
                width: 600,
                height: 270,
              },
              type: "png",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );
    } catch (e) {
      console.error("Error adding image to Word doc:", e);
    }
  }

  // Generated date
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${generatedDate}`,
          size: 20,
          color: "94A3B8",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // Overall Bar Chart (rendered as image)
  try {
    const overallChartImage = generateBarChartImage(
      majorMetrics.overallByMajor,
      "Overall Summary by Major",
      "major"
    );
    const chartBase64 = overallChartImage.split(",")[1];
    const chartBuffer = Uint8Array.from(atob(chartBase64), (c) =>
      c.charCodeAt(0)
    );

    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: chartBuffer,
            transformation: { width: 560, height: 320 },
            type: "png",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
  } catch (e) {
    console.error("Error generating bar chart for Word:", e);
  }

  // Overall metrics table title - grouped by Major
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Payment Data by Major",
          bold: true,
          size: 24,
          color: "1E293B",
        }),
      ],
      spacing: { before: 100, after: 100 },
    })
  );

  // Major summary table (matching PDF's overallByMajor)
  const majorRows = [
    new TableRow({
      children: ["Major", "Paid", "Partial", "Unpaid", "Total"].map(
        (text) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true, color: "FFFFFF" })],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              color: "6366F1",
              fill: "6366F1",
            },
          })
      ),
    }),
    ...majorMetrics.overallByMajor.map(
      (data) =>
        new TableRow({
          children: [
            data.major,
            data.paid.toString(),
            data.partial.toString(),
            data.unpaid.toString(),
            data.total.toString(),
          ].map(
            (text, idx) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text,
                        color:
                          idx === 1
                            ? "16A34A"
                            : idx === 2
                            ? "CA8A04"
                            : idx === 3
                            ? "DC2626"
                            : "1E293B",
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
    ),
  ];

  children.push(
    new Table({
      rows: majorRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  // Overall Metrics Summary
  const formatPeso = (val) =>
    `P${(val || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  const outstanding =
    (metrics.expectedCollection || 0) - (metrics.totalCollected || 0);

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Financial Summary",
          bold: true,
          size: 24,
          color: "1E293B",
        }),
      ],
      spacing: { before: 300, after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Contribution/Student: `,
          color: "64748B",
          size: 20,
        }),
        new TextRun({
          text: formatPeso(majorMetrics.contributionAmount),
          bold: true,
          size: 20,
        }),
        new TextRun({
          text: "  |  Total Enrolled: ",
          color: "64748B",
          size: 20,
        }),
        new TextRun({
          text: `${metrics.totalEnrolled} students`,
          bold: true,
          size: 20,
        }),
        new TextRun({
          text: "  |  Collection Rate: ",
          color: "64748B",
          size: 20,
        }),
        new TextRun({
          text: `${(metrics.collectionRate || 0).toFixed(1)}%`,
          bold: true,
          size: 20,
        }),
      ],
      spacing: { after: 100 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `Expected: `, color: "64748B", size: 20 }),
        new TextRun({
          text: formatPeso(metrics.expectedCollection),
          bold: true,
          size: 20,
        }),
        new TextRun({ text: "  |  Collected: ", color: "64748B", size: 20 }),
        new TextRun({
          text: formatPeso(metrics.totalCollected),
          bold: true,
          size: 20,
          color: "16A34A",
        }),
        new TextRun({ text: "  |  Outstanding: ", color: "64748B", size: 20 }),
        new TextRun({
          text: formatPeso(outstanding),
          bold: true,
          size: 20,
          color: "DC2626",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Payment Status Breakdown (visual cards as table)
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Payment Status Breakdown",
          bold: true,
          size: 24,
          color: "1E293B",
        }),
      ],
      spacing: { before: 300, after: 150 },
    })
  );

  // Status cards as a styled table
  const statusCardsRow = new TableRow({
    children: [
      // Fully Paid
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Fully Paid", size: 18, color: "16A34A" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: (metrics.paidCount || 0).toString(),
                bold: true,
                size: 36,
                color: "16A34A",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: "F0FDF4", fill: "F0FDF4" },
        width: { size: 33, type: WidthType.PERCENTAGE },
      }),
      // Partial Payment
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Partial Payment",
                size: 18,
                color: "CA8A04",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: (metrics.partialCount || 0).toString(),
                bold: true,
                size: 36,
                color: "CA8A04",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: "FEFCE8", fill: "FEFCE8" },
        width: { size: 33, type: WidthType.PERCENTAGE },
      }),
      // Unpaid
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Unpaid", size: 18, color: "DC2626" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: (metrics.unpaidCount || 0).toString(),
                bold: true,
                size: 36,
                color: "DC2626",
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.SOLID, color: "FEF2F2", fill: "FEF2F2" },
        width: { size: 33, type: WidthType.PERCENTAGE },
      }),
    ],
  });

  children.push(
    new Table({
      rows: [statusCardsRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  // Per-major sections
  majorMetrics.majors.forEach((major) => {
    const majorData = majorMetrics.perMajor[major];

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Major: ${major}`,
            bold: true,
            size: 28,
            color: "1E293B",
          }),
        ],
        spacing: { before: 400, after: 200 },
        pageBreakBefore: true,
      })
    );

    // Major summary
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Enrolled: ${majorData.totalEnrolled} | Paid: ${majorData.paidCount} | Partial: ${majorData.partialCount} | Unpaid: ${majorData.unpaidCount}`,
            size: 22,
            color: "64748B",
          }),
        ],
        spacing: { after: 150 },
      })
    );

    // Major bar chart (by year level)
    try {
      const majorChartImage = generateBarChartImage(
        majorData.yearLevelData,
        `${major} - Year Level Breakdown`,
        "yearLevel"
      );
      const chartBase64 = majorChartImage.split(",")[1];
      const chartBuffer = Uint8Array.from(atob(chartBase64), (c) =>
        c.charCodeAt(0)
      );

      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: chartBuffer,
              transformation: { width: 500, height: 280 },
              type: "png",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 150 },
        })
      );
    } catch (e) {
      console.error("Error generating major bar chart for Word:", e);
    }

    // Year level data table title
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Year Level Data",
            bold: true,
            size: 22,
            color: "475569",
          }),
        ],
        spacing: { before: 50, after: 80 },
      })
    );

    // Major year level table
    const majorRows = [
      new TableRow({
        children: ["Year Level", "Paid", "Partial", "Unpaid", "Total"].map(
          (text) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text, bold: true, color: "FFFFFF" }),
                  ],
                }),
              ],
              shading: {
                type: ShadingType.SOLID,
                color: "6366F1",
                fill: "6366F1",
              },
            })
        ),
      }),
      ...majorData.yearLevelData.map(
        (data) =>
          new TableRow({
            children: [
              `Year ${data.yearLevel}`,
              data.paid.toString(),
              data.partial.toString(),
              data.unpaid.toString(),
              data.total.toString(),
            ].map(
              (text, idx) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text,
                          color:
                            idx === 1
                              ? "16A34A"
                              : idx === 2
                              ? "CA8A04"
                              : idx === 3
                              ? "DC2626"
                              : "1E293B",
                        }),
                      ],
                    }),
                  ],
                })
            ),
          })
      ),
    ];

    children.push(
      new Table({
        rows: majorRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  });

  // Footer
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
      spacing: { before: 400 },
    })
  );

  const wordDoc = new Document({
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

  const blob = await Packer.toBlob(wordDoc);
  saveAs(blob, `${filename}.docx`);
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
