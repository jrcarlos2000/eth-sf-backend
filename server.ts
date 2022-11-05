import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { storeToNFTStorage, storeToWeb3Storage } from "./ipfs";
import {
  buildReceiptTable,
  createPDF
} from "./pdfkit";
import {
  fetchAllTokenBalancesForAllAccounts,
  fetchAllTokenTransactionsForAllAccounts,
} from "./etherscan";
import bodyParser from "body-parser";
import morganBody from "morgan-body";
import { awaitAndFilter } from "./utils";
import { Contract, providers, utils, Wallet } from "ethers";
import { fetchTokenPriceBsc } from "./coingecko";
import { supportedTokens } from "./constants";
import { worldCoinABI, JomTxABI } from "./utils/abis";
import { addresses } from "./utils/addresses";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, packToSolidityProof } from "@semaphore-protocol/proof";
import  { ZkIdentity, Strategy } from  "@zk-kit/identity";

const cors = require("cors");

const corsOptions = {
  origin: "http://localhost:3000",
  optionsSuccessStatus: 200,
};
const winston = require("winston");
const consoleTransport = new winston.transports.Console();
dotenv.config();
const myWinstonOptions = {
  transports: [consoleTransport],
};
const logger = new winston.createLogger(myWinstonOptions);

const ethereumPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;

const serverProviders: any = {
  "0x2696efe5": new providers.JsonRpcProvider(process.env.SKALE_RPC_PROVIDER!),
};
const app: Express = express();
const port = process.env.PORT;
const tempGroup = new Group();
// parse JSON and others
app.use(cors(corsOptions));
app.use(express.json());
app.use(bodyParser.json());
// log all requests and responses
morganBody(app, { logAllReqHeader: true, maxBodyLength: 5000 });

app.post("/balances", async (req: Request, res: Response) => {
  let result = await fetchAllTokenBalancesForAllAccounts(req.body.accounts);
  res.send(result);
});

app.post("/transactions", async (req: Request, res: Response) => {
  let result = await fetchAllTokenTransactionsForAllAccounts(req.body.accounts);
  res.send(result);
});

app.get("/price", async (req: Request, res: Response) => {
  let result = await fetchTokenPriceBsc(req.query.tokenAddress as string);
  res.send(result);
});

app.get("/tokens", async (req: Request, res: Response) => {
  let result = {
    supportedTokens,
  };
  res.send(result);
});

app.get("/whatever", async (req: Request, res: Response) => {
  res.status(200).end();
});

//body.receiptData
//body.storeKey -- identity commitment
//body.storeName


app.post("/submit-receipt", async (req: Request, res: Response) => {

  const {receiptData, storeKey, country, chainId, buyerAddr} = req.body;

  const receiptTable = await buildReceiptTable(receiptData);
  const pdfFileName = "output.pdf";
  await createPDF([receiptTable] ,country, country, country, pdfFileName);

  //we can opt to store this to other data storage providers
  const cids = await awaitAndFilter([
    storeToWeb3Storage(pdfFileName),
  ]);

  res.send({
    "web3.storage cid:": cids[0],
  });
});

//verifies a certain store as if they did with the worldcoin orb
app.post("/verify-worldcoin-dev", async (req: Request, res: Response) => {
  const { storeKey , chainId} = req.body;
  const identity = new ZkIdentity(Strategy.MESSAGE, storeKey);
  try {
    console.log(addresses.MockWorldID[chainId]);
    let cMockWorldID = new Contract(
      addresses.MockWorldID[chainId],
      worldCoinABI,
      new Wallet(ethereumPrivateKey!, serverProviders[chainId])
    );
    const transaction = await cMockWorldID.addMember(
      1,
      identity.genIdentityCommitment()
    );
    await transaction.wait();
    res.status(200).end();
  } catch (error: any) {
    console.error(error);
    res.status(500).end();
  }
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
