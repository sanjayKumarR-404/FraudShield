import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generateDisputePDF = async (recoveryCase: any, transaction: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            const pdfsDir = path.join(process.cwd(), 'generated-pdfs');
            if (!fs.existsSync(pdfsDir)) {
                fs.mkdirSync(pdfsDir, { recursive: true });
            }

            const timestamp = new Date().getTime();
            const filename = `dispute_RRN_${transaction.rrn}_${timestamp}.pdf`;
            const filePath = path.join(pdfsDir, filename);

            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Header
            doc.fontSize(24).font('Helvetica-Bold').text('FraudShield', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });
            doc.moveDown(2);

            // Section 1 
            doc.fontSize(16).font('Helvetica-Bold').text('1. Complainant Details');
            doc.fontSize(12).font('Helvetica').text(`Name: ${recoveryCase.complainantName}`);
            doc.text(`Email: ${recoveryCase.complainantEmail}`);
            doc.text(`UPI VPA: ${recoveryCase.complainantVpa}`);
            doc.moveDown(1.5);

            // Section 2
            doc.fontSize(16).font('Helvetica-Bold').text('2. Transaction Details');
            doc.fontSize(12).font('Helvetica').text(`RRN: ${transaction.rrn}`);
            doc.text(`Amount: INR ${Number(transaction.amount).toFixed(2)}`);
            doc.text(`Sender VPA: ${transaction.senderVpa}`);
            doc.text(`Receiver VPA: ${transaction.receiverVpa}`);
            doc.text(`Location: ${transaction.location || 'Unknown'}`);
            doc.text(`Timestamp: ${new Date(transaction.timestamp).toISOString()}`);
            doc.moveDown(1.5);

            // Section 3
            doc.fontSize(16).font('Helvetica-Bold').text('3. AI Risk Assessment');
            doc.fontSize(12).font('Helvetica').text(`Risk Score: ${transaction.riskScore || 'N/A'}`);
            doc.text(`Freeze Reason: ${transaction.reason || 'N/A'}`);
            doc.moveDown(1.5);

            // Section 4
            doc.fontSize(16).font('Helvetica-Bold').text('4. Legal Declaration');
            doc.fontSize(12).font('Helvetica-Oblique').text('"I hereby declare that the above transaction was not authorized by me and request immediate investigation under RBI Circular No. RBI/2017-18/15"', { align: 'justify' });
            doc.moveDown(1.5);

            // Section 5
            doc.fontSize(16).font('Helvetica-Bold').text('5. Recovery Timeline');
            doc.fontSize(12).font('Helvetica').text(`Case ID: ${recoveryCase.id}`);
            doc.text(`Status: ${recoveryCase.status}`);
            doc.text(`Initiated Date: ${new Date(recoveryCase.initiatedAt).toISOString()}`);
            doc.text(`Expiry Date: ${new Date(recoveryCase.expiresAt).toISOString()}`);
            doc.moveDown(3);

            // Footer
            doc.fontSize(10).font('Helvetica').text(`Case Reference Number: ${recoveryCase.id}`, { align: 'center' });

            doc.end();

            stream.on('finish', () => resolve(filePath));
            stream.on('error', (err) => reject(err));
        } catch (error) {
            reject(error);
        }
    });
};
