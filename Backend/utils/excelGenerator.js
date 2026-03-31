const ExcelJS = require('exceljs');

class ExcelGenerator {
  async generateExcel(data, state) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`RERA Projects - ${state}`);

    // Define columns
    worksheet.columns = [
      { header: 'S.No', key: 'sno', width: 8 },
      { header: 'Project Name', key: 'projectName', width: 40 },
      { header: 'Promoter Name', key: 'promoterName', width: 35 },
      { header: 'Registration Number', key: 'registrationNumber', width: 25 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'URL', key: 'url', width: 50 },
      { header: 'Extracted At', key: 'extractedAt', width: 20 }
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    // Add data
    data.forEach((project, index) => {
      worksheet.addRow({
        sno: index + 1,
        projectName: project.projectName,
        promoterName: project.promoterName,
        registrationNumber: project.registrationNumber,
        district: project.district,
        status: project.status,
        url: project.url,
        extractedAt: project.extractedAt
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

module.exports = new ExcelGenerator();