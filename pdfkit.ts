import PDFDocument from "pdfkit-table";
import fs from "fs";

async function createPDF(
  tables: any[],
  storeName : String,
  country : String,
  storeID : String,
  buyerName : String,
  localFilePath: string = "output.pdf"
) {
  // Create a document
  const doc = new PDFDocument({
    bufferPages: true,
  });

  doc.fontSize(10);
  doc.font('Times-Roman')
   .text(`Receipt from - ${storeName} - ${country} / JomTx-${storeID}XYZ`, {
    lineGap: 10,
    align: 'right'
   })
   .moveDown(0.5);
  
  doc.fontSize(20);
  doc.font('Times-Roman')
   .text(`Receipt for - ${buyerName || "Unidentified customer"}`, {
    lineGap: 20,
    width : 300,
    align : 'center'
   })
   .moveDown(0.5);

   doc.lineCap('butt')
   .moveTo(175, 90)
   .lineTo(575, 90)
   .stroke();

   doc.fontSize(8)

   doc.fontSize(14);

  const stream = fs.createWriteStream(localFilePath);
  doc.pipe(stream);

  for (let table of tables) {
    // @ts-ignore
    await doc.table(table);
  }

  //Global Edits to All Pages (Header/Footer, etc)
  let pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    //Footer: Add page number
    let oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; //Dumb: Have to remove bottom margin in order to write into it
    doc.text(
      `Page: ${i + 1} of ${pages.count}`,
      0,
      doc.page.height - oldBottomMargin / 2, // Centered vertically in bottom margin
      { align: "center" }
    );
    doc.page.margins.bottom = oldBottomMargin; // ReProtect bottom margin

  }

  doc.end();

  await new Promise<void>((resolve) => {
    stream.on("finish", function () {
      resolve();
    });
  });
}

// data.buyer
// data.currency , i.e MYR
// data.country, i.e Malaysia
// data.total
// data.items = [] --> has a detail, qty and price
// data.store

async function buildReceiptTable(data : any) {

  let parsed: any[][] = [];

  for(let i=0; i<data.items.length ; i++){
    parsed.push([data.items[i].detail, `${data.items[i].qty}`, `${data.items[i].price} ${data.currency}`])
  }

  parsed.push(["total", `1`, `${data.total} ${data.currency}`])

  const table = { 
    title: 'Receipt',
    headers: [
      { label: 'Item', property: 'token', width:100}, 
      { label: 'Qty', property: 'direction', width:80},
      { label: 'Price', property: 'amount', width:150}
    ],
    rows: parsed,
  };
  
  return table;
}

async function buildTaxDeclaration(txlist : any) {
  let parsed: any[][] = [];

  for(let i=0; i<txlist.length ; i++){
    const temp = txlist[i].detail.split("_");
    parsed.push([temp[0],temp[1] || "NaN",temp[2] || "ETH", "OK"])
  }
  // parsed.push(["total", `1`, `${data.total} ${data.currency}`])

  const table = { 
    title: 'List of Transactions in November 2022',
    headers: [
      { label: 'detail', property: 'detail', width:100},
      { label: 'amount', property: 'amount', width:100},
      { label: 'currency', property: 'curreny', width:70},
      { label: 'status', property: 'status', width:70},
    ],
    rows: parsed,
  };
  
  return table;
}

async function createTaxPDF(
  tables: any[],
  userAddr : String,
  userName : String,
  country : String,
  userSignal : any,
  localFilePath: string = "output.pdf"
){
  // Create a document
  const doc = new PDFDocument({
    bufferPages: true,
  });

  doc.fontSize(10);
  doc.font('Times-Roman')
   .text(`Tax Declaration for - ${userName} - ${country} / JomTx-${userSignal}XYZ`, {
    lineGap: 10,
    align: 'right'
   })
   .moveDown(0.5);

   doc.lineCap('butt')
   .moveTo(175, 90)
   .lineTo(575, 90)
   .stroke();

   doc.fontSize(8)

   doc.fontSize(14);

  const stream = fs.createWriteStream(localFilePath);
  doc.pipe(stream);

  for (let table of tables) {
    // @ts-ignore
    await doc.table(table);
  }

  //Global Edits to All Pages (Header/Footer, etc)
  let pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    //Footer: Add page number
    let oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; //Dumb: Have to remove bottom margin in order to write into it
    doc.text(
      `Page: ${i + 1} of ${pages.count}`,
      0,
      doc.page.height - oldBottomMargin / 2, // Centered vertically in bottom margin
      { align: "center" }
    );
    doc.page.margins.bottom = oldBottomMargin; // ReProtect bottom margin

  }
  doc.end();

  await new Promise<void>((resolve) => {
    stream.on("finish", function () {
      resolve();
    });
  });
}

export { createPDF, buildReceiptTable, buildTaxDeclaration, createTaxPDF };
