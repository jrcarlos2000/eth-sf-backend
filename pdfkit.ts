import PDFDocument from "pdfkit-table";
import fs from "fs";
import { fetchAllTokenBalancesForAllAccounts, fetchAllTokenTransactionsForAllAccounts } from "./etherscan"
import BigNumber from "bignumber.js";
import { fetchTokenPriceBsc } from "./coingecko"
import { awaitAndFilter } from "./utils"
import { symbolToAddress } from "./constants"

async function createPDF(
  tables: any[],
  storeName : String,
  country : String,
  storeID : String,
  buyerName : string,
  localFilePath: string = "output.pdf"
) {
  // Create a document
  const doc = new PDFDocument({
    bufferPages: true,
  });

  doc.fontSize(30);
  doc.font('Times-Roman')
   .text(`Receipt from - ${storeName} - ${country} / ${storeID}`, {
    lineGap: 20
   })
   .moveDown(0.5);
  
  doc.fontSize(20);
  doc.font('Times-Roman')
   .text(`Receipt for - ${buyerName}`, {
    lineGap: 20
   })
   .moveDown(0.5);

   doc.lineCap('butt')
   .moveTo(70, 100)
   .lineTo(400, 100)
   .stroke();

   doc.fontSize(8)

  //  doc.font('Times-Roman')
  //  .text(`${name}`, 70, 110, {
  //   lineGap: 10
  //  })

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

  parsed.push(["total", `1`, `${data.total}`])

  const table = { 
    title: 'Balances',
    headers: [
      { label: 'Item', property: 'token', width:100}, 
      { label: 'Qty', property: 'direction', width:80},
      { label: 'Price', property: 'amount', width:150}
    ],
    rows: parsed,
  };
  
  return table;
}

export { createPDF, buildReceiptTable };
