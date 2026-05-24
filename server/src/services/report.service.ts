import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateBatchReportPdf(batchData: any, transactions: any[]): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const reportsDir = '/app/reports';
            
            try {
                if (!fs.existsSync(reportsDir)) {
                    fs.mkdirSync(reportsDir, { recursive: true });
                }
            } catch (dirErr) {
                console.error(`[ReportService] Failed to create directory ${reportsDir}:`, dirErr);
                return reject(dirErr);
            }

            const timestamp = Date.now();
            const fileName = `batch_report_${batchData.id}_${timestamp}.pdf`;
            const filePath = path.join(reportsDir, fileName);

            const writeStream = fs.createWriteStream(filePath);
            
            writeStream.on('finish', () => {
                if (fs.existsSync(filePath)) {
                    resolve(filePath);
                } else {
                    const err = new Error(`PDF file was not created at ${filePath}`);
                    console.error('[ReportService] Validation failed:', err);
                    reject(err);
                }
            });

            writeStream.on('error', (err) => {
                console.error('[ReportService] Error writing PDF file:', err);
                reject(err);
            });

            doc.pipe(writeStream);

    // Header
    doc.fontSize(24).fillColor('#1e293b').text('FraudShield', { align: 'left' });
    doc.fontSize(12).fillColor('#64748b').text('Batch Processing Report', { align: 'left' });
    doc.moveDown(2);

    // Summary Section
    doc.fontSize(16).fillColor('#0f172a').text('Summary Statistics');
    doc.moveDown(1);

    doc.fontSize(10).fillColor('#334155');
    doc.text(`Batch ID: ${batchData.id}`);
    doc.text(`File Name: ${batchData.fileName}`);
    doc.text(`Date Processed: ${new Date(batchData.completedAt || batchData.createdAt).toLocaleString()}`);
    doc.moveDown(1);

    const summary = batchData.reportData ? JSON.parse(batchData.reportData).summary : null;
    if (summary) {
        doc.text(`Total Transactions: ${summary.total}`);
        doc.text(`Frozen Count: ${summary.frozen} (${summary.frozenPercent.toFixed(1)}%)`);
        doc.text(`Allowed Count: ${summary.allowed} (${summary.allowedPercent.toFixed(1)}%)`);
    }

    doc.moveDown(2);

    // Transaction Table (Top 50)
    doc.fontSize(16).fillColor('#0f172a').text('Transaction Log (Sample)');
    doc.moveDown(1);

    const startY = doc.y;
    doc.fontSize(8).fillColor('#64748b');
    doc.text('RRN', 50, startY);
    doc.text('Amount', 150, startY);
    doc.text('Status', 220, startY);
    doc.text('Risk', 280, startY);
    doc.text('Sender -> Receiver', 330, startY);

    let currY = startY + 15;

    // Draw line
    doc.moveTo(50, currY).lineTo(550, currY).stroke('#e2e8f0');
    currY += 10;

    const txSample = transactions.slice(0, 40); // limit to fit on page
    txSample.forEach((tx: any) => {
        if (currY > 750) {
            doc.addPage();
            currY = 50;
        }

        doc.fillColor('#0f172a');
        doc.text(tx.rrn, 50, currY);
        doc.text(`Rs ${Number(tx.amount).toLocaleString('en-IN')}`, 150, currY);

        doc.fillColor(tx.status === 'FROZEN' ? '#ef4444' : '#10b981');
        doc.text(tx.status, 220, currY);

        doc.fillColor('#0f172a');
        doc.text(Number(tx.riskScore).toFixed(4), 280, currY);

        doc.fillColor('#64748b');
        doc.text(`${tx.senderVpa.split('@')[0]} -> ${tx.receiverVpa.split('@')[0]}`, 330, currY, { width: 220, ellipsis: true });

        currY += 15;
    });

    // Footer
    doc.fontSize(8).fillColor('#94a3b8').text(`Generated automatically by FraudShield Engine. Internal Confidential.`, 50, 780, { align: 'center' });

    doc.end();
        } catch (error) {
            console.error('[ReportService] PDF Generation failed:', error);
            reject(error);
        }
    });
}
