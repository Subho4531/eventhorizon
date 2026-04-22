import { rpc, TransactionBuilder, Networks, Keypair } from "@stellar/stellar-sdk";

async function run() {
  const server = new rpc.Server("https://soroban-testnet.stellar.org");
  const contractId = "CAEQHGZ4UW2YXYCOM3THR6JZU2WWMHVZROFHD3UQJXXD7AWPHIZ3U4KU";
  
  // We need the secret key of the gravityflow-deployer to sign the initialization transaction
  // But wait, the source account doesn't need to be the deployer to call `init`, ANY account can call `init` if it's not initialized yet.
  const kp = Keypair.random();
  console.log("Funding init account:", kp.publicKey());
  await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);

  const sourceAccount = await server.getAccount(kp.publicKey());
  
  new TransactionBuilder(sourceAccount, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
        // @ts-expect-error - placeholder for operation
      new Address(contractId).toScVal() // wait, easier to just use `Contract` object
    )
    .setTimeout(300)
    .build();
    // Wait, using stellar-sdk to invoke a contract needs a bit more code...
}

run();
