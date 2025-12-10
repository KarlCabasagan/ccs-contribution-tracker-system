export default async function generateChartPDF(filter_params, chart_data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true
    });
    const oldTitle = document.title;

    document.title = "Generating List...";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Add Header
    const header = "./src/assets/docs/Header.png";
    doc.addImage(header, 'PNG', (pageWidth - 184) / 2, 5, 184, 28);

    // Add Footers
    const footer = "./src/assets/docs/Footer.png";
    doc.addImage(footer, 'PNG', (pageWidth - 184) / 2, pageHeight - 20, 184, 20);

    doc.setFontSize(18);
    doc.setFont("times", "normal");
    const title = "Data Summary";
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, 40); // Centered title

    const program_code = filter_params.programFilter;
    const year = filter_params.yearFilter;
    const month = filter_params.monthFilter;

    doc.setFontSize(14);
    const dataDescription = `Program Code: ${program_code} | Month: ${month} | Year: ${year}`;
    const dataDescriptionWidth = doc.getTextWidth(dataDescription);
    doc.text(dataDescription, (pageWidth - dataDescriptionWidth) / 2, 50); // Centered Description
    
    const year_levels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
    const pdata = chart_data.paid;
    const udata = chart_data.unpaid;

    const graphs = document.getElementsByClassName("graph-report");
    const imgWidth = 170; // Width in mm
    let positionY = 55; // Starting position for the first image

    for (let i = 0; i < graphs.length; i++) {
        // Convert each canvas to data URL
        const imgData = await html2canvas(graphs[i]).then(canvas => canvas.toDataURL('image/png'));
        const imgHeight = (350 * imgWidth) / 700;

        // Add image to PDF
        doc.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, positionY, imgWidth, imgHeight);
        
        // Update Y position for the next image
        positionY += imgHeight + 10;

        // Get paid and unpaid data for the current semester
        const pdataUse = i === 0 ? pdata.first : pdata.second;
        const udataUse = i === 0 ? udata.first : udata.second;

        let labelPosition = (pageWidth - imgWidth) / 2 + 10;
        for (let y = 0; y < year_levels.length; y++) {
            doc.setFontSize(8);
            doc.setTextColor(0, 0, 0);
            const label = year_levels[y] + ":";
            const labelWidth = doc.getTextWidth(label);
            doc.text(label, labelPosition, positionY);

            const paidData = pdataUse[y] + " Students";
            const pdataWidth = doc.getTextWidth(paidData);
            doc.setTextColor(0, 0, 255);
            doc.text(paidData, labelPosition + labelWidth + 5, positionY);

            const unpaidData = udataUse[y] + " Students";
            doc.setTextColor(255, 0, 0);
            doc.text(unpaidData, labelPosition + labelWidth + 5, positionY + 5);

            labelPosition += labelWidth + pdataWidth + 20;
        }

        positionY += 10; // Add extra space for labels
    }
    
    // Save PDF
    doc.save(`Data Summary Report (${program_code}).pdf`);
    document.title = "Generating List Done...";
    setTimeout(() => {
        document.title = oldTitle;
    }, 5000);
}