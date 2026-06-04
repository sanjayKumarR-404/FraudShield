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

export const generateFIRDocument = async (recoveryCase: any, transaction: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            const pdfsDir = path.join(process.cwd(), 'generated-pdfs');
            if (!fs.existsSync(pdfsDir)) {
                fs.mkdirSync(pdfsDir, { recursive: true });
            }

            const timestamp = Date.now();
            const firRef = `FIR_2024_UPI_${transaction.rrn}_${timestamp}`;
            const filename = `fir_${transaction.rrn}_${timestamp}.pdf`;
            const filePath = path.join(pdfsDir, filename);

            const doc = new PDFDocument({ margin: 55, size: 'A4' });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            const drawLine = () => {
                doc.moveTo(55, doc.y).lineTo(540, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
                doc.moveDown(0.5);
            };

            const drawThickLine = () => {
                doc.moveTo(55, doc.y).lineTo(540, doc.y).strokeColor('#000000').lineWidth(1.5).stroke();
                doc.moveDown(0.5);
            };

            // ═══ TOP BORDER ═══
            drawThickLine();

            // GOI Header
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#000000')
                .text('FIRST INFORMATION REPORT (FIR)', { align: 'center' });
            doc.fontSize(11).font('Helvetica').fillColor('#333333')
                .text('Ministry of Home Affairs', { align: 'center' });
            doc.text('Government of India', { align: 'center' });
            doc.moveDown(0.4);

            drawThickLine();

            // FIR Reference
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            doc.text(`Report Number: ${firRef}`, { align: 'left' });
            doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'left' });
            doc.text(`Registration Date: ${recoveryCase.registeredAt ? new Date(recoveryCase.registeredAt).toLocaleDateString('en-IN') : '_______________________'}`, { align: 'left' });
            doc.moveDown(0.8);

            drawLine();

            // Complainant Details
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── COMPLAINANT DETAILS ──');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            doc.text(`Name: ${recoveryCase.complainantName}`);
            doc.text(`Email: ${recoveryCase.complainantEmail}`);
            doc.text(`Phone: ${recoveryCase.complainantPhone || 'N/A'}`);
            doc.text(`Bank Account: ${recoveryCase.bankName || 'N/A'} A/C ${recoveryCase.accountNumber || 'N/A'}`);
            doc.moveDown(0.8);

            drawLine();

            // Transaction Details
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── TRANSACTION DETAILS ──');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            doc.text(`Transaction ID (RRN): ${transaction.rrn}`);
            doc.text(`Amount: ₹${Number(transaction.amount).toLocaleString('en-IN')}`);
            doc.text(`Sender UPI: ${transaction.senderVpa}`);
            doc.text(`Receiver UPI: ${transaction.receiverVpa}`);
            doc.text(`Date & Time: ${new Date(transaction.timestamp).toLocaleString('en-IN')}`);
            doc.text('Status: UNAUTHORIZED / FRAUDULENT');
            doc.moveDown(0.8);

            drawLine();

            // Offense Details
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── OFFENSE DETAILS ──');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            doc.text('IPC Sections Violated:');
            doc.text('  • Section 420 — Cheating and dishonestly inducing delivery of property');
            doc.text('  • Section 379 — Theft');
            doc.text('  • Section 506 — Criminal intimidation');
            doc.text('  • Section 120B — Criminal conspiracy');
            doc.text('Offense Type: UPI Fraud / Account Takeover');
            doc.moveDown(0.8);

            drawLine();

            // Incident Description
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── DESCRIPTION OF INCIDENT ──');
            doc.moveDown(0.3);
            const desc = `The complainant reported an unauthorized transaction of ₹${Number(transaction.amount).toLocaleString('en-IN')} from their ${recoveryCase.bankName || 'bank'} account ${recoveryCase.accountNumber || ''} via UPI on ${new Date(transaction.timestamp).toLocaleDateString('en-IN')} at ${new Date(transaction.timestamp).toLocaleTimeString('en-IN')}. The transaction was flagged as fraudulent by FraudShield AI detection system (confidence: ${transaction.riskScore ? (transaction.riskScore * 100).toFixed(1) : 'N/A'}%). The transaction was made without consent and involves potential cyber fraud.`;
            doc.fontSize(9).font('Helvetica').fillColor('#333333').text(desc, { align: 'justify' });
            doc.moveDown(0.8);

            drawLine();

            // Evidence
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── EVIDENCE ATTACHED ──');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            const ss = recoveryCase.screenshotsCount || 0;
            const bs = recoveryCase.bankStatementsCount || 0;
            const ch = recoveryCase.chatHistoriesCount || 0;
            doc.text(`- Transaction screenshot: ${ss > 0 ? `✓ (${ss} file${ss > 1 ? 's' : ''})` : '✗'}`);
            doc.text(`- Bank statement: ${bs > 0 ? `✓ (${bs} file${bs > 1 ? 's' : ''})` : '✗'}`);
            doc.text(`- Communication records: ${ch > 0 ? `✓ (${ch} file${ch > 1 ? 's' : ''})` : '✗'}`);
            doc.text('- FraudShield forensic report: ✓');
            doc.moveDown(0.8);

            drawLine();

            // Officer Details
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── POLICE OFFICER DETAILS (To be filled after registration) ──');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            doc.text(`Officer Name: ${recoveryCase.policeStationName ? '____________________' : '____________________'}`);
            doc.text('Badge Number: ____________________');
            doc.text(`Police Station: ${recoveryCase.policeStationName || '____________________'}`);
            doc.text(`Registration Date: ${recoveryCase.registeredAt ? new Date(recoveryCase.registeredAt).toLocaleDateString('en-IN') : '____________________'}`);
            doc.text(`FIR Number: ${recoveryCase.firNumber || '____________________'}`);
            doc.moveDown(0.8);

            drawLine();

            // Complainant Signature
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('── COMPLAINANT SIGNATURE ──');
            doc.moveDown(0.3);
            doc.fontSize(9).font('Helvetica').fillColor('#333333');
            doc.text('Signature: ____________________');
            doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
            doc.moveDown(0.8);

            drawThickLine();

            // Footer
            doc.fontSize(7.5).font('Helvetica').fillColor('#555555')
                .text('This FIR has been electronically generated by FraudShield and follows the NCRP (National Crime Records Bureau) 2023 format.', { align: 'center' });
            doc.text(`Case Reference: ${recoveryCase.id}`, { align: 'center' });

            drawThickLine();

            doc.end();
            stream.on('finish', () => resolve(filePath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
};
