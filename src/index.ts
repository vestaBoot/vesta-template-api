#!/usr/bin/env node
import { Culture } from "@vesta/culture";
import { IrDate, IrLocale } from "@vesta/culture-ir";
import { UsDate, UsLocale } from "@vesta/culture-us";
import { IrVocabs } from "./cmn/vocabs/IrVocabs";
import { UsVocabs } from "./cmn/vocabs/UsVocabs";
import config from "./config";
import { ServerApp } from "./ServerApp";

Culture.register(UsLocale, UsVocabs, UsDate);
Culture.register(IrLocale, IrVocabs, IrDate);

// initiating server
const MAX_TRY_COUNT = 3;
const TRY_INTERVAL = 5000;
let tryCounter = 1;

(async function run() {
    try {
        const server = new ServerApp(config);
        await server.init();
        await server.start();
        // tslint:disable-next-line:no-console
        console.log(`Server booted at ${new Date().toString()}`);
    } catch (err) {
        ++tryCounter;
        // tslint:disable-next-line:no-console
        console.error("Server initiation error: ", err);
        if (tryCounter <= MAX_TRY_COUNT) {
            // increasing the interval in case of repetitive errors
            const nextTryInterval = TRY_INTERVAL * tryCounter;
            // tslint:disable-next-line:no-console
            console.warn(`A retry effort will occurred in ${nextTryInterval / 1000}s`);
            setTimeout(async () => {
                // tslint:disable-next-line:no-console
                console.warn(`Restarting server initiation process [try #${tryCounter}]...`);
                await run();
            }, nextTryInterval);
        } else {
            // tslint:disable-next-line:no-console
            console.error("MAX_TRY_COUNT reached; exiting server...");
            process.exit(1);
        }
    }
})();
