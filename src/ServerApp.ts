import { Database, Err, IModelCollection } from "@vesta/core";
import { MySQL } from "@vesta/driver-mysql";
import { AclPolicy, LogLevel } from "@vesta/services";
import { json, urlencoded } from "body-parser";
import * as cors from "cors";
import * as express from "express";
import { readdirSync } from "fs";
import * as helmet from "helmet";
import { createServer, Server } from "http";
import { ApiFactory } from "./api/ApiFactory";
import { IExtRequest } from "./api/BaseController";
import { IAppConfig } from "./config";
import { Acl } from "./helpers/Acl";
import { DatabaseFactory } from "./helpers/DatabaseFactory";
import { LogFactory } from "./helpers/LogFactory";
import { jwtMiddleware } from "./middlewares/jwt";
import { loggerMiddleware } from "./middlewares/logger";

export class ServerApp {
    private app: express.Express;
    private server: Server;
    // private sessionDatabase: KeyValueDatabase;
    private database: Database;
    private acl: Acl;

    constructor(private config: IAppConfig) {
        this.app = express();
        this.server = createServer(this.app);
        // tslint:disable-next-line:no-console
        this.server.on("error", err => console.error(err));
        this.acl = new Acl(config, AclPolicy.Deny);
        if (!LogFactory.init(this.config.log)) {
            process.exit(1);
        }
    }

    public async init(): Promise<void> {
        this.configExpressServer();
        // await Session.init(this.config.session);
        await this.initDatabase();
        await this.initRouting();
        this.initErrorHandlers();
        await this.acl.initAcl();
    }

    public start() {
        return new Promise((resolve, reject) => {
            this.server
                .listen(this.config.port)
                .on("listening", arg => resolve(arg))
                .on("error", err => resolve(err));
        });
    }

    private configExpressServer() {
        this.app.use(helmet({ noCache: true, referrerPolicy: true }));
        // todo CHANGE origin in production mode based on your requirement
        this.app.use(
            cors({
                allowedHeaders: ["X-Requested-With", "Content-Type", "Content-Length", "X-Auth-Token", "From"],
                exposedHeaders: ["Content-Type", "Content-Length", "X-Auth-Token"],
                methods: ["GET", "POST", "PUT", "DELETE"],
                origin: [/https?:\/\/*:*/],
            })
        );
        this.app.use(urlencoded({ limit: "50mb", extended: false }));
        this.app.use(json({ limit: "50mb" }));
        // todo closing connection after sending response ???
        this.app.use((req: IExtRequest, res: express.Response, next: express.NextFunction) => {
            res.set("Connection", "Close");
            next();
        });
        this.app.enable("trust proxy");
        this.app.disable("case sensitive routing");
        this.app.disable("strict routing");
        this.app.disable("x-powered-by");
        this.app.disable("etag");
    }

    private async initRouting(): Promise<any> {
        if (this.config.env === "development") {
            this.app.use("/upl", express.static(this.config.dir.upload));
        }
        // removing wrapper around query to preserve data type
        this.app.use((req: IExtRequest, res, next) => {
            if (req.query && req.query.wrapper) {
                try {
                    req.query = JSON.parse(req.query.wrapper);
                } catch {}
            }
            next();
        });
        // jwt middleware
        this.app.use(jwtMiddleware);

        // logger must be set after session
        this.app.use(loggerMiddleware);
        const routing = await ApiFactory.create(this.config, this.acl, this.database);
        return this.app.use("/", routing);
    }

    private initErrorHandlers() {
        // 404 Not Found
        this.app.use((req: IExtRequest, res: express.Response, next: express.NextFunction) => {
            this.handleError(req, res, new Err(Err.Code.NotFound, `Not Found: ${req.url}`));
        });
        // 50x Internal Server Error
        this.app.use((err: any, req: IExtRequest, res: express.Response, next: express.NextFunction) => {
            this.handleError(req, res, err);
        });
        //
        process.on("unhandledRejection", reason => {
            // tslint:disable-next-line:no-console
            console.error("Unhandled Rejection:", reason);
        });
    }

    private async initDatabase(): Promise<any> {
        const modelsDirectory = `${__dirname}/cmn/models`;
        const modelFiles = readdirSync(modelsDirectory);
        const models: IModelCollection = {};
        // creating models list
        for (let i = modelFiles.length; i--; ) {
            if (modelFiles[i].endsWith(".js")) {
                const modelName = modelFiles[i].slice(0, -3);
                const model = require(`${modelsDirectory}/${modelFiles[i]}`);
                models[model[modelName].schema.name] = model[modelName];
            }
        }
        // registering database drivers
        DatabaseFactory.register("appDatabase", this.config.database, MySQL, models);
        // getting application database instance
        const db = await DatabaseFactory.getInstance("appDatabase");
        if (this.config.regenerateSchema) {
            await db.init();
        }
    }

    /**
     * This method handles the error generated inside any controller.
     * It will also removes actual error messages in production mode.
     */
    private handleError(req: IExtRequest, res: express.Response, error: Err | string) {
        if ("string" === typeof error) {
            error = new Err(Err.Code.Server, error);
        }
        if (req.log) {
            req.log(LogLevel.Error, error.message, error.method || "handleError", error.file || "ServerApp");
        } else {
            // tslint:disable-next-line:no-console
            console.error(error);
        }
        if (this.config.env === "production") {
            delete error.method;
            delete error.file;
            if ((error as any).sqlMessage) {
                // sql error
                error.code = Err.Code.Database.code;
                delete error.message;
            }
        }
        if (error instanceof Error) {
            error = new Err({ code: error.code, errno: error.errno }, error.message);
        }
        error.code = error.code || Err.Code.Server.code;
        res.status(error.errno);
        res.json({ error });
    }
}
