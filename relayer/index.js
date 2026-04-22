import { Keypair, Networks, Contract, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { Server } from '@stellar/stellar-sdk/rpc';
import cron from 'node-cron';
import fs from 'fs';
import 'dotenv/config';

const server = new Server("https://soroban-testnet.stellar.org");
const networkPassphrase = Networks.TESTNET;

// Using a fallback for testing purposes 
const relayerSecret = process.env.RELAYER_SECRET || Keypair.random().secret();
const relayerKeypair = Keypair.fromSecret(relayerSecret);
const contractId = process.env.CONTRACT_ID || "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KB"; 

async function executeMandate() {
    console.log(`[${new Date().toISOString()}] Checking active mandates...`);
    
    // In a production system, the relayer fetches active mandates from a database
    // and checks if (currentTime - last_executed >= interval) locally before submitting.
    try {
        let proofData = "00000000000000000000"; // Dummy fallback if file doesn't exist
        try {
            proofData = Buffer.from(fs.readFileSync("../circuit/proof.json", "utf8")).toString('hex');
        } catch (_e) {
            console.log("No proof.json found. Using mock bytes.");
        }
        
        console.log("Preparing execution transaction...");

        // Fetch relayer account for sequence number
        let account;
        try {
            account = await server.getAccount(relayerKeypair.publicKey());
        } catch (_e) {
            console.error("Relayer account not found on Testnet. Please fund:", relayerKeypair.publicKey());
            return;
        }

        const contract = new Contract(contractId);
        
        // In this implementation, the execute function expects: 
        // execute(env, relayer, request_amount, proof_bytes)
        const _tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase })
            .addOperation(contract.call(
                "execute",
                // args
                xdr.ScVal.scvAddress(xdr.ScAddress.scAddressTypeAccount(relayerKeypair.xdrAccountId())), // relayer
                xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: 0, lo: 100 })), // request_amount = 100
                xdr.ScVal.scvBytes(Buffer.from(proofData, 'hex')) // proof_bytes
            ))
            .setTimeout(30)
            .build();
            
        // The relayer is the one simulating and signing the tx, paying the gas. 
        // The user is completely offline.
        
        // Simulation for resource usage
        // const preparedTx = await server.prepareTransaction(tx);
        // preparedTx.sign(relayerKeypair);

        // Submit
        // const response = await server.sendTransaction(preparedTx);
        console.log("Mock submission success. Funds would be transferred if fully deployed on testnet.");
    } catch (e) {
        console.error("Error executing mandate:", e.message);
    }
}

// Running every 1 minute for demonstration purposes
cron.schedule('* * * * *', () => {
    executeMandate();
});

console.log(`AutoPay Relayer Scheduler Started. Relayer Pubkey: ${relayerKeypair.publicKey()}`);
