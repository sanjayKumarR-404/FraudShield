import { buildEnrichedContext } from './dist/services/mock-data.service.js';
import { processTransaction } from './dist/services/transaction.service.js';
import { getOrCreateUser } from './dist/services/user.service.js';

async function testTxn(sender, receiver, amount) {
    console.log(`\nTesting: ${sender} to ${receiver} for ₹${amount}`);
    try {
        await getOrCreateUser(sender);
        const context = buildEnrichedContext(sender, receiver, amount, "Mumbai", new Date());
        const tx = await processTransaction({ senderVpa: sender, receiverVpa: receiver, amount, location: "Mumbai" }, context);
        console.log(`=> Status: ${tx.status}`);
    } catch(e) {
        console.error(e);
    }
}

async function run() {
    await testTxn("sanjaykumarr@okicici", "merchant@hdfc", 2500);
    await testTxn("rahul@ybl", "some_merchant@ybl", 150000);
    await testTxn("mule123@unknown", "cashout@fraud", 500000);
    process.exit(0);
}
run();
