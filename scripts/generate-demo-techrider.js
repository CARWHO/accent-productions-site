const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function generateDemoTechRider() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let y = height - 50;
  const leftMargin = 50;

  const drawText = (text, options = {}) => {
    page.drawText(text, {
      x: options.x || leftMargin,
      y,
      size: options.size || 11,
      font: options.bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= options.lineHeight || 16;
  };

  // Header
  drawText('THE BLUE NOTES', { size: 24, bold: true, lineHeight: 30 });
  drawText('Technical Rider - 2025', { size: 14, lineHeight: 25 });

  drawText('', { lineHeight: 10 });
  drawText('BAND LINEUP', { size: 14, bold: true, lineHeight: 20 });
  drawText('Lead Vocals / Acoustic Guitar - Sarah Mitchell');
  drawText('Electric Guitar / Backing Vocals - James Cooper');
  drawText('Bass Guitar - Mike Thompson');
  drawText('Drums - Dave Wilson');
  drawText('Keyboards / Synth - Emma Roberts');

  drawText('', { lineHeight: 15 });
  drawText('INPUT LIST', { size: 14, bold: true, lineHeight: 20 });
  drawText('CH 1: Kick Drum - Beta 52A or similar');
  drawText('CH 2: Snare Top - SM57');
  drawText('CH 3: Snare Bottom - SM57');
  drawText('CH 4: Hi-Hat - SM81 or similar condenser');
  drawText('CH 5: Rack Tom - e604 or SM57');
  drawText('CH 6: Floor Tom - e604 or SM57');
  drawText('CH 7-8: Overheads - Matched pair condensers');
  drawText('CH 9: Bass DI');
  drawText('CH 10: Bass Amp Mic - SM57 or e609');
  drawText('CH 11: Electric Guitar Amp - SM57');
  drawText('CH 12: Acoustic Guitar DI');
  drawText('CH 13: Keys L - DI');
  drawText('CH 14: Keys R - DI');
  drawText('CH 15: Lead Vocal - SM58 or Beta 58');
  drawText('CH 16: BV 1 (Guitar) - SM58');

  drawText('', { lineHeight: 15 });
  drawText('MONITOR REQUIREMENTS', { size: 14, bold: true, lineHeight: 20 });
  drawText('Mix 1: Lead Vocal wedge (downstage center)');
  drawText('Mix 2: Guitar wedge (stage right)');
  drawText('Mix 3: Bass wedge (stage left)');
  drawText('Mix 4: Keys wedge (stage left)');
  drawText('Mix 5: Drum fill (behind kit)');
  drawText('Mix 6: Sidefill (if available)');

  drawText('', { lineHeight: 15 });
  drawText('PREFERRED CONSOLE', { size: 14, bold: true, lineHeight: 20 });
  drawText('Yamaha CL series, Allen & Heath dLive, or similar digital console');
  drawText('32-channel digital stage box required');

  drawText('', { lineHeight: 15 });
  drawText('STAGE LAYOUT', { size: 14, bold: true, lineHeight: 20 });
  drawText('Drums center-back on riser');
  drawText('Keys stage left, Bass stage left of drums');
  drawText('Electric guitar stage right');
  drawText('Lead vocal downstage center, backing vocal stage right');

  drawText('', { lineHeight: 15 });
  drawText('POWER REQUIREMENTS', { size: 14, bold: true, lineHeight: 20 });
  drawText('- 4 x 10A/240V circuits on stage');
  drawText('- Separate circuit for backline (amps, keys)');
  drawText('- Clean power preferred (no fridges/air-con on same circuit)');

  drawText('', { lineHeight: 15 });
  drawText('ADDITIONAL REQUIREMENTS', { size: 14, bold: true, lineHeight: 20 });
  drawText('- Minimum 5 monitor mixes');
  drawText('- 2 x DI boxes for keys (stereo)');
  drawText('- 2 x DI boxes for bass and acoustic');
  drawText('- Drum riser preferred (minimum 2m x 2m)');

  drawText('', { lineHeight: 15 });
  drawText('CONTACT', { size: 14, bold: true, lineHeight: 20 });
  drawText('Band Manager: John Smith - 021 555 1234');
  drawText('Email: bluenotes@example.com');

  const pdfBytes = await pdfDoc.save();

  const outputPath = path.join(__dirname, '..', 'demo-techrider.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`Demo tech rider saved to: ${outputPath}`);
}

generateDemoTechRider().catch(console.error);
